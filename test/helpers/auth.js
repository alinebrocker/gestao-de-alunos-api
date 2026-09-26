import request from 'supertest';
import app from '../../src/app.js';

export async function login({ email, senha }) {
  return request(app).post('/api/auth/login').send({ email, senha });
}

export async function loginAdmin() {
  return login({ email: 'admin@escola.com', senha: 'admin123' });
}

export async function loginAluno() {
  return login({ email: 'ana.souza@example.com', senha: '123456' });
}
