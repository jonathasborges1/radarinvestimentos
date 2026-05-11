import type { AssetB3FinderInput, SearchHit } from './types';
import {
  cleanedIssuerName,
  detectProductCode,
  extractMaturityMonthName,
  extractMaturityMonthYear,
  type ProductCode,
  stripAccents,
  tokenize,
} from './normalize';

const PATTERN_CRA_CRI = /\b(?:CRA|CRI)\d[A-Z0-9]{7,11}\b/g;
const PATTERN_PREFIXLESS_IF = /\b\d{2}[A-Z]\d{7,8}\b/g;
const PATTERN_DEB = /\b[A-Z]{4}[0-9]{2,3}\b/g;
const PATTERN_TICKER_11 = /\b[A-Z]{4}11\b/g;

const WORD_BLOCKLIST = new Set([
  'CRIPTOMOEDAS',
  'CRIPTOGRAFIA',
  'CRIPTOATIVOS',
  'CRIATIVIDADE',
  'CRIMINALMENTE',
  'CRACOLANDIA',
  'CRACOLANDIAS',
]);

const MONTH_NAME_TO_NUMBER: Record<string, string> = {
  JAN: '01',
  FEV: '02',
  MAR: '03',
  ABR: '04',
  MAI: '05',
  JUN: '06',
  JUL: '07',
  AGO: '08',
  SET: '09',
  OUT: '10',
  NOV: '11',
  DEZ: '12',
};

const INDEXER_ALIASES: Record<string, string[]> = {
  PREFIXADO: ['PREFIXADO', 'PREFIXADA', 'PRE FIXADO', 'PRE FIXADA', 'PRE-FIXADO', 'PRE-FIXADA'],
  IPCA: ['IPCA'],
  CDI: ['CDI', 'DI'],
  SELIC: ['SELIC'],
  IGP_M: ['IGPM', 'IGP M', 'IGP-M'],
};

export const CONFIDENCE_THRESHOLDS = {
  found: 70,
  lowConfidence: 50,
} as const;

export interface ScoreBreakdown {
  total: number;
  parts: Record<string, number>;
  reasons: string[];
  rejections: string[];
}

function looksLikeRealCode(code: string): boolean {
  if (!/\d/.test(code)) return false;
  if (WORD_BLOCKLIST.has(code)) return false;
  return true;
}

function collectMatches(re: RegExp, haystack: string, into: Set<string>): void {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(haystack)) !== null) into.add(m[0]);
}

export function extractB3Candidates(
  text: string,
  productHint?: ProductCode | null,
): string[] {
  if (!text) return [];
  const upper = stripAccents(text).toUpperCase();
  const found = new Set<string>();

  if (!productHint || productHint === 'CRA' || productHint === 'CRI' || productHint === 'CDCA') {
    collectMatches(PATTERN_CRA_CRI, upper, found);
    collectMatches(PATTERN_PREFIXLESS_IF, upper, found);
  }
  if (!productHint || productHint === 'DEB') collectMatches(PATTERN_DEB, upper, found);
  if (!productHint) collectMatches(PATTERN_TICKER_11, upper, found);

  return Array.from(found).filter(looksLikeRealCode);
}

