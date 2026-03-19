import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AnalyzeService } from './analyze.service';
import { AnalyzeRequestDto } from './dto/analyze-request.dto';
import type { AnalyzeResponse } from './interfaces/analyze-response.interface';
import type { AnalyzeRepository } from './interfaces/analyze-repository.interface';

@Controller('analyze')
export class AnalyzeController {
  constructor(private readonly analyzeService: AnalyzeService) {}

  @Get('repositories')
  repositories(): AnalyzeRepository[] {
    return this.analyzeService.listRepositories();
  }

  @Post()
  @HttpCode(200)
  analyze(@Body() payload: AnalyzeRequestDto): Promise<AnalyzeResponse> {
    return this.analyzeService.analyzeError(payload.error, payload.repositoryUrl);
  }
}
