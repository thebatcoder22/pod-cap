"use client";

import { useActionState, useState } from "react";
import { ArrowSquareOutIcon, PlusIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { SKILLS } from "@/db/schema";
import type { CapacitySheet } from "@/server/capacity";
import { addManualItemAction, deleteManualItemAction, updateManualItemAction, type ItemState } from "./actions";

const focus = "focus:outline-2 focus:outline-offset-1 focus:outline-accent";
const field = `h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm shadow-card placeholder:text-ink-faint ${focus}`;
const primary =
  "h-9 rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.16)] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50";
const ghost =
  "h-8 rounded-lg px-2.5 text-sm text-ink-muted transition hover:bg-fill hover:text-ink disabled:opacity-50";
const ghostDanger =
  "h-8 rounded-lg px-2.5 text-sm text-ink-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-50";

type ManualItem = CapacitySheet["items"][number];

const KIND = { work: "Non-Jira work", placeholder: "Placeholder" };

type Person = { id: number; name: string };

/** Work Jira does not hold, and placeholders for work not ticketed yet, counted with the sprint's tickets. */
export function ManualItems(props: {
  items: ManualItem[];
  people: Person[];
  podId: number;
  sprintId: number;
  canEdit: boolean;
}) {
  const { items, canEdit } = props;
  const [editing, setEditing] = useState<number | null>(null);

  return (
    <section aria-labelledby="manual" className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-5 pb-3 sm:px-5">
        <h3 id="manual" className="text-sm font-medium">
          Manual items
        </h3>
        <span className="text-xs text-ink-faint">Counted with the sprint&apos;s tickets</span>
      </div>
      {items.length === 0 ? (
        <p className="border-t border-line px-4 py-5 text-sm text-ink-muted sm:px-5">
          {canEdit
            ? "No manual items. Add support, interviews or onboarding, or reserve days for work not in Jira yet."
            : "No manual items in this sprint."}
        </p>
      ) : (
        <ul aria-label="Manual items" className="divide-y divide-line border-t border-line">
          {items.map((item) =>
            editing === item.id ? (
              <li key={item.id} aria-label={item.title} className="bg-fill/40 px-4 py-4 sm:px-5">
                <ItemForm {...props} item={item} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <Row key={item.id} item={item} canEdit={canEdit} onEdit={() => setEditing(item.id)} />
            ),
          )}
        </ul>
      )}
      {canEdit && (
        <div className="border-t border-line bg-fill/50 px-4 py-4 sm:px-5">
          <ItemForm {...props} />
        </div>
      )}
    </section>
  );
}

function Row({ item, canEdit, onEdit }: { item: ManualItem; canEdit: boolean; onEdit: () => void }) {
  const [state, remove, removing] = useActionState(deleteManualItemAction, null);
  return (
    <li aria-label={item.title} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-sm sm:px-5">
      <span className="flex min-w-0 flex-1 basis-full flex-col gap-1 sm:basis-0">
        <span className={`truncate font-medium ${item.counts ? "" : "text-ink-muted line-through"}`} title={item.title}>
          {item.title}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
          <span>{KIND[item.kind]}</span>
          {item.jiraKey && (
            <a
              href={item.url ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-ink-muted hover:text-accent"
            >
              {item.jiraKey}
              {item.url && (
                <>
                  <ArrowSquareOutIcon size={12} aria-hidden />
                  <span className="sr-only">(opens Jira)</span>
                </>
              )}
            </a>
          )}
          {!item.counts && <span>In {item.ticketPod}&apos;s sprint, so the ticket&apos;s estimate counts instead</span>}
        </span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-3">
        <span className={`text-xs ${item.person ? "text-ink-muted" : "text-ink-faint"}`}>
          {item.person ?? "No one yet"}
        </span>
        <span className="rounded-md bg-fill px-1.5 py-px font-mono text-xs text-ink-muted tabular-nums">
          {item.skill} {item.days}d
        </span>
        {canEdit && (
          <span className="-mr-2.5 flex items-center">
            <button type="button" onClick={onEdit} aria-label={`Edit ${item.title}`} className={ghost}>
              Edit
            </button>
            <form action={remove}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" disabled={removing} aria-label={`Delete ${item.title}`} className={ghostDanger}>
                Delete
              </button>
            </form>
          </span>
        )}
      </span>
      {state?.error && <Alert message={state.error} />}
    </li>
  );
}

/** Adds an item, or edits `item`. */
function ItemForm({
  item,
  people,
  podId,
  sprintId,
  onDone,
}: {
  item?: ManualItem;
  people: Person[];
  podId: number;
  sprintId: number;
  onDone?: () => void;
}) {
  const [kind, setKind] = useState(item?.kind ?? "work");
  const [state, save, saving] = useActionState(async (prev: ItemState, form: FormData) => {
    const next = await (item ? updateManualItemAction : addManualItemAction)(prev, form);
    if (next?.ok) {
      onDone?.();
      setKind("work");
    }
    return next;
  }, null);
  const typed = state?.ok ? undefined : state?.fields;
  const label = "mb-1.5 block text-xs font-medium text-ink-muted";

  return (
    // A fresh form after each result, so a save clears it and a refusal shows what was typed.
    <form key={state?.at} action={save} aria-label={item ? `Edit ${item.title}` : "Add a manual item"}>
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <input type="hidden" name="podId" value={podId} />
      <input type="hidden" name="sprintId" value={sprintId} />
      <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)] lg:grid-cols-[11rem_minmax(0,1fr)_11rem_5.5rem_5.5rem]">
        <label>
          <span className={label}>Kind</span>
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className={`${field} pr-8`}
          >
            <option value="work">{KIND.work}</option>
            <option value="placeholder">{KIND.placeholder}</option>
          </select>
        </label>
        <label>
          <span className={label}>Title</span>
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={typed?.title ?? item?.title}
            placeholder={kind === "work" ? "Support rotation" : "Checklist exports"}
            className={field}
          />
        </label>
        <label>
          <span className={label}>Person</span>
          <select name="personId" defaultValue={typed?.personId ?? item?.personId ?? ""} className={`${field} pr-8`}>
            <option value="">No one yet</option>
            {/* Someone who has left the pod stays picked, so saving says so rather than quietly dropping them. */}
            {item?.personId && !people.some((p) => p.id === item.personId) && (
              <option value={item.personId}>{item.person}, no longer in the pod</option>
            )}
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}>Skill</span>
          <select name="skill" defaultValue={typed?.skill ?? item?.skill ?? "FE"} className={`${field} pr-8`}>
            {SKILLS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}>Days</span>
          <input
            name="days"
            type="number"
            inputMode="decimal"
            required
            min={0.5}
            max={99.5}
            step={0.5}
            defaultValue={typed?.days ?? item?.days}
            className={`${field} tabular-nums`}
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {kind === "placeholder" && (
          <label className="w-40">
            <span className={label}>Jira ticket, once it exists</span>
            <input
              name="jiraKey"
              defaultValue={typed?.jiraKey ?? item?.jiraKey ?? ""}
              placeholder="DTP-163"
              pattern="[Dd][Tt][Pp]-[0-9]+"
              className={`${field} font-mono uppercase placeholder:normal-case`}
            />
          </label>
        )}
        <span className="ml-auto flex items-center gap-2">
          {item && (
            <button type="button" onClick={onDone} className={ghost}>
              Cancel
            </button>
          )}
          <button type="submit" disabled={saving} className={`${primary} inline-flex items-center gap-1.5`}>
            {item ? (
              saving ? (
                "Saving…"
              ) : (
                "Save"
              )
            ) : (
              <>
                <PlusIcon size={14} weight="bold" aria-hidden />
                {saving ? "Adding…" : "Add item"}
              </>
            )}
          </button>
        </span>
        {state?.error && <Alert message={state.error} />}
      </div>
    </form>
  );
}

function Alert({ message }: { message: string }) {
  return (
    <p role="alert" className="flex basis-full items-center gap-1.5 text-xs text-danger">
      <WarningCircleIcon size={14} weight="fill" aria-hidden />
      {message}
    </p>
  );
}
