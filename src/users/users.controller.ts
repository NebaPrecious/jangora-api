import { BadRequestException, Body, Controller, Get, NotFoundException, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { UpdateCurrentUserDto } from './dto/update-current-user.dto';
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

  @Patch('me')
  @UseGuards(FirebaseAuthGuard)
  async updateCurrentUser(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateCurrentUserDto,
  ) {
    const user = await this.usersService.findByFirebaseUid(request.user.uid);

    if (!user) {
      throw new NotFoundException('Authenticated user has not been synchronized.');
    }

    const input = this.validateUpdateBody(body);
    return this.usersService.updateUser(user, input);
  }

  private validateUpdateBody(body: UpdateCurrentUserDto) {
    const allowedKeys = ['firstName', 'lastName', 'displayName', 'profileImageUrl'];
    const unsupportedKey = Object.keys(body ?? {}).find((key) => !allowedKeys.includes(key));

    if (unsupportedKey) {
      throw new BadRequestException('Unsupported profile field was provided.');
    }

    let firstName = body.firstName;
    let lastName = body.lastName;

    if (body.displayName && firstName === undefined && lastName === undefined) {
      const [first, ...rest] = body.displayName.trim().split(/\s+/);
      firstName = first;
      lastName = rest.join(' ');
    }

    for (const value of [firstName, lastName]) {
      if (value !== undefined && (typeof value !== 'string' || !value.trim())) {
        throw new BadRequestException('Profile names must be non-empty text.');
      }
    }

    if (
      body.profileImageUrl !== undefined &&
      body.profileImageUrl !== null &&
      typeof body.profileImageUrl !== 'string'
    ) {
      throw new BadRequestException('Profile image must be a URL or empty.');
    }

    return {
      firstName: firstName?.trim(),
      lastName: lastName?.trim(),
      profileImageUrl: body.profileImageUrl === undefined ? undefined : body.profileImageUrl,
    };
  }
}
