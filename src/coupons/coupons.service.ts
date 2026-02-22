import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon, CouponType } from './entities/coupon.entity';
import { CreateCouponDto, UpdateCouponDto } from './dto';
import { AppException, ErrorCodes } from '../common';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
  ) { }

  async create(dto: CreateCouponDto) {
    const coupon = this.couponRepository.create(dto);
    return this.couponRepository.save(coupon);
  }

  async findAll() {
    return this.couponRepository.find({ order: { validTo: 'DESC' } });
  }

  async findOne(id: string) {
    const coupon = await this.couponRepository.findOne({ where: { id } });
    if (!coupon) {
      throw new AppException(
        ErrorCodes.COUPON_NOT_FOUND,
        'Coupon not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto) {
    const coupon = await this.findOne(id);
    Object.assign(coupon, dto);
    return this.couponRepository.save(coupon);
  }

  async remove(id: string) {
    const coupon = await this.findOne(id);
    await this.couponRepository.remove(coupon);
    return { message: 'Coupon deleted' };
  }

  async validateCoupon(code: string, subtotal: number): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne({
      where: { code },
    });

    if (!coupon) {
      throw new AppException(
        ErrorCodes.COUPON_NOT_FOUND,
        'Coupon not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!coupon.isActive) {
      throw new AppException(
        ErrorCodes.COUPON_INVALID,
        'Coupon is not active',
        HttpStatus.BAD_REQUEST,
      );
    }

    const now = new Date();
    if (now < new Date(coupon.validFrom) || now > new Date(coupon.validTo)) {
      throw new AppException(
        ErrorCodes.COUPON_EXPIRED,
        'Coupon is expired or not yet valid',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      throw new AppException(
        ErrorCodes.COUPON_USAGE_LIMIT,
        'Coupon usage limit reached',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (subtotal < Number(coupon.minOrder)) {
      throw new AppException(
        ErrorCodes.COUPON_MIN_ORDER,
        `Minimum order amount is ${coupon.minOrder}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return coupon;
  }

  calculateDiscount(coupon: Coupon, subtotal: number): number {
    if (coupon.type === CouponType.PERCENTAGE) {
      return (subtotal * Number(coupon.value)) / 100;
    }
    return Math.min(Number(coupon.value), subtotal);
  }

  async incrementUsage(couponId: string) {
    await this.couponRepository.increment({ id: couponId }, 'usedCount', 1);
  }
}
