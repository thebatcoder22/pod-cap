import { notFound } from "next/navigation";
import { SKILLS } from "@/db/schema";
import { dateTime, longDay } from "@/lib/format";
import { getPeopleAdmin } from "@/server/people";
import { requireViewer } from "@/server/session";
import { getJiraSettings, getPlanningSettings, listAllowlist } from "@/server/settings";
import { Allowlist, ConfirmJira, JiraForm, Members, NoPodYet, Planning } from "./forms";

// Small admin-only page: blocks on the session.
export const instant = false;

export default async function SettingsPage() {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) notFound();
  const [jira, rows, people, planning] = await Promise.all([
    getJiraSettings(viewer),
    listAllowlist(viewer),
    getPeopleAdmin(viewer),
    getPlanningSettings(),
  ]);
  // Rows with nothing to pick from would only repeat "Not linked to Jira yet" from the member list.
  const toConfirm = people.toConfirm.filter((p) => p.candidates.length || people.noPod.length);

  const sections = [
    { id: "jira-connection", label: "Jira connection" },
    { id: "access", label: "Who can sign in" },
    { id: "capacity", label: "Capacity planning" },
    { id: "people", label: "People" },
  ];

  return (
    <div className="lg:grid lg:grid-cols-[11rem_minmax(0,46rem)] lg:gap-x-12">
      <header className="rise space-y-1.5 lg:col-span-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-ink-muted">Shared by every pod. Only admins can change them.</p>
      </header>

      <nav aria-label="Settings sections" className="hidden lg:block">
        <ul className="sticky top-10 mt-10 space-y-px">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex h-8 items-center rounded-lg px-2 text-sm text-ink-muted transition-colors hover:bg-fill hover:text-ink"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 space-y-12">
        <Panel
          // Not "jira": that id belongs to the form the Save button submits.
          id="jira-connection"
          title="Jira connection"
          description="The account the platform reads DTP with. It never writes to Jira."
          i={1}
        >
          <JiraForm
            // Only what the form needs: the token never reaches the browser.
            settings={
              jira && {
                site: jira.site,
                email: jira.email,
                tokenUpdatedAt: dateTime(jira.tokenUpdatedAt),
              }
            }
          />
        </Panel>

        <Panel
          id="access"
          title="Who can sign in"
          description="Removing an address signs that person out on their next request."
          i={2}
        >
          <Allowlist rows={rows} viewerEmail={viewer.email} />
        </Panel>

        <Panel
          id="capacity"
          title="Capacity planning"
          description="Every pod's capacity is (working days - leave - holidays) x focus factor."
          i={3}
        >
          <Planning
            focusPercent={planning.focusPercent}
            holidays={planning.holidays.map((h) => ({ ...h, label: longDay(new Date(h.date)) }))}
          />
        </Panel>

        <section
          aria-labelledby="people-heading"
          className="rise scroll-mt-10 space-y-5"
          style={{ "--i": 4 } as React.CSSProperties}
          id="people"
        >
          <div className="space-y-1">
            <h2 id="people-heading" className="text-base font-semibold tracking-tight">
              People
            </h2>
            <p className="max-w-[65ch] text-sm text-ink-muted">
              Who is in which pod, and who they are in Jira. Each sync links people whose email or full name matches one
              Jira user. Anything less certain waits for you here.
            </p>
          </div>

          {toConfirm.length > 0 && (
            <SubPanel id="confirm-heading" title="Confirm Jira accounts" count={toConfirm.length}>
              <ConfirmJira rows={toConfirm} others={people.noPod} />
            </SubPanel>
          )}

          <SubPanel id="no-pod-heading" title="No pod yet" count={people.noPod.length}>
            <NoPodYet rows={people.noPod} pods={people.pods} skills={SKILLS} />
          </SubPanel>

          <SubPanel id="members-heading" title="Members" count={people.members.length}>
            <Members rows={people.members} pods={people.pods} />
          </SubPanel>
        </section>
      </div>
    </div>
  );
}

const panel = "overflow-hidden rounded-lg border border-line bg-surface shadow-card";

/** A top-level settings section: the heading sits above its card. */
function Panel({
  id,
  title,
  description,
  i,
  children,
}: {
  id: string;
  title: string;
  description: string;
  i: number;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="rise scroll-mt-10 space-y-4"
      style={{ "--i": i } as React.CSSProperties}
    >
      <div className="space-y-1">
        <h2 id={`${id}-heading`} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-ink-muted">{description}</p>
      </div>
      <div className={panel}>{children}</div>
    </section>
  );
}

/** A card inside the People section, titled in its own header bar. */
function SubPanel({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={panel}>
      <h3 id={id} className="flex items-baseline gap-2 border-b border-line px-5 py-3 text-sm font-medium">
        {title}
        <span className="font-normal text-ink-faint tabular-nums">{count}</span>
      </h3>
      {children}
    </section>
  );
}
