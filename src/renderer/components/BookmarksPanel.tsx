import React, { useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Plus, Trash2 } from 'lucide-react';
import { addBookmarkAtom, bookmarksAtom, loadBookmarksAtom, removeBookmarkAtom } from '../state/bookmarks';
import { createTabAtom } from '../state/tabs';

export function BookmarksPanel(): React.JSX.Element {
  const bookmarks = useAtomValue(bookmarksAtom);
  const loadBookmarks = useSetAtom(loadBookmarksAtom);
  const addBookmark = useSetAtom(addBookmarkAtom);
  const removeBookmark = useSetAtom(removeBookmarkAtom);
  const createTab = useSetAtom(createTabAtom);

  const [isAdding, setIsAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [path, setPath] = useState('');

  useEffect(() => {
    void loadBookmarks();
  }, [loadBookmarks]);

  const submitBookmark = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!label.trim() || !path.trim()) return;
    void addBookmark({ label: label.trim(), path: path.trim() });
    setLabel('');
    setPath('');
    setIsAdding(false);
  };

  return (
    <div className="sidebar-panel bookmarks-panel">
      <div className="sidebar-panel__header">
        <span>Bookmarks</span>
        <button type="button" aria-label="Add bookmark" onClick={() => setIsAdding((value) => !value)}>
          <Plus size={16} />
        </button>
      </div>
      {isAdding && (
        <form className="sidebar-panel__form" onSubmit={submitBookmark}>
          <input placeholder="Label" value={label} onChange={(event) => setLabel(event.target.value)} autoFocus />
          <input placeholder="Path" value={path} onChange={(event) => setPath(event.target.value)} />
          <button type="submit">Add</button>
        </form>
      )}
      <ul className="sidebar-panel__list">
        {bookmarks.map((bookmark) => (
          <li key={bookmark.id} className="sidebar-panel__item">
            <button
              type="button"
              className="sidebar-panel__item-label"
              onClick={() => createTab({ title: bookmark.label, cwd: bookmark.path })}
              title={bookmark.path}
            >
              {bookmark.label}
            </button>
            <button
              type="button"
              className="sidebar-panel__item-remove"
              aria-label={`Remove ${bookmark.label}`}
              onClick={() => removeBookmark(bookmark.id)}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
