import React, { useEffect, useRef } from 'react';
import { Copy, ClipboardPaste, TextSelect, Eraser } from 'lucide-react';

export interface TerminalContextMenuProps {
  x: number;
  y: number;
  hasSelection: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onClose: () => void;
}

/**
 * Floating right-click menu for terminal copy/paste actions, positioned at the cursor.
 */
export function TerminalContextMenu({
  x,
  y,
  hasSelection,
  onCopy,
  onPaste,
  onSelectAll,
  onClear,
  onClose,
}: TerminalContextMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('blur', onClose);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const menuWidth = 180;
  const menuHeight = 168;
  const left = Math.min(x, window.innerWidth - menuWidth - 4);
  const top = Math.min(y, window.innerHeight - menuHeight - 4);

  return (
    <div ref={menuRef} className="terminal-context-menu" style={{ left, top }}>
      <button className="terminal-context-menu__item" disabled={!hasSelection} onClick={onCopy}>
        <Copy size={14} />
        Copy
      </button>
      <button className="terminal-context-menu__item" onClick={onPaste}>
        <ClipboardPaste size={14} />
        Paste
      </button>
      <div className="terminal-context-menu__divider" />
      <button className="terminal-context-menu__item" onClick={onSelectAll}>
        <TextSelect size={14} />
        Select All
      </button>
      <button className="terminal-context-menu__item" onClick={onClear}>
        <Eraser size={14} />
        Clear
      </button>
    </div>
  );
}
