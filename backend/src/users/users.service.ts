import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { InterviewHistory } from '../interviews/entities/interview-history.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(InterviewHistory)
    private readonly interviewRepo: Repository<InterviewHistory>,
  ) {}

  async findById(id: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return user;
  }

  async getStats(userId: number): Promise<{
    totalStudyDays: number;
    totalSessions: number;
    avgScore: number;
    todayCount: number;
  }> {
    // 전체 훈련 횟수 및 평균 점수
    const all = await this.interviewRepo.find({
      where: { user: { id: userId } },
      select: ['aiScore', 'createdAt'],
    });

    const totalSessions = all.length;
    const avgScore = totalSessions > 0
      ? Math.round(all.reduce((sum, h) => sum + h.aiScore, 0) / totalSessions)
      : 0;

    // 누적 학습일 (DATE 단위 DISTINCT)
    const distinctDaysResult = await this.interviewRepo
      .createQueryBuilder('h')
      .select('COUNT(DISTINCT DATE(h.createdAt))', 'count')
      .where('h.user_id = :userId', { userId })
      .getRawOne();
    const totalStudyDays = parseInt(distinctDaysResult?.count ?? '0');

    // 오늘 훈련 횟수
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = all.filter((h) => new Date(h.createdAt) >= today).length;

    return { totalStudyDays, totalSessions, avgScore, todayCount };
  }

  async updateResume(userId: number, resume: string): Promise<{ resume: string }> {
    await this.userRepo.update(userId, { resume });
    return { resume };
  }

  async getOrCreateDummyUser(): Promise<User> {
    let user = await this.userRepo.findOne({ where: { id: 1 } });
    if (!user) {
      user = this.userRepo.create({
        email: 'test@iterateme.com',
        name: 'Developer',
        resume: 'Java, Spring Boot, MySQL 백엔드 개발 경험 3년. K8s 기반 MSA 전환 경험이 있으며 성능 최적화에 관심이 많습니다.',
      });
      await this.userRepo.save(user);
    }
    return user;
  }
}
