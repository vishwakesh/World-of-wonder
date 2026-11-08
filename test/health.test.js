const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

let server;

test.before(async () => {
  server = spawn('node', ['server.js'], { cwd: process.cwd(), env: { ...process.env, PORT: '3210' } });
  await new Promise((resolve) => setTimeout(resolve, 1200));
});

test.after(() => {
  if (server) server.kill('SIGTERM');
});

test('health endpoint responds ok', async () => {
  const res = await fetch('http://localhost:3210/api/health');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});
