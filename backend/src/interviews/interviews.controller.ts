import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { InterviewsService } from './interviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('interviews')
@UseGuards(JwtAuthGuard)
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post('generate')
  async generateQuestion(
    @Req() req: Request & { user: { id: number; email: string } },
    @Body('topic') topic: string,
  ) {
    const question = await this.interviewsService.generateQuestion(req.user.id, topic);
    return { question };
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
