import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnalyzeModule } from './analyze/analyze.module';

@Module({
  imports: [AnalyzeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
