import { readFileSync } from 'node:fs';
import request from 'supertest';
import { expect } from 'chai';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { loginAdmin, loginAluno } from './helpers/auth.js';

const testData = JSON.parse(readFileSync(new URL('./data/flow-data.json', import.meta.url), 'utf8'));

function resolveData(data, replacements) {
  if (typeof data === 'string') {
    return Object.entries(replacements).reduce(
      (value, [key, replacement]) => value.replaceAll(`{${key}}`, replacement),
      data,
    );
  }

  if (Array.isArray(data)) {
    return data.map((entry) => resolveData(entry, replacements));
  }

  if (data && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data).map(([key, entry]) => [key, resolveData(entry, replacements)]),
    );
  }

  return data;
}

describe('Fluxo encadeado de cadastro e entrega', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gestao-de-alunos',
      );
    }
  });

  after(async () => {
    await mongoose.connection.close();
  });

  testData.scenarios.forEach((scenarioData) => {
    it(`deve ${scenarioData.name}`, async () => {
      const timestamp = String(Date.now());
      const scenario = resolveData(scenarioData, { timestamp });

      const respostaLoginAdmin = await loginAdmin(scenario.admin.credentials, testData.loginRequest);
      expect(respostaLoginAdmin.status).to.equal(scenario.admin.expectedStatus);
      expect(respostaLoginAdmin.body).to.have.property(scenario.admin.tokenProperty);
      const tokenAdmin = respostaLoginAdmin.body[scenario.admin.tokenProperty];

      const respostaCadastro = await request(app)
        .post(scenario.registration.path)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(scenario.registration.payload);

      expect(respostaCadastro.status).to.equal(scenario.registration.expectedStatus);
      expect(respostaCadastro.body).to.include(scenario.registration.expectedBody);
      const alunoId = respostaCadastro.body[scenario.registration.idProperty];
      expect(alunoId).to.be.a('string').and.not.empty;

      const matricula = resolveData(scenario.enrollment, { alunoId });
      const respostaMatricula = await request(app)
        [matricula.method.toLowerCase()](matricula.path)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(matricula.payload);

      expect(respostaMatricula.status).to.equal(matricula.expectedStatus);
      expect(respostaMatricula.body).to.include({
        alunoId,
        disciplinaId: matricula.expectedBody.disciplinaId,
      });

      const respostaLoginAluno = await loginAluno(
        scenario.registration.payload,
        testData.loginRequest,
      );
      expect(respostaLoginAluno.status).to.equal(scenario.studentLogin.expectedStatus);
      expect(respostaLoginAluno.body).to.have.property(scenario.studentLogin.tokenProperty);
      expect(respostaLoginAluno.body[scenario.studentLogin.userProperty][scenario.studentLogin.idProperty])
        .to.equal(alunoId);
      const tokenAluno = respostaLoginAluno.body[scenario.studentLogin.tokenProperty];

      const entrega = resolveData(scenario.delivery, { alunoId });
      const respostaEntrega = await request(app)
        [entrega.method.toLowerCase()](entrega.path)
        .set('Authorization', `Bearer ${tokenAluno}`)
        .send(entrega.payload);

      expect(respostaEntrega.status).to.equal(entrega.expectedStatus);
      expect(respostaEntrega.body).to.include(entrega.expectedBody);
    });
  });
});