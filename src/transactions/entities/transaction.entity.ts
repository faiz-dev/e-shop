import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Coupon } from '../../coupons/entities/coupon.entity';
import { TransactionItem } from './transaction-item.entity';

export enum TransactionStatus {
  WAITING_PAYMENT = 'waiting_payment',
  PROCESSED = 'processed',
  DELIVERY = 'delivery',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'midtrans_order_id', unique: true })
  midtransOrderId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'coupon_id', nullable: true })
  couponId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total: number;

  @Column({ name: 'snap_token', nullable: true })
  snapToken: string;

  @Column({ name: 'snap_redirect_url', nullable: true })
  snapRedirectUrl: string;

  @Column({ name: 'payment_type', nullable: true })
  paymentType: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.WAITING_PAYMENT,
  })
  status: TransactionStatus;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.transactions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Coupon, { nullable: true })
  @JoinColumn({ name: 'coupon_id' })
  coupon: Coupon;

  @OneToMany(() => TransactionItem, (item) => item.transaction, {
    cascade: true,
    eager: true,
  })
  items: TransactionItem[];
}
