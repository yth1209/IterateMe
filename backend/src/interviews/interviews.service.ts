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
   * 1. 질문 생성 (Adaptive Questioning)
   */
  async generateQuestion(userId: number, topic: string): Promise<string> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // 기존의 틀렸던 이력 (Vector DB에서 검색)
    // 임의의 검색 쿼리 사용 (예: topic에 대한 일반적인 임베딩 벡터로 검색)
    const topicEmbedding = await this.aiService.generateEmbedding(topic);
    const pastMistakes = await this.pineconeService.queryVectors(topicEmbedding, 3, { userId });
    
    // 프롬프트 작성
    let prompt = `너는 시니어 서버 개발자이자 기술 면접관이야. 다음 주제에 대해 면접 질문을 하나 생성해줘: ${topic}\n`;
    if (user.resume) {
      prompt += `지원자의 이력 내용: ${user.resume}\n(이력과 연관지어서 질문할 것)\n`;
    }
    if (pastMistakes.length > 0) {
      prompt += `지원자가 이전에 틀렸던 개념들: ${pastMistakes.map(m => m.metadata?.question).join(', ')}\n(이러한 취약점을 조금 변형해서 다시 물어보는 Adaptive 질문을 만들어줘)\n`;
    }
    prompt += `형식: [면접 질문만 출력할 것]`;

    const generatedQuestion = await this.aiService.generateContent(prompt);
    return generatedQuestion;
  }

  /**
   * 2. 답변에 대한 채점 및 결과 저장 (AI Grading)
   */
  async evaluateAnswer(userId: number, question: string, answer: string): Promise<InterviewHistory> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // 평가 프롬프트
    const prompt = `너는 시니어 면접관이야. 아래 면접 질문과 지원자의 답변을 평가해줘.
질문: ${question}
답변: ${answer}
출력 형식은 다음 JSON만 출력해.
{"score": (0~100 사이의 점수), "feedback": "(모범 답안 및 상세한 보완점)", "isCorrect": (70점 이상이면 true, 아니면 false)}`;

    const evaluationText = await this.aiService.generateContent(prompt);
    
    // JSON 파싱 (마크다운 등이 섞여 있을 수 있으므로 정규식 처리 필요할 수 있음)
    let parsedEvaluation;
    try {
      const jsonMatch = evaluationText.match(/\{[\s\S]*?\}/);
      parsedEvaluation = JSON.parse(jsonMatch ? jsonMatch[0] : evaluationText);
    } catch (e) {
      // 파싱 실패 시 기본값
      parsedEvaluation = { score: 0, feedback: "평가 처리 중 요류 발생: " + evaluationText, isCorrect: false };
    }

    // DB에 기록
    const history = this.interviewRepo.create({
      user,
      question,
      userAnswer: answer,
      aiScore: parsedEvaluation.score,
      aiFeedback: parsedEvaluation.feedback,
      isCorrect: parsedEvaluation.isCorrect,
    });
    const savedHistory = await this.interviewRepo.save(history);

    // 오답일 경우 Vector DB에 저장하여 추후 Adaptive Questioning에 활용 (RAG)
    if (!parsedEvaluation.isCorrect) {
      const vector = await this.aiService.generateEmbedding(question + ' ' + answer);
      await this.pineconeService.upsertVectors([
        {
          id: `history_${savedHistory.id}`,
          values: vector,
          metadata: { userId, question, isCorrect: false }
        }
      ]);
    }

    return savedHistory;
  }
}
