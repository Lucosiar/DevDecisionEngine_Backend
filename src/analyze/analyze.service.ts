import { Injectable } from '@nestjs/common';
import { AnalyzeResponse } from './interfaces/analyze-response.interface';
import { AiService } from '../ai/ai.service';
import { AnalyzeRepository } from './interfaces/analyze-repository.interface';
import { AnalyzeRequestDto } from './dto/analyze-request.dto';
import { GenerateIssueRequestDto } from './dto/generate-issue-request.dto';
import { GenerateIssueResponse } from './interfaces/generate-issue-response.interface';
import { RepositoryContextService } from './repository-context.service';

@Injectable()
export class AnalyzeService {
  private readonly defaultRepositoryUrl =
    process.env.ANALYZE_REPOSITORY_URL ??
    'https://github.com/Lucosiar/DevDecisionEngine_Demo.git';
  private readonly repositoryAnalysisInstruction =
    'No se proporciono stacktrace. Analiza el repositorio y describe el problema tecnico mas relevante o el siguiente paso recomendado.';

  constructor(
    private readonly aiService: AiService,
    private readonly repositoryContextService: RepositoryContextService,
  ) {}

  listRepositories(): AnalyzeRepository[] {
    const fromEnv = this.parseRepositoriesFromEnv(process.env.ANALYZE_REPOSITORIES);
    const allRepositoryUrls = [...fromEnv, this.defaultRepositoryUrl];
    const uniqueUrls = [...new Set(allRepositoryUrls.map((url) => url.trim()))].filter(
      (url) => url.length > 0,
    );

    return uniqueUrls.map((url) => this.buildRepository(url));
  }

  getDemoAnalyses(): AnalyzeResponse[] {
    return [
      {
        problem: 'Null reference al renderizar la lista de usuarios',
        cause: 'La respuesta del API puede llegar vacia y el componente usa .map() sin validar',
        impact: 'La pantalla principal falla al cargar y bloquea el flujo de soporte',
        priority: 'HIGH',
        solution:
          'Inicializar la coleccion con [] y anadir una guarda antes del renderizado',
        confidence: 95,
      },
      {
        problem: 'Timeout recurrente al consultar el servicio de pagos',
        cause: 'No existe retry ni timeout configurable en el cliente HTTP',
        impact: 'Las operaciones tardan demasiado y aumentan los reintentos manuales',
        priority: 'MEDIUM',
        solution:
          'Configurar timeout explicito, reintentos acotados y observabilidad de latencia',
        confidence: 88,
      },
      {
        problem: 'Migracion rompe compatibilidad con variables de entorno antiguas',
        cause: 'El despliegue espera una clave nueva pero no hay valor por defecto ni validacion',
        impact: 'El servicio puede arrancar con configuracion incompleta y fallar en runtime',
        priority: 'LOW',
        solution:
          'Validar variables al iniciar y mantener compatibilidad temporal con el nombre anterior',
        confidence: 84,
      },
    ];
  }

  async analyze(payload: AnalyzeRequestDto): Promise<AnalyzeResponse> {
    const normalizedError = payload.error?.trim();
    const normalizedRepositoryUrl =
      payload.repo?.trim() ||
      payload.repositoryUrl?.trim() ||
      this.defaultRepositoryUrl;
    const hasReportedError = Boolean(normalizedError);

    if (!hasReportedError) {
      try {
        const repositoryIsEmpty =
          await this.repositoryContextService.isRepositoryEmpty(
            normalizedRepositoryUrl,
          );

        if (repositoryIsEmpty) {
          return this.buildEmptyRepositoryResponse(normalizedRepositoryUrl);
        }
      } catch {
        // If GitHub inspection fails, continue with the normal AI/fallback flow.
      }
    }

    const promptInput = normalizedError || this.repositoryAnalysisInstruction;

    if (!this.aiService.isConfigured()) {
      return this.buildFallbackResponse(promptInput, normalizedRepositoryUrl, hasReportedError);
    }

    try {
      return await this.aiService.analyzeError({
        error: promptInput,
        repo: normalizedRepositoryUrl,
      });
    } catch {
      return this.buildFallbackResponse(promptInput, normalizedRepositoryUrl, hasReportedError);
    }
  }

