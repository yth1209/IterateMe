import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone, PineconeRecord } from '@pinecone-database/pinecone';

@Injectable()
export class PineconeService implements OnModuleInit {
  private pinecone: Pinecone;
  private indexName: string;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.pinecone = new Pinecone({
      apiKey: this.configService.get<string>('PINECONE_API_KEY', ''),
    });
    this.indexName = this.configService.get<string>('PINECONE_INDEX', 'iterateme');
  }

  async upsertVectors(vectors: { id: string; values: number[]; metadata?: any }[]) {
    const index = this.pinecone.index(this.indexName);
    await (index.upsert as any)(vectors);
  }

  async queryVectors(vector: number[], topK: number = 3, filter?: any) {
    const index = this.pinecone.index(this.indexName);
    const result = await index.query({
      vector,
      topK,
      includeMetadata: true,
      filter,
    });
    return result.matches;
  }
}
