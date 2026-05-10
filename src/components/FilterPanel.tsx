import { useState } from 'react';
import type { FilterState, FilterOptions } from '../types';

interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: FilterState[keyof FilterState]) => void;
  onClearFilters: () => void;
  availableOptions: FilterOptions;
  isMobile: boolean;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

interface SelectFilterProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

function SelectFilter({ label, options, selected, onChange }: SelectFilterProps) {
  const handleToggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  if (options.length === 0) return null;

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
        {options.map((option) => (
          <label
            key={option}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer select-none transition-colors min-h-[32px] ${
              selected.includes(option)
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => handleToggle(option)}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface BooleanFilterProps {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}

function BooleanFilter({ label, value, onChange }: BooleanFilterProps) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
        {label}
      </legend>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onChange(value === true ? null : true)}
          className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
            value === true
              ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
          aria-pressed={value === true}
        >
          Sim
        </button>
        <button
          type="button"
          onClick={() => onChange(value === false ? null : false)}
          className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
            value === false
              ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
          aria-pressed={value === false}
        >
          Não
        </button>
      </div>
    </fieldset>
  );
}

interface DateRangeFilterProps {
  label: string;
  startValue: string | null;
  endValue: string | null;
  onStartChange: (value: string | null) => void;
  onEndChange: (value: string | null) => void;
}

function DateRangeFilter({
  label,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
}: DateRangeFilterProps) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
        {label}
      </legend>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={startValue ?? ''}
          onChange={(e) => onStartChange(e.target.value || null)}
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[32px]"
          aria-label={`${label} - data inicial`}
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">até</span>
        <input
          type="date"
          value={endValue ?? ''}
          onChange={(e) => onEndChange(e.target.value || null)}
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[32px]"
          aria-label={`${label} - data final`}
        />
      </div>
    </fieldset>
  );
}

interface NumericRangeFilterProps {
  label: string;
  minValue: number | null;
  maxValue: number | null;
  onMinChange: (value: number | null) => void;
  onMaxChange: (value: number | null) => void;
  step?: number;
  placeholder?: { min?: string; max?: string };
}

function NumericRangeFilter({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  step = 0.1,
  placeholder,
}: NumericRangeFilterProps) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
        {label}
      </legend>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={minValue ?? ''}
          onChange={(e) =>
            onMinChange(e.target.value === '' ? null : Number(e.target.value))
          }
          step={step}
          placeholder={placeholder?.min ?? 'Mín'}
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[32px]"
          aria-label={`${label} - valor mínimo`}
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">até</span>
        <input
          type="number"
          value={maxValue ?? ''}
          onChange={(e) =>
            onMaxChange(e.target.value === '' ? null : Number(e.target.value))
          }
          step={step}
          placeholder={placeholder?.max ?? 'Máx'}
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[32px]"
          aria-label={`${label} - valor máximo`}
        />
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter Content (shared between desktop and mobile)                 */
/* ------------------------------------------------------------------ */

interface FilterContentProps {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: FilterState[keyof FilterState]) => void;
  onClearFilters: () => void;
  availableOptions: FilterOptions;
}