  generateIssue(payload: GenerateIssueRequestDto): GenerateIssueResponse {
    const problem = this.normalizeIssueField(
      payload.problem,
      'Investigate technical issue reported by Dev Decision Engine',
    );
    const cause = this.normalizeIssueField(
      payload.cause,
      'Root cause still needs confirmation during implementation.',
    );
    const solution = this.normalizeIssueField(
      payload.solution,
      'Implement the suggested fix and validate with regression tests.',
    );

    return {
      title: this.buildIssueTitle(problem),
      description: [
        '## Problem',
        problem,
        '',
        '## Cause',
        cause,
        '',
        '## Proposed Solution',
        solution,
      ].join('\n'),
    };
  }

  private buildFallbackResponse(
    errorOrInstruction: string,
    repositoryUrl?: string,
    hasReportedError = true,
  ): AnalyzeResponse {
    if (!hasReportedError) {
      return {
        problem: 'No se pudo inferir un problema concreto del repositorio',
        cause:
          'No se recibio stacktrace y el analisis automatico del repositorio no produjo suficiente contexto fiable.',
        impact:
          'La respuesta puede ser demasiado generica para priorizar una accion tecnica con confianza alta.',
        priority: 'MEDIUM',
        solution:
          'Aporta un error real, un stacktrace o codigo relevante para obtener un diagnostico mas preciso.',
        confidence: 35,
      };
    }

    return {
      problem: 'Unhandled runtime error while processing application flow',
      cause: `The reported error suggests a missing null check or invalid state before using the failing value. Original error: ${errorOrInstruction}`,
      impact:
        repositoryUrl && repositoryUrl.length > 0
          ? `The issue may block normal execution in the repository ${repositoryUrl}.`
          : 'The issue may break the current feature flow and affect user experience.',
      priority: 'HIGH',
      solution:
        'Add defensive validation around the failing object, reproduce the error locally, and cover the fix with a regression test.',
      confidence: 65,
    };
  }

  private buildEmptyRepositoryResponse(repositoryUrl: string): AnalyzeResponse {
    return {
      problem: 'El repositorio esta vacio',
      cause:
        'GitHub indica que el repositorio no tiene archivos fuente ni una rama por defecto lista para analizar.',
      impact:
        'No se puede hacer un analisis tecnico del codigo porque actualmente no hay codigo que inspeccionar.',
      priority: 'LOW',
      solution:
        `Sube contenido al repositorio ${repositoryUrl} o proporciona un stacktrace real si quieres analizar un error concreto.`,
      confidence: 98,
    };
  }

  private parseRepositoriesFromEnv(input?: string): string[] {
    if (!input) {
      return [];
    }

    return input
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  private buildRepository(url: string): AnalyzeRepository {
    const [owner, repository] = this.extractOwnerAndRepository(url);
    const normalizedRepository = repository.endsWith('.git')
      ? repository.slice(0, -4)
      : repository;

    return {
      id: `${owner}-${normalizedRepository}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      name: `${owner}/${normalizedRepository}`,
      url,
    };
  }

  private extractOwnerAndRepository(url: string): [string, string] {
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== 'github.com') {
        return ['repository', 'custom'];
      }

      const parts = parsed.pathname.split('/').filter((segment) => segment.length > 0);
      if (parts.length < 2) {
        return ['repository', 'custom'];
      }

      return [parts[0], parts[1]];
    } catch {
      return ['repository', 'custom'];
    }
  }

  private buildIssueTitle(problem: string): string {
    const normalized = problem.replace(/\s+/g, ' ').trim();
    const title = normalized.startsWith('[') ? normalized : `[Dev Decision Engine] ${normalized}`;

    if (title.length <= 90) {
      return title;
    }

    return `${title.slice(0, 87).trimEnd()}...`;
  }

  private normalizeIssueField(value: string | undefined, fallback: string): string {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : fallback;
  }
}
