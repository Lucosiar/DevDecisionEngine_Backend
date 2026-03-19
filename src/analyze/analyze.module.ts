import { Module } from '@nestjs/common';
import { AnalyzeController } from './analyze.controller';
import { AnalyzeService } from './analyze.service';
import { RepositoryContextService } from './repository-context.service';
import { AnalyzeAiService } from './analyze-ai.service';

@Module({
  controllers: [AnalyzeController],
  providers: [AnalyzeService, RepositoryContextService, AnalyzeAiService]
})
export class AnalyzeModule {}
