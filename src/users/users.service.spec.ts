import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const userRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    userRepository.findOne.mockReset();
    userRepository.create.mockReset();
    userRepository.save.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should update allowed profile fields', async () => {
    const user = { firstName: 'Old', lastName: 'Name', profileImageUrl: null } as User;
    userRepository.save.mockImplementation(async (value) => value);

    await expect(
      service.updateUser(user, {
        firstName: 'New',
        profileImageUrl: 'https://example.com/avatar.png',
      }),
    ).resolves.toEqual({
      firstName: 'New',
      lastName: 'Name',
      profileImageUrl: 'https://example.com/avatar.png',
    });
  });
});
