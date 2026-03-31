import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface AnalyzeAssertionBody {
  priority: string;
  nextAction: string;
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/analyze (POST)', () => {
    return request(app.getHttpServer())
      .post('/analyze')
      .send({
        repo: 'demo-repo',
        error: 'TypeError: Cannot read properties of undefined (reading "map")',
      })
      .expect(200)
      .expect((response) => {
        expectAnalyzeBody(response.body);
      });
  });

  it('/analyze/repositories (GET)', () => {
    return request(app.getHttpServer())
      .get('/analyze/repositories')
      .expect(200)
      .expect([
        {
          id: 'lucosiar-devdecisionengine-demo',
          name: 'Lucosiar/DevDecisionEngine_Demo',
          url: 'https://github.com/Lucosiar/DevDecisionEngine_Demo.git',
        },
      ]);
  });

  it('/analyze/demo (POST)', () => {
    return request(app.getHttpServer())
      .post('/analyze/demo')
      .expect(200)
      .expect((response) => {
        expectAnalyzeArrayBody(response.body);
      });
  });

  it('/generate-issue (POST)', () => {
    return request(app.getHttpServer())
      .post('/generate-issue')
      .send({
        problem: 'Null pointer in dashboard',
        cause: 'Missing guard clause',
        solution: 'Validate before rendering',
        nextAction: 'Create a failing test before applying the fix',
      })
      .expect(200)
      .expect({
        title: '[Dev Decision Engine] Null pointer in dashboard',
        description: [
          '## Problem',
          'Null pointer in dashboard',
          '',
          '## Cause',
          'Missing guard clause',
          '',
          '## Proposed Solution',
          'Validate before rendering',
          '',
          '## Next Action',
          'Create a failing test before applying the fix',
        ].join('\n'),
      });
  });
});

function expectAnalyzeBody(body: unknown): void {
  const finding = body as Partial<AnalyzeAssertionBody>;

  expect(finding.priority).toBe('HIGH');
  expect(typeof finding.nextAction).toBe('string');
}

function expectAnalyzeArrayBody(body: unknown): void {
  expect(Array.isArray(body)).toBe(true);

  const findings = body as AnalyzeAssertionBody[];
  expect(findings).toHaveLength(3);
  expect(findings[0]?.priority).toBe('HIGH');
  expect(typeof findings[0]?.nextAction).toBe('string');
}
