import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vereda } from '../territorios/entities/vereda.entity';
import { BeneficiariosController } from './beneficiarios.controller';
import { BeneficiariosService } from './beneficiarios.service';
import { Beneficiario } from './entities/beneficiario.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Beneficiario, Vereda])],
  controllers: [BeneficiariosController],
  providers: [BeneficiariosService],
  exports: [TypeOrmModule, BeneficiariosService],
})
export class BeneficiariosModule {}
