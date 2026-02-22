import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from './entities/rating.entity';
import { CreateRatingDto } from './dto/create-rating.dto';
import { ProductsService } from '../products/products.service';
import { AppException, ErrorCodes } from '../common';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,
    private readonly productsService: ProductsService,
  ) { }

  async create(productId: string, userId: string, dto: CreateRatingDto) {
    // Check product exists
    await this.productsService.findOne(productId);

    // Check if already rated
    const existing = await this.ratingRepository.findOne({
      where: { productId, userId },
    });

    if (existing) {
      throw new AppException(
        ErrorCodes.ALREADY_RATED,
        'You have already rated this product',
        HttpStatus.CONFLICT,
      );
    }

    const rating = this.ratingRepository.create({
      ...dto,
      productId,
      userId,
    });

    const saved = await this.ratingRepository.save(rating);

    // Update product average rating
    await this.productsService.updateAvgRating(productId);

    return saved;
  }

  async findByProduct(productId: string) {
    return this.ratingRepository.find({
      where: { productId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }
}
