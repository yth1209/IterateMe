import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { LoggerInterface } from './logger.interface';

export class CustomLogger extends LoggerInterface {
  protected readonly dirname: string;
  protected readonly filename: string;
  protected readonly formatter = winston.format.printf((info) =>
    JSON.stringify({
      '@timestamp': new Date(),
      level: info.level,
      message: info.message,
    }),
  );

  constructor(private readonly configService: ConfigService) {
    super();
    this.dirname = '/logs/console/';
    this.filename = this.configService.get<string>('CONSOLE_FILE_NAME_PREFIX', 'console');
  }

  createLogger(): winston.Logger {
    const transports: winston.transport[] = [this.getConsoleTransport()];
    if (!this.isLocalEnv()) transports.push(this.getFileTransport());
    return this.createLoggerByTransports(transports);
  }
}
