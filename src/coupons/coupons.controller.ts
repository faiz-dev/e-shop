import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto';
import { Roles, RolesGuard } from '../common';

@ApiTags('Coupons')
@ApiBearerAuth()
@Controller('coupons')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) { }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Get()
  @Roles('admin')
  findAll() {
    return this.couponsService.findAll();
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.couponsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.couponsService.remove(id);
  }

  @Post('validate')
  @Roles('customer')
  validateCoupon(@Body() dto: ValidateCouponDto) {
    // Pass 0 as subtotal for simple validation (just check active + dates + usage)
    return this.couponsService.validateCoupon(dto.code, 0);
  }
}
