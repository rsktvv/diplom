import { Controller, Post, Body } from '@nestjs/common';
import { TelegramAuthService } from './telegram-auth.service';
import { TelegramAuthDto } from './dto/telegram-auth.dto';

@Controller('telegram-auth')
export class TelegramAuthController {
  constructor(private readonly telegramAuthService: TelegramAuthService) {}

  @Post('login')
  login(@Body() dto: TelegramAuthDto) {
    return this.telegramAuthService.login(dto);
  }
}
