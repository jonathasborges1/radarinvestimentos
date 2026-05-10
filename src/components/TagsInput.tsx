import { useState, useRef } from 'react';

interface TagsInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Input component for managing tags.
 * Type a tag and press Enter to add. Click the X button to remove.
 * Empty tags are silently ignored.
 */
export function TagsInput({ tags, onChange }: TagsInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (trimmed && !tags.includes(trimmed)) {
        onChange([...tags, trimmed]);
      }
      setInputValue('');
    }
  };

  const handleRemove = (tagToRemove: string) => {
    onChange(tags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor="tags-input"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Tags
      </label>
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500 transition-colors"
        onClick={() => inputRef.current?.focus()}
        role="group"
        aria-label="Tags adicionadas"
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-300"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(tag);
              }}
              className="inline-flex items-center justify-center rounded-full p-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 hover:text-blue-900 dark:hover:text-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label={`Remover tag ${tag}`}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id="tags-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? 'Digite uma tag e pressione Enter' : 'Adicionar tag...'}
          className="flex-1 min-w-[120px] border-none bg-transparent p-0 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-0"
          aria-label="Adicionar nova tag"
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Pressione Enter para adicionar uma tag
      </p>
    </div>
  );
}
