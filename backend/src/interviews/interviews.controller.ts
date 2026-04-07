import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { InterviewsService } from './interviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('interviews')
@UseGuards(JwtAuthGuard)
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post('generate')
  async generateQuestions(
    @Req() req: Request & { user: { id: number; email: string } },
    @Body('topic') topic?: string,
    @Body('n') n: number = 5,
  ) {
    const questions = await this.interviewsService.generateQuestions(req.user.id, n || 5, topic);
    return { questions };
  }

  @Post('evaluate')
  async evaluateAnswer(
    @Req() req: Request & { user: { id: number; email: string } },
    @Body() body: { question: string; answer: string },
  ) {
    const result = await this.interviewsService.evaluateAnswer(
      req.user.id,
      body.question,
      body.answer,
    );
    return result;
  }
}
