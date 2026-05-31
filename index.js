const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const N8N_WEBHOOK = 'https://primary-production-26151.up.railway.app/webhook/agendadoccomercialmedico';

// Armazena respostas do AgendaDoc por telefone
const respostas = {};

// ─── ENTRADA: Simulador → N8N ─────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  try {
    let payload = req.body;
    let forward = payload;
    if (Array.isArray(payload) && payload.length > 0 && payload[0].body) {
      forward = payload[0].body;
    }
    const r = await axios.post(N8N_WEBHOOK, forward, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });
    res.status(r.status).json(r.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ erro: err.message });
  }
});

// ─── SAÍDA: N8N envia resposta aqui em vez da Evolution API ───────────────
// Body esperado: { "telefone": "5585991110001", "texto": "Olá! Sou a Ranielle..." }
app.post('/resposta', (req, res) => {
  const { telefone, texto, number } = req.body;
  const tel = telefone || number;

  if (!tel || !texto) {
    return res.status(400).json({ erro: 'Campos obrigatorios: telefone, texto' });
  }

  if (!respostas[tel]) respostas[tel] = [];
  respostas[tel].push({ texto, ts: Date.now() });
  if (respostas[tel].length > 10) respostas[tel].shift();

  console.log(`[resposta] ${tel}: "${texto.substring(0, 60)}"`);
  res.json({ ok: true, telefone: tel });
});

// ─── POLLING: Simulador busca resposta ────────────────────────────────────
// GET /buscar-resposta?telefone=5585991110001&apos=1717000000000
app.get('/buscar-resposta', (req, res) => {
  const { telefone, apos } = req.query;
  if (!telefone) return res.status(400).json({ erro: 'Parametro telefone obrigatorio' });

  const aposTs = parseInt(apos) || 0;
  const msgs = (respostas[telefone] || []).filter(m => m.ts > aposTs);

  if (msgs.length > 0) {
    const ultima = msgs[msgs.length - 1];
    return res.json({ encontrado: true, texto: ultima.texto, ts: ultima.ts });
  }

  res.json({ encontrado: false });
});

// ─── HEALTH ────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, version: '2.0' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy AgendaDoc v2 rodando na porta ${PORT}`));
