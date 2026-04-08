import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, tap, catchError, throwError } from 'rxjs';
import * as winston from 'winston';
import { ApiLogger } from '../logger/api-logger';
import { ExceptionLogger } from '../logger/exception-logger';
import { Duration, RequestLog, ResponseLog } from '../model/api-log.model';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly apiLogger: winston.Logger;
  private readonly exceptionLogger: winston.Logger;

  constructor(configService: ConfigService) {
    this.apiLogger = new ApiLogger(configService).createLogger();
    this.exceptionLogger = new ExceptionLogger(configService).createLogger();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const apiStartTime = new Date();
    return next.handle().pipe(
      tap((responseBody) => this.apiLogSave(context, responseBody, apiStartTime)),
      catchError((err) => this.exceptionLogSave(context, err, apiStartTime)),
    );
  }

  private async apiLogSave(
    context: ExecutionContext,
    response: any,
    apiStartTime: Date,
  ): Promise<void> {
    const apiEndTime = new Date();
    this.apiLogger.debug({
      requestLog: LoggingInterceptor.getRequestLog(context),
      responseLog: LoggingInterceptor.getResponseLog(context, response),
      apiStartTime,
      apiEndTime,
      duration: LoggingInterceptor.getDuration(apiStartTime, apiEndTime),
    });
  }

  private async exceptionLogSave(
    context: ExecutionContext,
    exception: any,
    apiStartTime: Date,
  ): Promise<never> {
    const status = exception.status ?? 500;
    context.switchToHttp().getResponse().statusCode = status;

    const errorCode =
      'response' in exception ? exception.code || '99999999' : '99999999';

    let errorCustomMessage =
      'response' in exception
        ? exception.response?.message || exception.response
        : exception.message;

    if ('sql' in exception) {
      errorCustomMessage += ` (sql: ${exception.sql})`;
    }

    const response = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: context.switchToHttp().getRequest().url,
      errorCode,
      errorMessage: errorCustomMessage || '',
    };

    await this.apiLogSave(context, response, apiStartTime);

    this.exceptionLogger.error({
      requestLog: LoggingInterceptor.getRequestLog(context),
      responseLog: LoggingInterceptor.getResponseLog(context, response),
      exceptionMessage: errorCustomMessage,
      exceptionStack: exception.stack,
    });

    return throwError(() => exception) as never;
  }

  private static getRequestLog(context: ExecutionContext): RequestLog {
    const request = context.switchToHttp().getRequest();
    return {
      uri: request.originalUrl.split('?')[0],
      httpMethod: request.method,
      queryString: request.originalUrl.split('?')[1],
      controllerMethodArgs: JSON.stringify({ body: request.body, query: request.query }),
      requestHeader: JSON.stringify(request.headers),
    };
  }

  private static getResponseLog(context: ExecutionContext, response: any): ResponseLog {
    return {
      responseBody: JSON.stringify(response),
      httpStatusCode: context.switchToHttp().getResponse().statusCode,
    };
  }

  private static getDuration(apiStartTime: Date, apiEndTime: Date): Duration {
    const diff = apiEndTime.getTime() - apiStartTime.getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = (diff % 60000) / 1000;
    return {
      time: diff,
      unit: 'MILLIS',
      readableString: `${hours}시간 ${mins}분 ${secs}초`,
    };
  }
}
