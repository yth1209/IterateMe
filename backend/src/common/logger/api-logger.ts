import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { LoggerInterface } from './logger.interface';

export class ApiLogger extends LoggerInterface {
  protected readonly dirname: string;
  protected readonly filename: string;
  protected readonly formatter = winston.format.printf((info) =>
    JSON.stringify({
      '@timestamp': new Date(),
      apiLog: info.message,
    }),
  );

  constructor(private readonly configService: ConfigService) {
    super();
    this.dirname = '/logs/api/';
    this.filename = this.configService.get<string>('API_LOG_FILE_NAME_PREFIX', 'api');
  }

  createLogger(): winston.Logger {
    const transports: winston.transport[] = [this.getConsoleTransport()];
    if (!this.isLocalEnv()) transports.push(this.getFileTransport());
    return this.createLoggerByTransports(transports);
  }
}
