import { useState, useCallback } from 'react';
import type { Asset, PaymentEvent } from '../types';
import { useAssets } from '../hooks/useAssets';
import { useFilters } from '../hooks/useFilters';
import { useSorting } from '../hooks/useSorting';
import { usePagination } from '../hooks/usePagination';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useNotification } from '../context/NotificationContext';
import { extractFilterOptions } from '../utils/filtering';
import { sortPaymentsNewestFirst } from '../utils/paymentMetrics';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { SearchBar } from './SearchBar';
import { FilterPanel } from './FilterPanel';
import { ActiveFilterTags } from './ActiveFilterTags';
import { AssetTable } from './AssetTable';
import { ColumnToggle } from './ColumnToggle';
import { Paginator } from './Paginator';
import { EmptyFilterState } from './EmptyFilterState';
import { EditModal } from './EditModal';
import { JsonViewModal } from './JsonViewModal';

/**
 * Orchestrates the data view: search, filters, table, and pagination.
 * Manages the data pipeline: assets → filtered → sorted → paginated.
 * Also manages the edit modal state.
 */
export function DataView() {
  const { state, updateAsset, markAssetRead } = useAssets();
  const { addNotification } = useNotification();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { orderedVisible, visibleColumns, toggle, showAll, resetToDefault, reorder } = useColumnVisibility();

  // Data pipeline
  const { filters, setFilter, clearFilters, filteredAssets } = useFilters(state.assets);
  const { sortConfig, toggleSort, sortedAssets } = useSorting(filteredAssets);
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    paginatedAssets,
    setPage,
    setItemsPerPage,
    pageInfo,
  } = usePagination(sortedAssets);

  // Filter options extracted from all loaded assets
  const availableOptions = extractFilterOptions(state.assets);

  // Edit modal state
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  // JSON view modal state
  const [viewingJsonAsset, setViewingJsonAsset] = useState<Asset | null>(null);

  const handleEdit = useCallback(
    (asset: Asset) => {
      setEditingAsset(asset);
      // Opening the modal counts as the user having seen the change —
      // the badge in the table can disappear, but `updatedFields` itself
      // remains on the asset so the modal panel still shows the diff.
      markAssetRead(asset);
    },
    [markAssetRead]
  );

  const handleViewJson = useCallback((asset: Asset) => {
    setViewingJsonAsset(asset);
  }, []);

  const handleModalClose = useCallback(() => {
    setEditingAsset(null);
  }, []);

  const handleJsonViewClose = useCallback(() => {
    setViewingJsonAsset(null);
  }, []);

  const handleModalSave = useCallback(
    (updatedAsset: Asset) => {
      updateAsset(updatedAsset.code, updatedAsset);
      setEditingAsset(null);
      addNotification('success', 'Ativo atualizado com sucesso.');
    },
    [updateAsset, addNotification]
  );

  /**
   * Persiste imediatamente o histórico de pagamentos retornado pelo
   * agente fiduciário — sem precisar do clique em "Salvar". Atualiza
   * apenas `paymentSchedule` e `paymentScheduleUpdatedAt`, preservando
   * quaisquer edições em curso nos demais campos do modal.
   *
   * Atualiza também o `editingAsset` local para que o modal reflita
   * o estado salvo (timestamp e dados atuais) sem fechar.
   */
  const handlePaymentsFetched = useCallback(
    (code: number | string, payments: PaymentEvent[], fetchedAt: string) => {
      const sortedPayments = sortPaymentsNewestFirst(payments);
      updateAsset(code, {
        paymentSchedule: sortedPayments.length > 0 ? sortedPayments : undefined,
        paymentScheduleUpdatedAt: sortedPayments.length > 0 ? fetchedAt : undefined,
      });
      setEditingAsset((current) =>
        current && current.code === code
          ? {
              ...current,
              paymentSchedule: sortedPayments.length > 0 ? sortedPayments : undefined,
              paymentScheduleUpdatedAt: sortedPayments.length > 0 ? fetchedAt : undefined,
            }
          : current,
      );
      addNotification(
        'success',
        `Histórico salvo: ${sortedPayments.length} pagamento(s) persistido(s) localmente.`,
      );
    },
    [updateAsset, addNotification],
  );

  /**
   * Persiste imediatamente uma alteração na lista de URLs de agentes
   * fiduciários (Enter, remoção ou seleção de chip). Mesmo padrão de
   * `handlePaymentsFetched`: atualiza apenas o campo correspondente,
   * preservando demais edições em curso.
   */
  const handleUrlsCommitted = useCallback(
    (code: number | string, urls: string[]) => {
      const cleaned = urls.map((u) => u.trim()).filter((u) => u.length > 0);
      updateAsset(code, {
        fiduciaryAgentUrls: cleaned.length > 0 ? cleaned : undefined,
      });
      setEditingAsset((current) =>
        current && current.code === code
          ? { ...current, fiduciaryAgentUrls: cleaned.length > 0 ? cleaned : undefined }
          : current,
      );
      addNotification(
        'success',
        cleaned.length > 0
          ? `Agentes fiduciários salvos (${cleaned.length} URL${cleaned.length > 1 ? 's' : ''}).`
          : 'Lista de agentes fiduciários limpa.',
      );
    },
    [updateAsset, addNotification],
  );

  const filterTagsEl = (
    <ActiveFilterTags
      filters={filters}
      onFilterChange={setFilter}
      onClearFilters={clearFilters}
    />
  );

  // Show empty filter state when filters are active but no results
  if (filteredAssets.length === 0) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <SearchBar value={filters.search} onChange={(q) => setFilter('search', q)} />
        <FilterPanel
          filters={filters}
          onFilterChange={setFilter}
          onClearFilters={clearFilters}
          availableOptions={availableOptions}
          isMobile={isMobile}
        />
        {filterTagsEl}
        <EmptyFilterState />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <SearchBar value={filters.search} onChange={(q) => setFilter('search', q)} />
      <FilterPanel
        filters={filters}
        onFilterChange={setFilter}
        onClearFilters={clearFilters}
        availableOptions={availableOptions}
        isMobile={isMobile}
      />
      {filterTagsEl}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-700 dark:text-gray-200">
            {sortedAssets.length}
          </span>
          {sortedAssets.length !== state.assets.length && (
            <>
              {' '}de{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {state.assets.length}
              </span>
            </>
          )}
          {' '}ativos
        </p>
        {!isMobile && (
          <ColumnToggle
            visibleColumns={visibleColumns}
            onToggle={toggle}
            onShowAll={showAll}
            onReset={resetToDefault}
          />
        )}
      </div>
      <AssetTable
        assets={paginatedAssets}
        sortConfig={sortConfig}
        onSort={toggleSort}
        onEdit={handleEdit}
        onViewJson={handleViewJson}
        selectedAsset={editingAsset ?? viewingJsonAsset}
        isMobile={isMobile}
        orderedVisible={orderedVisible}
        onReorder={reorder}
      />
      <Paginator
        currentPage={currentPage}
        totalItems={sortedAssets.length}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        onPageChange={setPage}
        onItemsPerPageChange={setItemsPerPage}
        pageInfo={pageInfo}
      />
      <EditModal
        asset={editingAsset}
        isOpen={editingAsset !== null}
        onSave={handleModalSave}
        onClose={handleModalClose}
        onPaymentsFetched={handlePaymentsFetched}
        onUrlsCommitted={handleUrlsCommitted}
        isMobile={isMobile}
      />
      <JsonViewModal
        asset={viewingJsonAsset}
        isOpen={viewingJsonAsset !== null}
        onClose={handleJsonViewClose}
        isMobile={isMobile}
      />
    </div>
  );
}
