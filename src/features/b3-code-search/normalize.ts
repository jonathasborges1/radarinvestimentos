import type { AssetB3FinderInput } from './types';

/**
 * Funções puras de normalização aplicadas à entrada antes de qualquer
 * busca. Isoladas aqui para serem trivialmente testáveis e reutilizáveis
 * pelo scoring (caller passa o mesmo input para `scoreHit`).
 */

const ACCENT_MAP = /[̀-ͯ]/g;
const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos',
  'a', 'o', 'as', 'os',
  'e', 'em', 'no', 'na', 'nos', 'nas',
]);

const MONTH_NAMES = [
  'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
  'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ',
];
const MONTH_YEAR_RE =
  /\b(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[/\s-]?\d{4}\b|\b\d{1,2}\/\d{4}\b|\b\d{4}\b/g;

export function stripAccents(input: string): string {
  return input.normalize('NFD').replace(ACCENT_MAP, '');
}

export function normalizeSearchText(input: string): string {
  return stripAccents(input)
    .toUpperCase()
    .replace(/[-_.,;:()[\]{}"'`´^~!@#$%&*+=?|\\/<>]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAssetName(value: string): string {
  return normalizeSearchText(value)
    .replace(MONTH_YEAR_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokeniza removendo acentos, pontuação e stopwords curtas. Tokens
 * unitários são descartados — não agregam sinal e geram falso positivo
 * em qualquer página com letras avulsas.
 */
export function tokenize(input: string): string[] {
  return normalizeSearchText(input)
    .split(' ')
    .filter(t => t && t.length > 1 && !STOPWORDS.has(t.toLowerCase()));
}

/** "2030-07-15T00:00:00" → "07/2030". Retorna null para entradas inválidas. */
export function extractMaturityMonthYear(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return null;
  return `${m[2]}/${m[1]}`;
}

/** "2030-07-15T00:00:00" → "JUL/2030". Casa com o estilo dos nicknames. */
export function extractMaturityMonthName(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return null;
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  return `${MONTH_NAMES[month - 1]}/${m[1]}`;
}

/** "19,550%" → 19.55. Retorna null para entradas inválidas. */
export function parseFeePercent(fee: string | null | undefined): number | null {
  if (!fee) return null;
  const cleaned = String(fee).replace(/\s/g, '').replace('%', '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Núcleo do nickName, sem o sufixo de mês/ano e sem hífens. Ex.:
 *   "CRA FS BIO - JUL/2030"  → "CRA FS BIO"
 *   "CRA AGRO - 07/2030"     → "CRA AGRO"
 */
export function cleanedAssetName(input: AssetB3FinderInput): string {
  return stripAccents(input.nickName)
    .toUpperCase()
    .replace(/\b(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/\d{4}\b/g, '')
    .replace(/\b\d{1,2}\/\d{4}\b/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normaliza o produto declarado para um dos códigos canônicos usados na
 * extração de candidatos B3. Retorna null para produtos não cobertos.
 */
export type ProductCode = 'CRA' | 'CRI' | 'DEB' | 'CDCA' | 'LF';

export function detectProductCode(input: AssetB3FinderInput): ProductCode | null {
  const product = stripAccents(input.product || '').toUpperCase();
  if (product.includes('CDCA')) return 'CDCA';
  if (product.includes('CRA')) return 'CRA';
  if (product.includes('CRI')) return 'CRI';
  if (product.includes('DEBE')) return 'DEB';
  if (product === 'LF' || product.includes('LETRA FINANCEIRA')) return 'LF';
  return null;
}

/**
 * Aliases de prefixo de produto comumente usados pelas corretoras no
 * apelido do ativo. Removidos para isolar o nome do emissor.
 */
const PRODUCT_ALIASES: Record<ProductCode, RegExp> = {
  CRA: /\b(?:CRA)\b/g,
  CRI: /\b(?:CRI)\b/g,
  DEB: /\b(?:DEB|DEBENTURE|DEBENTURES)\b/g,
  CDCA: /\b(?:CDCA)\b/g,
  LF: /\b(?:LF|LETRA\s+FINANCEIRA)\b/g,
};

/**
 * Remove o prefixo do produto do nome para isolar o emissor.
 *   "CRA REDE SIM"      → "REDE SIM"
 *   "Debênture ABCD"    → "ABCD"
 *   "CRA FS BIO"        → "FS BIO"
 * Fonte oficial (securitizadora, agente fiduciário) raramente repete o
 * produto no nome do emissor — usar o emissor "limpo" amplia o recall.
 */
export function stripProductFromName(name: string, product: ProductCode | null): string {
  if (!product) return name;
  return name
    .replace(PRODUCT_ALIASES[product], ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nome só do emissor: nickName sem mês/ano e sem o prefixo do produto.
 */
export function cleanedIssuerName(input: AssetB3FinderInput): string {
  return stripProductFromName(cleanedAssetName(input), detectProductCode(input));
}

export function extractStrongTerms(input: AssetB3FinderInput): string[] {
  const product = detectProductCode(input);
  const year = input.maturityDate?.match(/^(\d{4})/)?.[1] ?? null;
  return Array.from(new Set([
    product,
    ...tokenize(cleanedIssuerName(input)),
    year,
  ].filter((value): value is string => Boolean(value))));
}
