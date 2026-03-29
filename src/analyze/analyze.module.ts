import { Module } from '@nestjs/common';
import { AnalyzeController } from './analyze.controller';
import { AnalyzeService } from './analyze.service';
import { AiModule } from '../ai/ai.module';
import { RepositoryContextService } from './repository-context.service';

@Module({
  imports: [AiModule],
  controllers: [AnalyzeController],
  providers: [AnalyzeService, RepositoryContextService],
  exports: [AnalyzeService],
})
export class AnalyzeModule {}
