"use client";

import { startTransition, useActionState } from "react";
import { TSHIRT_SIZES, type TshirtSize } from "@/db/schema";
import { setEpicSizeAction } from "./actions";

/** An epic's T-shirt size, saved as soon as the lead picks one. Checked again on the server. */
export function EpicSize({
  epicKey,
  size,
  className,
}: {
  epicKey: string;
  size: TshirtSize | null;
  className: string;
}) {
  const [state, save, saving] = useActionState(setEpicSizeAction, null);
  return (
    // Saved from onChange, not the form's action: React resets a form after its action, and a select resets to the
    // size it mounted with.
    <form className="inline-flex flex-col items-end">
      <input type="hidden" name="key" value={epicKey} />
      <select
        name="size"
        defaultValue={size ?? ""}
        aria-label={`T-shirt size of ${epicKey}`}
        aria-invalid={!!state || undefined}
        aria-busy={saving}
        onChange={(e) => {
          const form = new FormData(e.target.form!);
          startTransition(() => save(form));
        }}
        className={`${className} border-line-strong bg-surface pr-6 shadow-card transition hover:border-ink-faint focus:outline-2 focus:outline-offset-1 focus:outline-accent aria-invalid:border-danger ${size ? "font-medium" : "text-ink-faint"} ${saving ? "opacity-60" : ""}`}
      >
        <option value="">Not sized</option>
        {TSHIRT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {state && (
        <span role="alert" className="mt-1 max-w-40 text-right text-xs text-danger">
          {state.error}
        </span>
      )}
    </form>
  );
}
