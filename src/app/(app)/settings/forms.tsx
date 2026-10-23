"use client";

import { useActionState } from "react";
import { CheckCircleIcon, KeyIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Avatar } from "@/components/brand";
import type { PeopleAdmin } from "@/server/people";
import {
  addAllowlistAction,
  addFromJiraAction,
  addHolidayAction,
  confirmJiraAccountAction,
  movePersonAction,
  removeAllowlistAction,
  removeHolidayAction,
  removePersonAction,
  saveJiraAction,
  setFocusFactorAction,
  testJiraAction,
  type ActionState,
} from "./actions";

const focus = "focus:outline-2 focus:outline-offset-1 focus:outline-accent";
const input = `h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm shadow-card placeholder:text-ink-faint ${focus}`;
const primary =
  "h-9 rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.16)] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50";
const select = `h-9 rounded-lg border border-line-strong bg-surface pr-8 pl-2.5 text-sm shadow-card transition hover:bg-fill ${focus}`;
const list = "divide-y divide-line";
const row = "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm";
const secondary =
  "h-9 rounded-lg border border-line-strong bg-surface px-3.5 text-sm font-medium shadow-card transition hover:bg-fill active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";
const ghostDanger =
  "h-9 rounded-lg px-2.5 text-sm text-ink-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-50";
/** The action bar at the bottom of a settings panel. */
const footer = "flex flex-wrap items-center gap-3 border-t border-line bg-fill/50 px-5 py-3";

/** Shows the most recent of the form's action results, so an older one never lingers as if current. */
function Result({ states }: { states: ActionState[] }) {
  const state = states.reduce((a, b) => ((b?.at ?? 0) > (a?.at ?? 0) ? b : a), null);
  if (!state) return null;
  const Icon = state.ok ? CheckCircleIcon : WarningCircleIcon;
  return (
    <p className={`flex items-start gap-2 text-sm ${state.ok ? "text-success" : "text-danger"}`}>
      <Icon size={16} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
      {state.message}
    </p>
  );
}

export function JiraForm({ settings }: { settings: { site: string; email: string; tokenUpdatedAt: string } | null }) {
  const [saved, save, saving] = useActionState(saveJiraAction, null);
  const [tested, test, testing] = useActionState(testJiraAction, null);

  return (
    <>
      <div className="space-y-5 p-5">
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="grid size-6 place-items-center rounded-md bg-fill">
            <KeyIcon size={14} aria-hidden />
          </span>
          {settings ? <>API token saved {settings.tokenUpdatedAt}.</> : <>No API token saved yet.</>}
        </p>

        <form id="jira" action={save} className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="block text-sm font-medium">Site</span>
            <input
              name="site"
              required
              defaultValue={saved?.fields?.site ?? settings?.site.replace("https://", "")}
              placeholder="delightree.atlassian.net"
              className={input}
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-sm font-medium">Account email</span>
            <input
              name="email"
              type="email"
              required
              defaultValue={saved?.fields?.email ?? settings?.email}
              placeholder="you@delightree.com"
              className={input}
            />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="block text-sm font-medium">API token</span>
            <input
              name="token"
              type="password"
              autoComplete="new-password"
              required={!settings}
              placeholder={settings ? "Leave blank to keep the saved token" : "Paste an Atlassian API token"}
              className={input}
            />
            <span className="block text-xs text-ink-faint">
              Stored encrypted and never shown again. Paste a new token here to replace it.
            </span>
          </label>
        </form>
      </div>

      <div className={footer}>
        <button form="jira" type="submit" disabled={saving} className={primary}>
          {saving ? "Saving…" : "Save"}
        </button>
        <form action={test}>
          <button type="submit" disabled={!settings || testing} className={secondary}>
            {testing ? "Testing…" : "Test connection"}
          </button>
        </form>
        <div aria-live="polite" className="min-w-0 basis-full empty:hidden sm:ml-2 sm:basis-auto sm:flex-1">
          <Result states={[saved, tested]} />
        </div>
      </div>
    </>
  );
}

