"use client";

import { useEffect, useRef } from "react";

/**
 * Auto-growing post-title field.
 *
 * Uses a <textarea> rather than an <input> because large-font single-line
 * inputs clip their glyphs' ascenders in several browsers. A textarea flows
 * its text normally (no clipping) and lets long titles wrap onto a second
 * line — the same behaviour as Medium's editor. It still submits as
 * `name="title"`, so the surrounding server-action form is unchanged.
 */
export function TitleField({
  defaultValue = "",
  autoFocus = false,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function grow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    if (ref.current) grow(ref.current);
  }, []);

  return (
    <textarea
      ref={ref}
      name="title"
      className="mTitleInput"
      placeholder="Title"
      rows={1}
      required
      autoFocus={autoFocus}
      defaultValue={defaultValue}
      onInput={(e) => grow(e.currentTarget)}
    />
  );
}
