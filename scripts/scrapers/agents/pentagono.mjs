import { scrapeHtmlTables } from '../shared/html-table-scraper.mjs';

const HOST_REGEX = /(?:^|\.)pentagonotrustee\.com\.br$/i;

export const pentagonoPaymentScraper = {
  name: 'pentagono',
  canHandle: url => HOST_REGEX.test(url.hostname),
  scrape: (url, logs) => scrapeHtmlTables(url, logs, {
    agentName: 'pentagono',
    source: 'pentagono-html',
  }),
};
