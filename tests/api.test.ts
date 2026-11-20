import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.NODE_ENV = 'test';

import { createApp } from '../src/app';

const app = createApp();
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await mongoose.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

async function registerUser(email = 'ada@example.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Ada', email, password: 'password123' });
  return res.body.token as string;
}

describe('auth', () => {
  it('registers, logs in and returns the profile', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'Ada@Example.com', password: 'password123' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.email).toBe('ada@example.com');
    expect(reg.body.user.passwordHash).toBeUndefined();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'password123' });
    expect(login.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.name).toBe('Ada');
  });

  it('rejects duplicate emails, weak passwords and wrong credentials', async () => {
    await registerUser();
    const dup = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'password123' });
    expect(dup.status).toBe(409);

    const weak = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'bob@example.com', password: 'short' });
    expect(weak.status).toBe(400);

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  it('blocks requests without a valid token', async () => {
    expect((await request(app).get('/api/tasks')).status).toBe(401);
    const bad = await request(app).get('/api/tasks').set('Authorization', 'Bearer nope');
    expect(bad.status).toBe(401);
  });
});

describe('tasks', () => {
  it('creates, reads, updates and deletes a task', async () => {
    const token = await registerUser();
    const auth = { Authorization: `Bearer ${token}` };

    const created = await request(app)
      .post('/api/tasks')
      .set(auth)
      .send({ title: 'Write README', dueDate: '2030-01-01' });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('todo');
    const id = created.body._id;

    const got = await request(app).get(`/api/tasks/${id}`).set(auth);
    expect(got.body.title).toBe('Write README');

    const patched = await request(app)
      .patch(`/api/tasks/${id}`)
      .set(auth)
      .send({ status: 'done', dueDate: null });
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe('done');
    expect(patched.body.dueDate).toBeUndefined();

    expect((await request(app).delete(`/api/tasks/${id}`).set(auth)).status).toBe(204);
    expect((await request(app).get(`/api/tasks/${id}`).set(auth)).status).toBe(404);
  });

  it('validates input', async () => {
    const token = await registerUser();
    const auth = { Authorization: `Bearer ${token}` };
    expect((await request(app).post('/api/tasks').set(auth).send({})).status).toBe(400);
    expect((await request(app).get('/api/tasks?limit=1000').set(auth)).status).toBe(400);
    expect((await request(app).get('/api/tasks/not-an-id').set(auth)).status).toBe(404);
    expect((await request(app).patch('/api/tasks/abc').set(auth).send({})).status).toBe(404);
  });

  it('filters, sorts and paginates', async () => {
    const token = await registerUser();
    const auth = { Authorization: `Bearer ${token}` };
    for (let i = 1; i <= 5; i++) {
      await request(app)
        .post('/api/tasks')
        .set(auth)
        .send({ title: `Task ${i}`, status: i % 2 ? 'todo' : 'done' });
    }
    const page = await request(app).get('/api/tasks?limit=2&page=2').set(auth);
    expect(page.body.total).toBe(5);
    expect(page.body.totalPages).toBe(3);
    expect(page.body.items).toHaveLength(2);

    const done = await request(app).get('/api/tasks?status=done').set(auth);
    expect(done.body.total).toBe(2);
  });

  it("never exposes another user's tasks", async () => {
    const alice = await registerUser('alice@example.com');
    const bob = await registerUser('bob@example.com');
    const task = await request(app)
      .post('/api/tasks')
      .set({ Authorization: `Bearer ${alice}` })
      .send({ title: 'Private' });

    const asBob = { Authorization: `Bearer ${bob}` };
    expect((await request(app).get(`/api/tasks/${task.body._id}`).set(asBob)).status).toBe(404);
    expect((await request(app).delete(`/api/tasks/${task.body._id}`).set(asBob)).status).toBe(404);
    expect((await request(app).get('/api/tasks').set(asBob)).body.total).toBe(0);
  });
});
