import { Test, TestingModule } from '@nestjs/testing';
import { AnalyzeService } from './analyze.service';
import { AiService } from '../ai/ai.service';
import { RepositoryContextService } from './repository-context.service';

describe('AnalyzeService', () => {
  let service: AnalyzeService;
  let aiService: {
    isConfigured: jest.MockedFunction<() => boolean>;
    analyzeError: jest.MockedFunction<AiService['analyzeError']>;
  };
  let repositoryContextService: {
    isRepositoryEmpty: jest.MockedFunction<
      RepositoryContextService['isRepositoryEmpty']
    >;
    buildAnalysisContext: jest.MockedFunction<
      RepositoryContextService['buildAnalysisContext']
    >;
  };

  const aiFinding = {
    problem: 'problem',
    cause: 'cause',
    impact: 'impact',
    priority: 'HIGH' as const,
    solution: 'solution',
    nextAction: 'next action',
    confidence: 93,
  };
  const aiResponse = {
    summary: 'summary',
    findings: [aiFinding],
  };

  beforeEach(async () => {
    aiService = {
      isConfigured: jest.fn<() => boolean>().mockReturnValue(true),
      analyzeError: jest
        .fn<AiService['analyzeError']>()
        .mockResolvedValue(aiResponse),
    };

    repositoryContextService = {
      isRepositoryEmpty: jest
        .fn<RepositoryContextService['isRepositoryEmpty']>()
        .mockResolvedValue(false),
      buildAnalysisContext: jest
        .fn<RepositoryContextService['buildAnalysisContext']>()
        .mockResolvedValue('repo context'),
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
      repositoryContext: '',
      analysisMode: 'error',
      maxFindings: 1,
    });
    expect(result).toEqual({
      ...aiFinding,
      summary: 'summary',
      findings: [aiFinding],
      mode: 'error',
    });
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
      nextAction:
        'Añade el codigo fuente al repositorio o envía un stacktrace real para poder generar un diagnostico accionable.',
      confidence: 98,
      summary:
        'El repositorio seleccionado no contiene codigo para inspeccionar.',
      findings: [
        {
          problem: 'El repositorio esta vacio',
          cause:
            'GitHub indica que el repositorio no tiene archivos fuente ni una rama por defecto lista para analizar.',
          impact:
            'No se puede hacer un analisis tecnico del codigo porque actualmente no hay codigo que inspeccionar.',
          priority: 'LOW',
          solution:
            'Sube contenido al repositorio https://github.com/example/empty-repo.git o proporciona un stacktrace real si quieres analizar un error concreto.',
          nextAction:
            'Añade el codigo fuente al repositorio o envía un stacktrace real para poder generar un diagnostico accionable.',
          confidence: 98,
        },
      ],
      mode: 'repository',
    });
  });

  it('analyzes repository context and allows multiple findings when the error is empty', async () => {
    aiService.analyzeError.mockResolvedValue({
      summary: 'Se detectaron multiples hallazgos',
      findings: [
        aiFinding,
        {
          problem: 'second problem',
          cause: 'second cause',
          impact: 'second impact',
          priority: 'MEDIUM' as const,
          solution: 'second solution',
          nextAction: 'second next action',
          confidence: 81,
        },
      ],
    });

    const result = await service.analyze({
      repositoryUrl: 'https://github.com/example/demo.git',
    });

    expect(repositoryContextService.buildAnalysisContext).toHaveBeenCalledWith(
      'https://github.com/example/demo.git',
    );
    expect(aiService.analyzeError).toHaveBeenCalledWith({
      error: undefined,
      repo: 'https://github.com/example/demo.git',
      repositoryContext: 'repo context',
      analysisMode: 'repository',
      maxFindings: 5,
    });
    expect(result.findings).toHaveLength(2);
    expect(result.mode).toBe('repository');
    expect(result.problem).toBe('problem');
    expect(result.nextAction).toBe('next action');
  });

  it('returns fallback when OpenAI is not configured', async () => {
    aiService.isConfigured.mockReturnValue(false);

    const result = await service.analyze({});

    expect(aiService.analyzeError).not.toHaveBeenCalled();
    expect(result.mode).toBe('repository');
    expect(result.priority).toBe('MEDIUM');
    expect(result.confidence).toBe(35);
    expect(result.nextAction).toBe(
      'Comparte un stacktrace reproducible o amplía el contexto del repositorio antes de priorizar correcciones.',
    );
  });

  it('returns fallback when AI analysis fails', async () => {
    aiService.analyzeError.mockRejectedValue(new Error('boom'));

    const result = await service.analyze({});

    expect(result.mode).toBe('repository');
    expect(result.priority).toBe('MEDIUM');
    expect(result.confidence).toBe(35);
    expect(result.nextAction).toBe(
      'Comparte un stacktrace reproducible o amplía el contexto del repositorio antes de priorizar correcciones.',
    );
  });

  it('builds issue content', () => {
    const result = service.generateIssue({
      problem: 'Null pointer in dashboard',
      cause: 'Missing guard clause',
      solution: 'Validate the payload before rendering',
      nextAction:
        'Add a regression test that covers the null payload before fixing the render path',
    });

    expect(result.title).toContain('Null pointer in dashboard');
    expect(result.description).toContain('## Problem');
    expect(result.description).toContain('## Next Action');
  });
});
