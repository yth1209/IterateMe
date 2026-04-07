import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('interview_history')
export class InterviewHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.interviewHistories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text', nullable: true })
  userAnswer: string;

  @Column({ type: 'int', default: 0 })
  aiScore: number;

  @Column({ type: 'text', nullable: true })
  aiFeedback: string;

  @Column({ default: false })
  isCorrect: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
