export class UpdateUserPreferencesDto {
  primaryGoals?: string[];
  preferredCurrency?: string;
  incomeRange?: string | null;
  notificationPreferences?: string[];
  onboardingCompleted?: boolean;
}
