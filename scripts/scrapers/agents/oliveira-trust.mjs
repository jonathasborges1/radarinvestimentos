import { scrapeHtmlTables } from '../shared/html-table-scraper.mjs';

const HOST_REGEX = /(?:^|\.)oliveiratrust\.com\.br$/i;

export const oliveiraTrustPaymentScraper = {
  name: 'oliveira-trust',
  canHandle: url => HOST_REGEX.test(url.hostname),
  scrape: (url, logs) => scrapeHtmlTables(url, logs, {
    agentName: 'oliveira-trust',
    source: 'oliveira-trust-html',
  }),
};
