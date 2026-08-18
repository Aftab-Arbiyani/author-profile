"use client";

import { useEffect } from "react";

/**
 * Casual-copying deterrent for the manuscript reader.
 *
 * Read the limits before trusting this with anything: it is a speed bump, not a
 * control. A browser cannot disable its own developer tools. Devtools opened
 * *before* navigating here stay open, the menu path (⋮ → More tools) never
 * touches the keyboard, Safari and Firefox bind their own inspector shortcuts,
 * disabling JavaScript removes this file entirely, and `curl` with the session
 * cookie ignores all of it. Anyone who wants the text can still have it.
 *
 * What it does buy: the reflexive right-click → Save as, the accidental Ctrl+S,
 * and the idle "what's under here" F12 all stop working, which is most of what
 * actually happens in practice. The layers that survive a determined reader are
 * the two watermarks (lib/watermark.ts) and the read throttle (lib/arc.ts) —
 * those attribute a leak rather than trying to prevent one, which is the only
 * thing that works once the text is on someone's screen.
 *
 * Deliberately NOT included: the `debugger`-in-a-loop trap that devtools-blocker
 * snippets use. It freezes the tab for anyone who opens devtools for an innocent
 * reason, is defeated by one "never pause here" click, and turns a goodwill
 * programme hostile toward the reviewers we invited.
 */

/** Ctrl/Cmd + key: save, print, view-source. */
const BLOCKED_WITH_MOD = new Set(["s", "p", "u"]);
/** Ctrl/Cmd + Shift + key: the inspector, console, and element picker. */
const BLOCKED_WITH_MOD_SHIFT = new Set(["i", "j", "c"]);

export function ArcReaderShield() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;

      if (key === "f12") {
        event.preventDefault();
        return;
      }

      if (!mod) {
        return;
      }

      if (event.shiftKey ? BLOCKED_WITH_MOD_SHIFT.has(key) : BLOCKED_WITH_MOD.has(key)) {
        event.preventDefault();
      }
    }

    function swallow(event: Event) {
      event.preventDefault();
    }

    // Capture phase so nothing downstream can re-enable these first.
    document.addEventListener("keydown", onKeyDown, { capture: true });
    document.addEventListener("contextmenu", swallow);
    document.addEventListener("copy", swallow);
    document.addEventListener("cut", swallow);
    document.addEventListener("dragstart", swallow);

    return () => {
      document.removeEventListener("keydown", onKeyDown, { capture: true });
      document.removeEventListener("contextmenu", swallow);
      document.removeEventListener("copy", swallow);
      document.removeEventListener("cut", swallow);
      document.removeEventListener("dragstart", swallow);
    };
  }, []);

  return null;
}
