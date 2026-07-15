"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * "Read a free sample" — lets a visitor read the opening pages of the book.
 *
 * Desktop/laptop: opens a modal with Amazon's Kindle sample reader embedded,
 * giving it room and a dimmed backdrop. Mobile/tablet: opens the sample on
 * Amazon in a new tab instead — the embedded reader 403s there (mobile Safari
 * blocks the third-party cookies its session needs inside a cross-site
 * iframe), and full-screen on Amazon is the better small-screen experience.
 *
 * The control is a real link, so it also works with JS disabled and is
 * accessible; desktop just intercepts the click to open the modal.
 */
export function SamplePreview({
  sampleUrl,
  title,
}: {
  sampleUrl: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  function handleClick(e: React.MouseEvent) {
    // Only embed where it works: desktop/laptop widths. Smaller screens fall
    // through to the link's default behaviour (open the sample on Amazon).
    if (window.matchMedia("(min-width: 821px)").matches) {
      e.preventDefault();
      setOpen(true);
    }
  }

  // While the modal is open: close on Escape and lock background scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <a
        className="samplePreviewBtn"
        href={sampleUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 3.5C6 2 3.5 2 1.5 2.5v9C3.5 11 6 11 8 12.5M8 3.5c2-1.5 4.5-1.5 6.5-1v9c-2-.5-4.5-.5-6.5 1M8 3.5v9"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
        Read a free sample
      </a>

      {open &&
        createPortal(
          <div
            className="sampleModalOverlay"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <div
              className="sampleModalPanel"
              role="dialog"
              aria-modal="true"
              aria-label={`Read a free sample of ${title}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sampleModalBar">
                <span className="sampleModalTitle">Sample: {title}</span>
                <div className="sampleModalActions">
                  <a
                    className="sampleModalOpen"
                    href={sampleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open on Amazon ↗
                  </a>
                  <button
                    type="button"
                    className="sampleModalClose"
                    onClick={() => setOpen(false)}
                    aria-label="Close sample"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <iframe
                className="sampleModalFrame"
                src={sampleUrl}
                title={`Read a free sample of ${title}`}
                loading="lazy"
                allowFullScreen
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
