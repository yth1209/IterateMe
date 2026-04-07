import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DailyInsight, InsightCategory } from './entities/daily-insight.entity';
import { User } from '../users/entities/user.entity';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    @InjectRepository(DailyInsight)
    private readonly insightRepo: Repository<DailyInsight>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly aiService: AiService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyScraping() {
    this.logger.log('일일 인사이트 생성 시작...');
    const users = await this.userRepo.find();
    for (const user of users) {
      await this.generateAllInsights(user.id);
    }
    this.logger.log('일일 인사이트 생성 완료.');
  }

  async getInsights(
    userId: number,
    categories: string | string[] | undefined,
    page: string,
    limit: string,
  ) {
    const take = Math.min(parseInt(limit) || 10, 50);
    const skip = (parseInt(page) - 1) * take;

    const where: any = { user: { id: userId } };
    if (categories) {
      const categoryFilter = (Array.isArray(categories)
        ? categories
        : categories.split(',')
      ).filter(Boolean) as InsightCategory[];
      if (categoryFilter.length > 0) {
        where.category = In(categoryFilter);
      }
    }

    const [items, total] = await this.insightRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take,
      skip,
    });

    return {
      items,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / take),
    };
  }

  async generateAllInsights(userId: number): Promise<void> {
    await Promise.all([
      this.scrapeCompanyTrends(userId),
      this.generateVibeCodingInsight(userId),
      this.generateCSEInsight(userId),
    ]);
  }

  private async getExistingTitles(userId: number, category: InsightCategory): Promise<string[]> {
    const existing = await this.insightRepo.createQueryBuilder('i')
      .select('i.originalTitle', 'originalTitle')
      .where('i.user_id = :userId', { userId })
      .andWhere('i.category = :category', { category })
      .orderBy('i.createdAt', 'DESC')
      .getRawMany();
    return existing.map((i) => i.originalTitle);
  }

  private async scrapeCompanyTrends(userId: number): Promise<void> {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) return;

      // 채용 공고 샘플 데이터 (실제 운영 시 axios 크롤링으로 교체)
      const jobPostings = [
        '[토스] 백엔드 개발자 (경력) — Kafka, gRPC 대용량 트래픽 처리',
        '[카카오] 서버 개발자 — Spring, Java, K8s',
        '[당근마켓] 시니어 플랫폼 엔지니어 — Golang, AWS 아키텍처',
      ].join('\n');

      const existingTitles = await this.getExistingTitles(userId, InsightCategory.COMPANY_TRENDS);
      const exclusionNote = existingTitles.length > 0
        ? `\n[중요] 아래 목록에 이미 다뤄진 주제는 제외하고 새로운 주제를 선택할 것:\n${existingTitles.join('\n')}`
        : '';

      const prompt = `취준생/주니어 서버 개발자 관점에서 국내 IT 기업 채용 동향을 분석한 블로그 포스팅을 작성해줘.
제목 1줄 + 본문 500자 이상. 이미 잘 알려진 뻔한 내용보다 새로운 시각이나 인사이트를 담아줘.
출력 형식: {"title": "제목", "body": "본문 전체"}
[아래는 최근 채용 공고 내용]:
${jobPostings}${exclusionNote}`;

      const raw = await this.aiService.generateContent(prompt);
      const parsed = this.parseJsonResponse(raw);

      const insight = this.insightRepo.create({
        user,
        category: InsightCategory.COMPANY_TRENDS,
        source: 'Wanted',
        originalTitle: parsed.title,
        body: parsed.body,
        url: 'https://wanted.co.kr',
      });
      await this.insightRepo.save(insight);
      this.logger.log(`기업 동향 인사이트 생성 완료 (userId: ${userId})`);
    } catch (e) {
      this.logger.error(`기업 동향 인사이트 생성 실패 (userId: ${userId})`, e);
    }
  }

  private async generateVibeCodingInsight(userId: number): Promise<void> {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) return;

      const existingTitles = await this.getExistingTitles(userId, InsightCategory.VIBE_CODING);
      const exclusionNote = existingTitles.length > 0
        ? `\n[중요] 아래 목록에 이미 다뤄진 주제는 제외하고 새로운 주제를 선택할 것:\n${existingTitles.join('\n')}`
        : '';

      const prompt = `바이브 코딩(Vibe Coding) 관련 블로그 포스팅을 작성해줘.
단순 공식 문서 요약이 아닌, 실제 개발자들의 노하우, 팁, 경험담, 도구 활용법을 포함해.
제목 1줄 + 본문 500자 이상.
출력 형식: {"title": "제목", "body": "본문 전체"}${exclusionNote}`;

      const raw = await this.aiService.generateContent(prompt);
      const parsed = this.parseJsonResponse(raw);

      const insight = this.insightRepo.create({
        user,
        category: InsightCategory.VIBE_CODING,
        source: 'AI 생성',
        originalTitle: parsed.title,
        body: parsed.body,
        url: '',
      });
      await this.insightRepo.save(insight);
      this.logger.log(`바이브 코딩 인사이트 생성 완료 (userId: ${userId})`);
    } catch (e) {
      this.logger.error(`바이브 코딩 인사이트 생성 실패 (userId: ${userId})`, e);
    }
  }

  private async generateCSEInsight(userId: number): Promise<void> {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) return;

      const existingTitles = await this.getExistingTitles(userId, InsightCategory.CSE);
      const exclusionNote = existingTitles.length > 0
        ? `\n[중요] 아래 목록에 이미 다뤄진 주제는 제외하고 새로운 주제를 선택할 것:\n${existingTitles.join('\n')}`
        : '';

      const prompt = `서버 개발자 면접 대비 또는 실무에 유용한 CS 지식 블로그 포스팅을 작성해줘.
OS, 네트워크, DB, 자료구조, 서버 아키텍처, 인프라, 데이터 엔지니어링 중 1주제 선택.
제목 1줄 + 본문 500자 이상. 기초 개념도 좋고 최신 트렌드도 좋음.
출력 형식: {"title": "제목", "body": "본문 전체"}${exclusionNote}`;

      const raw = await this.aiService.generateContent(prompt);
      const parsed = this.parseJsonResponse(raw);

      const insight = this.insightRepo.create({
        user,
        category: InsightCategory.CSE,
        source: 'AI 생성',
        originalTitle: parsed.title,
        body: parsed.body,
        url: '',
      });
      await this.insightRepo.save(insight);
      this.logger.log(`CSE 인사이트 생성 완료 (userId: ${userId})`);
    } catch (e) {
      this.logger.error(`CSE 인사이트 생성 실패 (userId: ${userId})`, e);
    }
  }

  private parseJsonResponse(raw: string): { title: string; body: string } {
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : raw);
      return { title: parsed.title || '제목 없음', body: parsed.body || raw };
    } catch {
      // JSON 파싱 실패 시 첫 줄을 제목으로 나머지를 본문으로
      const lines = raw.trim().split('\n');
      return { title: lines[0] || '제목 없음', body: lines.slice(1).join('\n') || raw };
    }
  }
}
