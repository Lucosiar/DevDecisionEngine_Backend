import { Injectable } from '@nestjs/common';
import {
  AnalyzePriority,
  AnalyzeResponse,
} from '../analyze/interfaces/analyze-response.interface';

interface AnalyzeErrorParams {
  error: string;
  repo?: string;
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
export class AiService {
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async analyzeError(params: AnalyzeErrorParams): Promise<AnalyzeResponse> {
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
            role: 'user',
            content: this.buildPrompt(params),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'debug_analysis',
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
                confidence: { type: 'number' },
              },
              required: [
                'problem',
                'cause',
                'impact',
                'priority',
                'solution',
                'confidence',
              ],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${errorText}`);
    }

    const payload = (await response.json()) as OpenAiChatCompletionResponse;
    const rawContent = payload.choices?.[0]?.message?.content;
    const content = this.extractContent(rawContent);

    if (!content) {
      throw new Error('OpenAI returned an empty response');
    }

    const parsed = this.safeParseJson(content);
    return this.validateAnalyzeResponse(parsed);
  }

  private buildPrompt(params: AnalyzeErrorParams): string {
    const sections = [
      'Eres un experto en debugging. Devuelve SOLO JSON valido con:',
      '- problem',
      '- cause',
      '- impact',
      '- priority (HIGH, MEDIUM, LOW)',
      '- solution',
      '- confidence (0-100)',
      '',
      'Analiza este error:',
      params.error,
    ];

    if (params.repo) {
      sections.push('', `Repositorio: ${params.repo}`);
    }
    return sections.join('\n');
  }

  private safeParseJson(content: string): unknown {
    try {
      return JSON.parse(content) as unknown;
    } catch {
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error('OpenAI response is not valid JSON');
      }

      return JSON.parse(content.slice(firstBrace, lastBrace + 1)) as unknown;
    }
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
    const confidence = this.readConfidence(value.confidence);

    return {
      problem,
      cause,
      impact,
      priority,
      solution,
      confidence,
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

  private readConfidence(value: unknown): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new Error('Field "confidence" must be a number');
    }

    if (value < 0 || value > 100) {
      throw new Error('Field "confidence" must be between 0 and 100');
    }

    return Math.round(value);
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
