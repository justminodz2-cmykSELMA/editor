import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import { config } from './config.js';
import { runPipeline, PIPELINE_STAGES } from './pipeline/orchestrator.js';
import { AGENTS } from './agents/definitions.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

/** In-memory project store (swap for a DB in production). */
const projects = new Map();

app.get('/api/health', (_req, res) => res.json({ ok: true, agents: Object.keys(AGENTS).length }));
app.get('/api/agents', (_req, res) => res.json(Object.values(AGENTS).map(({ id, name, role }) => ({ id, name, role }))));
app.get('/api/stages', (_req, res) => res.json(PIPELINE_STAGES.map(s => s.id)));

/** Create a production from a single prompt. */
app.post('/api/studio/create', async (req, res) => {
  const { prompt, options = {} } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt is required' });

  const id = nanoid(10);
  const project = {
    id,
    prompt,
    options,
    status: 'running',
    createdAt: new Date().toISOString(),
    stages: {},
    events: [],
  };
  projects.set(id, project);

  // Fire and forget — client polls /api/projects/:id or streams /events
  runPipeline(project, (event) => project.events.push(event))
    .then(() => { project.status = 'complete'; })
    .catch((err) => { project.status = 'failed'; project.error = String(err.message || err); });

  res.json({ projectId: id });
});

app.get('/api/projects/:id', (req, res) => {
  const p = projects.get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
});

/** Server-sent events: live pipeline progress. */
app.get('/api/projects/:id/events', (req, res) => {
  const p = projects.get(req.params.id);
  if (!p) return res.status(404).end();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  let cursor = 0;
  const timer = setInterval(() => {
    while (cursor < p.events.length) {
      res.write(`data: ${JSON.stringify(p.events[cursor++])}\n\n`);
    }
    if (p.status !== 'running') {
      res.write(`data: ${JSON.stringify({ type: 'done', status: p.status })}\n\n`);
      clearInterval(timer);
      res.end();
    }
  }, 500);
  req.on('close', () => clearInterval(timer));
});

/** Manual editing: patch any stage output, then optionally re-run downstream stages. */
app.patch('/api/projects/:id/stages/:stage', (req, res) => {
  const p = projects.get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  p.stages[req.params.stage] = { ...p.stages[req.params.stage], output: req.body, edited: true };
  res.json({ ok: true });
});

/** Serve rendered outputs. */
fs.mkdirSync(config.outputDir, { recursive: true });
app.use('/output', express.static(path.resolve(config.outputDir)));

app.listen(config.port, () =>
  console.log(`🎬 AI Creative Studio server on http://localhost:${config.port}`));
