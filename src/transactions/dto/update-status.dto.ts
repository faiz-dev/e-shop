import { IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionStatus } from '../entities/transaction.entity';

export class UpdateStatusDto {
  @ApiProperty({
    enum: [
      TransactionStatus.PROCESSED,
      TransactionStatus.DELIVERY,
      TransactionStatus.FINISHED,
    ],
  })
  @IsNotEmpty()
  @IsEnum(TransactionStatus)
  status: TransactionStatus;
}
