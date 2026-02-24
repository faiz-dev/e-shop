import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike, FindOptionsWhere, DataSource } from 'typeorm';
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
    private readonly dataSource: DataSource,
  ) { }

  async create(dto: CreateProductDto) {
    const product = this.productRepository.create({
      name: dto.name,
      description: dto.description,
      imageUrl: dto.imageUrl,
    });

    // Assign categories
    if (dto.categoryIds?.length) {
      product.categories = await this.categoryRepository.findBy(
        { id: In(dto.categoryIds) },
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
    // Build where conditions
    const where: FindOptionsWhere<Product> = { isActive: true };

    // Search by name or description
    if (query.search) {
      // We need two where clauses for OR - TypeORM find() uses an array for OR
      const searchWhere: FindOptionsWhere<Product>[] = [
        { ...where, name: ILike(`%${query.search}%`) },
        { ...where, description: ILike(`%${query.search}%`) },
      ];

      // If filtering by category, add it to both OR conditions
      if (query.categoryId) {
        searchWhere.forEach(w => {
          (w as any).categories = { id: query.categoryId };
        });
      }

      // Filter by price range using subquery
      if (query.minPrice !== undefined || query.maxPrice !== undefined) {
        const productIds = await this.getProductIdsByPriceRange(query.minPrice, query.maxPrice);
        if (productIds.length === 0) {
          return new PaginatedResponse([], new PaginationMeta(query.page, query.limit, 0), 'Products retrieved');
        }
        searchWhere.forEach(w => {
          w.id = In(productIds);
        });
      }

      const [products, totalItems] = await this.productRepository.findAndCount({
        where: searchWhere,
        relations: ['variants', 'categories'],
        order: this.getSortOrder(query.sort, query.order),
        skip: query.skip,
        take: query.limit,
      });

      const meta = new PaginationMeta(query.page, query.limit, totalItems);
      return new PaginatedResponse(products, meta, 'Products retrieved');
    }

    // No search - simple where
    if (query.categoryId) {
      (where as any).categories = { id: query.categoryId };
    }

    // Filter by price range using subquery
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const productIds = await this.getProductIdsByPriceRange(query.minPrice, query.maxPrice);
      if (productIds.length === 0) {
        return new PaginatedResponse([], new PaginationMeta(query.page, query.limit, 0), 'Products retrieved');
      }
      where.id = In(productIds);
    }

    const [products, totalItems] = await this.productRepository.findAndCount({
      where,
      relations: ['variants', 'categories'],
      order: this.getSortOrder(query.sort, query.order),
      skip: query.skip,
      take: query.limit,
    });

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
      product.categories = await this.categoryRepository.findBy(
        { id: In(dto.categoryIds) },
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
    const result = await this.dataSource.query(
      `SELECT AVG(score) as avg FROM ratings WHERE product_id = $1`,
      [productId],
    );

    await this.productRepository.update(productId, {
      avgRating: parseFloat(result[0]?.avg) || 0,
    });
  }

  private async getProductIdsByPriceRange(minPrice?: number, maxPrice?: number): Promise<string[]> {
    let sql = 'SELECT DISTINCT product_id FROM product_variants WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (minPrice !== undefined) {
      sql += ` AND price >= $${paramIndex++}`;
      params.push(minPrice);
    }
    if (maxPrice !== undefined) {
      sql += ` AND price <= $${paramIndex++}`;
      params.push(maxPrice);
    }

    const rows = await this.dataSource.query(sql, params);
    return rows.map((r: any) => r.product_id);
  }

  private getSortOrder(sort: string, order: 'ASC' | 'DESC'): Record<string, 'ASC' | 'DESC'> {
    const map: Record<string, string> = {
      price: 'variants.price',
      rating: 'avgRating',
      created_at: 'createdAt',
      name: 'name',
    };
    const field = map[sort] || 'createdAt';

    // For nested relations like variants.price, TypeORM find() doesn't support it directly
    // Fall back to createdAt for price sorting
    if (field.includes('.')) {
      return { createdAt: order };
    }

    return { [field]: order };
  }
}
