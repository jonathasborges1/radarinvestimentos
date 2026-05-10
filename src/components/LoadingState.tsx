/**
 * Displayed while a JSON file is being loaded and validated.
 * Shows a spinner animation.
 */
export function LoadingState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 px-4 text-center"
      role="status"
      aria-label="Carregando"
    >
      {/* Spinner */}
      <svg
        className="h-12 w-12 text-blue-500 mb-4 animate-[spin_1s_linear_infinite]"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      <p className="text-gray-600 dark:text-gray-400 font-medium">Carregando dados…</p>
    </div>
  );
}
