import { Injectable } from '@nestjs/common';
import {
  AnalyzePriority,
  AnalyzeResponse,
} from './interfaces/analyze-response.interface';

interface AnalyzeWithAiParams {
  error: string;
  repositoryUrl: string;
  repositoryContext: string;
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>
        | null;
    };
  }>;
}

@Injectable()
export class AnalyzeAiService {
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async analyzeWithAi(params: AnalyzeWithAiParams): Promise<AnalyzeResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Eres un senior software engineer. Analiza el error y el contexto del repositorio. Responde SOLO JSON valido con: problem, cause, impact, priority, solution. priority debe ser HIGH, MEDIUM o LOW.',
          },
          {
            role: 'user',
            content: `Repository URL: ${params.repositoryUrl}
Error reportado:
${params.error}

Contexto del repositorio:
${params.repositoryContext}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'analysis_response',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                problem: { type: 'string' },
                cause: { type: 'string' },
                impact: { type: 'string' },
                priority: {
                  type: 'string',
                  enum: ['HIGH', 'MEDIUM', 'LOW'],
                },
                solution: { type: 'string' },
              },
              required: ['problem', 'cause', 'impact', 'priority', 'solution'],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI request failed (${response.status}): ${errorText}`,
      );
    }

    const payload =
      (await response.json()) as OpenAiChatCompletionResponse;
    const rawContent = payload.choices?.[0]?.message?.content;
    const content = this.extractContent(rawContent);

    if (!content) {
      throw new Error('OpenAI returned an empty response');
    }

    const parsed = JSON.parse(content) as unknown;
    return this.validateAnalyzeResponse(parsed);
  }

  private extractContent(
    content:
      | string
      | Array<{
          type?: string;
          text?: string;
        }>
      | null
      | undefined,
  ): string {
    if (typeof content === 'string') {
      return content;
    }

    if (!Array.isArray(content)) {
      return '';
    }

    const textParts = content
      .map((item) => item.text)
      .filter((item): item is string => typeof item === 'string');

    return textParts.join('\n');
  }

  private validateAnalyzeResponse(value: unknown): AnalyzeResponse {
    if (!this.isObject(value)) {
      throw new Error('Invalid JSON response from OpenAI');
    }

    const problem = this.readString(value.problem, 'problem');
    const cause = this.readString(value.cause, 'cause');
    const impact = this.readString(value.impact, 'impact');
    const solution = this.readString(value.solution, 'solution');
    const priority = this.readPriority(value.priority);

    return {
      problem,
      cause,
      impact,
      priority,
      solution,
    };
  }

  private readString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Field "${field}" must be a non-empty string`);
    }

    return value.trim();
  }

  private readPriority(value: unknown): AnalyzePriority {
    if (value === 'HIGH' || value === 'MEDIUM' || value === 'LOW') {
      return value;
    }

    throw new Error('Field "priority" must be HIGH, MEDIUM or LOW');
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
