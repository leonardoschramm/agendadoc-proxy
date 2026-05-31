const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const N8N_WEBHOOK = 'https://primary-production-26151.up.railway.app/webhook/agendadoccomercialmedico';

app.post('/webhook', async (req, res) => {
  try {
    // O simulador envia um array [ { headers, body, ... } ]
    // O N8N espera receber exatamente esse array diretamente
    // Problema anterior: o proxy reencapsulava req.body inteiro, gerando headers duplicados
    // Solução: extrair o array original e encaminhar só ele
    let payload = req.body;

    // Se vier como array, pegar o primeiro item e encaminhar o body interno
    // para que o N8N receba no formato correto da Evolution API
    if (Array.isArray(payload) && payload.length > 0 && payload[0].body) {
      // O simulador já manda o array correto — encaminhar diretamente
      // sem adicionar nova camada de headers
      const forward = payload[0].body;
      const r = await axios.post(N8N_WEBHOOK, forward, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      });
      return res.status(r.status).json(r.data);
    }

    // Fallback: encaminhar como veio
    const r = await axios.post(N8N_WEBHOOK, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });
    res.status(r.status).json(r.data);

  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ erro: err.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy rodando na porta ${PORT}`));
