/**
 * Nexus AI Workspace — Express server
 * ----------------------------------
 * Serves the REST API (/api/*) and the single-page frontend (public/).
 *
 * Run:  npm install && npm start   →  http://localhost:3000
 */
const fs = require('node:fs');
const path = require('node:path');

/* Tiny zero-dependency .env loader (runs before modules that read env vars). */
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = (match[2] || '').replace(/^["']|["']$/g, '');
    }
  }
}

const express = require('express');
const metaRouter = require('./src/routes/meta');
const chatRouter = require('./src/routes/chat');
const projectsRouter = require('./src/routes/projects');
const llm = require('./src/services/llm');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

/* Request log (API only). */
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`${new Date().toISOString()}  ${req.method} ${req.originalUrl}`);
  }
  next();
});

/* ── API ─────────────────────────────────────────────────────────────── */
app.use('/api', metaRouter);
app.use('/api', chatRouter);
app.use('/api', projectsRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));

/* ── Frontend ────────────────────────────────────────────────────────── */
app.use(express.static(path.join(__dirname, 'public')));
app.use((_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

/* ── Central error handler ───────────────────────────────────────────── */
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ⬡  Nexus AI Workspace — running');
  console.log('  ────────────────────────────────────────────');
  console.log(`  Frontend   http://localhost:${PORT}`);
  console.log(`  API        http://localhost:${PORT}/api`);
  console.log(`  AI layer   ${llm.provider.label}`);
  console.log('');
});
