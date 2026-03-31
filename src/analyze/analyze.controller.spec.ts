import { Test, TestingModule } from '@nestjs/testing';
import { AnalyzeController } from './analyze.controller';
import { AnalyzeService } from './analyze.service';
import {
  AnalyzeFinding,
  AnalyzeResponse,
} from './interfaces/analyze-response.interface';
import { AnalyzeRepository } from './interfaces/analyze-repository.interface';

describe('AnalyzeController', () => {
  let controller: AnalyzeController;
  let service: AnalyzeService;

  const mockFinding: AnalyzeFinding = {
    problem: 'problem',
    cause: 'cause',
    impact: 'impact',
    priority: 'HIGH',
    solution: 'solution',
    nextAction: 'next action',
    confidence: 91,
  };
  const mockResponse: AnalyzeResponse = {
    ...mockFinding,
    summary: 'summary',
    findings: [mockFinding],
    mode: 'error',
  };
  const mockRepositories: AnalyzeRepository[] = [
    {
      id: 'lucosiar-devdecisionengine-demo',
      name: 'Lucosiar/DevDecisionEngine_Demo',
      url: 'https://github.com/Lucosiar/DevDecisionEngine_Demo.git',
    },
  ];
  const mockDemoResponses: AnalyzeFinding[] = [mockFinding];
  const mockIssue = {
    title: '[Dev Decision Engine] problem',
    description: 'issue description',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyzeController],
      providers: [
        {
          provide: AnalyzeService,
          useValue: {
            listRepositories: jest.fn().mockReturnValue(mockRepositories),
            analyze: jest.fn().mockResolvedValue(mockResponse),
            getDemoAnalyses: jest.fn().mockReturnValue(mockDemoResponses),
            generateIssue: jest.fn().mockReturnValue(mockIssue),
          },
        },
      ],
    }).compile();

    controller = module.get<AnalyzeController>(AnalyzeController);
    service = module.get<AnalyzeService>(AnalyzeService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns repositories from service', () => {
    const spy = jest.spyOn(service, 'listRepositories');

    const response = controller.repositories();

    expect(spy).toHaveBeenCalled();
    expect(response).toEqual(mockRepositories);
  });

  it('delegates analysis to the service', async () => {
    const spy = jest.spyOn(service, 'analyze');
    const payload = {
      repo: 'demo-repo',
      error: 'TypeError',
    };

    const response = await controller.analyze(payload);

    expect(spy).toHaveBeenCalledWith(payload);
    expect(response).toEqual(mockResponse);
  });

  it('returns demo responses', () => {
    const spy = jest.spyOn(service, 'getDemoAnalyses');

    const response = controller.demo();

    expect(spy).toHaveBeenCalled();
    expect(response).toEqual(mockDemoResponses);
  });

  it('delegates issue generation to the service', () => {
    const spy = jest.spyOn(service, 'generateIssue');
    const payload = {
      problem: 'problem',
      cause: 'cause',
      solution: 'solution',
      nextAction: 'next action',
    };

    const response = controller.generateIssue(payload);

    expect(spy).toHaveBeenCalledWith(payload);
    expect(response).toEqual(mockIssue);
  });
});
