import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { RedisSaludIndicator } from './redis-salud.indicator';
import { SaludController } from './salud.controller';

@Module({
  imports: [TerminusModule],
  controllers: [SaludController],
  providers: [RedisSaludIndicator],
})
export class SaludModule {}
