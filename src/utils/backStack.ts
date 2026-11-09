// The phone / browser back button.
//
// Every screen change and every layer opened on top (dealership record, form,
// dialog, search) adds one step to the browser history. Back closes the top
// layer first; with nothing open, it goes to the previous screen. Closing a
// layer with its own X or Cancel removes its step, so Back never "re-closes"
// something that is already gone.

import { useEffect, useRef } from 'react';

type Layer = { id: number; close: () => boolean | void; dead?: boolean };

const stack: Layer[] = [];
let nextId = 1;
/** Back steps we triggered ourselves and must not treat as the user's Back. */
let ignore = 0;
const queue: (() => void)[] = [];
let viewHandler: ((state: unknown) => void) | null = null;
let installed = false;

const hasWindow = typeof window !== 'undefined';

function settled(fn: () => void) {
  if (ignore > 0) queue.push(fn);
  else fn();
}

function goBack(steps: number) {
  if (steps <= 0) return;
  ignore += 1;
  window.history.go(-steps);
}

function currentView(): unknown {
  return (window.history.state as { view?: unknown } | null)?.view;
}

function install() {
  if (installed || !hasWindow) return;
  installed = true;
  window.addEventListener('popstate', e => {
    if (ignore > 0) {
      ignore -= 1;
      if (ignore === 0) queue.splice(0).forEach(f => f());
      return;
    }
    // Drop layers that were already closed another way.
    while (stack.length && stack[stack.length - 1].dead) stack.pop();
    const top = stack.pop();
    if (top) {
      const stay = top.close() === false;
      if (stay) {
        // The layer stepped back inside itself (e.g. a multi-step form) and stays open.
        stack.push(top);
        window.history.pushState({ view: currentView() ?? (e.state as { view?: unknown } | null)?.view, layer: top.id }, '');
      }
      return;
    }
    viewHandler?.(e.state);
  });
}

/** Register the screen switcher. `initial` is the screen showing now. */
export function initScreens(initial: unknown, onBackTo: (view: unknown) => void) {
  if (!hasWindow) return;
  install();
  viewHandler = state => {
    const v = (state as { view?: unknown } | null)?.view;
    if (v !== undefined) onBackTo(v);
  };
  window.history.replaceState({ view: initial }, '');
}

/** A new screen: one Back returns to the previous one. */
export function pushScreen(view: unknown) {
  if (!hasWindow) return;
  install();
  // Wait a tick: anything closing in the same click (e.g. search) removes its step first.
  window.setTimeout(() =>
    settled(() => {
      if (currentView() === view && !anyLayerOpen()) return;
      window.history.pushState({ view }, '');
    })
  );
}

/** Replace the current screen without adding a Back step (e.g. after switching persona). */
export function replaceScreen(view: unknown) {
  if (!hasWindow) return;
  settled(() => window.history.replaceState({ view }, ''));
}

function openLayer(close: () => boolean | void): number {
  install();
  const id = nextId++;
  stack.push({ id, close });
  settled(() => window.history.pushState({ view: currentView(), layer: id }, ''));
  return id;
}

function closeLayer(id: number) {
  const i = stack.findIndex(l => l.id === id);
  if (i < 0) return; // already closed by Back
  if (i < stack.length - 1) {
    // Something is still open above it; leave its step for later.
    stack[i].dead = true;
    return;
  }
  stack.pop();
  let steps = 1;
  while (stack.length && stack[stack.length - 1].dead) {
    stack.pop();
    steps += 1;
  }
  goBack(steps);
}

/** True when this layer is the top one (for Escape handling). */
function isTopLayer(id: number) {
  for (let i = stack.length - 1; i >= 0; i--) if (!stack[i].dead) return stack[i].id === id;
  return false;
}

export function anyLayerOpen() {
  return stack.some(l => !l.dead);
}

/**
 * Give a pop-in, panel or dialog a Back step while `open` is true.
 * `onBack` runs when the user presses Back; return false to stay open
 * (after stepping back inside the layer). Returns isTop() for Escape keys.
 */
export function useBackLayer(open: boolean, onBack: () => boolean | void) {
  const cb = useRef(onBack);
  cb.current = onBack;
  const idRef = useRef<number | null>(null);
  useEffect(() => {
    if (!open || !hasWindow) return;
    const id = openLayer(() => {
      const stay = cb.current() === false;
      if (!stay) idRef.current = null;
      return stay ? false : undefined;
    });
    idRef.current = id;
    return () => {
      if (idRef.current === id) closeLayer(id);
      idRef.current = null;
    };
  }, [open]);
  return () => (idRef.current !== null ? isTopLayer(idRef.current) : false);
}
