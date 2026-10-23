import { notFound } from "next/navigation";
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
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-ink-muted">Shared by every pod. Only admins can change them.</p>
      </section>

      <section aria-labelledby="jira-heading" className="space-y-3">
        <h2 id="jira-heading" className="text-sm font-medium text-ink-muted">
          Jira connection
        </h2>
        <div className="rounded-lg border border-line bg-surface p-5">
          <JiraForm
            // Only what the form needs: the token never reaches the browser.
            settings={
              jira && {
                site: jira.site,
                email: jira.email,
                tokenUpdatedAt: jira.tokenUpdatedAt.toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Kolkata",
                }),
              }
            }
          />
        </div>
      </section>

      <section aria-labelledby="access-heading" className="space-y-3">
        <div className="space-y-1">
          <h2 id="access-heading" className="text-sm font-medium text-ink-muted">
            Who can sign in
          </h2>
          <p className="text-sm text-ink-faint">Removing an address signs that person out on their next request.</p>
        </div>
        <Allowlist rows={rows} viewerEmail={viewer.email} />
      </section>
    </div>
  );
}
