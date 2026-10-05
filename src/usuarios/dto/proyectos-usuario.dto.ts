import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReemplazarProyectosUsuarioDto {
  @ApiProperty({
    type: [String],
    description:
      'Proyectos donde el usuario queda como personal (reemplaza la lista)',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  proyectoIds: string[];
}

export class ProyectoAsignadoUsuarioDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;
}
