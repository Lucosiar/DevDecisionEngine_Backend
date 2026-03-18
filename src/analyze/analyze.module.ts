import { Module } from '@nestjs/common';
import { AnalyzeController } from './analyze.controller';
import { AnalyzeService } from './analyze.service';

@Module({
  controllers: [AnalyzeController],
  providers: [AnalyzeService]
})
export class AnalyzeModule {}
