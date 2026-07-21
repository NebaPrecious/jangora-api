import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { FirebaseAdminModule } from '../firebase-admin/firebase-admin.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), FirebaseAdminModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
