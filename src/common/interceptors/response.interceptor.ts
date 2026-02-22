import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiResponse, PaginatedResponse } from '../dto/api-response.dto';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        // Already formatted (PaginatedResponse or raw)
        if (data instanceof PaginatedResponse || data instanceof ApiResponse) {
          return data;
        }

        // Null / undefined
        if (data === null || data === undefined) {
          return new ApiResponse(null, 'Success');
        }

        // Auto-wrap
        return new ApiResponse(data, 'Success');
      }),
    );
  }
}
