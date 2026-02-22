import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto, UpdateStatusDto } from './dto';
import { CurrentUser, Roles, RolesGuard } from '../common';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) { }

  @Post()
  @Roles('customer')
  checkout(
    @CurrentUser() user: { id: string; email: string; name?: string },
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionsService.checkout(
      user.id,
      user.email,
      user.name || 'Customer',
      dto,
    );
  }

  @Get()
  @Roles('customer')
  findAll(@CurrentUser('id') userId: string) {
    return this.transactionsService.findAllByUser(userId);
  }

  @Get(':id')
  @Roles('customer')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.transactionsService.findOne(id, userId);
  }

  @Patch(':id/status')
  @Roles('admin')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.transactionsService.updateStatus(id, dto.status);
  }
}
