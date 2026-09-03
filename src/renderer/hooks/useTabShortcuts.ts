import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import {
  activateRelativeTabAtom,
  activeTabAtom,
  closeTabAtom,
  createTabAtom,
  focusPaneAtom,
  splitLayoutAtom,
  toggleSplitAtom,
} from '../state/tabs';

const isModifierPressed = (event: KeyboardEvent): boolean => event.ctrlKey || event.metaKey;

/**
 * Wires global keyboard shortcuts for tab lifecycle and navigation:
 * Ctrl/Cmd+T (new tab), Ctrl/Cmd+W (close tab), Ctrl/Cmd+Tab and Ctrl/Cmd+Shift+Tab (cycle tabs).
 */
export function useTabKeyboardShortcuts(): void {
  const createTab = useSetAtom(createTabAtom);
  const closeTab = useSetAtom(closeTabAtom);
  const activateRelativeTab = useSetAtom(activateRelativeTabAtom);
  const focusPane = useSetAtom(focusPaneAtom);
  const toggleSplit = useSetAtom(toggleSplitAtom);
  const activeTab = useAtomValue(activeTabAtom);
  const splitLayout = useAtomValue(splitLayoutAtom);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isModifierPressed(event)) return;

      if (event.key === '\\') {
        event.preventDefault();
        toggleSplit();
        return;
      }

      if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        if (!splitLayout) return;
        event.preventDefault();
        focusPane(event.key === 'ArrowLeft' ? 'primary' : 'secondary');
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
  }, [activeTab, createTab, closeTab, activateRelativeTab, focusPane, splitLayout, toggleSplit]);
}
