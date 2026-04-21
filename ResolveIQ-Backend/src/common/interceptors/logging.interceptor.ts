import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, requestId } = request;
    const userAgent = request.get('user-agent') || '';
    const ip = request.ip;
    const startTime = Date.now();

    const logContext = {
      requestId,
      method,
      url,
      ip,
      userAgent: userAgent.substring(0, 100),
    };

    // Log request
    if (process.env.NODE_ENV === 'production') {
      this.logger.log(JSON.stringify({ ...logContext, type: 'request' }));
    } else {
      this.logger.log(`[${requestId}] ${method} ${url}`);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const duration = Date.now() - startTime;

          if (process.env.NODE_ENV === 'production') {
            this.logger.log(
              JSON.stringify({
                ...logContext,
                type: 'response',
                statusCode,
                duration,
              }),
            );
          } else {
            this.logger.log(`[${requestId}] ${method} ${url} ${statusCode} ${duration}ms`);
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;

          if (process.env.NODE_ENV === 'production') {
            this.logger.error(
              JSON.stringify({
                ...logContext,
                type: 'error',
                error: error.message,
                stack: error.stack,
                duration,
              }),
            );
          } else {
            this.logger.error(`[${requestId}] ${method} ${url} ERROR ${duration}ms - ${error.message}`);
          }
        },
      }),
    );
  }
}
