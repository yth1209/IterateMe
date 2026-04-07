import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyInsight } from './entities/daily-insight.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('insights')
@UseGuards(JwtAuthGuard)
export class ScraperController {
  constructor(
    @InjectRepository(DailyInsight)
    private readonly insightRepo: Repository<DailyInsight>,
  ) {}

  @Get()
  async getInsights(@Query('limit') limit: string = '10') {
    const take = Math.min(parseInt(limit) || 10, 50); // 최대 50개 제한
    return this.insightRepo.find({
      order: { createdAt: 'DESC' },
      take,
    });
  }
}
