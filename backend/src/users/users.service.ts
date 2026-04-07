import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findById(id: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return user;
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

