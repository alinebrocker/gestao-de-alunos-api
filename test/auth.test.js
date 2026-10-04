import { readFileSync } from 'node:fs';
import request from 'supertest';
import { expect } from 'chai';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { login, loginAdmin, loginAluno } from './helpers/auth.js';

const testData = JSON.parse(readFileSync(new URL('./data/auth-data.json', import.meta.url), 'utf8'));

function resolveTestData(data, timestamp) {
  if (typeof data === 'string') {
    return data.replaceAll('{timestamp}', timestamp).replaceAll('{timestamp6}', timestamp.slice(-6));
  }

  if (Array.isArray(data)) {
    return data.map((entry) => resolveTestData(entry, timestamp));
  }

  if (data && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data).map(([key, entry]) => [key, resolveTestData(entry, timestamp)]),
    );
  }

  return data;
}

describe('Autenticação e cadastro', () => {
  let token;

  before(async () => {
    const admin = testData.validLogins.find(({ role }) => role === testData.roles.admin);
    const respostaLogin = await loginAdmin(admin, testData.loginRequest);
    token = respostaLogin.body[testData.validLoginExpectations.tokenProperty];
  });

  after(async () => {
    await mongoose.connection.close();
  });

  testData.validLogins.forEach(({ name, email, senha, role }) => {
    it(
      `deve retornar ${testData.validLoginExpectations.expectedStatus} e um token quando o ${name} informar e-mail e senha corretos`,
      async () => {
        const resposta = await login({ email, senha }, testData.loginRequest);
        const expectations = testData.validLoginExpectations;

        expect(resposta.status).to.equal(expectations.expectedStatus);
        expect(resposta.body).to.have.property(expectations.tokenProperty);
        expect(resposta.body[expectations.userProperty][expectations.roleProperty]).to.equal(role);
      },
    );
  });

  testData.invalidLogins.forEach(({ name, email, senha, expectedStatus, expectedError }) => {
    it(`deve retornar ${expectedStatus} quando ${name} informar senha inválida`, async () => {
      const resposta = await login({ email, senha }, testData.loginRequest);

      expect(resposta.status).to.equal(expectedStatus);
      expect(resposta.body.error).to.equal(expectedError);
    });
  });

  it(`deve ${testData.studentRegistration.name}`, async () => {
    const timestamp = String(Date.now());
    const scenario = resolveTestData(testData.studentRegistration, timestamp);

    const resposta = await request(app)
      [scenario.method.toLowerCase()](scenario.path)
      .set('Authorization', `Bearer ${token}`)
      .send(scenario.payload);

    expect(resposta.status).to.equal(scenario.expectedStatus);
    expect(resposta.body).to.include(scenario.expectedBody);
    scenario.excludedResponseProperties.forEach((property) => {
      expect(resposta.body).to.not.have.property(property);
    });
  });

  const credenciaisAluno = testData.validLogins.find(({ role }) => role === testData.roles.student);

  testData.workDeliveries.forEach((workDelivery) => {
    it(`deve ${workDelivery.name}`, async () => {
      const timestamp = String(Date.now());
      const scenario = resolveTestData(workDelivery, timestamp);
      const respostaLogin = await loginAluno(credenciaisAluno, testData.loginRequest);
      const tokenAluno = respostaLogin.body[testData.validLoginExpectations.tokenProperty];
      const resposta = await request(app)
        [scenario.method.toLowerCase()](scenario.path)
        .set('Authorization', `Bearer ${tokenAluno}`)
        .send(scenario.payload);

      expect(resposta.status).to.equal(scenario.expectedStatus);
      if (scenario.expectedBody) {
        expect(resposta.body).to.include(scenario.expectedBody);
      }
      if (scenario.expectedError) {
        expect(resposta.body.error).to.equal(scenario.expectedError);
      }
    });
  });
});
