import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return true;
  }
}
