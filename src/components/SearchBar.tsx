interface SearchBarProps {
  value: string;
  onChange: (query: string) => void;
}

/**
 * Text search input with a search icon and descriptive placeholder.
 */
export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative w-full">
      {/* Search icon */}
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <svg
          className="h-5 w-5 text-gray-400 dark:text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar por nome, produto, código, rating, agência ou indexador..."
        className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2.5 pl-10 pr-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 min-h-[44px] transition-colors"
        aria-label="Buscar ativos"
      />
    </div>
  );
}
