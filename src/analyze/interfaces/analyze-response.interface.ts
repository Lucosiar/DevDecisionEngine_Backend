export type AnalyzePriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AnalyzeResponse {
  problem: string;
  cause: string;
  impact: string;
  priority: AnalyzePriority;
  solution: string;
}
