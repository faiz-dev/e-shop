import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateCouponDto {
  @ApiProperty({ example: 'SAVE20' })
  @IsNotEmpty()
  @IsString()
  code: string;
}
