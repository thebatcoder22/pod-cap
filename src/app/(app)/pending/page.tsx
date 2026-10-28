import Link from "next/link";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { PendingEpics } from "@/components/jira";
import { getPendingInJira } from "@/server/epics";
import { requireViewer } from "@/server/session";

// Small page: blocks on the session.
export const instant = false;

/** Every pod's open epics with something still to fill in on Jira, for leads to hand to their PMs. */
export default async function PendingPage() {
  const viewer = await requireViewer();
  const pending = await getPendingInJira(viewer.pods.map((p) => p.id));

  return (
    <div className="space-y-10">
      <header className="rise space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Pending in Jira</h1>
        <p className="text-sm text-ink-muted">What PMs still have to fill in on each pod&apos;s open epics in Jira.</p>
      </header>

      {pending.length === 0 ? (
        <p className="rise flex items-center gap-2 text-sm text-ink-muted" style={{ "--i": 1 } as React.CSSProperties}>
          <CheckCircleIcon size={16} weight="fill" className="text-success" aria-hidden />
          Every open epic has its POD and Ready for Production Date in Jira.
        </p>
      ) : (
        pending.map(({ pod, epics }, i) => (
          <section
            key={pod.id}
            aria-labelledby={`pod-${pod.slug}`}
            className="rise space-y-4"
            style={{ "--i": i + 1 } as React.CSSProperties}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id={`pod-${pod.slug}`} className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
                <Link href={`/pods/${pod.slug}`} className="hover:text-accent">
                  {pod.name}
                </Link>
                {viewer.pods.some((p) => p.id === pod.id) && (
                  <span className="inline-flex items-center rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent">
                    Your pod
                  </span>
                )}
              </h2>
              <p className="text-xs text-ink-faint tabular-nums">
                {epics.length} {epics.length === 1 ? "epic" : "epics"}
              </p>
            </div>
            <PendingEpics epics={epics} />
          </section>
        ))
      )}
    </div>
  );
}
