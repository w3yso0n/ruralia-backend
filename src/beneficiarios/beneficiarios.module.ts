import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Beneficiario } from './entities/beneficiario.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Beneficiario])],
  exports: [TypeOrmModule],
})
export class BeneficiariosModule {}
