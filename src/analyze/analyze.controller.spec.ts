import { Test, TestingModule } from '@nestjs/testing';
import { AnalyzeController } from './analyze.controller';
import { AnalyzeService } from './analyze.service';

describe('AnalyzeController', () => {
  let controller: AnalyzeController;
  let service: AnalyzeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyzeController],
      providers: [AnalyzeService],
    }).compile();

    controller = module.get<AnalyzeController>(AnalyzeController);
    service = module.get<AnalyzeService>(AnalyzeService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates analysis to the service', () => {
    const spy = jest.spyOn(service, 'analyzeError');
    const payload = {
      error: "TypeError: Cannot read property 'map' of undefined",
    };

    const response = controller.analyze(payload);

    expect(spy).toHaveBeenCalledWith(payload.error);
    expect(response.priority).toBe('HIGH');
  });
});
