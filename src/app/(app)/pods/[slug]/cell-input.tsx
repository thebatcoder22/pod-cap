"use client";

import { useActionState } from "react";
import type { CellState } from "./actions";

/** A number in a table cell that saves when the lead leaves the field or presses Enter. Bounds are checked here and again on the server. */
export function CellInput(props: {
  action: (state: CellState, form: FormData) => Promise<CellState>;
  /** Sent with the value, to say what it belongs to. */
  fields: Record<string, string | number>;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  unit: string;
  /** The box the column's values share. */
  className: string;
}) {
  const [state, save, saving] = useActionState(props.action, null);
  return (
    <form action={save} className="inline-flex flex-col items-end">
      {Object.entries(props.fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label
        className={`${props.className} border-line-strong bg-surface shadow-card transition hover:border-ink-faint focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent has-aria-invalid:border-danger ${saving ? "opacity-60" : ""}`}
      >
        <input
          name={props.name}
          type="number"
          inputMode={Number.isInteger(props.step) ? "numeric" : "decimal"}
          required
          min={props.min}
          max={props.max}
          step={props.step}
          defaultValue={props.value}
          aria-label={props.label}
          aria-invalid={!!state || undefined}
          aria-busy={saving}
          onBlur={(e) => {
            const input = e.target;
            if (input.value === input.defaultValue) return;
            // Leaving with a value out of range undoes it, rather than trapping focus in the field.
            if (input.checkValidity()) input.form?.requestSubmit();
            else input.value = input.defaultValue;
          }}
          className={`w-[3ch] [appearance:textfield] bg-transparent text-right outline-none [&::-webkit-inner-spin-button]:appearance-none ${props.value === 0 ? "text-ink-faint focus:text-ink" : ""}`}
        />
        <span aria-hidden className="text-ink-faint">
          {props.unit}
        </span>
      </label>
      {state && (
        <span role="alert" className="mt-1 max-w-40 text-right text-xs text-danger">
          {state.error}
        </span>
      )}
    </form>
  );
}
