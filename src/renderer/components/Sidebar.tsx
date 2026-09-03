import React, { useCallback, useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { activePanelAtom, sidebarWidthAtom } from '../state/sidebar';
import { BookmarksPanel } from './BookmarksPanel';
import { SnippetsPanel } from './SnippetsPanel';
import { SettingsPanel } from './SettingsPanel';

const MIN_WIDTH = 160;
const MAX_WIDTH = 480;

export function Sidebar(): React.JSX.Element | null {
  const activePanel = useAtomValue(activePanelAtom);
  const [width, setWidth] = useAtom(sidebarWidthAtom);
  const startRef = useRef<{ x: number; width: number } | null>(null);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      startRef.current = { x: event.clientX, width };
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
    },
    [width],
  );

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start) return;
    const next = start.width + (event.clientX - start.x);
    setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)));
  }, [setWidth]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    startRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  if (!activePanel) return null;

  return (
    <div className="sidebar" style={{ width }}>
      {activePanel === 'bookmarks' ? <BookmarksPanel /> : activePanel === 'snippets' ? <SnippetsPanel /> : <SettingsPanel />}
      <div
        className="sidebar__resize-handle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
}
