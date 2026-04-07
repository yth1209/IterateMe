import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class AiService implements OnModuleInit {
  private llm: ChatGoogleGenerativeAI;
  private genai: GoogleGenAI;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const model = this.configService.get<string>('AI_MODEL', 'gemini-2.0-flash');

    this.llm = new ChatGoogleGenerativeAI({ apiKey, model });
    this.genai = new GoogleGenAI({ apiKey });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const embeddingModel = this.configService.get<string>('AI_EMBEDDING_MODEL', 'text-embedding-004');
    const response = await this.genai.models.embedContent({
      model: embeddingModel,
      contents: text,
    });
    return response.embeddings?.[0]?.values || [];
  }

  async generateContent(prompt: string): Promise<string> {
    const response = await this.llm.invoke([new HumanMessage(prompt)]);
    return response.content as string;
  }
}
