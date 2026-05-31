import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { UsersService } from '../users/users.service';
import { TelegramAuthDto } from './dto/telegram-auth.dto';

@Injectable()
export class TelegramAuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  verifyTelegramAuth(dto: TelegramAuthDto) {
    const token =
      this.config.get<string>('TELEGRAM_BOT_TOKEN') ||
      this.config.get<string>('BOT_TOKEN');
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN or BOT_TOKEN is missing');

    const { hash, ...data } = dto as any;

    const dataCheckString = Object.keys(data)
      .filter((key) => data[key] !== undefined && data[key] !== null)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('\n');

    const secretKey = createHash('sha256').update(token).digest();
    const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const hashBuffer = Buffer.from(hash, 'hex');
    const calculatedBuffer = Buffer.from(calculatedHash, 'hex');

    if (
      hashBuffer.length !== calculatedBuffer.length ||
      !timingSafeEqual(hashBuffer, calculatedBuffer)
    ) {
      throw new UnauthorizedException('Telegram hash is invalid');
    }

    const authDate = Number(dto.auth_date);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      throw new UnauthorizedException('Telegram auth data is too old');
    }

    return data;
  }

  async login(dto: TelegramAuthDto) {
    const validData = this.verifyTelegramAuth(dto);

    const user = await this.usersService.upsertTelegramUser({
      telegramId: validData.id,
      telegramUsername: validData.username,
      firstName: validData.first_name,
      lastName: validData.last_name,
    });

    return {
      message: 'Telegram login successful',
      user,
    };
  }
}
