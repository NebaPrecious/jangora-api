import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { firebaseUid },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  async createUser(input: {
    firebaseUid: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string | null;
    authProvider: string;
  }): Promise<User> {
    const user = this.userRepository.create({
      firebaseUid: input.firebaseUid,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      profileImageUrl: input.profileImageUrl,
      authProvider: input.authProvider,
      isActive: true,
    });

    return this.userRepository.save(user);
  }

  async updateUser(
    user: User,
    input: {
      firstName?: string;
      lastName?: string;
      profileImageUrl?: string | null;
    },
  ): Promise<User> {
    if (input.firstName !== undefined) {
      user.firstName = input.firstName;
    }

    if (input.lastName !== undefined) {
      user.lastName = input.lastName;
    }

    if (input.profileImageUrl !== undefined) {
      user.profileImageUrl = input.profileImageUrl;
    }

    return this.userRepository.save(user);
  }

  async updateFirebaseIdentity(
    user: User,
    input: {
      firebaseUid: string;
      authProvider: string;
      profileImageUrl?: string | null;
    },
  ): Promise<User> {
    user.firebaseUid = input.firebaseUid;
    user.authProvider = input.authProvider;

    if (!user.profileImageUrl && input.profileImageUrl) {
      user.profileImageUrl = input.profileImageUrl;
    }

    return this.userRepository.save(user);
  }
}
