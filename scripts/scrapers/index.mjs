import { ecoagroPaymentScraper } from './agents/ecoagro.mjs';
import { genericPaymentScraper } from './agents/generic.mjs';
import { oliveiraTrustPaymentScraper } from './agents/oliveira-trust.mjs';
import { opeaPaymentScraper } from './agents/opea.mjs';
import { pentagonoPaymentScraper } from './agents/pentagono.mjs';
import { vortxPaymentScraper } from './agents/vortx.mjs';

const paymentScrapers = [
  ecoagroPaymentScraper,
  vortxPaymentScraper,
  oliveiraTrustPaymentScraper,
  pentagonoPaymentScraper,
  opeaPaymentScraper,
  genericPaymentScraper,
];

export async function scrapePayments(rawUrl) {
  const logs = [];
  const url = new URL(rawUrl);
  const scraper = paymentScrapers.find(candidate => candidate.canHandle(url));

  if (scraper.name === 'generic') {
    logs.push(`[generic] Agente não reconhecido: ${url.hostname.toLowerCase()}. Usando scraper genérico.`);
  }

  return scraper.scrape(url, logs);
}
