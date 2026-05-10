/**
 * Proxy Scraper Server — YieldRadar
 * 
 * Servidor local que busca dados de agenda de pagamento de agentes fiduciários.
 * Roda APENAS em localhost:3001.
 * 
 * Uso: node scripts/proxy-scraper.mjs
 */

import http from 'node:http';

const PORT = 3001;
const ALLOWED_ORIGIN = 'http://localhost:5173';

/**
 * Scrape Opea — tries multiple strategies to extract payment data.
 */
async function scrapeOpea(url, logs) {
  logs.push(`[opea] URL recebida: ${url}`);

  // Strategy 1: Try to find an API endpoint from the URL
  // Opea pattern: https://app.opea.com.br/pt/emissoes/{code}
  const codeMatch = url.match(/emissoes\/([A-Za-z0-9]+)/);
  if (codeMatch) {
    const code = codeMatch[1];
    logs.push(`[opea] Código extraído da URL: ${code}`);

    // Try common API patterns that SPAs use
    const apiUrls = [
      `https://app.opea.com.br/api/emissoes/${code}`,
      `https://app.opea.com.br/api/v1/emissoes/${code}`,
      `https://app.opea.com.br/api/emissions/${code}`,
      `https://app.opea.com.br/api/v1/emissions/${code}`,
      `https://api.opea.com.br/emissoes/${code}`,
      `https://api.opea.com.br/v1/emissoes/${code}`,
      `https://api.opea.com.br/emissions/${code}`,
      `https://app.opea.com.br/api/emissoes/${code}/eventos`,
      `https://app.opea.com.br/api/emissoes/${code}/pagamentos`,
      `https://app.opea.com.br/api/emissoes/${code}/agenda`,
    ];

    for (const apiUrl of apiUrls) {
      try {
        logs.push(`[opea] Tentando API: ${apiUrl}`);
        const resp = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': url,
            'Origin': 'https://app.opea.com.br',
          },
          signal: AbortSignal.timeout(10000),
        });

        logs.push(`[opea] ${apiUrl} → HTTP ${resp.status}`);

        if (resp.ok) {
          const contentType = resp.headers.get('content-type') || '';
          if (contentType.includes('json')) {
            const data = await resp.json();
            logs.push(`[opea] JSON recebido: ${JSON.stringify(data).substring(0, 500)}...`);
            const payments = extractPaymentsFromJson(data, logs);
            if (payments.length > 0) {
              return { success: true, payments, source: 'opea-api', fetchedAt: new Date().toISOString(), logs };
            }
          }
        }
      } catch (err) {
        logs.push(`[opea] Erro em ${apiUrl}: ${err.message}`);
      }
    }
  }

  // Strategy 2: Fetch the HTML page and look for embedded data
  logs.push(`[opea] Tentando fetch HTML da página...`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    logs.push(`[opea] HTML response: HTTP ${response.status}, content-type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      logs.push(`[opea] Falha HTTP: ${response.status} ${response.statusText}`);
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}`, logs };
    }

    const html = await response.text();
    logs.push(`[opea] HTML recebido: ${html.length} bytes`);

    // Look for __NEXT_DATA__ (Next.js apps)
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      logs.push(`[opea] __NEXT_DATA__ encontrado (${nextDataMatch[1].length} bytes)`);
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        logs.push(`[opea] __NEXT_DATA__ parseado com sucesso. Keys: ${Object.keys(nextData).join(', ')}`);
        if (nextData.props?.pageProps) {
          logs.push(`[opea] pageProps keys: ${Object.keys(nextData.props.pageProps).join(', ')}`);
        }
        const payments = extractPaymentsFromJson(nextData, logs);
        if (payments.length > 0) {
          return { success: true, payments, source: 'opea-nextdata', fetchedAt: new Date().toISOString(), logs };
        }
      } catch (err) {
        logs.push(`[opea] Erro ao parsear __NEXT_DATA__: ${err.message}`);
      }
    } else {
      logs.push(`[opea] __NEXT_DATA__ NÃO encontrado`);
    }

    // Look for __NUXT__ (Nuxt.js apps)
    const nuxtMatch = html.match(/window\.__NUXT__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
    if (nuxtMatch) {
      logs.push(`[opea] __NUXT__ encontrado`);
    }

    // Look for any JSON data in script tags
    const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
    logs.push(`[opea] ${scriptMatches.length} tags <script> encontradas`);

    for (let i = 0; i < scriptMatches.length; i++) {
      const content = scriptMatches[i][1].trim();
      if (content.length > 100 && content.length < 500000) {
        // Try to find JSON objects with payment-related data
        const jsonMatches = content.match(/\{[^{}]*"(?:data|eventos|pagamentos|agenda|events|payments)"[^{}]*\[[\s\S]*?\]\s*\}/g);
        if (jsonMatches) {
          for (const jsonStr of jsonMatches) {
            try {
              const data = JSON.parse(jsonStr);
              logs.push(`[opea] JSON encontrado em script[${i}]: keys=${Object.keys(data).join(',')}`);
              const payments = extractPaymentsFromJson(data, logs);
              if (payments.length > 0) {
                return { success: true, payments, source: 'opea-embedded', fetchedAt: new Date().toISOString(), logs };
              }
            } catch { /* not valid JSON */ }
          }
        }
      }
    }

    // Strategy 3: Parse HTML tables directly
    logs.push(`[opea] Tentando extrair de tabelas HTML...`);
    const payments = parseHtmlTables(html, logs);
    if (payments.length > 0) {
      return { success: true, payments, source: 'opea-html', fetchedAt: new Date().toISOString(), logs };
    }

    logs.push(`[opea] Nenhum dado de pagamento encontrado. O site provavelmente carrega dados via JavaScript client-side.`);
    logs.push(`[opea] Sugestão: verifique no DevTools do navegador (aba Network) quais APIs o site chama ao carregar a página.`);

    // Return a snippet of the HTML for debugging
    const bodyStart = html.indexOf('<body');
    const snippet = html.substring(bodyStart, bodyStart + 2000);
    logs.push(`[opea] HTML snippet (primeiros 2000 chars do body): ${snippet.replace(/\s+/g, ' ').substring(0, 800)}`);

    return { success: false, error: 'Nenhum dado de pagamento encontrado. O site pode carregar dados via JavaScript.', logs };
  } catch (err) {
    logs.push(`[opea] Erro ao buscar HTML: ${err.message}`);
    return { success: false, error: err.message, logs };
  }
}

