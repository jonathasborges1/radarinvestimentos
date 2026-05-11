import { scrapeHtmlTables } from '../shared/html-table-scraper.mjs';

const HOST_REGEX = /(?:^|\.)ecoagro\.agr\.br$/i;

export const ecoagroPaymentScraper = {
  name: 'ecoagro',
  canHandle: url => HOST_REGEX.test(url.hostname),
  scrape: (url, logs) => scrapeHtmlTables(url, logs, {
    agentName: 'ecoagro',
    source: 'ecoagro-html',
  }),
};
