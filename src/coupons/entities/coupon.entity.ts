import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

export enum CouponType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'enum', enum: CouponType })
  type: CouponType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  value: number;

  @Column({ name: 'min_order', type: 'decimal', precision: 12, scale: 2, default: 0 })
  minOrder: number;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom: Date;

  @Column({ name: 'valid_to', type: 'date' })
  validTo: Date;

  @Column({ name: 'usage_limit', type: 'int', default: 0 })
  usageLimit: number;

  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
