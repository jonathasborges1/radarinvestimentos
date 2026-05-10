interface ErrorStateProps {
  message: string;
}

/**
 * Displayed when the loaded JSON file is invalid or an error occurred.
 * Shows the error message in red with an error icon.
 */
export function ErrorState({ message }: ErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 px-4 text-center"
      role="alert"
    >
      {/* Error icon */}
      <svg
        className="h-16 w-16 text-red-400 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 8v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
        />
      </svg>
      <h2 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
        Erro ao carregar dados
      </h2>
      <p className="text-red-600 dark:text-red-400 max-w-md">{message}</p>
    </div>
  );
}
