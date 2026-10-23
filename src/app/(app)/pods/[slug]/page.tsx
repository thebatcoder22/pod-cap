import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SKILLS } from "@/db/schema";
import { getPodPage } from "@/server/pods";
import { requireViewer } from "@/server/session";

export default function PodPage({ params }: PageProps<"/pods/[slug]">) {
  return (
    <Suspense fallback={<PodSkeleton />}>
      <Pod params={params} />
    </Suspense>
  );
}

async function Pod({ params }: Pick<PageProps<"/pods/[slug]">, "params">) {
  const [{ slug }, viewer] = await Promise.all([params, requireViewer()]);
  const page = await getPodPage(slug);
  if (!page) notFound();

  const { pod, members } = page;
  const lead = members.find((m) => m.isLead);
  const isOwn = viewer.pod?.id === pod.id;

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{pod.name}</h1>
          <span
            className={`rounded-lg px-2 py-0.5 text-xs font-medium ${
              isOwn ? "bg-accent-soft text-accent" : "border border-line text-ink-muted"
            }`}
          >
            {isOwn ? "Your pod" : "Read only"}
          </span>
        </div>
        <p className="text-sm text-ink-muted">
          {lead ? <>Led by {lead.name}. </> : null}
          Jira POD <span className="font-medium text-ink">{pod.jiraPodValue}</span>
        </p>
      </section>

      <section aria-labelledby="shape" className="space-y-3">
        <h2 id="shape" className="text-sm font-medium text-ink-muted">
          Team shape
        </h2>
        <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-4">
          {SKILLS.map((skill, i) => {
            const n = members.filter((m) => m.mainSkill === skill).length;
            return (
              <div
                key={skill}
                className={`border-line px-5 py-4 ${i % 2 ? "border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}
              >
                <dt className="font-mono text-xs text-ink-faint">{skill}</dt>
                <dd className={`mt-1 text-xl font-semibold tabular-nums ${n === 0 ? "text-ink-faint" : ""}`}>
                  {n}
                  <span className="ml-1.5 text-sm font-normal text-ink-muted">{n === 1 ? "person" : "people"}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section aria-labelledby="members" className="space-y-3">
        <h2 id="members" className="text-sm font-medium text-ink-muted">
          Members
        </h2>
        {members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-5 py-8 text-sm text-ink-muted">
            No one is in this pod yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-faint">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Name
                  </th>
                  <th scope="col" className="w-28 px-5 py-2.5 font-medium sm:w-40">
                    Main skill
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="grid size-8 shrink-0 place-items-center rounded-lg bg-line/70 text-xs font-medium text-ink-muted"
                        >
                          {initials(m.name)}
                        </span>
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium">{m.name}</span>
                          {m.isLead && <span className="text-xs text-ink-faint">Lead</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-lg border border-line px-2 py-0.5 font-mono text-xs">{m.mainSkill}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function initials(name: string) {
  const parts = name.split(" ");
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function PodSkeleton() {
  return (
    <div aria-hidden className="animate-pulse space-y-10">
      <div className="space-y-3">
        <div className="h-7 w-40 rounded-lg bg-line" />
        <div className="h-4 w-64 rounded-lg bg-line/70" />
      </div>
      <div className="h-[86px] rounded-lg border border-line bg-surface" />
      <div className="h-72 rounded-lg border border-line bg-surface" />
    </div>
  );
}