/**
 * Recursively searches for payment event arrays in nested JSON objects.
 */
function extractPaymentsFromJson(obj, logs, path = '', depth = 0) {
  if (depth > 15 || !obj || typeof obj !== 'object') return [];

  if (Array.isArray(obj)) {
    // Check if this array contains payment-like objects
    if (obj.length > 0 && obj[0] && typeof obj[0] === 'object') {
      const firstItem = obj[0];
      const keys = Object.keys(firstItem);

      // Look for date-related fields
      const dateFields = keys.filter(k =>
        /data|date|vencimento|pagamento/i.test(k)
      );

      if (dateFields.length > 0) {
        logs.push(`[json] Array encontrado em "${path}" com ${obj.length} items. Keys: ${keys.join(', ')}`);

        // Try to map to payment events
        const payments = obj.map(item => {
          const dateField = dateFields.find(f => item[f]) || dateFields[0];
          const dateValue = item[dateField];

          // Determine type
          let type = 'Evento';
          const typeField = keys.find(k => /tipo|type|evento|event/i.test(k));
          if (typeField && item[typeField]) {
            type = String(item[typeField]);
          }

          // Determine value
          let value = null;
          const valueField = keys.find(k => /valor|value|amount|montante|unitario/i.test(k));
          if (valueField && item[valueField] != null) {
            value = typeof item[valueField] === 'number' ? item[valueField] : parseFloat(String(item[valueField]).replace(/[^\d.,\-]/g, '').replace(',', '.'));
          }

          // Determine status
          let status = null;
          const statusField = keys.find(k => /status|situacao|situação|estado/i.test(k));
          if (statusField && item[statusField]) {
            status = String(item[statusField]);
          }

          return {
            date: formatDateValue(dateValue),
            type,
            value: isNaN(value) ? null : value,
            status,
          };
        }).filter(p => p.date);

        if (payments.length > 0) {
          logs.push(`[json] ${payments.length} eventos extraídos de "${path}"`);
          return payments;
        }
      }
    }
  }

  // Recurse into object properties
  const keys = Array.isArray(obj) ? obj.map((_, i) => String(i)) : Object.keys(obj);
  for (const key of keys) {
    const child = Array.isArray(obj) ? obj[parseInt(key)] : obj[key];
    const childPath = path ? `${path}.${key}` : key;
    const result = extractPaymentsFromJson(child, logs, childPath, depth + 1);
    if (result.length > 0) return result;
  }

  return [];
}

/**
 * Formats various date representations to DD/MM/YYYY.
 */
