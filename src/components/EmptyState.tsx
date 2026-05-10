/**
 * Displayed when no file has been loaded and no data exists in localStorage.
 * Instructs the user to load a JSON file.
 */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      {/* Upload icon */}
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
          d="M12 16V4m0 0l-4 4m4-4l4 4M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"
        />
      </svg>
      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Nenhum dado carregado
      </h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm">
        Carregue um arquivo JSON para começar
      </p>
    </div>
  );
}
