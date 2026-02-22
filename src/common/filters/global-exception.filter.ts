import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AppException, ErrorCodes } from '../exceptions/app.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status: number;
    let message: string;
    let errorCode: string;
    let errors: string[] | undefined;

    if (exception instanceof AppException) {
      status = exception.getStatus();
      message = exception.message;
      errorCode = exception.errorCode;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res.message as string) || exception.message;
        errorCode = ErrorCodes.VALIDATION_ERROR;

        // class-validator returns messages as array
        if (Array.isArray(res.message)) {
          errors = res.message as string[];
          message = 'Validation failed';
        }
      } else {
        message = exception.message;
        errorCode = ErrorCodes.INTERNAL_ERROR;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      errorCode = ErrorCodes.INTERNAL_ERROR;
      this.logger.error('Unhandled exception', exception);
    }

    const body: Record<string, unknown> = {
      success: false,
      message,
      errorCode,
    };

    if (errors) {
      body.errors = errors;
    }

    response.status(status).json(body);
  }
}
