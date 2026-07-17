import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FirebaseAdminService } from '../firebase-admin/firebase-admin.service';
import { UsersService } from '../users/users.service';
import { UserPreferencesController } from './user-preferences.controller';
import { UserPreferencesService } from './user-preferences.service';

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
}));

describe('UserPreferencesController', () => {
  let controller: UserPreferencesController;
  const user = { id: 'user-id', firebaseUid: 'firebase-uid' };
  const usersService = {
    findByFirebaseUid: jest.fn(),
  };
  const userPreferencesService = {
    getForUser: jest.fn(),
    upsertForUser: jest.fn(),
  };

  beforeEach(async () => {
    usersService.findByFirebaseUid.mockReset();
    userPreferencesService.getForUser.mockReset();
    userPreferencesService.upsertForUser.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserPreferencesController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: UserPreferencesService, useValue: userPreferencesService },
        { provide: FirebaseAdminService, useValue: { verifyIdToken: jest.fn() } },
      ],
    }).compile();

    controller = module.get<UserPreferencesController>(UserPreferencesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return only the authenticated user preferences', async () => {
    const preferences = { preferredCurrency: 'XAF', user };
    usersService.findByFirebaseUid.mockResolvedValue(user);
    userPreferencesService.getForUser.mockResolvedValue(preferences);

    await expect(controller.getMyPreferences({ user: { uid: 'firebase-uid' } } as any)).resolves.toEqual(
      preferences,
    );
    expect(usersService.findByFirebaseUid).toHaveBeenCalledWith('firebase-uid');
    expect(userPreferencesService.getForUser).toHaveBeenCalledWith(user);
  });

  it('should upsert preferences for the authenticated user', async () => {
    const preferences = { preferredCurrency: 'USD', user };
    usersService.findByFirebaseUid.mockResolvedValue(user);
    userPreferencesService.upsertForUser.mockResolvedValue(preferences);

    await expect(
      controller.updateMyPreferences({ user: { uid: 'firebase-uid' } } as any, {
        primaryGoals: ['Save More'],
        preferredCurrency: 'USD',
        incomeRange: null,
        notificationPreferences: [],
        onboardingCompleted: true,
      }),
    ).resolves.toEqual(preferences);
    expect(userPreferencesService.upsertForUser).toHaveBeenCalledWith(user, {
      primaryGoals: ['Save More'],
      preferredCurrency: 'USD',
      incomeRange: null,
      notificationPreferences: [],
      onboardingCompleted: true,
    });
  });

  it('should reject malformed preference payloads', async () => {
    usersService.findByFirebaseUid.mockResolvedValue(user);

    await expect(
      controller.updateMyPreferences({ user: { uid: 'firebase-uid' } } as any, {
        primaryGoals: 'Save More',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should return 404 when the authenticated user is unsynchronized', async () => {
    usersService.findByFirebaseUid.mockResolvedValue(null);

    await expect(controller.getMyPreferences({ user: { uid: 'firebase-uid' } } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
