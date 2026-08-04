export enum CategoriaRechazo {
  INFORMACION_INCOMPLETA = 'INFORMACION_INCOMPLETA',
  DOCUMENTO_INCORRECTO = 'DOCUMENTO_INCORRECTO',
  FIRMA_FALTANTE = 'FIRMA_FALTANTE',
  EVIDENCIA_FALTANTE = 'EVIDENCIA_FALTANTE',
  FOTOGRAFIA_INVALIDA = 'FOTOGRAFIA_INVALIDA',
  FOTOGRAFIA_BORROSA = 'FOTOGRAFIA_BORROSA',
  UBICACION_INCORRECTA = 'UBICACION_INCORRECTA',
  BENEFICIARIO_INCORRECTO = 'BENEFICIARIO_INCORRECTO',
  ASOCIACION_INCORRECTA = 'ASOCIACION_INCORRECTA',
  INCONSISTENCIA_FORMULARIO_DOCUMENTO = 'INCONSISTENCIA_FORMULARIO_DOCUMENTO',
  OTRO = 'OTRO',
}

export const ETIQUETAS_CATEGORIA_RECHAZO: Record<CategoriaRechazo, string> = {
  [CategoriaRechazo.INFORMACION_INCOMPLETA]: 'Información incompleta',
  [CategoriaRechazo.DOCUMENTO_INCORRECTO]: 'Documento incorrecto',
  [CategoriaRechazo.FIRMA_FALTANTE]: 'Firma faltante',
  [CategoriaRechazo.EVIDENCIA_FALTANTE]: 'Evidencia faltante',
  [CategoriaRechazo.FOTOGRAFIA_INVALIDA]: 'Fotografía inválida',
  [CategoriaRechazo.FOTOGRAFIA_BORROSA]: 'Fotografía borrosa',
  [CategoriaRechazo.UBICACION_INCORRECTA]: 'Ubicación incorrecta',
  [CategoriaRechazo.BENEFICIARIO_INCORRECTO]: 'Beneficiario incorrecto',
  [CategoriaRechazo.ASOCIACION_INCORRECTA]: 'Asociación incorrecta',
  [CategoriaRechazo.INCONSISTENCIA_FORMULARIO_DOCUMENTO]:
    'Inconsistencia entre formulario y documento',
  [CategoriaRechazo.OTRO]: 'Otro',
};
