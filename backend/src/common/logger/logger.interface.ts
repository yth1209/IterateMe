import * as winston from 'winston';
import { Format } from 'logform';
import 'winston-daily-rotate-file';

export abstract class LoggerInterface {
  protected abstract readonly formatter: Format;
  protected abstract readonly dirname: string;
  protected abstract readonly filename: string;

  getFileTransport(): winston.transport {
    return new winston.transports.DailyRotateFile({
      datePattern: 'YYYY-MM-DD',
      dirname: this.dirname,
      filename: this.filename + '_%DATE%.txt',
      maxSize: '10m',
      maxFiles: '2',
      createSymlink: true,
      symlinkName: this.filename + '.log',
    } as any);
  }

  getConsoleTransport(): winston.transport {
    return new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD hh:mm:ss.SSS' }),
        winston.format.colorize({ level: true }),
        winston.format.printf((info) => {
          if (typeof info.message === 'object' && 'exceptionStack' in (info.message as object)) {
            const msg = info.message as any;
            const output = { message: msg.exceptionMessage, stack: msg.exceptionStack };
            return `[${info.timestamp}] [${info.level}] ${JSON.stringify(output, null, 2)}`;
          }
          return `[${info.timestamp}] [${info.level}] ${JSON.stringify(info.message)}`;
        }),
      ),
    });
  }

  isLocalEnv(): boolean {
    const nodeEnv = process.env.NODE_ENV;
    return !(
      nodeEnv === 'dev' ||
      nodeEnv === 'development' ||
      nodeEnv === 'prod' ||
      nodeEnv === 'production'
    );
  }

  createLoggerByTransports(transports: winston.transport[]): winston.Logger {
    return winston.createLogger({
      level: 'debug',
      format: this.formatter,
      transports,
    });
  }
}
