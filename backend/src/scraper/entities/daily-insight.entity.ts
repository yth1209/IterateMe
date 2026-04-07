import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('daily_insights')
export class DailyInsight {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  source: string;

  @Column({ type: 'text' })
  originalTitle: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'text' })
  url: string;

  @CreateDateColumn()
  createdAt: Date;
}
