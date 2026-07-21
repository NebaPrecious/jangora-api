import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { FirebaseAdminService } from './firebase-admin.service';

@Module({
  imports: [ConfigModule],
  providers: [FirebaseAdminService, FirebaseAuthGuard],
  exports: [FirebaseAdminService, FirebaseAuthGuard],
})
export class FirebaseAdminModule {}
