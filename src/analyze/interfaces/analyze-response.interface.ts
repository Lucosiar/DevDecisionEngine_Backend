export type AnalyzePriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AnalyzeFinding {
  problem: string;
  cause: string;
  impact: string;
  priority: AnalyzePriority;
  solution: string;
  nextAction: string;
  confidence: number;
}

export interface AnalyzeResponse extends AnalyzeFinding {
  summary: string;
  findings: AnalyzeFinding[];
  mode: 'error' | 'repository';
}
