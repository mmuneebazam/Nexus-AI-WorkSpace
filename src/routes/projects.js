/**
 * projects.js — full CRUD for the project board.
 */
const router = require('express').Router();
const store = require('../data/store');

const { STATUSES } = store;

function normalizeTags(tags) {
  if (typeof tags === 'string') tags = tags.split(',');
  if (!Array.isArray(tags)) return [];
  return tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6);
}

router.get('/projects', (_req, res) => {
  res.json(store.listProjects());
});

router.post('/projects', (req, res) => {
  const { title, description = '', status = 'Planning', tags = [] } = req.body || {};
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: '"title" is required' });
  }
  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ error: `"status" must be one of: ${STATUSES.join(', ')}` });
  }
  const project = store.createProject({
    title: title.trim(),
    description: String(description).trim(),
    status,
    tags: normalizeTags(tags),
  });
  res.status(201).json(project);
});

router.patch('/projects/:id', (req, res) => {
  const { title, description, status, tags } = req.body || {};
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: `"status" must be one of: ${STATUSES.join(', ')}` });
  }
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    return res.status(400).json({ error: '"title" cannot be empty' });
  }
  const project = store.updateProject(req.params.id, {
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(description !== undefined ? { description: String(description).trim() } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(tags !== undefined ? { tags: normalizeTags(tags) } : {}),
  });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

router.delete('/projects/:id', (req, res) => {
  const ok = store.deleteProject(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Project not found' });
  res.json({ ok: true });
});

module.exports = router;
