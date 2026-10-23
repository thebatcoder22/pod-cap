"use client";

import { useActionState } from "react";
import type { Skill } from "@/db/schema";
import { setProficiencyAction } from "./actions";

/** Saves when the lead leaves the field or presses Enter. Bounds are checked here and again on the server. */
export function ProficiencyInput(props: {
  personId: number;
  name: string;
  skill: Skill;
  percent: number;
  /** The box the column's values share. */
  className: string;
}) {
  const [state, save, saving] = useActionState(setProficiencyAction, null);
  return (
    <form action={save} className="inline-flex flex-col items-end">
      <input type="hidden" name="personId" value={props.personId} />
      <input type="hidden" name="skill" value={props.skill} />
      <label
        className={`${props.className} border-line-strong bg-surface shadow-card transition hover:border-ink-faint focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent has-aria-invalid:border-danger ${saving ? "opacity-60" : ""}`}
      >
        <input
          name="percent"
          type="number"
          inputMode="numeric"
          required
          min={0}
          max={100}
          step={1}
          defaultValue={props.percent}
          aria-label={`${props.skill} proficiency for ${props.name}`}
          aria-invalid={!!state || undefined}
          aria-busy={saving}
          onBlur={(e) => {
            const input = e.target;
            if (input.value === input.defaultValue) return;
            // Leaving with a value out of range undoes it, rather than trapping focus in the field.
            if (input.checkValidity()) input.form?.requestSubmit();
            else input.value = input.defaultValue;
          }}
          className={`w-[3ch] [appearance:textfield] bg-transparent text-right outline-none [&::-webkit-inner-spin-button]:appearance-none ${props.percent === 0 ? "text-ink-faint focus:text-ink" : ""}`}
        />
        <span aria-hidden className="text-ink-faint">
          %
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
