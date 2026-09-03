import React, { useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Check, Plus, Trash2 } from 'lucide-react';
import { addSnippetAtom, loadSnippetsAtom, removeSnippetAtom, snippetsAtom } from '../state/snippets';

export function SnippetsPanel(): React.JSX.Element {
  const snippets = useAtomValue(snippetsAtom);
  const loadSnippets = useSetAtom(loadSnippetsAtom);
  const addSnippet = useSetAtom(addSnippetAtom);
  const removeSnippet = useSetAtom(removeSnippetAtom);

  const [isAdding, setIsAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    void loadSnippets();
  }, [loadSnippets]);

  const submitSnippet = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!label.trim() || !text.trim()) return;
    void addSnippet({ label: label.trim(), text: text.trim() });
    setLabel('');
    setText('');
    setIsAdding(false);
  };

  const copySnippet = async (id: string, snippetText: string): Promise<void> => {
    await navigator.clipboard.writeText(snippetText);
    setCopiedId(id);
    setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1200);
  };

  return (
    <div className="sidebar-panel snippets-panel">
      <div className="sidebar-panel__header">
        <span>Snippets</span>
        <button type="button" aria-label="Add snippet" onClick={() => setIsAdding((value) => !value)}>
          <Plus size={16} />
        </button>
      </div>
      {isAdding && (
        <form className="sidebar-panel__form" onSubmit={submitSnippet}>
          <input placeholder="Label" value={label} onChange={(event) => setLabel(event.target.value)} autoFocus />
          <textarea placeholder="Command / text" value={text} onChange={(event) => setText(event.target.value)} rows={3} />
          <button type="submit">Add</button>
        </form>
      )}
      <ul className="sidebar-panel__list">
        {snippets.map((snippet) => (
          <li key={snippet.id} className="sidebar-panel__item">
            <button
              type="button"
              className="sidebar-panel__item-label"
              onClick={() => void copySnippet(snippet.id, snippet.text)}
              title={snippet.text}
            >
              {copiedId === snippet.id ? <Check size={14} /> : null}
              {snippet.label}
            </button>
            <button
              type="button"
              className="sidebar-panel__item-remove"
              aria-label={`Remove ${snippet.label}`}
              onClick={() => removeSnippet(snippet.id)}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
