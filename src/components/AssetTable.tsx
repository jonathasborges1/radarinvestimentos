import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Asset, SortConfig, SortableColumn } from '../types';
import type { ColumnKey, ColumnDef } from '../types/column';
import { ALL_COLUMNS } from '../config/columns';
import { formatDate, formatCurrency, formatNumber, displayValue } from '../utils/formatting';
import { computePaymentMetrics, type PaymentRating } from '../utils/paymentMetrics';

const AGENTS_STORAGE_KEY = 'yield-radar-fiduciary-agents';

interface AgentEntry {
  name: string;
  url: string;
}

function loadAgentsList(): AgentEntry[] {
  try {
    const stored = localStorage.getItem(AGENTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [
    { name: 'Virgo', url: 'https://www.virgo.com.br' },
    { name: 'Opea', url: 'https://www.opea.com.br' },
    { name: 'Vórtx', url: 'https://www.vortx.com.br' },
    { name: 'Oliveira Trust', url: 'https://www.oliveiratrust.com.br' },
    { name: 'Pentágono', url: 'https://www.pentagonotrustee.com.br' },
    { name: 'Planner', url: 'https://www.plfrm.com.br' },
    { name: 'Simplific Pavarini', url: 'https://www.simplific.com.br' },
  ];
}

/**
 * Resolves the agent name from a URL by matching against known agents.
 * Falls back to extracting the meaningful domain name if no match is found.
 */
function resolveAgentName(url: string, agents: AgentEntry[]): string {
  // Exact match
  const exact = agents.find((a) => a.url === url);
  if (exact) return exact.name;

  // Match by base domain (ignore subdomains like app., portal., www.)
  try {
    const urlHostname = new URL(url).hostname.toLowerCase();
    const byDomain = agents.find((a) => {
      try {
        const agentHostname = new URL(a.url).hostname.toLowerCase();
        // Check if they share the same base domain
        return urlHostname === agentHostname ||
          urlHostname.endsWith('.' + agentHostname.replace(/^www\./, '')) ||
          agentHostname.endsWith('.' + urlHostname.replace(/^www\./, '')) ||
          getBaseDomain(urlHostname) === getBaseDomain(agentHostname);
      } catch { return false; }
    });
    if (byDomain) return byDomain.name;
  } catch { /* ignore */ }

  // Fallback: extract the meaningful part of the domain
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const name = extractMeaningfulName(hostname);
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return 'Link';
  }
}

/** Common subdomains to skip when extracting the meaningful domain name */
const COMMON_SUBDOMAINS = new Set(['www', 'app', 'portal', 'api', 'web', 'sistema', 'plataforma', 'painel', 'admin', 'secure', 'my']);

/** Extracts the base domain (e.g., "opea.com.br" from "app.opea.com.br") */
function getBaseDomain(hostname: string): string {
  const parts = hostname.split('.');
  // For .com.br style TLDs, keep last 3 parts; otherwise last 2
  if (parts.length >= 3 && parts[parts.length - 1].length <= 3 && parts[parts.length - 2].length <= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/** Extracts the meaningful name from a hostname, skipping common subdomains */
function extractMeaningfulName(hostname: string): string {
  const parts = hostname.split('.');
  // Skip common subdomains from the left
  for (const part of parts) {
    if (!COMMON_SUBDOMAINS.has(part) && part.length > 2) {
      return part;
    }
  }
  // If all parts are common subdomains, return the first non-TLD part
  return parts[0];
}

interface AssetTableProps {
  assets: Asset[];
  sortConfig: SortConfig;
  onSort: (column: SortableColumn) => void;
  onEdit: (asset: Asset) => void;
  onViewJson: (asset: Asset) => void;
  isMobile: boolean;
  orderedVisible: ColumnKey[];
  onReorder: (newOrder: ColumnKey[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Fiduciary agent links cell                                          */
/* ------------------------------------------------------------------ */

function FiduciaryAgentLinks({
  urls,
  agents,
  stopPropagation = false,
}: {
  urls: string[] | undefined;
  agents: AgentEntry[];
  stopPropagation?: boolean;
}) {
  const list = (urls ?? []).filter((u) => u && u.trim().length > 0);
  if (list.length === 0) {
    return <span className="text-gray-400 dark:text-gray-500">—</span>;
  }
  const [primary, ...rest] = list;
  const restTitle = rest.length > 0 ? rest.map((u) => `${resolveAgentName(u, agents)} — ${u}`).join('\n') : '';
  return (
    <span className="inline-flex items-center gap-1">
      <a
        href={primary}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 text-xs"
        title={primary}
        onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      >
        {resolveAgentName(primary, agents)}
      </a>
      {rest.length > 0 && (
        <span
          className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300"
          title={restTitle}
        >
          +{rest.length}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Sort Indicator                                                      */
/* ------------------------------------------------------------------ */

function SortIndicator({ column, sortConfig }: { column: SortableColumn; sortConfig: SortConfig }) {
  if (sortConfig.column !== column) {
    return (
      <svg className="ml-1 h-3 w-3 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }
  return sortConfig.direction === 'asc' ? (
    <svg className="ml-1 h-3 w-3 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="ml-1 h-3 w-3 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Drag-handle icon                                                    */
/* ------------------------------------------------------------------ */

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="2"  r="1.4" />
      <circle cx="7" cy="2"  r="1.4" />
      <circle cx="3" cy="7"  r="1.4" />
      <circle cx="7" cy="7"  r="1.4" />
      <circle cx="3" cy="12" r="1.4" />
      <circle cx="7" cy="12" r="1.4" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Sortable Header Cell (drag + sort)                                  */
/* ------------------------------------------------------------------ */

function SortableHeaderCell({
  col,
  sortConfig,
  onSort,
}: {
  col: ColumnDef;
  sortConfig: SortConfig;
  onSort: (c: SortableColumn) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: col.key,
  });

  return (
    <th
      ref={setNodeRef}
      scope="col"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`px-3 py-3 text-left text-xs font-medium uppercase tracking-wider select-none whitespace-nowrap transition-colors ${
        isDragging
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 opacity-60'
          : 'text-gray-500 dark:text-gray-400'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span
          {...attributes}
          {...listeners}
          title="Arrastar para reordenar"
          className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500 shrink-0 touch-none"
        >
          <GripIcon />
        </span>
        {col.sortable ? (
          <button
            type="button"
            onClick={() => onSort(col.sortable!)}
            className="group inline-flex items-center gap-0.5 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus:text-blue-600 dark:focus:text-blue-400"
            aria-label={`Ordenar por ${col.label}`}
          >
            {col.label}
            <SortIndicator column={col.sortable} sortConfig={sortConfig} />
          </button>
        ) : (
          <span>{col.label}</span>
        )}
      </div>
    </th>
  );
}

/* ------------------------------------------------------------------ */
/*  Static Header Cell (pinned — no drag)                              */
/* ------------------------------------------------------------------ */

function StaticHeaderCell({ col }: { col: ColumnDef }) {
  return (
    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
      {col.label}
    </th>
  );
}

/* ------------------------------------------------------------------ */
/*  Updated Badge (asset has unread changes from last upload)          */
/* ------------------------------------------------------------------ */

function UpdatedBadge({ asset }: { asset: Asset }) {
  if (!asset.hasUnreadChanges) return null;
  const fields = asset.updatedFields ? Object.keys(asset.updatedFields) : [];
  const tooltip =
    fields.length > 0
      ? `Atualizado no último upload — ${fields.join(', ')}`
      : 'Atualizado no último upload';
  return (
    <span
      title={tooltip}
      role="img"
      aria-label={tooltip}
      className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500 dark:bg-amber-400"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Cell & Header renderers                                             */
/* ------------------------------------------------------------------ */

const BASE_TD = 'px-3 py-3 text-sm text-gray-600 dark:text-gray-300';
const ACTION_COLUMN = 'w-24 min-w-24 px-3 py-3 text-center align-middle';
const ACTION_COLUMN_STYLE = { width: '6rem', minWidth: '6rem', maxWidth: '6rem' } as const;

function yesNo(value: string | boolean | null | undefined): string {
  if (value === true  || value === 'S') return 'Sim';
  if (value === false || value === 'N') return 'Não';
  return displayValue(value);
}

const PAYMENT_RATING_LABEL: Record<PaymentRating, string> = {
  ruim: 'Ruim',
  regular: 'Regular',
  excelente: 'Excelente',
};

const PAYMENT_RATING_CLASS: Record<PaymentRating, string> = {
  ruim: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  regular: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  excelente: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
};

function formatPaymentRatio(ratio: number | null): string {
  if (ratio == null) return '—';
  return `${(ratio * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function PaymentVsPuMinCellContent({ asset }: { asset: Asset }) {
  const metrics = computePaymentMetrics(asset.paymentSchedule, asset.puMinValue);
  const ratio = metrics.ratio12m ?? metrics.ratio6m;
  const average = metrics.avg12m ?? metrics.avg6m;
  const count = metrics.ratio12m != null ? metrics.count12m : metrics.count6m;
  const windowLabel = metrics.ratio12m != null ? '12m' : '6m';

  if (ratio == null || !metrics.rating) {
    return <span className="text-gray-400 dark:text-gray-500">—</span>;
  }

  const title = `Média ${windowLabel}: ${formatCurrency(average)} · ${count} pagamento(s)`;
  return (
    <div className="flex items-center gap-2 whitespace-nowrap" title={title}>
      <span className="font-medium text-gray-900 dark:text-gray-100">
        {formatPaymentRatio(ratio)}
      </span>
      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PAYMENT_RATING_CLASS[metrics.rating]}`}>
        {PAYMENT_RATING_LABEL[metrics.rating]}
      </span>
    </div>
  );
}

function renderDesktopCell(key: ColumnKey, asset: Asset, onEdit: (a: Asset) => void, onViewJson: (a: Asset) => void, agents: AgentEntry[]): React.ReactNode {
  switch (key) {
    case 'nickName':
      return <td key={key} className={`${BASE_TD} font-medium text-gray-900 dark:text-gray-100`} title={asset.nickName}>{displayValue(asset.nickName)}</td>;
    case 'code':
      return <td key={key} className={BASE_TD}>{displayValue(asset.code)}</td>;
    case 'product':
      return <td key={key} className={BASE_TD}>{displayValue(asset.product)}</td>;
    case 'fee':
      return <td key={key} className={BASE_TD}>{displayValue(asset.fee)}</td>;
    case 'maturityDate':
      return <td key={key} className={`${BASE_TD} whitespace-nowrap`}>{formatDate(asset.maturityDate)}</td>;
    case 'puMinValue':
      return <td key={key} className={`${BASE_TD} whitespace-nowrap`}>{formatCurrency(asset.puMinValue ?? null)}</td>;
    case 'paymentVsPuMin':
      return <td key={key} className={BASE_TD}><PaymentVsPuMinCellContent asset={asset} /></td>;
    case 'minimumQuantityForApplication':
      return <td key={key} className={BASE_TD}>{formatNumber(asset.minimumQuantityForApplication ?? null)}</td>;
    case 'quantityAvailable':
      return <td key={key} className={`${BASE_TD} whitespace-nowrap`}>{formatNumber(asset.quantityAvailable ?? null)}</td>;
    case 'indexers':
      return <td key={key} className={BASE_TD}>{displayValue(asset.indexers)}</td>;
    case 'ratingName':
      return <td key={key} className={BASE_TD}>{displayValue(asset.ratingName)}</td>;
    case 'agencyName':
      return <td key={key} className={BASE_TD}>{displayValue(asset.agencyName)}</td>;
    case 'riskScore':
      return <td key={key} className={BASE_TD}>{displayValue(asset.riskScore)}</td>;
    case 'descriptionInterestrates':
      return <td key={key} className={BASE_TD}>{displayValue(asset.descriptionInterestrates)}</td>;
    case 'descriptionAmortization':
      return <td key={key} className={BASE_TD}>{displayValue(asset.descriptionAmortization)}</td>;
    case 'graceDate':
      return <td key={key} className={`${BASE_TD} whitespace-nowrap`}>{formatDate(asset.graceDate)}</td>;
    case 'redemptionType':
      return <td key={key} className={BASE_TD}>{displayValue(asset.redemptionType)}</td>;
    case 'incentive':
      return <td key={key} className={BASE_TD}>{yesNo(asset.incentive)}</td>;
    case 'guaranteeFGC':
      return <td key={key} className={BASE_TD}>{yesNo(asset.guaranteeFGC)}</td>;
    case 'qualifiedInvestor':
      return <td key={key} className={BASE_TD}>{yesNo(asset.qualifiedInvestor)}</td>;
    case 'professionalInvestor':
      return <td key={key} className={BASE_TD}>{yesNo(asset.professionalInvestor)}</td>;
    case 'generalInvestor':
      return <td key={key} className={BASE_TD}>{yesNo(asset.generalInvestor)}</td>;
    case 'prefixedFeeValue':
      return <td key={key} className={BASE_TD}>{displayValue(asset.prefixedFeeValue)}</td>;
    case 'b3Code':
      return <td key={key} className={BASE_TD}>{displayValue(asset.b3Code)}</td>;
    case 'fiduciaryAgentUrl':
      return (
        <td key={key} className="px-3 py-3 text-sm">
          <FiduciaryAgentLinks urls={asset.fiduciaryAgentUrls} agents={agents} />
        </td>
      );
    case 'notes':
      return <td key={key} className={`${BASE_TD} max-w-40 truncate`} title={asset.notes ?? ''}>{displayValue(asset.notes)}</td>;
    case 'favorite':
      return <td key={key} className={BASE_TD}>{asset.favorite ? '★' : '—'}</td>;
    case 'tags':
      return <td key={key} className={BASE_TD}>{asset.tags && asset.tags.length > 0 ? asset.tags.join(', ') : '—'}</td>;
    case 'trackingStatus':
      return <td key={key} className={BASE_TD}>{displayValue(asset.trackingStatus)}</td>;
    case 'actions':
      return (
        <td key={key} className={ACTION_COLUMN} style={ACTION_COLUMN_STYLE}>
          <div className="flex justify-center items-center gap-1">
            <UpdatedBadge asset={asset} />
            <button
              type="button"
              onClick={() => onViewJson(asset)}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`Ver JSON de ${asset.nickName}`}
              title="Ver JSON"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onEdit(asset)}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`Editar ${asset.nickName}`}
              title="Editar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        </td>
      );
    default:
      return <td key={key} className={BASE_TD}>—</td>;
  }
}

/* ------------------------------------------------------------------ */
/*  Mobile detail value helper                                          */
/* ------------------------------------------------------------------ */

function mobileDetailValue(key: ColumnKey, asset: Asset, agents: AgentEntry[]): React.ReactNode {
  switch (key) {
    case 'maturityDate': return formatDate(asset.maturityDate);
    case 'graceDate':    return formatDate(asset.graceDate);
    case 'puMinValue':   return formatCurrency(asset.puMinValue ?? null);
    case 'paymentVsPuMin': return <PaymentVsPuMinCellContent asset={asset} />;
    case 'minimumQuantityForApplication': return formatNumber(asset.minimumQuantityForApplication ?? null);
    case 'quantityAvailable': return formatNumber(asset.quantityAvailable ?? null);
    case 'incentive':        return yesNo(asset.incentive);
    case 'guaranteeFGC':     return yesNo(asset.guaranteeFGC);
    case 'qualifiedInvestor':    return yesNo(asset.qualifiedInvestor);
    case 'professionalInvestor': return yesNo(asset.professionalInvestor);
    case 'generalInvestor':      return yesNo(asset.generalInvestor);
    case 'favorite': return asset.favorite ? '★ Sim' : 'Não';
    case 'tags': return asset.tags && asset.tags.length > 0 ? asset.tags.join(', ') : '—';
    case 'fiduciaryAgentUrl':
      return <FiduciaryAgentLinks urls={asset.fiduciaryAgentUrls} agents={agents} stopPropagation />;
    default: {
      const raw = (asset as Record<string, unknown>)[key];
      return displayValue(raw);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Mobile Expandable Row                                               */
/* ------------------------------------------------------------------ */

function MobileRow({
  asset,
  onEdit,
  orderedVisible,
  agents,
}: {
  asset: Asset;
  onEdit: (a: Asset) => void;
  orderedVisible: ColumnKey[];
  agents: AgentEntry[];
}) {
  const [expanded, setExpanded] = useState(false);

  const detailCols = orderedVisible
    .map((k) => ALL_COLUMNS.find((c) => c.key === k)!)
    .filter((c) => c && !c.pinned && c.group !== 'ui');

  return (
    <>
      <tr
        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium max-w-35 truncate">
          {displayValue(asset.nickName)}
        </td>
        <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">{displayValue(asset.product)}</td>
        <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">{displayValue(asset.fee)}</td>
        <td className={ACTION_COLUMN} style={ACTION_COLUMN_STYLE}>
          <div className="flex items-center justify-center gap-1">
            <UpdatedBadge asset={asset} />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(asset); }}
              className="inline-flex items-center justify-center rounded-md p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-11 min-w-11"
              aria-label={`Editar ${asset.nickName}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
      {expanded && detailCols.length > 0 && (
        <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <td colSpan={4} className="px-4 py-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {detailCols.map((col) => (
                <div key={col.key}>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">{col.label}</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{mobileDetailValue(col.key, asset, agents)}</dd>
                </div>
              ))}
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Desktop Table Row                                                   */
/* ------------------------------------------------------------------ */

function DesktopRow({
  asset,
  onEdit,
  onViewJson,
  orderedVisible,
  agents,
}: {
  asset: Asset;
  onEdit: (a: Asset) => void;
  onViewJson: (a: Asset) => void;
  orderedVisible: ColumnKey[];
  agents: AgentEntry[];
}) {
  return (
    <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
      {orderedVisible.map((key) => renderDesktopCell(key, asset, onEdit, onViewJson, agents))}
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Main AssetTable Component                                           */
/* ------------------------------------------------------------------ */

export function AssetTable({
  assets,
  sortConfig,
  onSort,
  onEdit,
  onViewJson,
  isMobile,
  orderedVisible,
  onReorder,
}: AssetTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const agents = useMemo(() => loadAgentsList(), []);
  const colMap = new Map(ALL_COLUMNS.map((c) => [c.key, c]));

  const pinnedStart = orderedVisible.filter((k) => {
    const c = colMap.get(k);
    return c?.pinned && k !== 'actions';
  });
  const pinnedEnd   = orderedVisible.includes('actions') ? ['actions' as ColumnKey] : [];
  const nonPinned   = orderedVisible.filter((k) => !colMap.get(k)?.pinned);
  const displayOrder = [...pinnedStart, ...nonPinned, ...pinnedEnd];

  if (assets.length === 0) return null;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = nonPinned.indexOf(active.id as ColumnKey);
    const newIdx = nonPinned.indexOf(over.id  as ColumnKey);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(nonPinned, oldIdx, newIdx);
    onReorder([...pinnedStart, ...reordered, ...pinnedEnd]);
  }

  if (isMobile) {
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <table className="min-w-full" role="table">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {['Nome', 'Produto', 'Taxa', 'Ações'].map((h) => (
                <th key={h} scope="col" className={`px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${h === 'Ações' ? 'w-24 min-w-24 text-center' : 'text-left'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <MobileRow
                key={`${asset.code}-${asset.nickName}`}
                asset={asset}
                onEdit={onEdit}
                orderedVisible={orderedVisible}
                agents={agents}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <table className="min-w-full" role="table">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <SortableContext items={nonPinned} strategy={horizontalListSortingStrategy}>
              <tr>
                {pinnedStart.map((k) => (
                  <StaticHeaderCell key={k} col={colMap.get(k)!} />
                ))}

                {nonPinned.map((k) => (
                  <SortableHeaderCell
                    key={k}
                    col={colMap.get(k)!}
                    sortConfig={sortConfig}
                    onSort={onSort}
                  />
                ))}

                {pinnedEnd.map((k) => (
                  <th
                    key={k}
                    scope="col"
                    style={ACTION_COLUMN_STYLE}
                    className="w-24 min-w-24 px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    <div className="flex justify-center">
                      {colMap.get(k)!.label}
                    </div>
                  </th>
                ))}
              </tr>
            </SortableContext>
          </thead>
          <tbody>
          {assets.map((asset) => (
            <DesktopRow
              key={`${asset.code}-${asset.nickName}`}
              asset={asset}
              onEdit={onEdit}
              onViewJson={onViewJson}
              orderedVisible={displayOrder}
              agents={agents}
            />
          ))}
        </tbody>
      </table>
    </div>
    </DndContext>
  );
}
