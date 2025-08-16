import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest, FastifyReply } from 'fastify';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  error?: string;
  details?: any;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const isProduction = this.configService.get('NODE_ENV') === 'production';
    
    let status: number;
    let message: string;
    let error: string | undefined;
    let details: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exception.message;
        details = !isProduction ? (exceptionResponse as any).details : undefined;
      } else {
        message = exception.message;
      }
      
      error = exception.name;
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = isProduction ? 'Internal server error' : exception.message;
      error = isProduction ? 'InternalServerError' : exception.name;
      
      // Log the full error in non-production environments
      if (!isProduction) {
        details = {
          stack: exception.stack,
        };
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'UnknownError';
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...(error && { error }),
      ...(details && { details }),
    };

    // Log the error
    const logMessage = `${request.method} ${request.url} - ${status} - ${message}`;
    
    if (status >= 500) {
      this.logger.error(logMessage, exception instanceof Error ? exception.stack : undefined);
    } else if (status >= 400) {
      this.logger.warn(logMessage);
    } else {
      this.logger.log(logMessage);
    }

    response.status(status).send(errorResponse);
  }
}