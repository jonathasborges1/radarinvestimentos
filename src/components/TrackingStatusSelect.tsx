interface TrackingStatusSelectProps {
  value: string | undefined;
  onChange: (status: string) => void;
}

const STATUS_OPTIONS = [
  { value: '', label: '— Selecione —' },
  { value: 'not_started', label: 'Não iniciado' },
  { value: 'watching', label: 'Acompanhando' },
  { value: 'completed', label: 'Concluído' },
  { value: 'ignored', label: 'Ignorado' },
] as const;

/**
 * Dropdown select for tracking status of an asset.
 */
export function TrackingStatusSelect({ value, onChange }: TrackingStatusSelectProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor="tracking-status-select"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Status de Acompanhamento
      </label>
      <select
        id="tracking-status-select"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Status de acompanhamento"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
