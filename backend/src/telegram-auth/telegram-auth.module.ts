import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramAuthController } from './telegram-auth.controller';
import { TelegramAuthService } from './telegram-auth.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ConfigModule, UsersModule],
  controllers: [TelegramAuthController],
  providers: [TelegramAuthService],
})
export class TelegramAuthModule {}
