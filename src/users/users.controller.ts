import { Controller, Get, NotFoundException, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { UsersService } from './users.service';

interface AuthenticatedRequest extends Request {
  user: DecodedIdToken;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  async getCurrentUser(@Req() request: AuthenticatedRequest) {
    const user = await this.usersService.findByFirebaseUid(request.user.uid);

    if (!user) {
      throw new NotFoundException('Authenticated user has not been synchronized.');
    }

    return user;
  }
}
