import { useState, useEffect, useCallback } from 'react';
import { isValidUrl } from '../utils/url';

interface FiduciaryAgentInputProps {
  value: string;
  onChange: (url: string) => void;
  error?: string;
}

interface AgentEntry {
  name: string;
  url: string;
}

const DEFAULT_AGENTS: AgentEntry[] = [
  { name: 'Virgo', url: 'https://www.virgo.com.br' },
  { name: 'Opea', url: 'https://www.opea.com.br' },
  { name: 'Vórtx', url: 'https://www.vortx.com.br' },
  { name: 'Oliveira Trust', url: 'https://www.oliveiratrust.com.br' },
  { name: 'Pentágono', url: 'https://www.pentagonotrustee.com.br' },
  { name: 'Planner', url: 'https://www.plfrm.com.br' },
  { name: 'Simplific Pavarini', url: 'https://www.simplific.com.br' },
];

const STORAGE_KEY = 'yield-radar-fiduciary-agents';

function loadAgents(): AgentEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_AGENTS;
}

function saveAgents(agents: AgentEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  } catch { /* ignore */ }
}

/**
 * Input component for fiduciary agent URL with validation and editable known agent suggestions.
 */
export function FiduciaryAgentInput({ value, onChange, error }: FiduciaryAgentInputProps) {
  const [touched, setTouched] = useState(false);
  const [agents, setAgents] = useState<AgentEntry[]>(loadAgents);
  const [showManager, setShowManager] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');

  useEffect(() => {
    saveAgents(agents);
  }, [agents]);

  const showValidationError = touched && value.length > 0 && !isValidUrl(value);
  const displayError = error || (showValidationError ? 'Informe uma URL válida (ex: https://exemplo.com)' : undefined);

  const handleStartAdd = useCallback(() => {
    setEditingIdx(null);
    setEditName('');
    setEditUrl('');
    setShowManager(true);
  }, []);

  const handleStartEdit = useCallback((idx: number) => {
    setEditingIdx(idx);
    setEditName(agents[idx].name);
    setEditUrl(agents[idx].url);
    setShowManager(true);
  }, [agents]);

  const handleSave = useCallback(() => {
    const trimmedName = editName.trim();
    const trimmedUrl = editUrl.trim();
    if (!trimmedName || !trimmedUrl) return;

    if (editingIdx !== null) {
      // Edit existing
      setAgents((prev) => prev.map((a, i) => i === editingIdx ? { name: trimmedName, url: trimmedUrl } : a));
    } else {
      // Add new
      setAgents((prev) => [...prev, { name: trimmedName, url: trimmedUrl }]);
    }
    setShowManager(false);
    setEditingIdx(null);
    setEditName('');
    setEditUrl('');
  }, [editName, editUrl, editingIdx]);

  const handleDelete = useCallback((idx: number) => {
    setAgents((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleCancel = useCallback(() => {
    setShowManager(false);
    setEditingIdx(null);
    setEditName('');
    setEditUrl('');
  }, []);

  return (
    <div className="space-y-2">
      <label
        htmlFor="fiduciary-agent-url"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Link do Agente Fiduciário
      </label>
      <input
        id="fiduciary-agent-url"
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder="https://www.exemplo.com.br"
        className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
          displayError
            ? 'border-red-300 dark:border-red-600 text-red-900 dark:text-red-300 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:border-blue-500'
        }`}
        aria-invalid={!!displayError}
        aria-describedby={displayError ? 'fiduciary-agent-error' : 'fiduciary-agent-suggestions'}
      />
      {displayError && (
        <p id="fiduciary-agent-error" className="text-sm text-red-600 dark:text-red-400" role="alert">
          {displayError}
        </p>
      )}

      {/* Agent suggestions */}
      <div id="fiduciary-agent-suggestions">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">Agentes conhecidos:</p>
          <button
            type="button"
            onClick={handleStartAdd}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
          >
            + Adicionar
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sugestões de agentes fiduciários">
          {agents.map((agent, idx) => (
            <span
              key={`${agent.name}-${idx}`}
              className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 dark:bg-gray-700 pl-2.5 pr-1 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 group"
            >
              <button
                type="button"
                onClick={() => {
                  onChange(agent.url);
                  setTouched(false);
                }}
                className="hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                aria-label={`Usar URL de ${agent.name}`}
                title={agent.url}
              >
                {agent.name}
              </button>
              <button
                type="button"
                onClick={() => handleStartEdit(idx)}
                className="ml-0.5 p-0.5 rounded-full text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none"
                aria-label={`Editar ${agent.name}`}
                title="Editar"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Add/Edit form */}
      {showManager && (
        <div className="rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {editingIdx !== null ? 'Editar agente' : 'Novo agente'}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nome (ex: Vórtx)"
              className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="url"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              placeholder="URL (ex: https://www.vortx.com.br)"
              className="flex-[2] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!editName.trim() || !editUrl.trim()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            {editingIdx !== null && (
              <button
                type="button"
                onClick={() => { handleDelete(editingIdx); handleCancel(); }}
                className="ml-auto rounded-md px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Excluir
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
