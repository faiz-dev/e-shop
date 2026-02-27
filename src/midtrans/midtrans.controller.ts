import {
  Controller,
  Post,
  Body,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint, ApiOperation, ApiBody } from '@nestjs/swagger';
import { MidtransService } from './midtrans.service';
import { TransactionsService } from '../transactions/transactions.service';
import { AppException, ErrorCodes } from '../common';
import { TransactionStatus } from '../transactions/entities/transaction.entity';

@ApiTags('Midtrans')
@Controller('midtrans')
export class MidtransController {
  private readonly logger = new Logger(MidtransController.name);

  constructor(
    private readonly midtransService: MidtransService,
    private readonly transactionsService: TransactionsService,
  ) { }

  @Post('notification')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleNotification(@Body() body: Record<string, unknown>) {
    this.logger.log(`Midtrans notification: ${JSON.stringify(body)}`);

    const orderId = body.order_id as string;
    const statusCode = body.status_code as string;
    const grossAmount = body.gross_amount as string;
    const signatureKey = body.signature_key as string;
    const transactionStatus = body.transaction_status as string;
    const paymentType = body.payment_type as string;
    const fraudStatus = body.fraud_status as string | undefined;

    // Verify signature
    const isValid = this.midtransService.verifySignature(
      orderId,
      statusCode,
      grossAmount,
      signatureKey,
    );

    if (!isValid) {
      this.logger.warn(`Invalid signature for order: ${orderId}`);
      throw new AppException(
        ErrorCodes.MIDTRANS_INVALID_SIGNATURE,
        'Invalid signature',
      );
    }

    // Determine new status
    let newStatus: TransactionStatus | null = null;

    if (transactionStatus === 'capture') {
      // Credit card: check fraud status
      newStatus =
        fraudStatus === 'accept'
          ? TransactionStatus.PROCESSED
          : TransactionStatus.CANCELLED;
    } else if (transactionStatus === 'settlement') {
      newStatus = TransactionStatus.PROCESSED;
    } else if (
      transactionStatus === 'cancel' ||
      transactionStatus === 'deny'
    ) {
      newStatus = TransactionStatus.CANCELLED;
    } else if (transactionStatus === 'expire') {
      newStatus = TransactionStatus.EXPIRED;
    } else if (transactionStatus === 'pending') {
      // Still waiting, no status change
      newStatus = null;
    }

    if (newStatus) {
      await this.transactionsService.handlePaymentNotification(
        orderId,
        newStatus,
        paymentType,
      );
    }

    return { status: 'ok' };
  }

  /**
   * Mock endpoint to simulate Midtrans payment confirmation.
   * Only available when MIDTRANS_MOCK=true.
   */
  @Post('mock-confirm/:orderId')
  @HttpCode(200)
  @ApiOperation({ summary: '[DEV] Simulate payment confirmation (mock mode only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['settlement', 'cancel', 'expire'],
          default: 'settlement',
          description: 'Simulated Midtrans transaction status',
        },
      },
    },
    required: false,
  })
  async mockConfirm(
    @Param('orderId') orderId: string,
    @Body() body: { status?: string },
  ) {
    if (!this.midtransService.isMockMode) {
      throw new NotFoundException(
        'This endpoint is only available when MIDTRANS_MOCK=true',
      );
    }

    const simulatedStatus = body?.status || 'settlement';
    this.logger.log(
      `[MOCK] Simulating payment "${simulatedStatus}" for order: ${orderId}`,
    );

    let newStatus: TransactionStatus;
    switch (simulatedStatus) {
      case 'settlement':
        newStatus = TransactionStatus.PROCESSED;
        break;
      case 'cancel':
        newStatus = TransactionStatus.CANCELLED;
        break;
      case 'expire':
        newStatus = TransactionStatus.EXPIRED;
        break;
      default:
        newStatus = TransactionStatus.PROCESSED;
    }

    await this.transactionsService.handlePaymentNotification(
      orderId,
      newStatus,
      'mock_payment',
    );

    return {
      status: 'ok',
      message: `[MOCK] Order ${orderId} updated to "${newStatus}"`,
    };
  }
}
