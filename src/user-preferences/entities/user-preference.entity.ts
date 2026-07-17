import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

@Entity('user_preferences')
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  primaryGoals!: string[];

  @Column({ default: 'XAF' })
  preferredCurrency!: string;

  @Column({ type: 'varchar', nullable: true })
  incomeRange!: string | null;

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  notificationPreferences!: string[];

  @Column({ default: 'English' })
  language!: string;

  @Column({ type: 'decimal', nullable: true })
  monthlyIncome!: number;

  @Column({ nullable: true })
  primaryGoal!: string;

  @Column({ default: true })
  notificationsEnabled!: boolean;

  @Column({ default: true })
  dailyExpenseReminder!: boolean;

  @Column({ default: true })
  dailySavingsReminder!: boolean;

  @Column({ default: true })
  budgetAlertsEnabled!: boolean;

  @Column({ nullable: true })
  quietHoursStart!: string;

  @Column({ nullable: true })
  quietHoursEnd!: string;

  @Column({ default: false })
  darkMode!: boolean;

  @Column({ default: false })
  onboardingCompleted!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
