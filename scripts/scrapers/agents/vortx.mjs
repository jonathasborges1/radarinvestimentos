import { scrapeHtmlTables } from '../shared/html-table-scraper.mjs';

const HOST_REGEX = /(?:^|\.)vortx\.com\.br$/i;

export const vortxPaymentScraper = {
  name: 'vortx',
  canHandle: url => HOST_REGEX.test(url.hostname),
  scrape: (url, logs) => scrapeHtmlTables(url, logs, {
    agentName: 'vortx',
    source: 'vortx-html',
  }),
};
