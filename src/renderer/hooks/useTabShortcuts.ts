import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import {
  activateRelativeTabAtom,
  activeTabAtom,
  closeTabAtom,
  createTabAtom,
  focusPaneDirectionAtom,
  FocusDirection,
  splitLayoutAtom,
  splitPaneAtom,
} from '../state/tabs';

const isModifierPressed = (event: KeyboardEvent): boolean => event.ctrlKey || event.metaKey;

const ARROW_DIRECTIONS: Record<string, FocusDirection> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

/**
 * Wires global keyboard shortcuts for tab lifecycle and navigation:
 * Ctrl/Cmd+T (new tab), Ctrl/Cmd+W (close tab), Ctrl/Cmd+Tab and Ctrl/Cmd+Shift+Tab (cycle tabs),
 * Ctrl/Cmd+\ (split pane right), Ctrl/Cmd+Shift+\ (split pane down), Ctrl/Cmd+Alt+Arrows (move pane focus).
 */
export function useTabKeyboardShortcuts(): void {
  const createTab = useSetAtom(createTabAtom);
  const closeTab = useSetAtom(closeTabAtom);
  const activateRelativeTab = useSetAtom(activateRelativeTabAtom);
  const focusPaneDirection = useSetAtom(focusPaneDirectionAtom);
  const splitPane = useSetAtom(splitPaneAtom);
  const activeTab = useAtomValue(activeTabAtom);
  const splitLayout = useAtomValue(splitLayoutAtom);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isModifierPressed(event)) return;

      if (event.key === '\\' || event.key === '|') {
        event.preventDefault();
        // Shift turns '\' into '|' on US layouts: use it for the orthogonal split.
        splitPane({ direction: event.key === '|' ? 'down' : 'right' });
        return;
      }

      const arrowDirection = event.altKey ? ARROW_DIRECTIONS[event.key] : undefined;
      if (arrowDirection) {
        if (!splitLayout) return;
        event.preventDefault();
        focusPaneDirection(arrowDirection);
        return;
      }

      if (event.key === 't' || event.key === 'T') {
        event.preventDefault();
        createTab();
        return;
      }

      if (event.key === 'w' || event.key === 'W') {
        if (activeTab) {
          event.preventDefault();
          closeTab(activeTab.id);
        }
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        activateRelativeTab(event.shiftKey ? -1 : 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, createTab, closeTab, activateRelativeTab, focusPaneDirection, splitLayout, splitPane]);
}
