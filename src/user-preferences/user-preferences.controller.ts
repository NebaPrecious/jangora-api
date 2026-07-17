import { BadRequestException, Body, Controller, Get, NotFoundException, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { UsersService } from '../users/users.service';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
import { UserPreferencesService } from './user-preferences.service';

interface AuthenticatedRequest extends Request {
  user: DecodedIdToken;
}

@Controller('user-preferences')
export class UserPreferencesController {
  constructor(
    private readonly userPreferencesService: UserPreferencesService,
    private readonly usersService: UsersService,
  ) {}

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  async getMyPreferences(@Req() request: AuthenticatedRequest) {
    const user = await this.getAuthenticatedUser(request);
    return this.userPreferencesService.getForUser(user);
  }

  @Put('me')
  @UseGuards(FirebaseAuthGuard)
  async updateMyPreferences(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateUserPreferencesDto,
  ) {
    const user = await this.getAuthenticatedUser(request);
    const input = this.validateUpdateBody(body);
    return this.userPreferencesService.upsertForUser(user, input);
  }

  private async getAuthenticatedUser(request: AuthenticatedRequest) {
    const user = await this.usersService.findByFirebaseUid(request.user.uid);

    if (!user) {
      throw new NotFoundException('Authenticated user has not been synchronized.');
    }

    return user;
  }

  private validateUpdateBody(body: UpdateUserPreferencesDto): UpdateUserPreferencesDto {
    const allowedKeys = [
      'primaryGoals',
      'preferredCurrency',
      'incomeRange',
      'notificationPreferences',
      'onboardingCompleted',
    ];
    const unsupportedKey = Object.keys(body ?? {}).find((key) => !allowedKeys.includes(key));

    if (unsupportedKey) {
      throw new BadRequestException('Unsupported preference field was provided.');
    }

    if (
      body.primaryGoals !== undefined &&
      (!Array.isArray(body.primaryGoals) || !body.primaryGoals.every((goal) => typeof goal === 'string'))
    ) {
      throw new BadRequestException('Primary goals must be a list of text values.');
    }

    if (
      body.preferredCurrency !== undefined &&
      (typeof body.preferredCurrency !== 'string' || !body.preferredCurrency.trim())
    ) {
      throw new BadRequestException('Preferred currency is required.');
    }

    if (body.incomeRange !== undefined && body.incomeRange !== null && typeof body.incomeRange !== 'string') {
      throw new BadRequestException('Income range must be text or empty.');
    }

    if (
      body.notificationPreferences !== undefined &&
      (!Array.isArray(body.notificationPreferences) ||
        !body.notificationPreferences.every((preference) => typeof preference === 'string'))
    ) {
      throw new BadRequestException('Notification preferences must be a list of text values.');
    }

    if (body.onboardingCompleted !== undefined && typeof body.onboardingCompleted !== 'boolean') {
      throw new BadRequestException('Onboarding completed must be true or false.');
    }

    return {
      primaryGoals: body.primaryGoals?.map((goal) => goal.trim()).filter(Boolean),
      preferredCurrency: body.preferredCurrency?.trim(),
      incomeRange: typeof body.incomeRange === 'string' ? body.incomeRange.trim() || null : body.incomeRange,
      notificationPreferences: body.notificationPreferences?.map((preference) => preference.trim()).filter(Boolean),
      onboardingCompleted: body.onboardingCompleted,
    };
  }
}
