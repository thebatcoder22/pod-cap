import { notFound } from "next/navigation";
import { dateTime } from "@/lib/format";
import { requireViewer } from "@/server/session";
import { getJiraSettings, listAllowlist } from "@/server/settings";
import { Allowlist, JiraForm } from "./forms";

// Small admin-only page: blocks on the session.
export const instant = false;

export default async function SettingsPage() {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) notFound();
  const [jira, rows] = await Promise.all([getJiraSettings(viewer), listAllowlist(viewer)]);

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
    </div>
  );
}
