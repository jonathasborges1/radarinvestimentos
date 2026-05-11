import { scrapeHtmlTables } from '../shared/html-table-scraper.mjs';

export const genericPaymentScraper = {
  name: 'generic',
  canHandle: () => true,
  scrape: scrapeGeneric,
};

async function scrapeGeneric(url, logs) {
  return scrapeHtmlTables(url, logs, {
    agentName: 'generic',
    source: 'generic',
  });
}
