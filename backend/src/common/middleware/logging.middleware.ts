import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'requests.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, _res: Response, next: NextFunction) {
    const { method, originalUrl, query, body } = req;
    const timestamp = new Date().toISOString();

    const queryStr = JSON.stringify(query);
    const bodyStr = JSON.stringify(body ?? {});

    const consoleLine = `${method} ${originalUrl}  query=${queryStr}  body=${bodyStr}`;
    this.logger.log(consoleLine);

    const fileLine =
      `[${timestamp}] ${method} ${originalUrl}\n` +
      `  query : ${queryStr}\n` +
      `  body  : ${bodyStr}\n\n`;

    fs.appendFile(LOG_FILE, fileLine, () => {});

    next();
  }
}
