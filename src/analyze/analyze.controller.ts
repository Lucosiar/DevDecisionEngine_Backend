import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AnalyzeService } from './analyze.service';
import { AnalyzeRequestDto } from './dto/analyze-request.dto';
import type { AnalyzeResponse } from './interfaces/analyze-response.interface';
import type { AnalyzeRepository } from './interfaces/analyze-repository.interface';
import { GenerateIssueRequestDto } from './dto/generate-issue-request.dto';
import type { GenerateIssueResponse } from './interfaces/generate-issue-response.interface';

@Controller()
export class AnalyzeController {
  constructor(private readonly analyzeService: AnalyzeService) {}

  @Get('analyze/repositories')
  repositories(): AnalyzeRepository[] {
    return this.analyzeService.listRepositories();
  }

  @Post('analyze')
  @HttpCode(200)
  analyze(@Body() payload: AnalyzeRequestDto): Promise<AnalyzeResponse> {
    return this.analyzeService.analyze(payload);
  }

  @Post('analyze/demo')
  @HttpCode(200)
  demo(): AnalyzeResponse[] {
    return this.analyzeService.getDemoAnalyses();
  }

  @Post('generate-issue')
  @HttpCode(200)
  generateIssue(
    @Body() payload: GenerateIssueRequestDto,
  ): GenerateIssueResponse {
    return this.analyzeService.generateIssue(payload);
  }
}
