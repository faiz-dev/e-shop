import { PartialType } from '@nestjs/swagger';
import { CreateVariantDto } from './create-product.dto';

export class UpdateVariantDto extends PartialType(CreateVariantDto) { }
