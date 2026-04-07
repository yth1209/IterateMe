import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as cheerio from 'cheerio';
// import axios from 'axios';
import { DailyInsight } from './entities/daily-insight.entity';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    @InjectRepository(DailyInsight)
    private readonly insightRepo: Repository<DailyInsight>,
    private readonly aiService: AiService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyScraping() {
    this.logger.log('일일 기술 트렌드 및 채용 정보 스크래핑 시작...');
    await this.scrapeWanted();
    await this.scrapeProgrammers();
    await this.scrapeJobKorea();
    this.logger.log('스크래핑 파이프라인 및 데이터 저장 완료.');
  }

  private async scrapeWanted() {
    try {
      // 실제 구현 시: const { data } = await axios.get('...'); 로 원티드 JSON/HTML 수집
      const sampleHtml = '<div><h2>[토스] 백엔드 개발자 (경력)</h2><p>Kafka, gRPC 대용량 트래픽 처리</p></div>';
      const $ = cheerio.load(sampleHtml);
      const title = $('h2').text();
      const content = $('p').text();
      
      const summary = await this.aiService.generateContent(`이 채용 공고를 백엔드 취준생/주니어 관점에서 배울 점 위주로 1줄 요약해줘: ${title} - ${content}`);
      const insight = this.insightRepo.create({ source: 'Wanted', originalTitle: title, summary, url: 'https://wanted.co.kr/test' });
      await this.insightRepo.save(insight);
      this.logger.log('원티드 스크래핑 완료');
    } catch (e) {
      this.logger.error('원티드 스크래핑 실패', e);
    }
  }

  private async scrapeProgrammers() {
    try {
      const sampleHtml = '<div><h2>[카카오] 서버 개발자</h2><p>Spring, Java, K8s</p></div>';
      const $ = cheerio.load(sampleHtml);
      const title = $('h2').text();
      const content = $('p').text();
      
      const summary = await this.aiService.generateContent(`이 채용 공고를 핵심 기술 위주로 1줄 요약 요망: ${title} - ${content}`);
      const insight = this.insightRepo.create({ source: 'Programmers', originalTitle: title, summary, url: 'https://programmers.co.kr/test' });
      await this.insightRepo.save(insight);
      this.logger.log('프로그래머스 스크래핑 완료');
    } catch (e) {
      this.logger.error('프로그래머스 스크래핑 실패', e);
    }
  }

  private async scrapeJobKorea() {
    try {
      const sampleHtml = '<div><h2>[당근마켓] 시니어 플랫폼 엔지니어</h2><p>Golang, AWS 아키텍처</p></div>';
      const $ = cheerio.load(sampleHtml);
      const title = $('h2').text();
      const content = $('p').text();
      
      const summary = await this.aiService.generateContent(`해당 직무 요구사항 요약: ${title} - ${content}`);
      const insight = this.insightRepo.create({ source: 'JobKorea', originalTitle: title, summary, url: 'https://jobkorea.co.kr/test' });
      await this.insightRepo.save(insight);
      this.logger.log('잡코리아 스크래핑 완료');
    } catch (e) {
      this.logger.error('잡코리아 스크래핑 실패', e);
    }
  }
}
