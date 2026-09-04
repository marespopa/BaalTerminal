import { atom } from 'jotai';
import type { PaneId } from './tabs';

export type DropPosition = 'before' | 'after';

export interface TabDragTarget {
  paneId: PaneId;
  /** Tab the indicator anchors to; null means the end of that pane's strip. */
  tabId: string | null;
  position: DropPosition;
}

export interface TabDragState {
  tabId: string;
  x: number;
  y: number;
  /** Live hit-test result; null when the pointer is over no valid drop point. */
  target: TabDragTarget | null;
}

/**
 * Pointer-based tab drag state. A tab's pointerdown seeds this; document-level
 * pointermove/pointerup update/clear it. Avoids HTML5 drag-and-drop, whose
 * bubbling + preventDefault interplay is unreliable inside nested React containers.
 */
export const tabDragAtom = atom<TabDragState | null>(null);

/** True while a drag is active, so tabs can suppress their click-to-activate. */
export const isDraggingTabAtom = atom((get) => get(tabDragAtom) !== null);
