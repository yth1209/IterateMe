import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterviewHistory } from './entities/interview-history.entity';
import { User } from '../users/entities/user.entity';
import { AiService } from '../ai/ai.service';
import { PineconeService } from '../pinecone/pinecone.service';

@Injectable()
export class InterviewsService {
  constructor(
    @InjectRepository(InterviewHistory)
    private readonly interviewRepo: Repository<InterviewHistory>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly aiService: AiService,
    private readonly pineconeService: PineconeService,
  ) {}

  /**
   * 1. N개 질문 일괄 생성 (Adaptive Questioning)
   */
  async generateQuestions(userId: number, n: number, topic?: string): Promise<string[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // DB에서 과거 기록 전체 조회
    const history = await this.interviewRepo.find({
      where: { user: { id: userId } },
      select: ['question', 'isCorrect'],
    });

    const correctQuestions = history
      .filter((h) => h.isCorrect)
      .map((h) => h.question);

    const wrongQuestions = history
      .filter((h) => !h.isCorrect)
      .map((h) => h.question);

    // 프롬프트 조립
    let prompt = `너는 시니어 서버 개발자이자 기술 면접관이야.\n`;

    if (topic) {
      prompt += `주제: ${topic}\n`;
    }
    if (user.resume) {
      prompt += `지원자 이력서:\n${user.resume}\n`;
    }
    if (correctQuestions.length > 0) {
      prompt += `\n이미 정확히 아는 주제 (출제 금지):\n${correctQuestions.slice(0, 30).join('\n')}\n`;
    }
    if (wrongQuestions.length > 0) {
      prompt += `\n취약 개념 (변형하여 반드시 포함):\n${wrongQuestions.slice(0, 20).join('\n')}\n`;
    }

    prompt += `\n위 조건을 반영하여 면접 질문 ${n}개를 생성해.
JSON 배열 형태로만 출력: ["질문1", "질문2", ...]`;

    const raw = await this.aiService.generateContent(prompt);
    return this.parseQuestionsArray(raw, n);
  }

  private parseQuestionsArray(raw: string, n: number): string[] {
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(match ? match[0] : raw);
      if (Array.isArray(parsed)) return parsed.slice(0, n);
    } catch {
      // fallback: 줄바꿈 기준 split
      const lines = raw
        .split('\n')
        .map((l) => l.replace(/^[\d\.\-\*\s]+/, '').trim())
        .filter(Boolean);
      if (lines.length > 0) return lines.slice(0, n);
    }
    return [raw.trim()];
  }

  /**
   * 2. 답변에 대한 채점 및 결과 저장 (AI Grading)
   */
  async evaluateAnswer(userId: number, question: string, answer: string): Promise<InterviewHistory> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const prompt = `너는 시니어 면접관이야. 아래 면접 질문과 지원자의 답변을 평가해줘.
질문: ${question}
답변: ${answer}
출력 형식은 다음 JSON만 출력해.
{"score": (0~100 사이의 점수), "feedback": "(모범 답안 및 상세한 보완점)", "isCorrect": (70점 이상이면 true, 아니면 false)}`;

    const evaluationText = await this.aiService.generateContent(prompt);

    let parsedEvaluation;
    try {
      const jsonMatch = evaluationText.match(/\{[\s\S]*?\}/);
      parsedEvaluation = JSON.parse(jsonMatch ? jsonMatch[0] : evaluationText);
    } catch {
      parsedEvaluation = { score: 0, feedback: '평가 처리 중 오류 발생: ' + evaluationText, isCorrect: false };
    }

    const history = this.interviewRepo.create({
      user,
      question,
      userAnswer: answer,
      aiScore: parsedEvaluation.score,
      aiFeedback: parsedEvaluation.feedback,
      isCorrect: parsedEvaluation.isCorrect,
    });
    const savedHistory = await this.interviewRepo.save(history);

    // if (!parsedEvaluation.isCorrect) {
    //   const vector = await this.aiService.generateEmbedding(question + ' ' + answer);
    //   await this.pineconeService.upsertVectors([
    //     {
    //       id: `history_${savedHistory.id}`,
    //       values: vector,
    //       metadata: { userId, question, isCorrect: false },
    //     },
    //   ]);
    // }

    return savedHistory;
  }
}
