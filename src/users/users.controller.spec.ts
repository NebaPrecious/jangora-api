import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FirebaseAdminService } from '../firebase-admin/firebase-admin.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
}));

describe('UsersController', () => {
  let controller: UsersController;
  const usersService = {
    findByFirebaseUid: jest.fn(),
    updateUser: jest.fn(),
  };

  beforeEach(async () => {
    usersService.findByFirebaseUid.mockReset();
    usersService.updateUser.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: FirebaseAdminService,
          useValue: {
            verifyIdToken: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return the authenticated PostgreSQL user', async () => {
    const user = { id: 'user-id', firebaseUid: 'firebase-uid' };
    usersService.findByFirebaseUid.mockResolvedValue(user);

    await expect(
      controller.getCurrentUser({ user: { uid: 'firebase-uid' } } as any),
    ).resolves.toEqual(user);
    expect(usersService.findByFirebaseUid).toHaveBeenCalledWith('firebase-uid');
  });

  it('should throw 404 when the authenticated user has not been synchronized', async () => {
    usersService.findByFirebaseUid.mockResolvedValue(null);

    await expect(
      controller.getCurrentUser({ user: { uid: 'firebase-uid' } } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should update only the authenticated user profile', async () => {
    const user = { id: 'user-id', firebaseUid: 'firebase-uid' };
    const updated = { ...user, firstName: 'Ada', lastName: 'Lovelace' };
    usersService.findByFirebaseUid.mockResolvedValue(user);
    usersService.updateUser.mockResolvedValue(updated);

    await expect(
      controller.updateCurrentUser({ user: { uid: 'firebase-uid' } } as any, {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'bad@example.com',
      } as any),
    ).rejects.toThrow();

    await expect(
      controller.updateCurrentUser({ user: { uid: 'firebase-uid' } } as any, {
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    ).resolves.toEqual(updated);
    expect(usersService.updateUser).toHaveBeenCalledWith(user, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      profileImageUrl: undefined,
    });
  });
});
