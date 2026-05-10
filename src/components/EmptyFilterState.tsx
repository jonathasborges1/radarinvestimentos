/**
 * Displayed when active filters produce no matching results.
 * Suggests the user adjust or clear filters.
 */
export function EmptyFilterState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      {/* Search icon */}
      <svg
        className="h-16 w-16 text-gray-400 dark:text-gray-500 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
        />
      </svg>
      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Nenhum resultado encontrado
      </h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm">
        Nenhum ativo corresponde aos filtros aplicados
      </p>
    </div>
  );
}
