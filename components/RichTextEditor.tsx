"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { markdownToEditorHtml } from "@/lib/markdown";

type ToolbarPos = { top: number; left: number; visible: boolean };

export function RichTextEditor({ initialHtml = "" }: { initialHtml?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const linkModeRef = useRef(false);

  const [html, setHtml] = useState(initialHtml);
  const [tb, setTb] = useState<ToolbarPos>({ top: 0, left: 0, visible: false });
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const refreshToolbar = useCallback(() => {
    // While the link input is open, keep the toolbar pinned — focusing the
    // input collapses the text selection, which would otherwise hide it.
    if (linkModeRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setTb((s) => ({ ...s, visible: false }));
      return;
    }
    if (!editorRef.current?.contains(sel.anchorNode)) {
      setTb((s) => ({ ...s, visible: false }));
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setTb({ top: rect.top - 56, left: rect.left + rect.width / 2, visible: true });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshToolbar);
    return () => document.removeEventListener("selectionchange", refreshToolbar);
  }, [refreshToolbar]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (initialHtml) {
      el.innerHTML = initialHtml;
      el.classList.remove("isEmpty");
    } else {
      el.innerHTML = "<p><br></p>";
    }
  }, [initialHtml]);

  // Keep the ref in sync so the selectionchange handler reads the latest value.
  useEffect(() => {
    linkModeRef.current = linkMode;
    if (linkMode) {
      setTimeout(() => linkInputRef.current?.focus(), 50);
    }
  }, [linkMode]);

  function syncHtml() {
    const el = editorRef.current;
    if (!el) return;
    el.classList.toggle("isEmpty", !el.innerText.trim());
    setHtml(el.innerHTML);
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreOrAppendSelection() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel) return;

    if (savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    } else {
      // Move cursor to end
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function exec(cmd: string, val?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    syncHtml();
  }

  // Paste as markdown: convert links/bold/italic/headings/lists/quotes to HTML
  // so the author can paste a Medium-style markdown draft and get formatting.
  // Non-text pastes (e.g. images) fall through to the browser default.
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const text = e.clipboardData.getData("text/plain");
    if (!text.trim()) return;
    e.preventDefault();
    const generated = markdownToEditorHtml(text);
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, generated);
    syncHtml();
  }

  function openLink() {
    saveSelection();
    setLinkUrl("");
    setLinkMode(true);
  }

  function cancelLink() {
    setLinkMode(false);
    setLinkUrl("");
    restoreOrAppendSelection();
  }

  function applyLink() {
    let url = linkUrl.trim();
    if (!url) return;
    // Default to https:// so bare domains still produce a working link.
    if (!/^(https?:|mailto:|\/)/i.test(url)) url = `https://${url}`;
    restoreOrAppendSelection();
    document.execCommand("createLink", false, url);
    syncHtml();
    setLinkMode(false);
    setLinkUrl("");
  }

  return (
    <div className="mEditor">
      {tb.visible && (
        <div
          className="mToolbar"
          style={{ top: tb.top, left: tb.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {linkMode ? (
            <div className="mToolbarLink">
              <input
                ref={linkInputRef}
                className="mToolbarLinkInput"
                type="text"
                placeholder="Paste or type a link, then Enter"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  } else if (e.key === "Escape") {
                    cancelLink();
                  }
                }}
              />
              <button type="button" title="Apply link" className="mTb" onClick={applyLink}>Apply</button>
              <button type="button" title="Cancel" className="mTb" onClick={cancelLink}>✕</button>
            </div>
          ) : (
            <>
              <button type="button" title="Bold" className="mTb mTbB" onClick={() => exec("bold")}>B</button>
              <button type="button" title="Italic" className="mTb mTbI" onClick={() => exec("italic")}>i</button>
              <button type="button" title="Link" className="mTb" onClick={openLink}>
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M6 8.5a3 3 0 004.24 0l2-2a3 3 0 00-4.24-4.24l-1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M8 5.5a3 3 0 00-4.24 0l-2 2a3 3 0 004.24 4.24l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
              <span className="mTbSep" />
              <button type="button" title="Large heading" className="mTb mTbT1" onClick={() => exec("formatBlock", "h2")}>T</button>
              <button type="button" title="Small heading" className="mTb mTbT2" onClick={() => exec("formatBlock", "h3")}>T</button>
              <button type="button" title="Quote" className="mTb mTbQ" onClick={() => exec("formatBlock", "blockquote")}>&rdquo;</button>
              <button type="button" title="Bullet list" className="mTb" onClick={() => exec("insertUnorderedList")}>
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><circle cx="1.5" cy="2.5" r="1.5" fill="currentColor"/><rect x="5" y="1.5" width="9" height="2" rx="1" fill="currentColor"/><circle cx="1.5" cy="7" r="1.5" fill="currentColor"/><rect x="5" y="6" width="9" height="2" rx="1" fill="currentColor"/><circle cx="1.5" cy="11.5" r="1.5" fill="currentColor"/><rect x="5" y="10.5" width="9" height="2" rx="1" fill="currentColor"/></svg>
              </button>
            </>
          )}
        </div>
      )}

      <div
        ref={editorRef}
        className="mEditorBody isEmpty"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Blog content"
        data-placeholder="Tell your story…"
        onBlur={() => { saveSelection(); syncHtml(); }}
        onInput={syncHtml}
        onPaste={handlePaste}
        suppressContentEditableWarning
      />
      <input name="contentHtml" type="hidden" value={html} />
    </div>
  );
}
