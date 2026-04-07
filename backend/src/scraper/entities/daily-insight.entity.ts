import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum InsightCategory {
  COMPANY_TRENDS = 'company_trends',
  VIBE_CODING    = 'vibe_coding',
  CSE            = 'cse',
}

@Entity('daily_insights')
export class DailyInsight {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: InsightCategory, default: InsightCategory.COMPANY_TRENDS })
  category: InsightCategory;

  @Column()
  source: string;

  @Column({ type: 'text' })
  originalTitle: string;

  @Column({ type: 'longtext' })
  body: string;

  @Column({ type: 'text' })
  url: string;

  @CreateDateColumn()
  createdAt: Date;
}
