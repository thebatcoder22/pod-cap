"use client";

import { useActionState } from "react";
import { CheckCircleIcon, KeyIcon, WarningCircleIcon } from "@phosphor-icons/react";
import type { PeopleAdmin } from "@/server/people";
import {
  addAllowlistAction,
  addFromJiraAction,
  confirmJiraAccountAction,
  movePersonAction,
  removeAllowlistAction,
  removePersonAction,
  saveJiraAction,
  testJiraAction,
  type ActionState,
} from "./actions";

const input =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm placeholder:text-ink-faint focus:outline-2 focus:outline-accent";
const primary =
  "rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50";
const select =
  "rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm focus:outline-2 focus:outline-accent";
const list = "divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-card";
const row = "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm";
const secondary =
  "rounded-lg border border-line-strong px-3.5 py-2 text-sm font-medium transition hover:bg-line/60 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";

/** Shows the most recent of the form's action results, so an older one never lingers as if current. */
function Result({ states }: { states: ActionState[] }) {
  const state = states.reduce((a, b) => ((b?.at ?? 0) > (a?.at ?? 0) ? b : a), null);
  if (!state) return null;
  const Icon = state.ok ? CheckCircleIcon : WarningCircleIcon;
  return (
    <p className={`flex items-start gap-2 text-sm ${state.ok ? "text-accent" : "text-danger"}`}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
      {state.message}
    </p>
  );
}

export function JiraForm({ settings }: { settings: { site: string; email: string; tokenUpdatedAt: string } | null }) {
  const [saved, save, saving] = useActionState(saveJiraAction, null);
  const [tested, test, testing] = useActionState(testJiraAction, null);

  return (
    // gap, not space-y: the hidden result region must not leave a margin behind.
    <div className="flex flex-col gap-5">
      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <KeyIcon size={16} aria-hidden />
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

      <div className="flex flex-wrap items-center gap-2">
        <button form="jira" type="submit" disabled={saving} className={primary}>
          {saving ? "Saving…" : "Save"}
        </button>
        <form action={test}>
          <button type="submit" disabled={!settings || testing} className={secondary}>
            {testing ? "Testing…" : "Test connection"}
          </button>
        </form>
      </div>

      <div aria-live="polite" className="empty:hidden">
        <Result states={[saved, tested]} />
      </div>
    </div>
  );
}

export function Allowlist({ rows, viewerEmail }: { rows: { email: string; isAdmin: boolean }[]; viewerEmail: string }) {
  const [added, add, adding] = useActionState(addAllowlistAction, null);
  const [removed, remove, removing] = useActionState(removeAllowlistAction, null);
  const admins = rows.filter((r) => r.isAdmin).length;

  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-card">
        {rows.map((r) => {
          const isYou = r.email === viewerEmail;
          const removable = !isYou && !(r.isAdmin && admins <= 1);
          return (
            <li key={r.email} className="flex min-h-12 items-center gap-3 px-5 py-2 text-sm">
              <span className="min-w-0 truncate">{r.email}</span>
              {r.isAdmin && (
                <span className="rounded-lg bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Admin</span>
              )}
              {isYou && <span className="text-xs text-ink-faint">You</span>}
              {removable && (
                <form action={remove} className="ml-auto">
                  <input type="hidden" name="email" value={r.email} />
                  <button
                    type="submit"
                    disabled={removing}
                    aria-label={`Remove ${r.email}`}
                    className="rounded-lg px-2.5 py-1 text-sm text-ink-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                  >
                    Remove
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      <form action={add} className="flex gap-2">
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
          className={`${input} max-w-xs`}
        />
        <button type="submit" disabled={adding} className={secondary}>
          {adding ? "Adding…" : "Add"}
        </button>
      </form>

      <div aria-live="polite" className="empty:hidden">
        <Result states={[removed, added]} />
      </div>
    </div>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Live({ states }: { states: ActionState[] }) {
  return (
    <div aria-live="polite" className="empty:hidden">
      <Result states={states} />
    </div>
  );
}

export function ConfirmJira({ rows, others }: { rows: PeopleAdmin["toConfirm"]; others: PeopleAdmin["noPod"] }) {
  const [state, confirm, confirming] = useActionState(confirmJiraAccountAction, null);
  return (
    <div className="flex flex-col gap-3">
      <Live states={[state]} />
      <ul className={list}>
        {rows.map((p) => (
          <li key={p.id} className={row}>
            <div className="min-w-0 flex-[1_1_12rem]">
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
    </div>
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
    <div className="flex flex-col gap-3">
      <Live states={[state]} />
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong px-5 py-6 text-center text-sm text-ink-muted">
          No one waiting. Jira users on DTP tickets who are in no pod show up here after a sync.
        </p>
      ) : (
        <ul className={list}>
          {rows.map((u) => (
            <li key={u.accountId} className={row}>
              <div className="min-w-0 flex-[1_1_12rem]">
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
    </div>
  );
}

export function Members({ rows, pods }: { rows: PeopleAdmin["members"]; pods: PeopleAdmin["pods"] }) {
  const [moved, move, moving] = useActionState(movePersonAction, null);
  const [removed, remove, removing] = useActionState(removePersonAction, null);
  return (
    <div className="flex flex-col gap-3">
      <Live states={[moved, removed]} />
      {pods.map((pod) => {
        const members = rows.filter((m) => m.pod.id === pod.id);
        return (
          <section key={pod.id} aria-label={pod.name} className="space-y-2">
            <h4 className="flex items-baseline gap-2 text-sm font-medium">
              {pod.name}
              <span className="text-xs font-normal text-ink-faint">{plural(members.length, "person", "people")}</span>
            </h4>
            {members.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong px-5 py-4 text-sm text-ink-muted">
                No one in {pod.name} yet.
              </p>
            ) : (
              <ul className={list}>
                {members.map((m) => (
                  <li key={m.id} className={row}>
                    <div className="min-w-0 flex-[1_1_12rem]">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        <span className="rounded-lg border border-line px-1.5 py-px font-mono text-xs">
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
                            className="rounded-lg px-2.5 py-1.5 text-sm text-ink-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"
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
    </div>
  );
}
