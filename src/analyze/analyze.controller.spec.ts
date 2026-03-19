import { Test, TestingModule } from '@nestjs/testing';
import { AnalyzeController } from './analyze.controller';
import { AnalyzeService } from './analyze.service';
import { AnalyzeResponse } from './interfaces/analyze-response.interface';

describe('AnalyzeController', () => {
  let controller: AnalyzeController;
  let service: AnalyzeService;

  const mockResponse: AnalyzeResponse = {
    problem: 'problem',
    cause: 'cause',
    impact: 'impact',
    priority: 'HIGH',
    solution: 'solution',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyzeController],
      providers: [
        {
          provide: AnalyzeService,
          useValue: {
            analyzeError: jest.fn().mockResolvedValue(mockResponse),
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

  it('delegates analysis to the service', async () => {
    const spy = jest.spyOn(service, 'analyzeError');
    const payload = {
      error: "TypeError: Cannot read property 'map' of undefined",
      repositoryUrl: 'https://github.com/Lucosiar/DevDecisionEngine_Demo.git',
    };

    const response = await controller.analyze(payload);

    expect(spy).toHaveBeenCalledWith(payload.error, payload.repositoryUrl);
    expect(response).toEqual(mockResponse);
  });
});
