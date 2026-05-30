const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const N8N_WEBHOOK = 'https://primary-production-26151.up.railway.app/webhook/agendadoccomercialmedico';

app.post('/webhook', async (req, res) => {
  try {
    const r = await axios.post(N8N_WEBHOOK, req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });
    res.status(r.status).json(r.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ erro: err.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 3001, () => console.log('Proxy ok'));
