import { useAssets } from '../hooks/useAssets';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { DataView } from './DataView';

/**
 * Main content area that conditionally renders based on the application status.
 * - empty → EmptyState (no data loaded)
 * - loading → LoadingState (file being processed)
 * - error → ErrorState (invalid file or read error)
 * - loaded → DataView (full data view with filters, table, pagination)
 */
export function MainContent() {
  const { state } = useAssets();

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') return <ErrorState message={state.errorMessage ?? 'Erro desconhecido'} />;
  if (state.status === 'empty') return <EmptyState />;
  return <DataView />;
}
