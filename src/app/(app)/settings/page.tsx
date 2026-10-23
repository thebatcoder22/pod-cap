import { notFound } from "next/navigation";
import { SKILLS } from "@/db/schema";
import { dateTime } from "@/lib/format";
import { getPeopleAdmin } from "@/server/people";
import { requireViewer } from "@/server/session";
import { getJiraSettings, listAllowlist } from "@/server/settings";
import { Allowlist, ConfirmJira, JiraForm, Members, NoPodYet } from "./forms";

// Small admin-only page: blocks on the session.
export const instant = false;

export default async function SettingsPage() {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) notFound();
  const [jira, rows, people] = await Promise.all([
    getJiraSettings(viewer),
    listAllowlist(viewer),
    getPeopleAdmin(viewer),
  ]);
  // Rows with nothing to pick from would only repeat "Not linked to Jira yet" from the member list.
  const toConfirm = people.toConfirm.filter((p) => p.candidates.length || people.noPod.length);

  return (
    <div className="max-w-2xl space-y-10">
      <section className="rise space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-ink-muted">Shared by every pod. Only admins can change them.</p>
      </section>

      <section aria-labelledby="jira-heading" className="rise space-y-3" style={{ "--i": 1 } as React.CSSProperties}>
        <h2 id="jira-heading" className="text-base font-semibold tracking-tight">
          Jira connection
        </h2>
        <div className="rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6">
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
        </div>
      </section>

      <section aria-labelledby="access-heading" className="rise space-y-3" style={{ "--i": 2 } as React.CSSProperties}>
        <div className="space-y-1">
          <h2 id="access-heading" className="text-base font-semibold tracking-tight">
            Who can sign in
          </h2>
          <p className="text-sm text-ink-faint">Removing an address signs that person out on their next request.</p>
        </div>
        <Allowlist rows={rows} viewerEmail={viewer.email} />
      </section>

      <section aria-labelledby="people-heading" className="rise space-y-6" style={{ "--i": 3 } as React.CSSProperties}>
        <div className="space-y-1">
          <h2 id="people-heading" className="text-base font-semibold tracking-tight">
            People
          </h2>
          <p className="text-sm text-ink-faint">
            Who is in which pod, and who they are in Jira. Each sync links people whose email or full name matches one
            Jira user; anything less certain waits for you here.
          </p>
        </div>

        {toConfirm.length > 0 && (
          <section aria-labelledby="confirm-heading" className="space-y-3">
            <h3 id="confirm-heading" className="text-sm font-semibold">
              Confirm Jira accounts
            </h3>
            <ConfirmJira rows={toConfirm} others={people.noPod} />
          </section>
        )}

        <section aria-labelledby="no-pod-heading" className="space-y-3">
          <h3 id="no-pod-heading" className="text-sm font-semibold">
            No pod yet
          </h3>
          <NoPodYet rows={people.noPod} pods={people.pods} skills={SKILLS} />
        </section>

        <section aria-labelledby="members-heading" className="space-y-3">
          <h3 id="members-heading" className="text-sm font-semibold">
            Members
          </h3>
          <Members rows={people.members} pods={people.pods} />
        </section>
      </section>
    </div>
  );
}
