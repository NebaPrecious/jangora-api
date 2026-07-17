import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserPreference } from './entities/user-preference.entity';
import { UserPreferencesService } from './user-preferences.service';

describe('UserPreferencesService', () => {
  let service: UserPreferencesService;
  const user = { id: 'user-id' } as any;
  const preferencesRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    preferencesRepository.findOne.mockReset();
    preferencesRepository.create.mockReset();
    preferencesRepository.save.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserPreferencesService,
        {
          provide: getRepositoryToken(UserPreference),
          useValue: preferencesRepository,
        },
      ],
    }).compile();

    service = module.get<UserPreferencesService>(UserPreferencesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return default preferences when none exist', async () => {
    preferencesRepository.findOne.mockResolvedValue(null);

    await expect(service.getForUser(user)).resolves.toMatchObject({
      user,
      primaryGoals: [],
      preferredCurrency: 'XAF',
      incomeRange: null,
      notificationPreferences: [],
      onboardingCompleted: false,
    });
  });

  it('should create preferences when none exist', async () => {
    const created = { user };
    const saved = { id: 'pref-id', user, primaryGoals: ['Save More'] };
    preferencesRepository.findOne.mockResolvedValue(null);
    preferencesRepository.create.mockReturnValue(created);
    preferencesRepository.save.mockResolvedValue(saved);

    await expect(
      service.upsertForUser(user, {
        primaryGoals: ['Save More'],
        preferredCurrency: 'USD',
        notificationPreferences: ['Smart Reminders'],
        onboardingCompleted: true,
      }),
    ).resolves.toEqual(saved);
    expect(preferencesRepository.create).toHaveBeenCalledWith({ user });
    expect(preferencesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        user,
        primaryGoals: ['Save More'],
        preferredCurrency: 'USD',
        notificationsEnabled: true,
      }),
    );
  });

  it('should update the same preferences record on repeat calls', async () => {
    const existing = { id: 'pref-id', user, primaryGoals: [] };
    preferencesRepository.findOne.mockResolvedValue(existing);
    preferencesRepository.save.mockImplementation(async (value) => value);

    const result = await service.upsertForUser(user, {
      primaryGoals: ['Budget Better'],
      preferredCurrency: 'XAF',
    });

    expect(result).toBe(existing);
    expect(preferencesRepository.create).not.toHaveBeenCalled();
    expect(preferencesRepository.save).toHaveBeenCalledWith(existing);
  });
});