function FilterContent({
  filters,
  onFilterChange,
  onClearFilters,
  availableOptions,
}: FilterContentProps) {
  return (
    <div className="space-y-4">
      {/* Selection Filters */}
      <SelectFilter
        label="Produto"
        options={availableOptions.products}
        selected={filters.product}
        onChange={(val) => onFilterChange('product', val)}
      />
      <SelectFilter
        label="Indexador"
        options={availableOptions.indexers}
        selected={filters.indexer}
        onChange={(val) => onFilterChange('indexer', val)}
      />
      <SelectFilter
        label="Rating"
        options={availableOptions.ratings}
        selected={filters.rating}
        onChange={(val) => onFilterChange('rating', val)}
      />
      <SelectFilter
        label="Agência"
        options={availableOptions.agencies}
        selected={filters.agency}
        onChange={(val) => onFilterChange('agency', val)}
      />
      <SelectFilter
        label="Pagamento de Juros"
        options={availableOptions.interestFrequencies}
        selected={filters.interestFrequency}
        onChange={(val) => onFilterChange('interestFrequency', val)}
      />
      <SelectFilter
        label="Amortização"
        options={availableOptions.amortizationFrequencies}
        selected={filters.amortizationFrequency}
        onChange={(val) => onFilterChange('amortizationFrequency', val)}
      />

      {/* Boolean Filters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <BooleanFilter
          label="Investidor Qualificado"
          value={filters.qualifiedInvestor}
          onChange={(val) => onFilterChange('qualifiedInvestor', val)}
        />
        <BooleanFilter
          label="Investidor Profissional"
          value={filters.professionalInvestor}
          onChange={(val) => onFilterChange('professionalInvestor', val)}
        />
        <BooleanFilter
          label="Investidor Geral"
          value={filters.generalInvestor}
          onChange={(val) => onFilterChange('generalInvestor', val)}
        />
        <BooleanFilter
          label="Incentivo Fiscal"
          value={filters.incentive}
          onChange={(val) => onFilterChange('incentive', val)}
        />
        <BooleanFilter
          label="Garantia FGC"
          value={filters.guaranteeFGC}
          onChange={(val) => onFilterChange('guaranteeFGC', val)}
        />
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter
        label="Vencimento"
        startValue={filters.maturityDateStart}
        endValue={filters.maturityDateEnd}
        onStartChange={(val) => onFilterChange('maturityDateStart', val)}
        onEndChange={(val) => onFilterChange('maturityDateEnd', val)}
      />

      {/* Numeric Range Filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumericRangeFilter
          label="Taxa (%)"
          minValue={filters.feeMin}
          maxValue={filters.feeMax}
          onMinChange={(val) => onFilterChange('feeMin', val)}
          onMaxChange={(val) => onFilterChange('feeMax', val)}
          step={0.1}
          placeholder={{ min: 'Mín %', max: 'Máx %' }}
        />
        <NumericRangeFilter
          label="Risco"
          minValue={filters.riskMin}
          maxValue={filters.riskMax}
          onMinChange={(val) => onFilterChange('riskMin', val)}
          onMaxChange={(val) => onFilterChange('riskMax', val)}
          step={1}
          placeholder={{ min: 'Mín', max: 'Máx' }}
        />
      </div>

      {/* Clear Filters Button */}
      <button
        type="button"
        onClick={onClearFilters}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 min-h-[44px]"
      >
        Limpar filtros
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main FilterPanel Component                                         */
/* ------------------------------------------------------------------ */

/**
 * Filter panel that renders as a collapsible panel on desktop
 * and a slide-in drawer on mobile.
 */
export function FilterPanel({
  filters,
  onFilterChange,
  onClearFilters,
  availableOptions,
  isMobile,
}: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        {/* Mobile toggle button */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 min-h-[44px] min-w-[44px]"
          aria-label="Abrir filtros"
          aria-expanded={isOpen}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          Filtros
        </button>

        {/* Mobile drawer overlay */}
        {isOpen && (
          <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Painel de filtros">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            {/* Drawer panel */}
            <div className="relative z-50 flex w-full max-w-xs flex-col bg-white dark:bg-gray-800 shadow-xl overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Filtros</h2>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Fechar filtros"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="flex-1 px-4 py-4">
                <FilterContent
                  filters={filters}
                  onFilterChange={onFilterChange}
                  onClearFilters={onClearFilters}
                  availableOptions={availableOptions}
                />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop: collapsible panel
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 min-h-[44px]"
        aria-expanded={isOpen}
        aria-controls="filter-panel-content"
      >
        <span className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-gray-500 dark:text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          Filtros
        </span>
        <svg
          className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen && (
        <div id="filter-panel-content" className="border-t border-gray-200 dark:border-gray-700 px-4 py-4">
          <FilterContent
            filters={filters}
            onFilterChange={onFilterChange}
            onClearFilters={onClearFilters}
            availableOptions={availableOptions}
          />
        </div>
      )}
    </div>
  );
}
