import { Injectable } from '@nestjs/common';
import {
  AnalyzeFinding,
  AnalyzeResponse,
} from './interfaces/analyze-response.interface';
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
  private readonly maxRepositoryFindings = 5;

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

  getDemoAnalyses(): AnalyzeFinding[] {
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
    let repositoryContext = '';

    if (!hasReportedError) {
      try {
        const repositoryIsEmpty =
          await this.repositoryContextService.isRepositoryEmpty(
            normalizedRepositoryUrl,
          );

        if (repositoryIsEmpty) {
          return this.buildEmptyRepositoryResponse(normalizedRepositoryUrl);
        }

        repositoryContext =
          await this.repositoryContextService.buildAnalysisContext(
            normalizedRepositoryUrl,
          );
      } catch {
        // If GitHub inspection fails, continue with the normal AI/fallback flow.
      }
    }

    if (!this.aiService.isConfigured()) {
      return this.buildFallbackResponse(normalizedRepositoryUrl, hasReportedError);
    }

    try {
      const analysis = await this.aiService.analyzeError({
        error: normalizedError,
        repo: normalizedRepositoryUrl,
        repositoryContext,
        analysisMode: hasReportedError ? 'error' : 'repository',
        maxFindings: hasReportedError ? 1 : this.maxRepositoryFindings,
      });

      return this.buildAnalyzeResponse(
        analysis.summary,
        analysis.findings,
        hasReportedError ? 'error' : 'repository',
      );
    } catch {
      return this.buildFallbackResponse(normalizedRepositoryUrl, hasReportedError);
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
    repositoryUrl?: string,
    hasReportedError = true,
  ): AnalyzeResponse {
    if (hasReportedError) {
      return this.buildAnalyzeResponse(
        'No se pudo validar el analisis asistido, asi que se devuelve un unico hallazgo generico basado en el error reportado.',
        [
          {
            problem: 'Unhandled runtime error while processing application flow',
            cause:
              'The reported error suggests a missing null check or invalid state before using the failing value.',
            impact:
              repositoryUrl && repositoryUrl.length > 0
                ? `The issue may block normal execution in the repository ${repositoryUrl}.`
                : 'The issue may break the current feature flow and affect user experience.',
            priority: 'HIGH',
            solution:
              'Add defensive validation around the failing object, reproduce the error locally, and cover the fix with a regression test.',
            confidence: 65,
          },
        ],
        'error',
      );
    }

    return this.buildAnalyzeResponse(
      'No se pudo completar el analisis automatico del repositorio sin stacktrace.',
      [
        {
          problem: 'No se pudo inferir una lista fiable de errores del repositorio',
          cause:
            'No se recibio stacktrace y el analisis automatico del repositorio no produjo suficiente contexto fiable.',
          impact:
            'La respuesta puede ser demasiado generica para priorizar varias correcciones con confianza alta.',
          priority: 'MEDIUM',
          solution:
            'Configura correctamente la integracion de IA o proporciona un stacktrace real para complementar el analisis automatico del repositorio.',
          confidence: 35,
        },
      ],
      'repository',
    );
  }

  private buildAnalyzeResponse(
    summary: string,
    findings: AnalyzeFinding[],
    mode: 'error' | 'repository',
  ): AnalyzeResponse {
    const normalizedFindings =
      findings.length > 0 ? findings : [this.buildMissingFinding(mode)];
    const primaryFinding = normalizedFindings[0];

    return {
      ...primaryFinding,
      summary,
      findings: normalizedFindings,
      mode,
    };
  }

  private buildMissingFinding(mode: 'error' | 'repository'): AnalyzeFinding {
    if (mode === 'repository') {
      return {
        problem: 'No se encontraron hallazgos concluyentes en el repositorio',
        cause:
          'El contexto inspeccionado no fue suficiente para aislar un error real con confianza aceptable.',
        impact:
          'Puede quedar algun fallo sin diagnosticar hasta contar con mas contexto o un stacktrace reproducible.',
        priority: 'MEDIUM',
        solution:
          'Amplia el contexto analizado del repositorio o agrega un stacktrace para aumentar la precision del diagnostico.',
        confidence: 30,
      };
    }

    return {
      problem: 'No se encontro un hallazgo concluyente a partir del error reportado',
      cause:
        'La informacion entregada no permitio reconstruir una causa tecnica concreta con suficiente confianza.',
      impact:
        'La correccion puede retrasarse hasta contar con un stacktrace mas completo o pasos de reproduccion.',
      priority: 'MEDIUM',
      solution:
        'Comparte un stacktrace completo o codigo relacionado para mejorar el analisis.',
      confidence: 30,
    };
  }

  private buildEmptyRepositoryResponse(repositoryUrl: string): AnalyzeResponse {
    return this.buildAnalyzeResponse(
      'El repositorio seleccionado no contiene codigo para inspeccionar.',
      [
        {
          problem: 'El repositorio esta vacio',
          cause:
            'GitHub indica que el repositorio no tiene archivos fuente ni una rama por defecto lista para analizar.',
          impact:
            'No se puede hacer un analisis tecnico del codigo porque actualmente no hay codigo que inspeccionar.',
          priority: 'LOW',
          solution:
            `Sube contenido al repositorio ${repositoryUrl} o proporciona un stacktrace real si quieres analizar un error concreto.`,
          confidence: 98,
        },
      ],
      'repository',
    );
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
