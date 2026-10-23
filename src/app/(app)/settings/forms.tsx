"use client";

import { useActionState } from "react";
import { CheckCircleIcon, KeyIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { addAllowlistAction, removeAllowlistAction, saveJiraAction, testJiraAction, type ActionState } from "./actions";

const input =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm placeholder:text-ink-faint focus:outline-2 focus:outline-accent";
const primary =
  "rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50";
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
    <div className="space-y-5">
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
    <div className="space-y-4">
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
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
