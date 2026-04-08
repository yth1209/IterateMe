import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { LoggingInterceptor } from 'git_modules/nestjs-logger/interceptor/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: ['http://localhost:4100', 'http://127.0.0.1:4100'],
    credentials: true,
  });

  const configService = app.get(ConfigService);
  app.useGlobalInterceptors(new LoggingInterceptor(configService));

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
