import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTransactionDto {
  @ApiPropertyOptional({ example: 'SAVE20', description: 'Coupon code' })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
