"use client";

import { Children, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * A list that shows only the rows its card has room for, then "+N more" to show the rest. The card sets the room:
 * with `contain: size` it takes its height from the grid row, so the list never grows the row past its neighbour.
 * Without it (one column on small screens) every row fits and the list shows them all.
 */
export function FitList({ children, className }: { children: ReactNode; className: string }) {
  const rows = Children.toArray(children);
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(rows.length);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    // Open, the card grows to fit every row, so there is nothing to measure until it closes.
    if (open) return;
    const el = box.current!;
    const card = el.closest("section")!;
    const measure = () => {
      const items = el.querySelectorAll("li");
      if (getComputedStyle(card).contain === "none" || !items.length) return setFit(rows.length);
      // Rows are one truncated line each, so all the same height; the "+N more" row takes one of them.
      const row = (items[1] ?? items[0]).getBoundingClientRect().height;
      // Down to the card's bottom border, so the space is the same whether or not "+N more" is showing yet.
      const room = card.getBoundingClientRect().bottom - 1 - el.getBoundingClientRect().top;
      setFit(rows.length * row <= room + 1 ? rows.length : Math.max(1, Math.floor(room / row) - 1));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    return () => observer.disconnect();
  }, [rows.length, open]);

  const shown = open ? rows : rows.slice(0, fit);
  return (
    <>
      <div ref={box} className="min-h-0 flex-1 overflow-hidden">
        <ul className={className}>{shown}</ul>
      </div>
      {fit < rows.length && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          data-open={open || undefined}
          className="w-full border-t border-line px-4 py-2.5 text-left text-sm font-medium text-accent transition-colors hover:bg-fill/50 sm:px-5"
        >
          {open ? "Show less" : `+${rows.length - fit} more`}
        </button>
      )}
    </>
  );
}