function formatDateValue(value) {
  if (!value) return '';
  const str = String(value);

  // Already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;

  // ISO format: 2024-01-15 or 2024-01-15T00:00:00
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

  // Timestamp (number)
  if (typeof value === 'number' && value > 1000000000) {
    const d = new Date(value * (value < 10000000000 ? 1000 : 1));
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  return str;
}

/**
 * Parses HTML tables looking for payment schedule data.
 */
function parseHtmlTables(html, logs) {
  const payments = [];
  const typePatterns = [
    { regex: /juros\s*\+?\s*amortiza[çc][ãa]o/i, type: 'Juros + Amortização' },
    { regex: /amortiza[çc][ãa]o/i, type: 'Amortização' },
    { regex: /juros|remunera[çc][ãa]o/i, type: 'Juros' },
    { regex: /vencimento/i, type: 'Vencimento' },
  ];

  // Find all table rows
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  let rowCount = 0;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowContent = rowMatch[1];
    const dateMatch = rowContent.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) continue;

    rowCount++;
    let eventType = 'Evento';
    for (const tp of typePatterns) {
      if (tp.regex.test(rowContent)) {
        eventType = tp.type;
        break;
      }
    }

    const valueMatch = rowContent.match(/R\$\s*([\d.,]+)/);
    const value = valueMatch ? parseFloat(valueMatch[1].replace(/\./g, '').replace(',', '.')) : null;

    const statusMatch = rowContent.match(/(pago|previsto|agendado|liquidado|confirmado)/i);
    const status = statusMatch ? statusMatch[1].charAt(0).toUpperCase() + statusMatch[1].slice(1).toLowerCase() : null;

    payments.push({
      date: dateMatch[1],
      type: eventType,
      value: isNaN(value) ? null : value,
      status,
    });
  }

  logs.push(`[html] ${rowCount} linhas com datas encontradas, ${payments.length} eventos extraídos`);
  return payments;
}

/**
 * Routes to the appropriate scraper based on URL.
 */
async function scrapePayments(url) {
  const logs = [];
  const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes('opea')) {
    return scrapeOpea(url, logs);
  }

  // Generic scraper for other agents
  logs.push(`[generic] Agente não reconhecido: ${hostname}. Usando scraper genérico.`);
  return scrapeGeneric(url, logs);
}

async function scrapeGeneric(url, logs) {
  try {
    logs.push(`[generic] Buscando: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      logs.push(`[generic] HTTP ${response.status}`);
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}`, logs };
    }

    const html = await response.text();
    logs.push(`[generic] HTML recebido: ${html.length} bytes`);

    const payments = parseHtmlTables(html, logs);
    if (payments.length > 0) {
      return { success: true, payments, source: 'generic', fetchedAt: new Date().toISOString(), logs };
    }

    return { success: false, error: 'Nenhum dado de pagamento encontrado.', logs };
  } catch (err) {
    logs.push(`[generic] Erro: ${err.message}`);
    return { success: false, error: err.message, logs };
  }
}

/**
 * HTTP Server
 */
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/scrape') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { url } = JSON.parse(body);

        if (!url || typeof url !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'URL é obrigatória.', logs: [] }));
          return;
        }

        console.log(`\n[scrape] Buscando: ${url}`);
        const result = await scrapePayments(url);
        console.log(`[scrape] Resultado: ${result.success ? (result.payments?.length || 0) + ' eventos' : result.error}`);

        // Print logs to console
        if (result.logs) {
          for (const log of result.logs) {
            console.log(`  ${log}`);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message, logs: [`[server] Erro: ${err.message}`] }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/fetch-html') {
    // Endpoint simples de "passa-bola": pega o HTML cru e devolve.
    // O parsing acontece no front, dentro de cada provider em
    // src/services/paymentSchedule/providers/. Mantém a regra de cada
    // agente fiduciário em um único lugar e fácil de testar com jsdom.
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { url } = JSON.parse(body);
        if (!url || typeof url !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'URL é obrigatória.' }));
          return;
        }

        // Restringimos a HTTP/HTTPS para evitar fetch acidental em outros esquemas.
        let parsed;
        try {
          parsed = new URL(url);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'URL inválida.' }));
          return;
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Apenas http(s) é suportado.' }));
          return;
        }

        console.log(`\n[fetch-html] ${url}`);
        const upstream = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          },
          signal: AbortSignal.timeout(20000),
          redirect: 'follow',
        });

        const html = await upstream.text();
        console.log(`[fetch-html] HTTP ${upstream.status} — ${html.length} bytes`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: upstream.ok,
          status: upstream.status,
          html,
        }));
      } catch (err) {
        console.log(`[fetch-html] ERRO: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🔍 YieldRadar Proxy Scraper rodando em http://localhost:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`   POST /scrape      — { "url": "..." } (legado: parse no Node)`);
  console.log(`   POST /fetch-html  — { "url": "..." } (devolve HTML cru — usado pelo provider Ecoagro)`);
  console.log(`   GET  /health      — Status do servidor\n`);
});
