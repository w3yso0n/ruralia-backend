import { PartialType } from '@nestjs/swagger';
import { CrearProyectoDto } from './crear-proyecto.dto';

export class ActualizarProyectoDto extends PartialType(CrearProyectoDto) {}
