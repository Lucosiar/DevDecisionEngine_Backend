import { Test, TestingModule } from '@nestjs/testing';
import { AnalyzeService } from './analyze.service';
import { RepositoryContextService } from './repository-context.service';
import { AnalyzeAiService } from './analyze-ai.service';

describe('AnalyzeService', () => {
  let service: AnalyzeService;
  let repositoryContextService: {
    loadContext: jest.Mock<Promise<string>, [string]>;
  };
  let analyzeAiService: {
    isConfigured: jest.Mock<boolean, []>;
    analyzeWithAi: jest.Mock;
  };

  const aiResponse = {
    problem: 'problem',
    cause: 'cause',
    impact: 'impact',
    priority: 'HIGH' as const,
    solution: 'solution',
  };

  beforeEach(async () => {
    repositoryContextService = {
      loadContext: jest.fn().mockResolvedValue('repo context'),
    };

    analyzeAiService = {
      isConfigured: jest.fn().mockReturnValue(true),
      analyzeWithAi: jest.fn().mockResolvedValue(aiResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyzeService,
        {
          provide: RepositoryContextService,
          useValue: repositoryContextService,
        },
        {
          provide: AnalyzeAiService,
          useValue: analyzeAiService,
        },
      ],
    }).compile();

    service = module.get<AnalyzeService>(AnalyzeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns repository list with default repository', () => {
    const originalEnv = process.env.ANALYZE_REPOSITORIES;
    process.env.ANALYZE_REPOSITORIES =
      'https://github.com/Lucosiar/DevDecisionEngine_Backend.git';

    const repositories = service.listRepositories();

    process.env.ANALYZE_REPOSITORIES = originalEnv;

    expect(repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://github.com/Lucosiar/DevDecisionEngine_Backend.git',
        }),
        expect.objectContaining({
          url: 'https://github.com/Lucosiar/DevDecisionEngine_Demo.git',
        }),
      ]),
    );
  });

  it('returns the AI analysis when integration is configured', async () => {
    const result = await service.analyzeError(
      undefined,
      'https://github.com/Lucosiar/DevDecisionEngine_Demo.git',
    );

    expect(repositoryContextService.loadContext).toHaveBeenCalledWith(
      'https://github.com/Lucosiar/DevDecisionEngine_Demo.git',
    );
    expect(analyzeAiService.analyzeWithAi).toHaveBeenCalled();
    expect(result).toEqual(aiResponse);
  });

  it('returns fallback when OpenAI is not configured', async () => {
    analyzeAiService.isConfigured.mockReturnValue(false);

    const result = await service.analyzeError(undefined);

    expect(repositoryContextService.loadContext).not.toHaveBeenCalled();
    expect(result).toEqual({
      problem: 'Error al acceder a propiedad de un objeto undefined',
      cause: 'El objeto no esta inicializado antes de usar .map()',
      impact: 'Puede romper la UI y afectar a la experiencia de usuario',
      priority: 'HIGH',
      solution:
        'Anadir validacion previa o valor por defecto antes de usar .map()',
    });
  });

  it('returns fallback when AI analysis fails', async () => {
    analyzeAiService.analyzeWithAi.mockRejectedValue(new Error('boom'));

    const result = await service.analyzeError(undefined);

    expect(result.priority).toBe('HIGH');
  });
});
