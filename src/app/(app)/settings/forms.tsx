"use client";

import { useActionState } from "react";
import { KeyIcon } from "@phosphor-icons/react";
import {
  addAllowlistAction,
  addHolidayAction,
  removeAllowlistAction,
  removeHolidayAction,
  saveJiraAction,
  setFocusFactorAction,
  testJiraAction,
} from "./actions";
import { Avatar } from "@/components/brand";
import { footer, ghostDanger, input, list, primary, Result, secondary } from "./form-ui";

export { ConfirmJira, Members, NoPodYet } from "./people-forms";

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
