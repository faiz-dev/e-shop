import { Controller, Post, Body, Logger, HttpCode } from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { MidtransService } from './midtrans.service';
import { TransactionsService } from '../transactions/transactions.service';
import { AppException, ErrorCodes } from '../common';
import { TransactionStatus } from '../transactions/entities/transaction.entity';

@ApiTags('Midtrans')
@Controller('midtrans')
export class MidtransController {
  private readonly logger = new Logger(MidtransController.name);

  constructor(
    private readonly midtransService: MidtransService,
    private readonly transactionsService: TransactionsService,
  ) { }

  @Post('notification')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleNotification(@Body() body: Record<string, unknown>) {
    this.logger.log(`Midtrans notification: ${JSON.stringify(body)}`);

    const orderId = body.order_id as string;
    const statusCode = body.status_code as string;
    const grossAmount = body.gross_amount as string;
    const signatureKey = body.signature_key as string;
    const transactionStatus = body.transaction_status as string;
    const paymentType = body.payment_type as string;
    const fraudStatus = body.fraud_status as string | undefined;

    // Verify signature
    const isValid = this.midtransService.verifySignature(
      orderId,
      statusCode,
      grossAmount,
      signatureKey,
    );

    if (!isValid) {
      this.logger.warn(`Invalid signature for order: ${orderId}`);
      throw new AppException(
        ErrorCodes.MIDTRANS_INVALID_SIGNATURE,
        'Invalid signature',
      );
    }

    // Determine new status
    let newStatus: TransactionStatus | null = null;

    if (transactionStatus === 'capture') {
      // Credit card: check fraud status
      newStatus =
        fraudStatus === 'accept'
          ? TransactionStatus.PROCESSED
          : TransactionStatus.CANCELLED;
    } else if (transactionStatus === 'settlement') {
      newStatus = TransactionStatus.PROCESSED;
    } else if (
      transactionStatus === 'cancel' ||
      transactionStatus === 'deny'
    ) {
      newStatus = TransactionStatus.CANCELLED;
    } else if (transactionStatus === 'expire') {
      newStatus = TransactionStatus.EXPIRED;
    } else if (transactionStatus === 'pending') {
      // Still waiting, no status change
      newStatus = null;
    }

    if (newStatus) {
      await this.transactionsService.handlePaymentNotification(
        orderId,
        newStatus,
        paymentType,
      );
    }

    return { status: 'ok' };
  }
}
