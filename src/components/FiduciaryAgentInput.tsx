import { useState, useEffect, useCallback, useRef } from 'react';
import { isValidUrl } from '../utils/url';

interface FiduciaryAgentInputProps {
  value: string[];
  onChange: (urls: string[]) => void;
  /**
   * Disparado quando o usuário "comita" uma mudança na lista de URLs por
   * uma ação intencional (Enter num input com conteúdo, remover via X, ou
   * clicar num chip de agente conhecido). NÃO dispara durante a digitação.
   * Recebe o array final já com slots vazios — o consumidor é responsável
   * por filtrar antes de persistir.
   */
  onCommit?: (urls: string[]) => void;
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
 * Editor de URLs de agentes fiduciários do ativo. Aceita múltiplas URLs
 * (ex.: o mesmo CRA pode ter Vórtx + Opea). A ordem importa: o fetch de
 * pagamentos tenta cada URL na ordem listada e usa a primeira que funcionar.
 */
export function FiduciaryAgentInput({ value, onChange, onCommit, error }: FiduciaryAgentInputProps) {
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const [agents, setAgents] = useState<AgentEntry[]>(loadAgents);
  const [showManager, setShowManager] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const focusIndexRef = useRef<number | null>(null);

  useEffect(() => {
    saveAgents(agents);
  }, [agents]);

  // Após adicionar um novo slot via Enter, move o foco para o input recém-criado.
  useEffect(() => {
    if (focusIndexRef.current != null) {
      const target = inputsRef.current[focusIndexRef.current];
      target?.focus();
      focusIndexRef.current = null;
    }
  });

  const urls = value.length > 0 ? value : [''];

  const updateUrlAt = useCallback((index: number, next: string) => {
    const copy = [...urls];
    copy[index] = next;
    // Remove vazias do meio quando o usuário esvazia, mas mantém pelo menos uma.
    const cleaned = copy.filter((u, i) => u.trim().length > 0 || i === copy.length - 1);
    onChange(cleaned.filter((u) => u.trim().length > 0));
  }, [urls, onChange]);

  const handleAddSlot = useCallback(() => {
    onChange([...urls.filter((u) => u.trim().length > 0), '']);
  }, [urls, onChange]);

  const handleEnterOnInput = useCallback((idx: number) => {
    const current = (urls[idx] || '').trim();
    if (current.length === 0) return; // Enter em slot vazio = no-op
    const filled = urls.map((u) => u.trim()).filter((u) => u.length > 0);
    const next = [...filled, ''];
    onChange(next);
    onCommit?.(filled); // persiste só URLs válidas (sem o slot vazio)
    // Marca o input recém-adicionado para receber foco no próximo render.
    focusIndexRef.current = filled.length;
    setTouched((prev) => new Set(prev).add(idx));
  }, [urls, onChange, onCommit]);

  const handleRemove = useCallback((index: number) => {
    const next = urls.filter((_, i) => i !== index).filter((u) => u.trim().length > 0);
    onChange(next);
    onCommit?.(next);
    setTouched((prev) => {
      const nextTouched = new Set<number>();
      for (const i of prev) if (i < index) nextTouched.add(i); else if (i > index) nextTouched.add(i - 1);
      return nextTouched;
    });
  }, [urls, onChange, onCommit]);

  const setUrlFromAgent = useCallback((url: string) => {
    const trimmed = urls.map((u) => u.trim()).filter((u) => u.length > 0);
    if (trimmed.includes(url)) return;
    const next = [...trimmed, url];
    onChange(next);
    onCommit?.(next);
  }, [urls, onChange, onCommit]);

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

  const handleSaveAgent = useCallback(() => {
    const trimmedName = editName.trim();
    const trimmedUrl = editUrl.trim();
    if (!trimmedName || !trimmedUrl) return;

    if (editingIdx !== null) {
      setAgents((prev) => prev.map((a, i) => i === editingIdx ? { name: trimmedName, url: trimmedUrl } : a));
    } else {
      setAgents((prev) => [...prev, { name: trimmedName, url: trimmedUrl }]);
    }
    setShowManager(false);
    setEditingIdx(null);
    setEditName('');
    setEditUrl('');
  }, [editName, editUrl, editingIdx]);

  const handleDeleteAgent = useCallback((idx: number) => {
    setAgents((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleCancelManager = useCallback(() => {
    setShowManager(false);
    setEditingIdx(null);
    setEditName('');
    setEditUrl('');
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Links dos Agentes Fiduciários
        </label>
        <button
          type="button"
          onClick={handleAddSlot}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
        >
          + Adicionar URL
        </button>
      </div>

      <ul className="space-y-1.5">
        {urls.map((url, idx) => {
          const isTouched = touched.has(idx);
          const showInvalid = isTouched && url.length > 0 && !isValidUrl(url);
          return (
            <li key={idx} className="flex gap-2 items-start">
              <input
                ref={(el) => { inputsRef.current[idx] = el; }}
                type="url"
                value={url}
                onChange={(e) => updateUrlAt(idx, e.target.value)}
                onBlur={() => setTouched((prev) => new Set(prev).add(idx))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleEnterOnInput(idx);
                  }
                }}
                placeholder="https://www.exemplo.com.br/..."
                className={`flex-1 rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  showInvalid
                    ? 'border-red-300 dark:border-red-600 text-red-900 dark:text-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:border-blue-500'
                }`}
                aria-invalid={showInvalid}
              />
              {urls.length > 1 || url.trim().length > 0 ? (
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="rounded-md p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label={`Remover URL ${idx + 1}`}
                  title="Remover"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
      )}

      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Múltiplos agentes são tentados em ordem ao buscar pagamentos — o primeiro que retornar dados é usado.
      </p>

      {/* Agent suggestions */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">Agentes conhecidos:</p>
          <button
            type="button"
            onClick={handleStartAdd}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
          >
            + Editar lista
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
                onClick={() => setUrlFromAgent(agent.url)}
                className="hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                aria-label={`Adicionar URL de ${agent.name}`}
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

      {/* Add/Edit form for the agents catalog */}
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
              onClick={handleSaveAgent}
              disabled={!editName.trim() || !editUrl.trim()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={handleCancelManager}
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            {editingIdx !== null && (
              <button
                type="button"
                onClick={() => { handleDeleteAgent(editingIdx); handleCancelManager(); }}
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
