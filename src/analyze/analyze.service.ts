import { Injectable } from '@nestjs/common';
import { AnalyzeResponse } from './interfaces/analyze-response.interface';
import { RepositoryContextService } from './repository-context.service';
import { AnalyzeAiService } from './analyze-ai.service';
import { AnalyzeRepository } from './interfaces/analyze-repository.interface';

@Injectable()
export class AnalyzeService {
  private readonly defaultRepositoryUrl =
    process.env.ANALYZE_REPOSITORY_URL ??
    'https://github.com/Lucosiar/DevDecisionEngine_Demo.git';
  private readonly defaultAnalysisInstruction =
    'Analyze this repository and identify the most relevant technical issue and next action.';

  constructor(
    private readonly repositoryContextService: RepositoryContextService,
    private readonly analyzeAiService: AnalyzeAiService,
  ) {}

  listRepositories(): AnalyzeRepository[] {
    const fromEnv = this.parseRepositoriesFromEnv(process.env.ANALYZE_REPOSITORIES);
    const allRepositoryUrls = [...fromEnv, this.defaultRepositoryUrl];
    const uniqueUrls = [...new Set(allRepositoryUrls.map((url) => url.trim()))].filter(
      (url) => url.length > 0,
    );

    return uniqueUrls.map((url) => this.buildRepository(url));
  }

  async analyzeError(
    error?: string,
    repositoryUrl?: string,
  ): Promise<AnalyzeResponse> {
    const normalizedError = error?.trim() || this.defaultAnalysisInstruction;
    const normalizedRepositoryUrl = repositoryUrl ?? this.defaultRepositoryUrl;

    if (!this.analyzeAiService.isConfigured()) {
      return this.buildFallbackResponse();
    }

    try {
      const repositoryContext =
        await this.repositoryContextService.loadContext(normalizedRepositoryUrl);

      return await this.analyzeAiService.analyzeWithAi({
        error: normalizedError,
        repositoryUrl: normalizedRepositoryUrl,
        repositoryContext,
      });
    } catch {
      return this.buildFallbackResponse();
    }
  }

  private buildFallbackResponse(): AnalyzeResponse {
    return {
      problem: 'Error al acceder a propiedad de un objeto undefined',
      cause: 'El objeto no esta inicializado antes de usar .map()',
      impact: 'Puede romper la UI y afectar a la experiencia de usuario',
      priority: 'HIGH',
      solution:
        'Anadir validacion previa o valor por defecto antes de usar .map()',
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
}
