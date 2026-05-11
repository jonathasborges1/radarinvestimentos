import { HTML_FETCH_HEADERS } from '../../proxy/config.mjs';
import { parseHtmlTables } from './payment-parsers.mjs';

export async function scrapeHtmlTables(url, logs, options) {
  const { agentName, source } = options;

  try {
    logs.push(`[${agentName}] Buscando: ${url}`);
    const response = await fetch(url, {
      headers: HTML_FETCH_HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      logs.push(`[${agentName}] HTTP ${response.status}`);
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}`, logs };
    }

    const html = await response.text();
    logs.push(`[${agentName}] HTML recebido: ${html.length} bytes`);

    const payments = parseHtmlTables(html, logs);
    if (payments.length > 0) {
      return {
        success: true,
        payments,
        source,
        fetchedAt: new Date().toISOString(),
        logs,
      };
    }

    return { success: false, error: 'Nenhum dado de pagamento encontrado.', logs };
  } catch (err) {
    logs.push(`[${agentName}] Erro: ${err.message}`);
    return { success: false, error: err.message, logs };
  }
}
