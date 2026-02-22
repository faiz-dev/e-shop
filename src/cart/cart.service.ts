import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from './entities/cart-item.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { AppException, ErrorCodes } from '../common';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private readonly cartRepository: Repository<CartItem>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
  ) { }

  async findAll(userId: string) {
    return this.cartRepository.find({
      where: { userId },
      relations: ['variant', 'variant.product'],
    });
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    // Verify variant exists
    const variant = await this.variantRepository.findOne({
      where: { id: dto.variantId },
    });

    if (!variant) {
      throw new AppException(
        ErrorCodes.VARIANT_NOT_FOUND,
        'Product variant not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Check if already in cart → update quantity
    const existing = await this.cartRepository.findOne({
      where: { userId, variantId: dto.variantId },
    });

    if (existing) {
      existing.quantity += dto.quantity;
      return this.cartRepository.save(existing);
    }

    const cartItem = this.cartRepository.create({
      userId,
      variantId: dto.variantId,
      quantity: dto.quantity,
    });

    return this.cartRepository.save(cartItem);
  }

  async updateItem(userId: string, id: string, dto: UpdateCartItemDto) {
    const item = await this.cartRepository.findOne({
      where: { id, userId },
    });

    if (!item) {
      throw new AppException(
        ErrorCodes.CART_ITEM_NOT_FOUND,
        'Cart item not found',
        HttpStatus.NOT_FOUND,
      );
    }

    item.quantity = dto.quantity;
    return this.cartRepository.save(item);
  }

  async removeItem(userId: string, id: string) {
    const item = await this.cartRepository.findOne({
      where: { id, userId },
    });

    if (!item) {
      throw new AppException(
        ErrorCodes.CART_ITEM_NOT_FOUND,
        'Cart item not found',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.cartRepository.remove(item);
    return { message: 'Item removed from cart' };
  }

  async clearCart(userId: string) {
    await this.cartRepository.delete({ userId });
  }
}
