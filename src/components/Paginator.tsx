interface PaginatorProps {
  currentPage: number;
  totalItems: number;
  totalPages: number;
  itemsPerPage: number | 'all';
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (count: number | 'all') => void;
  pageInfo: { start: number; end: number; total: number };
}

const ITEMS_PER_PAGE_OPTIONS: { label: string; value: number | 'all' }[] = [
  { label: '10', value: 10 },
  { label: '25', value: 25 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
  { label: 'Todos', value: 'all' },
];

/**
 * Pagination controls with page navigation and items-per-page selector.
 * Hides navigation when totalPages <= 1.
 */
export function Paginator({
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  pageInfo,
}: PaginatorProps) {
  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onItemsPerPageChange(val === 'all' ? 'all' : Number(val));
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 transition-colors">
      {/* Info text */}
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Exibindo{' '}
        <span className="font-medium">{pageInfo.start}</span>
        –
        <span className="font-medium">{pageInfo.end}</span>
        {' '}de{' '}
        <span className="font-medium">{pageInfo.total}</span>
        {' '}ativos
      </p>

      <div className="flex items-center gap-4">
        {/* Items per page selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="items-per-page" className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
            Por página:
          </label>
          <select
            id="items-per-page"
            value={itemsPerPage === 'all' ? 'all' : String(itemsPerPage)}
            onChange={handleItemsPerPageChange}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[36px]"
          >
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Navigation controls - hidden when totalPages <= 1 */}
        {totalPages > 1 && (
          <nav className="flex items-center gap-1" aria-label="Paginação">
            {/* First page */}
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px] min-w-[36px]"
              aria-label="Primeira página"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>

            {/* Previous page */}
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px] min-w-[36px]"
              aria-label="Página anterior"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Current page indicator */}
            <span className="px-2 text-sm font-medium text-gray-700 dark:text-gray-300" aria-current="page">
              {currentPage} / {totalPages}
            </span>

            {/* Next page */}
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px] min-w-[36px]"
              aria-label="Próxima página"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Last page */}
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px] min-w-[36px]"
              aria-label="Última página"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
