import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TurnstileAccessLog } from './turnstile-access-log.entity';
import { TurnstileController } from './turnstile.controller';
import { TurnstileService } from './turnstile.service';

@Module({
  imports: [TypeOrmModule.forFeature([TurnstileAccessLog])],
  controllers: [TurnstileController],
  providers: [TurnstileService],
})
export class TurnstileModule {}
