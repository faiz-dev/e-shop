import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const midtransClient = require('midtrans-client');

export interface SnapTransactionParams {
  orderId: string;
  grossAmount: number;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  customer: {
    firstName: string;
    email: string;
  };
}

export interface SnapResponse {
  token: string;
  redirect_url: string;
}

@Injectable()
export class MidtransService {
  private readonly snap: InstanceType<typeof midtransClient.Snap>;
  private readonly serverKey: string;
  private readonly logger = new Logger(MidtransService.name);

  constructor(private readonly configService: ConfigService) {
    this.serverKey = this.configService.get<string>('MIDTRANS_SERVER_KEY', '');

    this.snap = new midtransClient.Snap({
      isProduction:
        this.configService.get<string>('MIDTRANS_IS_PRODUCTION') === 'true',
      serverKey: this.serverKey,
      clientKey: this.configService.get<string>('MIDTRANS_CLIENT_KEY', ''),
    });
  }

  async createTransaction(params: SnapTransactionParams): Promise<SnapResponse> {
    const parameter = {
      transaction_details: {
        order_id: params.orderId,
        gross_amount: params.grossAmount,
      },
      item_details: params.items.map((item) => ({
        id: item.id,
        name: item.name.substring(0, 50), // Midtrans max 50 chars
        price: item.price,
        quantity: item.quantity,
      })),
      customer_details: {
        first_name: params.customer.firstName,
        email: params.customer.email,
      },
      expiry: {
        unit: 'minutes',
        duration: 30,
      },
    };

    try {
      const response = await this.snap.createTransaction(parameter);
      this.logger.log(`Snap token created for order: ${params.orderId}`);
      return response as SnapResponse;
    } catch (error) {
      this.logger.error(`Midtrans error: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  verifySignature(
    orderId: string,
    statusCode: string,
    grossAmount: string,
    signatureKey: string,
  ): boolean {
    const payload = orderId + statusCode + grossAmount + this.serverKey;
    const hash = crypto.createHash('sha512').update(payload).digest('hex');
    return hash === signatureKey;
  }
}
