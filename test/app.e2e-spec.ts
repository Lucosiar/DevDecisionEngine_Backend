import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

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
        expect(response.body).toMatchObject({
          priority: 'HIGH',
        });
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
        expect(response.body).toHaveLength(3);
        expect(response.body[0]).toMatchObject({
          priority: 'HIGH',
        });
      });
  });

  it('/generate-issue (POST)', () => {
    return request(app.getHttpServer())
      .post('/generate-issue')
      .send({
        problem: 'Null pointer in dashboard',
        cause: 'Missing guard clause',
        solution: 'Validate before rendering',
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
        ].join('\n'),
      });
  });
});
