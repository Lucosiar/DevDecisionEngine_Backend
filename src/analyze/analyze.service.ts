import { BadRequestException, Injectable } from '@nestjs/common';
import { AnalyzeResponse } from './interfaces/analyze-response.interface';
import { RepositoryContextService } from './repository-context.service';
import { AnalyzeAiService } from './analyze-ai.service';

@Injectable()
export class AnalyzeService {
  private readonly defaultRepositoryUrl =
    process.env.ANALYZE_REPOSITORY_URL ??
    'https://github.com/Lucosiar/DevDecisionEngine_Demo.git';

  constructor(
    private readonly repositoryContextService: RepositoryContextService,
    private readonly analyzeAiService: AnalyzeAiService,
  ) {}

  async analyzeError(
    error: string,
    repositoryUrl?: string,
  ): Promise<AnalyzeResponse> {
    if (!error?.trim()) {
      throw new BadRequestException('Field "error" is required');
    }

    const normalizedError = error.trim();
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
}
