import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseAdminService } from '../firebase-admin/firebase-admin.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  const firebaseAdminService = {
    verifyIdToken: jest.fn(),
  };
  const usersService = {
    findByFirebaseUid: jest.fn(),
    findByEmail: jest.fn(),
    createUser: jest.fn(),
    updateFirebaseIdentity: jest.fn(),
  };

  beforeEach(async () => {
    firebaseAdminService.verifyIdToken.mockReset();
    usersService.findByFirebaseUid.mockReset();
    usersService.findByEmail.mockReset();
    usersService.createUser.mockReset();
    usersService.updateFirebaseIdentity.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: FirebaseAdminService, useValue: firebaseAdminService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should create a synchronized user on first Firebase login', async () => {
    const createdUser = { id: 'user-id', firebaseUid: 'firebase-uid', email: 'ada@example.com' };
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      picture: 'https://example.com/avatar.png',
    });
    usersService.findByFirebaseUid.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(null);
    usersService.createUser.mockResolvedValue(createdUser);

    await expect(service.firebaseLogin('token')).resolves.toMatchObject({ user: createdUser });
    expect(usersService.createUser).toHaveBeenCalledWith({
      firebaseUid: 'firebase-uid',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      profileImageUrl: 'https://example.com/avatar.png',
      authProvider: 'firebase',
    });
  });

  it('should return an existing user on repeated Firebase UID login', async () => {
    const user = { id: 'user-id', firebaseUid: 'firebase-uid', email: 'ada@example.com' };
    firebaseAdminService.verifyIdToken.mockResolvedValue({ uid: 'firebase-uid', email: 'ada@example.com' });
    usersService.findByFirebaseUid.mockResolvedValue(user);

    await expect(service.firebaseLogin('token')).resolves.toMatchObject({ user });
    expect(usersService.createUser).not.toHaveBeenCalled();
  });

  it('should attach Firebase UID to a matching email user without creating a duplicate', async () => {
    const existingUser = { id: 'user-id', firebaseUid: 'old-uid', email: 'ada@example.com' };
    const updatedUser = { ...existingUser, firebaseUid: 'firebase-uid' };
    firebaseAdminService.verifyIdToken.mockResolvedValue({ uid: 'firebase-uid', email: 'ada@example.com' });
    usersService.findByFirebaseUid.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(existingUser);
    usersService.updateFirebaseIdentity.mockResolvedValue(updatedUser);

    await expect(service.firebaseLogin('token')).resolves.toMatchObject({ user: updatedUser });
    expect(usersService.createUser).not.toHaveBeenCalled();
  });
});
