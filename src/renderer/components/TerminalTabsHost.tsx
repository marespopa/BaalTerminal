import React, { useCallback, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { activeTabIdAtom, focusPaneAtom, splitLayoutAtom, splitRatioAtom, tabsAtom } from '../state/tabs';
import { TerminalView } from './TerminalView';

const MIN_RATIO = 0.15;
const MAX_RATIO = 0.85;

/**
 * Renders every open tab's viewport simultaneously and toggles CSS visibility,
 * so terminal DOM/Xterm instances stay mounted (and their PTY output buffered) when switching tabs.
 */
export function TerminalTabsHost(): React.JSX.Element {
  const tabs = useAtomValue(tabsAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const splitLayout = useAtomValue(splitLayoutAtom);
  const focusPane = useSetAtom(focusPaneAtom);
  const [splitRatio, setSplitRatio] = useAtom(splitRatioAtom);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; ratio: number; width: number } | null>(null);

  const visibleTabIds = splitLayout
    ? new Set([splitLayout.primaryTabId, splitLayout.secondaryTabId])
    : new Set(activeTabId ? [activeTabId] : []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const hostWidth = hostRef.current?.clientWidth ?? 0;
      if (hostWidth === 0) return;
      event.preventDefault();
      dragRef.current = { x: event.clientX, ratio: splitRatio, width: hostWidth };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [splitRatio],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const nextRatio = drag.ratio + (event.clientX - drag.x) / drag.width;
      setSplitRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, nextRatio)));
    },
    [setSplitRatio],
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  return (
    <div className={`terminal-tabs-host${splitLayout ? ' terminal-tabs-host--split' : ''}`} ref={hostRef}>
      {tabs.map((tab) => {
        const isPrimary = splitLayout?.primaryTabId === tab.id;
        const isSecondary = splitLayout?.secondaryTabId === tab.id;
        const flexBasis = splitLayout
          ? `${(isPrimary ? splitRatio : isSecondary ? 1 - splitRatio : 0.5) * 100}%`
          : undefined;
        // Order primary/secondary around the resize handle regardless of tab array order.
        const order = isPrimary ? 1 : isSecondary ? 3 : undefined;
        return (
          <div
            key={tab.id}
            className={`terminal-tabs-host__viewport${isPrimary ? ' terminal-tabs-host__viewport--primary' : ''}${
              isSecondary ? ' terminal-tabs-host__viewport--secondary' : ''
            }${
              splitLayout && tab.id === (splitLayout.focusedPane === 'primary' ? splitLayout.primaryTabId : splitLayout.secondaryTabId)
                ? ' terminal-tabs-host__viewport--focused'
                : ''
            }`}
            style={flexBasis ? { flexBasis, flexGrow: 0, order } : undefined}
            hidden={!visibleTabIds.has(tab.id)}
            data-tab-id={tab.id}
            onMouseDown={() => {
              if (!splitLayout) return;
              focusPane(tab.id === splitLayout.primaryTabId ? 'primary' : 'secondary');
            }}
          >
            <TerminalView
              tabId={tab.id}
              isActive={tab.id === activeTabId}
              cwd={tab.cwd}
              onFocus={() => {
                if (!splitLayout) return;
                focusPane(tab.id === splitLayout.primaryTabId ? 'primary' : 'secondary');
              }}
            />
          </div>
        );
      })}
      {splitLayout ? (
        <div
          className="terminal-tabs-host__resize-handle"
          style={{ order: 2 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      ) : null}
    </div>
  );
}
