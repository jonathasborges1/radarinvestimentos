import type { FilterState } from '../types';
import { formatDate } from '../utils/formatting';

type SetFilter = (key: keyof FilterState, value: FilterState[keyof FilterState]) => void;

interface FilterTag {
  key: string;
  label: string;
  onRemove: () => void;
}

type ArrayKey = 'product' | 'indexer' | 'rating' | 'agency' | 'interestFrequency' | 'amortizationFrequency';
type BoolKey  = 'qualifiedInvestor' | 'professionalInvestor' | 'generalInvestor' | 'incentive' | 'guaranteeFGC';

const ARRAY_FIELDS: [ArrayKey, string][] = [
  ['product',               'Produto'],
  ['indexer',               'Indexador'],
  ['rating',                'Rating'],
  ['agency',                'Agência'],
  ['interestFrequency',     'Juros'],
  ['amortizationFrequency', 'Amortização'],
];

const BOOL_FIELDS: [BoolKey, string][] = [
  ['qualifiedInvestor',    'Inv. Qualificado'],
  ['professionalInvestor', 'Inv. Profissional'],
  ['generalInvestor',      'Inv. Geral'],
  ['incentive',            'Incentivado'],
  ['guaranteeFGC',         'FGC'],
];

function buildTags(filters: FilterState, setFilter: SetFilter): FilterTag[] {
  const tags: FilterTag[] = [];

  for (const [field, label] of ARRAY_FIELDS) {
    for (const val of filters[field]) {
      tags.push({
        key: `${field}-${val}`,
        label: `${label}: ${val}`,
        onRemove: () => setFilter(field, filters[field].filter((v) => v !== val)),
      });
    }
  }

  for (const [field, label] of BOOL_FIELDS) {
    const val = filters[field];
    if (val !== null) {
      tags.push({
        key: field,
        label: `${label}: ${val ? 'Sim' : 'Não'}`,
        onRemove: () => setFilter(field, null),
      });
    }
  }

  if (filters.maturityDateStart) {
    tags.push({
      key: 'maturityDateStart',
      label: `Vencimento de: ${formatDate(filters.maturityDateStart)}`,
      onRemove: () => setFilter('maturityDateStart', null),
    });
  }
  if (filters.maturityDateEnd) {
    tags.push({
      key: 'maturityDateEnd',
      label: `Vencimento até: ${formatDate(filters.maturityDateEnd)}`,
      onRemove: () => setFilter('maturityDateEnd', null),
    });
  }

  if (filters.feeMin !== null) {
    tags.push({
      key: 'feeMin',
      label: `Taxa ≥ ${filters.feeMin}%`,
      onRemove: () => setFilter('feeMin', null),
    });
  }
  if (filters.feeMax !== null) {
    tags.push({
      key: 'feeMax',
      label: `Taxa ≤ ${filters.feeMax}%`,
      onRemove: () => setFilter('feeMax', null),
    });
  }
  if (filters.riskMin !== null) {
    tags.push({
      key: 'riskMin',
      label: `Risco ≥ ${filters.riskMin}`,
      onRemove: () => setFilter('riskMin', null),
    });
  }
  if (filters.riskMax !== null) {
    tags.push({
      key: 'riskMax',
      label: `Risco ≤ ${filters.riskMax}`,
      onRemove: () => setFilter('riskMax', null),
    });
  }

  if (filters.search.trim()) {
    tags.push({
      key: 'search',
      label: `Busca: "${filters.search.trim()}"`,
      onRemove: () => setFilter('search', ''),
    });
  }

  return tags;
}

interface ActiveFilterTagsProps {
  filters: FilterState;
  onFilterChange: SetFilter;
  onClearFilters: () => void;
}

export function ActiveFilterTags({ filters, onFilterChange, onClearFilters }: ActiveFilterTagsProps) {
  const tags = buildTags(filters, onFilterChange);
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <span
          key={tag.key}
          className="inline-flex items-center gap-1 rounded-full border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300"
        >
          {tag.label}
          <button
            type="button"
            onClick={tag.onRemove}
            aria-label={`Remover filtro: ${tag.label}`}
            className="rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearFilters}
        className="text-xs font-medium text-gray-400 dark:text-gray-500 underline underline-offset-2 hover:text-red-500 dark:hover:text-red-400 transition-colors"
      >
        Limpar todos
      </button>
    </div>
  );
}
