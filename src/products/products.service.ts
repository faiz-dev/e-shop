import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { Category } from '../categories/entities/category.entity';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateVariantDto,
  UpdateVariantDto,
  CatalogQueryDto,
} from './dto';
import {
  AppException,
  ErrorCodes,
  PaginatedResponse,
  PaginationMeta,
} from '../common';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) { }

  async create(dto: CreateProductDto) {
    const product = this.productRepository.create({
      name: dto.name,
      description: dto.description,
      imageUrl: dto.imageUrl,
    });

    // Assign categories
    if (dto.categoryIds?.length) {
      product.categories = await this.categoryRepository.findByIds(
        dto.categoryIds,
      );
    }

    // Save product first to get ID
    const saved = await this.productRepository.save(product);

    // Create variants
    const variants = dto.variants.map((v) =>
      this.variantRepository.create({ ...v, productId: saved.id }),
    );
    saved.variants = await this.variantRepository.save(variants);

    return saved;
  }

  async findAll(query: CatalogQueryDto) {
    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.variants', 'variant')
      .leftJoinAndSelect('product.categories', 'category')
      .where('product.is_active = :isActive', { isActive: true });

    // Search
    if (query.search) {
      qb.andWhere(
        '(product.name ILIKE :search OR product.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Filter by category
    if (query.categoryId) {
      qb.andWhere('category.id = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    // Filter by price range (min price of any variant)
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      qb.andWhere(
        `product.id IN (
          SELECT pv.product_id FROM product_variants pv 
          WHERE 1=1
          ${query.minPrice !== undefined ? 'AND pv.price >= :minPrice' : ''}
          ${query.maxPrice !== undefined ? 'AND pv.price <= :maxPrice' : ''}
        )`,
        {
          ...(query.minPrice !== undefined && { minPrice: query.minPrice }),
          ...(query.maxPrice !== undefined && { maxPrice: query.maxPrice }),
        },
      );
    }

    // Sort
    const sortField = this.getSortField(query.sort);
    qb.orderBy(sortField, query.order);

    // Count total
    const totalItems = await qb.getCount();

    // Paginate
    qb.skip(query.skip).take(query.limit);

    const products = await qb.getMany();
    const meta = new PaginationMeta(query.page, query.limit, totalItems);

    return new PaginatedResponse(products, meta, 'Products retrieved');
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['variants', 'categories', 'ratings', 'ratings.user'],
    });

    if (!product) {
      throw new AppException(
        ErrorCodes.PRODUCT_NOT_FOUND,
        'Product not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.findOne(id);

    if (dto.categoryIds) {
      product.categories = await this.categoryRepository.findByIds(
        dto.categoryIds,
      );
    }

    Object.assign(product, {
      ...(dto.name && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
    });

    return this.productRepository.save(product);
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    product.isActive = false;
    await this.productRepository.save(product);
    return { message: 'Product deactivated' };
  }

  // Variant management
  async addVariant(productId: string, dto: CreateVariantDto) {
    await this.findOne(productId);
    const variant = this.variantRepository.create({
      ...dto,
      productId,
    });
    return this.variantRepository.save(variant);
  }

  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
  ) {
    const variant = await this.variantRepository.findOne({
      where: { id: variantId, productId },
    });

    if (!variant) {
      throw new AppException(
        ErrorCodes.VARIANT_NOT_FOUND,
        'Variant not found',
        HttpStatus.NOT_FOUND,
      );
    }

    Object.assign(variant, dto);
    return this.variantRepository.save(variant);
  }

  async removeVariant(productId: string, variantId: string) {
    const variant = await this.variantRepository.findOne({
      where: { id: variantId, productId },
    });

    if (!variant) {
      throw new AppException(
        ErrorCodes.VARIANT_NOT_FOUND,
        'Variant not found',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.variantRepository.remove(variant);
    return { message: 'Variant deleted' };
  }

  async updateAvgRating(productId: string) {
    const result = await this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.ratings', 'rating')
      .select('AVG(rating.score)', 'avg')
      .where('product.id = :productId', { productId })
      .getRawOne();

    await this.productRepository.update(productId, {
      avgRating: parseFloat(result.avg) || 0,
    });
  }

  private getSortField(sort: string): string {
    const map: Record<string, string> = {
      price: 'variant.price',
      rating: 'product.avg_rating',
      created_at: 'product.created_at',
      name: 'product.name',
    };
    return map[sort] || 'product.created_at';
  }
}
