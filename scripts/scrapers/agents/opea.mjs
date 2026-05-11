import { HTML_FETCH_HEADERS, JSON_FETCH_HEADERS } from '../../proxy/config.mjs';
import { extractPaymentsFromJson, parseHtmlTables } from '../shared/payment-parsers.mjs';

export const opeaPaymentScraper = {
  name: 'opea',
  canHandle: url => url.hostname.toLowerCase().includes('opea'),
  scrape: scrapeOpea,
};

async function scrapeOpea(url, logs) {
  logs.push(`[opea] URL recebida: ${url}`);

  const apiResult = await scrapeOpeaApis(url, logs);
  if (apiResult) return apiResult;

  return scrapeOpeaHtml(url, logs);
}

async function scrapeOpeaApis(url, logs) {
  const codeMatch = String(url).match(/emissoes\/([A-Za-z0-9]+)/);
  if (!codeMatch) return null;

  const code = codeMatch[1];
  logs.push(`[opea] Código extraído da URL: ${code}`);

  for (const apiUrl of buildOpeaApiUrls(code)) {
    try {
      logs.push(`[opea] Tentando API: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        headers: {
          ...JSON_FETCH_HEADERS,
          Referer: String(url),
          Origin: 'https://app.opea.com.br',
        },
        signal: AbortSignal.timeout(10000),
      });

      logs.push(`[opea] ${apiUrl} -> HTTP ${response.status}`);
      const result = await parseOpeaApiResponse(response, logs);
      if (result) return result;
    } catch (err) {
      logs.push(`[opea] Erro em ${apiUrl}: ${err.message}`);
    }
  }

  return null;
}

function buildOpeaApiUrls(code) {
  return [
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
}

async function parseOpeaApiResponse(response, logs) {
  if (!response.ok) return null;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) return null;

  const data = await response.json();
  logs.push(`[opea] JSON recebido: ${JSON.stringify(data).substring(0, 500)}...`);

  const payments = extractPaymentsFromJson(data, logs);
  if (payments.length === 0) return null;

  return {
    success: true,
    payments,
    source: 'opea-api',
    fetchedAt: new Date().toISOString(),
    logs,
  };
}

async function scrapeOpeaHtml(url, logs) {
  logs.push('[opea] Tentando fetch HTML da página...');

  try {
    const response = await fetch(url, {
      headers: HTML_FETCH_HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    logs.push(
      `[opea] HTML response: HTTP ${response.status}, content-type: ${response.headers.get('content-type')}`,
    );

    if (!response.ok) {
      logs.push(`[opea] Falha HTTP: ${response.status} ${response.statusText}`);
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}`, logs };
    }

    const html = await response.text();
    logs.push(`[opea] HTML recebido: ${html.length} bytes`);

    return (
      extractFromNextData(html, logs) ||
      extractFromEmbeddedScripts(html, logs) ||
      extractFromHtmlTables(html, logs) ||
      buildOpeaNotFoundResult(html, logs)
    );
  } catch (err) {
    logs.push(`[opea] Erro ao buscar HTML: ${err.message}`);
    return { success: false, error: err.message, logs };
  }
}

function extractFromNextData(html, logs) {
  const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!nextDataMatch) {
    logs.push('[opea] __NEXT_DATA__ NÃO encontrado');
    return null;
  }

  logs.push(`[opea] __NEXT_DATA__ encontrado (${nextDataMatch[1].length} bytes)`);

  try {
    const nextData = JSON.parse(nextDataMatch[1]);
    logs.push(`[opea] __NEXT_DATA__ parseado com sucesso. Keys: ${Object.keys(nextData).join(', ')}`);
    if (nextData.props?.pageProps) {
      logs.push(`[opea] pageProps keys: ${Object.keys(nextData.props.pageProps).join(', ')}`);
    }

    const payments = extractPaymentsFromJson(nextData, logs);
    if (payments.length === 0) return null;

    return {
      success: true,
      payments,
      source: 'opea-nextdata',
      fetchedAt: new Date().toISOString(),
      logs,
    };
  } catch (err) {
    logs.push(`[opea] Erro ao parsear __NEXT_DATA__: ${err.message}`);
    return null;
  }
}

function extractFromEmbeddedScripts(html, logs) {
  const nuxtMatch = html.match(/window\.__NUXT__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
  if (nuxtMatch) logs.push('[opea] __NUXT__ encontrado');

  const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  logs.push(`[opea] ${scriptMatches.length} tags <script> encontradas`);

  for (let index = 0; index < scriptMatches.length; index += 1) {
    const result = extractFromScriptContent(scriptMatches[index][1].trim(), index, logs);
    if (result) return result;
  }

  return null;
}

function extractFromScriptContent(content, index, logs) {
  if (content.length <= 100 || content.length >= 500000) return null;

  const jsonMatches = content.match(
    /\{[^{}]*"(?:data|eventos|pagamentos|agenda|events|payments)"[^{}]*\[[\s\S]*?\]\s*\}/g,
  );
  if (!jsonMatches) return null;

  for (const jsonStr of jsonMatches) {
    try {
      const data = JSON.parse(jsonStr);
      logs.push(`[opea] JSON encontrado em script[${index}]: keys=${Object.keys(data).join(',')}`);
      const payments = extractPaymentsFromJson(data, logs);
      if (payments.length > 0) {
        return {
          success: true,
          payments,
          source: 'opea-embedded',
          fetchedAt: new Date().toISOString(),
          logs,
        };
      }
    } catch {
      // Ignore snippets that only look like JSON.
    }
  }

  return null;
}

function extractFromHtmlTables(html, logs) {
  logs.push('[opea] Tentando extrair de tabelas HTML...');

  const payments = parseHtmlTables(html, logs);
  if (payments.length === 0) return null;

  return {
    success: true,
    payments,
    source: 'opea-html',
    fetchedAt: new Date().toISOString(),
    logs,
  };
}

function buildOpeaNotFoundResult(html, logs) {
  logs.push(
    '[opea] Nenhum dado de pagamento encontrado. O site provavelmente carrega dados via JavaScript client-side.',
  );
  logs.push(
    '[opea] Sugestão: verifique no DevTools do navegador (aba Network) quais APIs o site chama ao carregar a página.',
  );

  const bodyStart = html.indexOf('<body');
  const snippet = html.substring(bodyStart, bodyStart + 2000);
  logs.push(`[opea] HTML snippet (primeiros 2000 chars do body): ${snippet.replace(/\s+/g, ' ').substring(0, 800)}`);

  return {
    success: false,
    error: 'Nenhum dado de pagamento encontrado. O site pode carregar dados via JavaScript.',
    logs,
  };
}
