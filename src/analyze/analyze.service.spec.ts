import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AnalyzeService } from './analyze.service';

describe('AnalyzeService', () => {
  let service: AnalyzeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyzeService],
    }).compile();

    service = module.get<AnalyzeService>(AnalyzeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns a structured mock analysis', () => {
    const result = service.analyzeError(
      "TypeError: Cannot read property 'map' of undefined",
    );

    expect(result).toEqual({
      problem: 'Error al acceder a propiedad de un objeto undefined',
      cause: 'El objeto no esta inicializado antes de usar .map()',
      impact: 'Puede romper la UI y afectar a la experiencia de usuario',
      priority: 'HIGH',
      solution:
        'Anadir validacion previa o valor por defecto antes de usar .map()',
    });
  });

  it('throws when error is empty', () => {
    expect(() => service.analyzeError('   ')).toThrow(BadRequestException);
  });
});
