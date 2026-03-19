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
        repositoryUrl: 'https://github.com/Lucosiar/DevDecisionEngine_Demo.git',
      })
      .expect(200)
      .expect({
        problem: 'Error al acceder a propiedad de un objeto undefined',
        cause: 'El objeto no esta inicializado antes de usar .map()',
        impact: 'Puede romper la UI y afectar a la experiencia de usuario',
        priority: 'HIGH',
        solution:
          'Anadir validacion previa o valor por defecto antes de usar .map()',
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
});
