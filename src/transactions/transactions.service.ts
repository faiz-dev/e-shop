import { Injectable, HttpStatus, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Transaction, TransactionStatus } from './entities/transaction.entity';
import { TransactionItem } from './entities/transaction-item.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { CouponsService } from '../coupons/coupons.service';
import { MidtransService } from '../midtrans/midtrans.service';
import { CreateTransactionDto } from './dto';
import { AppException, ErrorCodes } from '../common';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionItem)
    private readonly transactionItemRepository: Repository<TransactionItem>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    private readonly couponsService: CouponsService,
    @Inject(forwardRef(() => MidtransService))
    private readonly midtransService: MidtransService,
    private readonly dataSource: DataSource,
  ) { }

  async checkout(
    userId: string,
    userEmail: string,
    userName: string,
    dto: CreateTransactionDto,
  ) {
    // Use a database transaction for atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Get cart items
      const cartItems = await this.cartItemRepository.find({
        where: { userId },
        relations: ['variant', 'variant.product'],
      });

      if (cartItems.length === 0) {
        throw new AppException(
          ErrorCodes.CART_EMPTY,
          'Cart is empty',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 2. Validate stock & calculate subtotal
      let subtotal = 0;
      const itemsForMidtrans: Array<{
        id: string;
        name: string;
        price: number;
        quantity: number;
      }> = [];

      for (const cartItem of cartItems) {
        const variant = await queryRunner.manager.findOne(ProductVariant, {
          where: { id: cartItem.variantId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!variant || variant.stock < cartItem.quantity) {
          throw new AppException(
            ErrorCodes.INSUFFICIENT_STOCK,
            `Insufficient stock for variant "${cartItem.variant.name}"`,
            HttpStatus.BAD_REQUEST,
          );
        }

        const price = Number(variant.price);
        subtotal += price * cartItem.quantity;

        itemsForMidtrans.push({
          id: variant.id,
          name: `${cartItem.variant.product.name} - ${variant.name}`,
          price: Math.round(price),
          quantity: cartItem.quantity,
        });

        // Decrease stock
        variant.stock -= cartItem.quantity;
        await queryRunner.manager.save(variant);
      }

      // 3. Apply coupon
      let discount = 0;
      let couponId: string | undefined = undefined;

      if (dto.couponCode) {
        const coupon = await this.couponsService.validateCoupon(
          dto.couponCode,
          subtotal,
        );
        discount = this.couponsService.calculateDiscount(coupon, subtotal);
        couponId = coupon.id;
      }

      const total = Math.round(subtotal - discount);
      const midtransOrderId = `TXN-${uuidv4()}`;

      // 4. Create Midtrans Snap transaction
      let snapToken = '';
      let snapRedirectUrl = '';

      // Add discount as negative item if present
      const midtransItems = [...itemsForMidtrans];
      if (discount > 0) {
        midtransItems.push({
          id: 'DISCOUNT',
          name: `Coupon: ${dto.couponCode}`,
          price: -Math.round(discount),
          quantity: 1,
        });
      }

      try {
        const snapResponse = await this.midtransService.createTransaction({
          orderId: midtransOrderId,
          grossAmount: total,
          items: midtransItems,
          customer: {
            firstName: userName,
            email: userEmail,
          },
        });
        snapToken = snapResponse.token;
        snapRedirectUrl = snapResponse.redirect_url;
      } catch (error) {
        this.logger.error(`Midtrans error: ${JSON.stringify(error)}`);
        throw new AppException(
          ErrorCodes.MIDTRANS_ERROR,
          'Failed to create payment',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // 5. Create transaction record
      const transaction = queryRunner.manager.create(Transaction, {
        midtransOrderId,
        userId,
        couponId,
        subtotal,
        discount,
        total,
        snapToken,
        snapRedirectUrl,
        status: TransactionStatus.WAITING_PAYMENT,
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      // 6. Create transaction items (snapshots)
      const transactionItems = cartItems.map((cartItem) =>
        queryRunner.manager.create(TransactionItem, {
          transactionId: savedTransaction.id,
          variantId: cartItem.variantId,
          productName: cartItem.variant.product.name,
          variantName: cartItem.variant.name,
          price: Number(cartItem.variant.price),
          quantity: cartItem.quantity,
        }),
      );

      await queryRunner.manager.save(transactionItems);

      // 7. Clear cart
      await queryRunner.manager.delete(CartItem, { userId });

      // 8. Increment coupon usage
      if (couponId) {
        await this.couponsService.incrementUsage(couponId);
      }

      await queryRunner.commitTransaction();

      // Auto-confirm payment in mock mode
      if (this.midtransService.isMockMode) {
        await this.handlePaymentNotification(
          midtransOrderId,
          TransactionStatus.PROCESSED,
          'mock_payment',
        );
        savedTransaction.status = TransactionStatus.PROCESSED;
        this.logger.log(`[MOCK] Auto-confirmed payment for order: ${midtransOrderId}`);
      }

      return {
        id: savedTransaction.id,
        midtransOrderId,
        total,
        status: savedTransaction.status,
        snapToken,
        snapRedirectUrl,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllByUser(userId: string) {
    return this.transactionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['items'],
    });
  }

  async findOne(id: string, userId?: string) {
    const where: Record<string, unknown> = { id };
    if (userId) {
      where.userId = userId;
    }

    const transaction = await this.transactionRepository.findOne({
      where,
      relations: ['items', 'coupon'],
    });

    if (!transaction) {
      throw new AppException(
        ErrorCodes.TRANSACTION_NOT_FOUND,
        'Transaction not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return transaction;
  }

  async updateStatus(id: string, status: TransactionStatus) {
    const transaction = await this.findOne(id);

    // Validate status flow
    const validTransitions: Record<string, TransactionStatus[]> = {
      [TransactionStatus.PROCESSED]: [TransactionStatus.DELIVERY],
      [TransactionStatus.DELIVERY]: [TransactionStatus.FINISHED],
    };

    const allowed = validTransitions[transaction.status];
    if (!allowed || !allowed.includes(status)) {
      throw new AppException(
        ErrorCodes.TRANSACTION_INVALID_STATUS,
        `Cannot change status from ${transaction.status} to ${status}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    transaction.status = status;
    return this.transactionRepository.save(transaction);
  }

  async handlePaymentNotification(
    midtransOrderId: string,
    status: TransactionStatus,
    paymentType: string,
  ) {
    const transaction = await this.transactionRepository.findOne({
      where: { midtransOrderId },
      relations: ['items'],
    });

    if (!transaction) {
      this.logger.warn(
        `Transaction not found for order: ${midtransOrderId}`,
      );
      return;
    }

    // Skip if already processed
    if (transaction.status !== TransactionStatus.WAITING_PAYMENT) {
      this.logger.log(
        `Transaction ${midtransOrderId} already processed (status: ${transaction.status})`,
      );
      return;
    }

    transaction.status = status;
    transaction.paymentType = paymentType;

    if (status === TransactionStatus.PROCESSED) {
      transaction.paidAt = new Date();
    }

    // Restore stock if cancelled/expired
    if (
      status === TransactionStatus.CANCELLED ||
      status === TransactionStatus.EXPIRED
    ) {
      for (const item of transaction.items) {
        await this.variantRepository.increment(
          { id: item.variantId },
          'stock',
          item.quantity,
        );
      }
      this.logger.log(`Stock restored for order: ${midtransOrderId}`);
    }

    await this.transactionRepository.save(transaction);
    this.logger.log(
      `Transaction ${midtransOrderId} updated to: ${status}`,
    );
  }
}
