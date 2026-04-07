import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterviewHistory } from './entities/interview-history.entity';
import { User } from '../users/entities/user.entity';
import { InterviewsService } from './interviews.service';
import { InterviewsController } from './interviews.controller';
import { AiModule } from '../ai/ai.module';
import { PineconeModule } from '../pinecone/pinecone.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InterviewHistory, User]),
    AiModule,
    PineconeModule
  ],
  controllers: [InterviewsController],
  providers: [InterviewsService],
  exports: [InterviewsService]
})
export class InterviewsModule {}

