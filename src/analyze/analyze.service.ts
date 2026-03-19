import { BadRequestException, Injectable } from '@nestjs/common';
import { AnalyzeResponse } from './interfaces/analyze-response.interface';

@Injectable()
export class AnalyzeService {
  analyzeError(error: string): AnalyzeResponse {
    if (!error?.trim()) {
      throw new BadRequestException('Field "error" is required');
    }

    return {
      problem: 'Error al acceder a propiedad de un objeto undefined',
      cause: 'El objeto no esta inicializado antes de usar .map()',
      impact: 'Puede romper la UI y afectar a la experiencia de usuario',
      priority: 'HIGH',
      solution:
        'Anadir validacion previa o valor por defecto antes de usar .map()',
    };
  }
}
