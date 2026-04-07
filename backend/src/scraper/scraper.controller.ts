import { Controller, Get, Post, Query, Req, UseGuards, HttpCode, Logger } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('insights')
@UseGuards(JwtAuthGuard)
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);

  constructor(private readonly scraperService: ScraperService) {}

  @Get()
  getInsights(
    @Req() req: any,
    @Query('limit') limit = '10',
    @Query('categories') categories?: string | string[],
    @Query('page') page = '1',
  ) {
    return this.scraperService.getInsights(req.user.id, categories, page, limit);
  }

  @Post('trigger')
  @HttpCode(202)
  async triggerScraping(@Req() req: any) {
    this.scraperService
      .generateAllInsights(req.user.id)
      .catch((err) => this.logger.error('트리거 스크래핑 실패', err));
    return { message: '인사이트 생성을 시작했습니다. 잠시 후 새로고침 해주세요.' };
  }
}
