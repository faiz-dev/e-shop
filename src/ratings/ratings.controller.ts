import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { CurrentUser, Roles, RolesGuard } from '../common';

@ApiTags('Ratings')
@ApiBearerAuth()
@Controller('products/:productId/ratings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) { }

  @Post()
  @Roles('customer')
  create(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRatingDto,
  ) {
    return this.ratingsService.create(productId, userId, dto);
  }

  @Get()
  findByProduct(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.ratingsService.findByProduct(productId);
  }
}
