import { Test, TestingModule } from '@nestjs/testing';
import { AnalyzeService } from './analyze.service';
import { AiService } from '../ai/ai.service';
import { RepositoryContextService } from './repository-context.service';

describe('AnalyzeService', () => {
  let service: AnalyzeService;
  let aiService: {
    isConfigured: jest.Mock<boolean, []>;
    analyzeError: jest.Mock;
  };
  let repositoryContextService: {
    isRepositoryEmpty: jest.Mock<Promise<boolean>, [string]>;
  };

  const aiResponse = {
    problem: 'problem',
    cause: 'cause',
    impact: 'impact',
    priority: 'HIGH' as const,
    solution: 'solution',
    confidence: 93,
  };

  beforeEach(async () => {
    aiService = {
      isConfigured: jest.fn().mockReturnValue(true),
      analyzeError: jest.fn().mockResolvedValue(aiResponse),
    };

    repositoryContextService = {
      isRepositoryEmpty: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyzeService,
        {
          provide: AiService,
          useValue: aiService,
        },
        {
          provide: RepositoryContextService,
          useValue: repositoryContextService,
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
    const result = await service.analyze({
      repo: 'demo-repo',
      error: 'TypeError: cannot read properties of undefined',
    });

    expect(aiService.analyzeError).toHaveBeenCalledWith({
      repo: 'demo-repo',
      error: 'TypeError: cannot read properties of undefined',
    });
    expect(result).toEqual(aiResponse);
  });

  it('returns an explicit response when the repository is empty and there is no error', async () => {
    repositoryContextService.isRepositoryEmpty.mockResolvedValue(true);

    const result = await service.analyze({
      repo: 'https://github.com/example/empty-repo.git',
    });

    expect(repositoryContextService.isRepositoryEmpty).toHaveBeenCalledWith(
      'https://github.com/example/empty-repo.git',
    );
    expect(aiService.analyzeError).not.toHaveBeenCalled();
    expect(result).toEqual({
      problem: 'El repositorio esta vacio',
      cause:
        'GitHub indica que el repositorio no tiene archivos fuente ni una rama por defecto lista para analizar.',
      impact:
        'No se puede hacer un analisis tecnico del codigo porque actualmente no hay codigo que inspeccionar.',
      priority: 'LOW',
      solution:
        'Sube contenido al repositorio https://github.com/example/empty-repo.git o proporciona un stacktrace real si quieres analizar un error concreto.',
      confidence: 98,
    });
  });

  it('returns fallback when OpenAI is not configured', async () => {
    aiService.isConfigured.mockReturnValue(false);

    const result = await service.analyze({});

    expect(aiService.analyzeError).not.toHaveBeenCalled();
    expect(result.priority).toBe('MEDIUM');
    expect(result.confidence).toBe(35);
  });

  it('returns fallback when AI analysis fails', async () => {
    aiService.analyzeError.mockRejectedValue(new Error('boom'));

    const result = await service.analyze({});

    expect(result.priority).toBe('MEDIUM');
    expect(result.confidence).toBe(35);
  });

  it('builds issue content', () => {
    const result = service.generateIssue({
      problem: 'Null pointer in dashboard',
      cause: 'Missing guard clause',
      solution: 'Validate the payload before rendering',
    });

    expect(result.title).toContain('Null pointer in dashboard');
    expect(result.description).toContain('## Problem');
  });
});
