/**
 * meta.js — system endpoints: health, models, stats, activity.
 */
const router = require('express').Router();
const store = require('../data/store');
const llm = require('../services/llm');

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSec: Math.round(process.uptime()),
    provider: llm.provider.label,
    timestamp: new Date().toISOString(),
  });
});

router.get('/models', (_req, res) => {
  res.json({ provider: llm.provider.label, models: llm.MODELS });
});

router.get('/activity', (_req, res) => {
  res.json(store.listActivity());
});

router.get('/stats', (_req, res) => {
  res.json(store.getStats({
    provider: llm.provider.label,
    node: process.version,
    models: llm.MODELS.length,
    uptimeSec: Math.round(process.uptime()),
  }));
});

module.exports = router;
