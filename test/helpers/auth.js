import request from 'supertest';
import app from '../../src/app.js';

export async function login({ email, senha }, { method, path }) {
  return request(app)[method.toLowerCase()](path).send({ email, senha });
}

export async function loginAdmin(credentials, requestConfig) {
  return login(credentials, requestConfig);
}

export async function loginAluno(credentials, requestConfig) {
  return login(credentials, requestConfig);
}
