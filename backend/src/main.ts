import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: ['http://localhost:4100', 'http://127.0.0.1:4100'],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();