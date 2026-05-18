import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string;
  error?: string;
  errors?: Record<string, string[]>;
  requestId?: string;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw = isHttp ? exception.getResponse() : null;
    const isValidation = status === HttpStatus.UNPROCESSABLE_ENTITY && raw && typeof raw === 'object';

    const body: ErrorBody = {
      statusCode: status,
      message: this.resolveMessage(exception, status, raw),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (isValidation) {
      const validationBody = raw as Record<string, unknown>;
      const maybeErrors = validationBody.message;
      if (Array.isArray(maybeErrors)) {
        body.errors = { _form: maybeErrors.map((m) => String(m)) };
        body.message = 'Validation failed';
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status >= 400) {
      this.logger.warn(`${request.method} ${request.url} -> ${status} ${body.message}`);
    }

    response.status(status).json(body);
  }

  private resolveMessage(exception: unknown, status: number, raw: unknown): string {
    if (status === HttpStatus.INTERNAL_SERVER_ERROR && !(exception instanceof HttpException)) {
      return 'Something went wrong. Please try again.';
    }
    if (raw && typeof raw === 'object') {
      const msg = (raw as Record<string, unknown>).message;
      if (typeof msg === 'string') return msg;
      if (Array.isArray(msg) && msg.length > 0) return String(msg[0]);
    }
    if (exception instanceof HttpException) {
      return exception.message;
    }
    return 'Request failed.';
  }
}
