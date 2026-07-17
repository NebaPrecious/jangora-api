import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
import { UserPreference } from './entities/user-preference.entity';

export interface DefaultUserPreferences {
  id: null;
  user: User;
  primaryGoals: string[];
  preferredCurrency: string;
  incomeRange: string | null;
  notificationPreferences: string[];
  onboardingCompleted: boolean;
}

@Injectable()
export class UserPreferencesService {
  constructor(
    @InjectRepository(UserPreference)
    private readonly preferencesRepository: Repository<UserPreference>,
  ) {}

  async findByUser(user: User): Promise<UserPreference | null> {
    return this.preferencesRepository.findOne({
      where: { user: { id: user.id } },
      relations: { user: true },
    });
  }

  async getForUser(user: User): Promise<UserPreference | DefaultUserPreferences> {
    const preferences = await this.findByUser(user);
    return preferences ?? this.buildDefaultPreferences(user);
  }

  async upsertForUser(user: User, input: UpdateUserPreferencesDto): Promise<UserPreference> {
    const existing = await this.findByUser(user);
    const preferences = existing ?? this.preferencesRepository.create({ user });

    if (input.primaryGoals !== undefined) {
      preferences.primaryGoals = input.primaryGoals;
      preferences.primaryGoal = input.primaryGoals[0] ?? null;
    }

    if (input.preferredCurrency !== undefined) {
      preferences.preferredCurrency = input.preferredCurrency;
    }

    if (input.incomeRange !== undefined) {
      preferences.incomeRange = input.incomeRange;
    }

    if (input.notificationPreferences !== undefined) {
      preferences.notificationPreferences = input.notificationPreferences;
      preferences.notificationsEnabled = input.notificationPreferences.length > 0;
      preferences.dailyExpenseReminder = input.notificationPreferences.includes('Smart Reminders');
      preferences.dailySavingsReminder = input.notificationPreferences.includes('Savings Goal Alerts');
      preferences.budgetAlertsEnabled = input.notificationPreferences.includes('Weekly Financial Summary');
    }

    if (input.onboardingCompleted !== undefined) {
      preferences.onboardingCompleted = input.onboardingCompleted;
    }

    return this.preferencesRepository.save(preferences);
  }

  private buildDefaultPreferences(user: User): DefaultUserPreferences {
    return {
      id: null,
      user,
      primaryGoals: [],
      preferredCurrency: 'XAF',
      incomeRange: null,
      notificationPreferences: [],
      onboardingCompleted: false,
    };
  }
}
