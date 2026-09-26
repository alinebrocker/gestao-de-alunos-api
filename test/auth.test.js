import request from 'supertest';
import { expect } from 'chai';
import mongoose from 'mongoose';
import app from '../src/app.js';

describe('Autenticação e cadastro', () => {
  let token;

  before(async () => {
    const respostaLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@escola.com', senha: 'admin123' });

    token = respostaLogin.body.token;
  });

  after(async () => {
    await mongoose.connection.close();
  });

  it('deve retornar 200 e um token quando o admin informar e-mail e senha corretos', async () => {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@escola.com', senha: 'admin123' });

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('token');
    expect(resposta.body.usuario.role).to.equal('admin');
  });

  it('deve retornar 200 e um token quando o aluno informar e-mail e senha corretos', async () => {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana.souza@example.com', senha: '123456' });

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('token');
    expect(resposta.body.usuario.role).to.equal('aluno');
  });

  it('deve retornar 401 quando a senha informada for inválida', async () => {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@escola.com', senha: 'senha-incorreta' });

    expect(resposta.status).to.equal(401);
    expect(resposta.body.error).to.equal('E-mail ou senha inválidos.');
  });

  it('deve retornar 401 quando o aluno informar senha inválida', async () => {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana.souza@example.com', senha: 'senha-incorreta' });

    expect(resposta.status).to.equal(401);
    expect(resposta.body.error).to.equal('E-mail ou senha inválidos.');
  });

  it('deve cadastrar um aluno quando o administrador informa dados válidos', async () => {
    const payload = {
      nome: 'Aluno Teste Cadastro',
      email: `aluno.teste.${Date.now()}@example.com`,
      matricula: `2024${String(Date.now()).slice(-6)}`,
      senha: '123456',
    };

    const resposta = await request(app)
      .post('/api/admin/alunos')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.include({
      nome: payload.nome,
      email: payload.email,
      matricula: payload.matricula,
    });
    expect(resposta.body).to.not.have.property('senha');
  });

  it('deve registrar a entrega de um trabalho quando o aluno está autenticado e matriculado', async () => {
    const loginAluno = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana.souza@example.com', senha: '123456' });

    const payload = {
      disciplinaId: 'disciplina-matematica',
      titulo: `Entrega de teste ${Date.now()}`,
      descricao: 'Entrega do trabalho via teste automatizado.',
    };

    const resposta = await request(app)
      .post('/api/alunos/aluno-ana-souza/trabalhos')
      .set('Authorization', `Bearer ${loginAluno.body.token}`)
      .send(payload);

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.include({
      alunoId: 'aluno-ana-souza',
      disciplinaId: payload.disciplinaId,
      titulo: payload.titulo,
      descricao: payload.descricao,
      status: 'entregue',
    });
  });

  it('deve impedir que o aluno entregue trabalho em disciplina não matriculada', async () => {
    const loginAluno = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana.souza@example.com', senha: '123456' });

    const payload = {
      disciplinaId: 'disciplina-historia',
      titulo: `Trabalho fora da matrícula ${Date.now()}`,
      descricao: 'Tentativa de entrega em disciplina não cursada.',
    };

    const resposta = await request(app)
      .post('/api/alunos/aluno-ana-souza/trabalhos')
      .set('Authorization', `Bearer ${loginAluno.body.token}`)
      .send(payload);

    expect(resposta.status).to.equal(409);
    expect(resposta.body.error).to.equal('O aluno não está matriculado nesta disciplina.');
  });
});
