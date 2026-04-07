import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyInsight } from './entities/daily-insight.entity';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([DailyInsight]), AiModule],
  controllers: [ScraperController],
  providers: [ScraperService],
  exports: [ScraperService]
})
export class ScraperModule {}
