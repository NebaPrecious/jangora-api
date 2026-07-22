import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

export enum ExpenseCategory {
  FOOD = 'Food',
  TRANSPORT = 'Transport',
  BILLS = 'Bills',
  HEALTH = 'Health',
  ENTERTAINMENT = 'Entertainment',
  SHOPPING = 'Shopping',
  OTHER = 'Other',
}

export enum ExpenseRecurrenceType {
  DAILY = 'Daily',
  WEEKLY = 'Weekly',
  MONTHLY = 'Monthly',
}

@Entity('expenses')
@Index('IDX_expenses_user_date', ['userId', 'date'])
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string;

  @Column({ length: 3 })
  currency!: string;

  @Column({ type: 'enum', enum: ExpenseCategory })
  category!: ExpenseCategory;

  @Column({ type: 'timestamptz' })
  date!: Date;

  @Column({ type: 'varchar', length: 240, nullable: true })
  note!: string | null;

  @Column({ default: false })
  isRecurring!: boolean;

  @Column({ type: 'enum', enum: ExpenseRecurrenceType, nullable: true })
  recurrenceType!: ExpenseRecurrenceType | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