export function Allowlist({ rows, viewerEmail }: { rows: { email: string; isAdmin: boolean }[]; viewerEmail: string }) {
  const [added, add, adding] = useActionState(addAllowlistAction, null);
  const [removed, remove, removing] = useActionState(removeAllowlistAction, null);
  const admins = rows.filter((r) => r.isAdmin).length;

  return (
    <>
      <ul className={list}>
        {rows.map((r) => {
          const isYou = r.email === viewerEmail;
          const removable = !isYou && !(r.isAdmin && admins <= 1);
          return (
            <li key={r.email} className="flex min-h-13 items-center gap-3 px-5 py-2 text-sm">
              <Avatar name={r.email} size="sm" />
              <span className="min-w-0 truncate">{r.email}</span>
              {r.isAdmin && (
                <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent">Admin</span>
              )}
              {isYou && <span className="text-xs text-ink-faint">You</span>}
              {removable && (
                <form action={remove} className="ml-auto">
                  <input type="hidden" name="email" value={r.email} />
                  <button type="submit" disabled={removing} aria-label={`Remove ${r.email}`} className={ghostDanger}>
                    Remove
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      <form action={add} className={footer}>
        <label htmlFor="allowlist-email" className="sr-only">
          Email address to allow
        </label>
        <input
          id="allowlist-email"
          name="email"
          type="email"
          required
          defaultValue={added?.fields?.email}
          placeholder="name@delightree.com"
          className={`${input} max-w-xs flex-1`}
        />
        <button type="submit" disabled={adding} className={secondary}>
          {adding ? "Adding…" : "Add"}
        </button>
        <div aria-live="polite" className="min-w-0 basis-full empty:hidden sm:ml-2 sm:basis-auto sm:flex-1">
          <Result states={[removed, added]} />
        </div>
      </form>
    </>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Live({ states }: { states: ActionState[] }) {
  return (
    <div aria-live="polite" className="border-b border-line bg-fill/50 px-5 py-2.5 empty:hidden">
      <Result states={states} />
    </div>
  );
}

export function ConfirmJira({ rows, others }: { rows: PeopleAdmin["toConfirm"]; others: PeopleAdmin["noPod"] }) {
  const [state, confirm, confirming] = useActionState(confirmJiraAccountAction, null);
  return (
    <>
      <Live states={[state]} />
      <ul className={list}>
        {rows.map((p) => (
          <li key={p.id} className={row}>
            <Avatar name={p.name} size="md" />
            <div className="min-w-0 flex-[1_1_10rem]">
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-ink-faint">
                {p.pod} ·{" "}
                {p.candidates.length
                  ? `${plural(p.candidates.length, "possible match", "possible matches")} in Jira`
                  : "No likely match on DTP tickets yet"}
              </p>
            </div>
            <form action={confirm} className="flex items-center gap-2">
              <input type="hidden" name="personId" value={p.id} />
              <select
                name="accountId"
                required
                aria-label={`Jira account for ${p.name}`}
                // One suggestion is preselected, but still needs the click; several need a deliberate pick.
                defaultValue={p.candidates.length === 1 ? p.candidates[0].accountId : ""}
                className={`${select} w-48`}
              >
                <option value="" disabled>
                  Pick a Jira user
                </option>
                {p.candidates.length > 0 && (
                  <optgroup label="Suggested">
                    {p.candidates.map((u) => (
                      <option key={u.accountId} value={u.accountId}>
                        {u.displayName}
                      </option>
                    ))}
                  </optgroup>
                )}
                {others.length > 0 && (
                  <optgroup label="Other Jira users">
                    {others.map((u) => (
                      <option key={u.accountId} value={u.accountId}>
                        {u.displayName}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="submit"
                disabled={confirming || !(p.candidates.length || others.length)}
                aria-label={`Confirm Jira account for ${p.name}`}
                className={secondary}
              >
                Confirm
              </button>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}

export function NoPodYet({
  rows,
  pods,
  skills,
}: {
  rows: PeopleAdmin["noPod"];
  pods: PeopleAdmin["pods"];
  skills: readonly string[];
}) {
  const [state, add, adding] = useActionState(addFromJiraAction, null);
  return (
    <>
      <Live states={[state]} />
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-muted">
          No one waiting. Jira users on DTP tickets who are in no pod show up here after a sync.
        </p>
      ) : (
        <ul className={list}>
          {rows.map((u) => (
            <li key={u.accountId} className={row}>
              <Avatar name={u.displayName} size="md" />
              <div className="min-w-0 flex-[1_1_10rem]">
                <p className="font-medium">{u.displayName}</p>
                <p className="text-xs text-ink-faint">On {plural(u.tickets, "DTP ticket")}</p>
              </div>
              <form action={add} className="flex items-center gap-2">
                <input type="hidden" name="accountId" value={u.accountId} />
                <select
                  name="podId"
                  required
                  defaultValue=""
                  aria-label={`Pod for ${u.displayName}`}
                  className={select}
                >
                  <option value="" disabled>
                    Pod
                  </option>
                  {pods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  name="mainSkill"
                  required
                  defaultValue=""
                  aria-label={`Main skill for ${u.displayName}`}
                  className={select}
                >
                  <option value="" disabled>
                    Main skill
                  </option>
                  {skills.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button type="submit" disabled={adding} aria-label={`Add ${u.displayName}`} className={secondary}>
                  Add
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function Members({ rows, pods }: { rows: PeopleAdmin["members"]; pods: PeopleAdmin["pods"] }) {
  const [moved, move, moving] = useActionState(movePersonAction, null);
  const [removed, remove, removing] = useActionState(removePersonAction, null);
  return (
    <>
      <Live states={[moved, removed]} />
      {pods.map((pod) => {
        const members = rows.filter((m) => m.pod.id === pod.id);
        return (
          <section key={pod.id} aria-label={pod.name} className="border-b border-line last:border-b-0">
            <h4 className="flex items-baseline gap-2 border-b border-line bg-fill/50 px-5 py-2 text-xs font-medium">
              {pod.name}
              <span className="font-normal text-ink-faint">{plural(members.length, "person", "people")}</span>
            </h4>
            {members.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-muted">No one in {pod.name} yet.</p>
            ) : (
              <ul className={list}>
                {members.map((m) => (
                  <li key={m.id} className={row}>
                    <Avatar name={m.name} size="md" tone={m.isLead ? "accent" : "neutral"} />
                    <div className="min-w-0 flex-[1_1_10rem]">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        <span className="rounded-md bg-fill px-1.5 py-px font-mono text-xs text-ink-muted">
                          {m.mainSkill}
                        </span>
                        {m.isLead && <span className="text-xs text-ink-faint">Lead</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {m.jira
                          ? `Jira: ${m.jira.displayName ?? "linked, on no synced ticket"}`
                          : "Not linked to Jira yet"}
                      </p>
                    </div>
                    {m.isLead ? (
                      <span className="text-xs text-ink-faint">Leads stay in their pod</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <form action={move} className="flex items-center gap-2">
                          <input type="hidden" name="personId" value={m.id} />
                          <select
                            name="podId"
                            defaultValue={m.pod.id}
                            aria-label={`Pod for ${m.name}`}
                            className={select}
                          >
                            {pods.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" disabled={moving} aria-label={`Move ${m.name}`} className={secondary}>
                            Move
                          </button>
                        </form>
                        <form
                          action={remove}
                          onSubmit={(e) => {
                            if (!confirm(`Remove ${m.name}? They stop counting toward any pod.`)) e.preventDefault();
                          }}
                        >
                          <input type="hidden" name="personId" value={m.id} />
                          <button
                            type="submit"
                            disabled={removing}
                            aria-label={`Remove ${m.name}`}
                            className={ghostDanger}
                          >
                            Remove
                          </button>
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}

export function Planning({
  focusPercent,
  holidays,
}: {
  focusPercent: number;
  holidays: { date: string; name: string; label: string }[];
}) {
  const [focused, saveFocus, savingFocus] = useActionState(setFocusFactorAction, null);
  const [added, add, adding] = useActionState(addHolidayAction, null);
  const [removed, remove, removing] = useActionState(removeHolidayAction, null);

  return (
    <>
      <form action={saveFocus} className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-line p-5">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">Focus factor</span>
          <span
            className={`${input} flex w-28 items-center gap-1 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent`}
          >
            <input
              name="percent"
              type="number"
              inputMode="numeric"
              required
              min={1}
              max={100}
              step={1}
              defaultValue={focused?.fields?.percent ?? focusPercent}
              className="w-full [appearance:textfield] bg-transparent tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span aria-hidden className="text-ink-faint">
              %
            </span>
          </span>
        </label>
        <button type="submit" disabled={savingFocus} className={secondary}>
          {savingFocus ? "Saving…" : "Save"}
        </button>
        <p className="basis-full text-xs text-ink-faint">
          The share of available days that is plannable. The rest is for thinking, monitoring and rituals.
        </p>
        <div aria-live="polite" className="basis-full empty:hidden">
          <Result states={[focused]} />
        </div>
      </form>

      <h3 className="flex items-baseline gap-2 border-b border-line bg-fill/50 px-5 py-2 text-xs font-medium">
        Company holidays
        <span className="font-normal text-ink-faint tabular-nums">{holidays.length}</span>
      </h3>
      {holidays.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-ink-muted">
          No holidays yet. A holiday takes a day off every person&apos;s capacity.
        </p>
      ) : (
        <ul className={list}>
          {holidays.map((h) => (
            <li key={h.date} className="flex min-h-13 items-center gap-4 px-5 py-2 text-sm">
              <span className="w-32 shrink-0 text-ink-muted tabular-nums">{h.label}</span>
              <span className="min-w-0 truncate font-medium">{h.name}</span>
              <form action={remove} className="ml-auto">
                <input type="hidden" name="date" value={h.date} />
                <button type="submit" disabled={removing} aria-label={`Remove ${h.name}`} className={ghostDanger}>
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={add} className={footer}>
        <label htmlFor="holiday-date" className="sr-only">
          Holiday date
        </label>
        <input
          id="holiday-date"
          name="date"
          type="date"
          required
          defaultValue={added?.fields?.date}
          className={`${input} max-w-44`}
        />
        <label htmlFor="holiday-name" className="sr-only">
          Holiday name
        </label>
        <input
          id="holiday-name"
          name="name"
          required
          defaultValue={added?.fields?.name}
          placeholder="Diwali"
          className={`${input} max-w-xs flex-1`}
        />
        <button type="submit" disabled={adding} className={secondary}>
          {adding ? "Adding…" : "Add holiday"}
        </button>
        <div aria-live="polite" className="min-w-0 basis-full empty:hidden">
          <Result states={[added, removed]} />
        </div>
      </form>
    </>
  );
}