function compact(text: string): string {
  return stripAccents(text).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizedHaystack(hit: SearchHit): string {
  return stripAccents(`${hit.title}\n${hit.snippet}\n${hit.url}`).toUpperCase();
}

function extractMentionedMonthYears(upper: string): Set<string> {
  const found = new Set<string>();

  for (const match of upper.matchAll(/\b(?:\d{2}\/)?(\d{2})\/(\d{4})\b/g)) {
    const [, month, year] = match;
    if (Number(month) >= 1 && Number(month) <= 12) found.add(`${month}/${year}`);
  }

  for (const match of upper.matchAll(/\b(\d{4})-(\d{2})-\d{2}\b/g)) {
    const [, year, month] = match;
    if (Number(month) >= 1 && Number(month) <= 12) found.add(`${month}/${year}`);
  }

  for (const match of upper.matchAll(/\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/(\d{4})\b/g)) {
    const [, monthName, year] = match;
    found.add(`${MONTH_NAME_TO_NUMBER[monthName]}/${year}`);
  }

  return found;
}

function detectProductMentions(upper: string): Set<ProductCode> {
  const found = new Set<ProductCode>();
  if (/\bCRA\b|CRA\d/i.test(upper)) found.add('CRA');
  if (/\bCRI\b|CRI\d/i.test(upper)) found.add('CRI');
  if (/\bCDCA\b/i.test(upper)) found.add('CDCA');
  if (/\bDEB(?:ENTURE|ENTURES)?\b|DEBENTURE/i.test(upper)) found.add('DEB');
  if (/\bLF\b|LETRA FINANCEIRA/i.test(upper)) found.add('LF');
  return found;
}

function expectedIndexerKey(value: string | null | undefined): string | null {
  const text = compact(value || '');
  if (!text) return null;
  if (text.includes('PREFIXAD') || text.includes('PREFIXAD')) return 'PREFIXADO';
  if (text.includes('IPCA')) return 'IPCA';
  if (text.includes('CDI') || text === 'DI') return 'CDI';
  if (text.includes('SELIC')) return 'SELIC';
  if (text.includes('IGPM') || text.includes('IGP')) return 'IGP_M';
  return text;
}

function hasIndexer(upper: string, key: string): boolean {
  const variants = INDEXER_ALIASES[key] ?? [key];
  const haystack = compact(upper);
  return variants.some(variant => haystack.includes(compact(variant)));
}

function detectKnownIndexerMismatch(upper: string, expectedKey: string): boolean {
  return Object.keys(INDEXER_ALIASES)
    .filter(key => key !== expectedKey)
    .some(key => hasIndexer(upper, key));
}

function clampScore(score: number): number {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return Math.round(score);
}

type FrequencyKey = 'MENSAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'VENCIMENTO';

const FREQUENCY_PATTERNS: Record<FrequencyKey, RegExp> = {
  MENSAL: /\bmensal\b/i,
  BIMESTRAL: /\bbimestral\b/i,
  TRIMESTRAL: /\btrimestral\b/i,
  SEMESTRAL: /\bsemestral\b/i,
  ANUAL: /\banual\b/i,
  VENCIMENTO: /\bvencimento\b/i,
};

/**
 * Normaliza a descrição de periodicidade para uma chave canônica.
 * "Mensal a partir de: 15/02/2024" → "MENSAL"
 * "Semestral a partir de: 15/07/2024" → "SEMESTRAL"
 */
function normalizeFrequency(description: string | null | undefined): FrequencyKey | null {
  if (!description) return null;
  const text = description.toLowerCase();
  if (text.includes('mensal')) return 'MENSAL';
  if (text.includes('bimestral')) return 'BIMESTRAL';
  if (text.includes('trimestral')) return 'TRIMESTRAL';
  if (text.includes('semestral')) return 'SEMESTRAL';
  if (text.includes('anual')) return 'ANUAL';
  if (text.includes('vencimento')) return 'VENCIMENTO';
  return null;
}

/**
 * Verifica se o haystack menciona a periodicidade esperada.
 */
function hasFrequencyMention(upper: string, freq: FrequencyKey): boolean {
  return FREQUENCY_PATTERNS[freq].test(upper);
}

export function scoreHit(input: AssetB3FinderInput, hit: SearchHit): ScoreBreakdown {
  const upper = normalizedHaystack(hit);
  const parts: Record<string, number> = {
    nickName: 0,
    product: 0,
    maturity: 0,
    indexer: 0,
    productMismatch: 0,
    maturityMismatch: 0,
    indexerMismatch: 0,
  };
  const reasons: string[] = [];
  const rejections: string[] = [];

  const product = detectProductCode(input);
  const productMentions = detectProductMentions(upper);
  if (product) {
    if (productMentions.has(product) || upper.includes(product)) {
      parts.product = 1;
      reasons.push(`produto ${product} confirmado`);
    } else if (productMentions.size > 0) {
      parts.productMismatch = 1;
      rejections.push(`produto divergente (${Array.from(productMentions).join(', ')})`);
    }
  }

  const tokens = tokenize(cleanedIssuerName(input));
  if (tokens.length > 0) {
    const matched = tokens.filter(t => upper.includes(t));
    parts.nickName = matched.length / tokens.length;
    if (matched.length > 0) reasons.push(`nome/emissor: ${matched.join(' ')}`);
  }

  const my = extractMaturityMonthYear(input.maturityDate);
  const myName = extractMaturityMonthName(input.maturityDate);
  if (myName && upper.includes(myName)) {
    parts.maturity = 1;
    reasons.push(`vencimento exato ${myName}`);
  } else if (my && upper.includes(my)) {
    parts.maturity = 1;
    reasons.push(`vencimento exato ${my}`);
  } else if (input.maturityDate) {
    const year = input.maturityDate.slice(0, 4);
    if (/^\d{4}$/.test(year) && upper.includes(year)) {
      parts.maturity = 0.5;
      reasons.push(`ano de vencimento ${year}`);
    }
  }

  if (my && parts.maturity !== 1) {
    const mentionedMonthYears = extractMentionedMonthYears(upper);
    if (mentionedMonthYears.size > 0 && !mentionedMonthYears.has(my)) {
      parts.maturityMismatch = 1;
      rejections.push(`vencimento divergente (${Array.from(mentionedMonthYears).join(', ')})`);
    }
  }

  const indexerKey = expectedIndexerKey(input.indexers);
  if (indexerKey) {
    if (hasIndexer(upper, indexerKey)) {
      parts.indexer = 1;
      reasons.push(`indexador ${input.indexers} confirmado`);
    } else if (detectKnownIndexerMismatch(upper, indexerKey)) {
      parts.indexerMismatch = 1;
      rejections.push('indexador divergente');
    }
  }

  // Periodicidade de juros
  const interestFreq = normalizeFrequency(input.descriptionInterestrates);
  if (interestFreq) {
    if (hasFrequencyMention(upper, interestFreq)) {
      parts.interestFrequency = 1;
      reasons.push(`periodicidade juros: ${interestFreq}`);
    }
  }

  const rawScore =
    30 * parts.maturity +
    30 * parts.nickName +
    20 * parts.product +
    15 * parts.indexer +
    10 * (parts.interestFrequency || 0) -
    50 * parts.maturityMismatch -
    30 * parts.indexerMismatch -
    30 * parts.productMismatch;

  return {
    total: clampScore(rawScore),
    parts,
    reasons,
    rejections,
  };
}
