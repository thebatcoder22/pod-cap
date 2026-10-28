import Link from "next/link";
import { Avatar } from "@/components/brand";
import type { PodPage as PodData } from "@/server/pods";
import { setProficiencyAction } from "./actions";
import { CellInput } from "./cell-input";
import { SKILL_TONE, card, cardTitle, skillCell } from "./pod-ui";

// ---- Team ----

export function Team({ members, skills, canEdit }: Pick<PodData, "members" | "skills"> & { canEdit: boolean }) {
  const bySkill = skills.map((skill) => ({ skill, people: members.filter((m) => m.mainSkill === skill) }));

  return (
    <section aria-labelledby="team" className="space-y-4">
      <h2 id="team" className="text-base font-semibold tracking-tight">
        Team
      </h2>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-labelledby="shape" className={`${card} p-5`}>
          <h3 id="shape" className={cardTitle}>
            Team shape
          </h3>
          <p className="mt-1 text-sm text-ink-muted">Main skill of each person.</p>
          {members.length > 0 && (
            <div className="mt-5 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {bySkill.map(
                ({ skill, people }, i) =>
                  people.length > 0 && (
                    <span
                      key={skill}
                      className={`grow-x h-full ${SKILL_TONE[skill]}`}
                      style={{ flexGrow: people.length, "--i": i } as React.CSSProperties}
                    />
                  ),
              )}
            </div>
          )}
          <ul className="mt-5 space-y-3.5">
            {bySkill.map(({ skill, people }) => (
              <li key={skill} className="flex items-start gap-3 text-sm">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${SKILL_TONE[skill]}`} aria-hidden />
                <span className="w-12 font-mono text-xs leading-5 text-ink-muted">{skill}</span>
                <span className={`w-4 font-semibold tabular-nums ${people.length ? "" : "text-ink-faint"}`}>
                  {people.length}
                </span>
                <span className={`min-w-0 ${people.length ? "text-ink-muted" : "text-ink-faint"}`}>
                  {people.length ? people.map((p) => p.name.split(" ")[0]).join(", ") : "No one yet"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <Members members={members} skills={skills} canEdit={canEdit} />
      </div>
    </section>
  );
}

function Members({ members, skills, canEdit }: Pick<PodData, "members" | "skills"> & { canEdit: boolean }) {
  return (
    <section aria-labelledby="members" className={card}>
      <div className="flex items-baseline justify-between gap-3 px-4 pt-5 pb-3 sm:px-5">
        <h3 id="members" className={cardTitle}>
          Members
        </h3>
        <span className="text-xs text-ink-faint">
          {canEdit ? "Proficiency per skill, main skill fixed at 100%" : "Proficiency per skill"}
        </span>
      </div>
      {members.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-ink-muted">No one is in this pod yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-line text-xs text-ink-faint">
                <th scope="col" className="py-2 pl-4 text-left font-medium sm:pl-5">
                  Name
                </th>
                {skills.map((skill) => (
                  <th
                    key={skill}
                    scope="col"
                    className="w-16 py-2 pr-3.5 text-right font-mono font-medium last:pr-4.5 sm:pr-4.5 sm:last:pr-6.5"
                  >
                    {skill}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-t border-line">
              {members.map((m) => (
                <tr key={m.id} className="transition-colors hover:bg-fill/50">
                  <td className="py-2.5 pl-4 sm:pl-5">
                    <div className="flex items-center gap-3">
                      <span className="hidden sm:contents">
                        <Avatar name={m.name} size="md" tone={m.isLead ? "accent" : "neutral"} />
                      </span>
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{m.name}</span>
                        {m.isLead && <span className="text-xs text-ink-faint">Lead</span>}
                        {m.alsoIn && (
                          <span className="text-xs text-ink-faint">
                            {m.share}% here, also in{" "}
                            <Link href={`/pods/${m.alsoIn.slug}`} className="hover:text-accent">
                              {m.alsoIn.name}
                            </Link>
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  {skills.map((skill) => (
                    <td key={skill} className="py-2.5 pr-2 text-right last:pr-4 sm:pr-3 sm:last:pr-5">
                      {skill === m.mainSkill ? (
                        <span
                          title="Main skill"
                          className={`${skillCell} gap-1.5 border-transparent bg-fill font-medium`}
                        >
                          <span className={`hidden size-1.5 rounded-full sm:block ${SKILL_TONE[skill]}`} aria-hidden />
                          100%
                          <span className="sr-only">, main skill</span>
                        </span>
                      ) : canEdit ? (
                        <CellInput
                          action={setProficiencyAction}
                          fields={{ personId: m.id, skill }}
                          name="percent"
                          value={m.proficiency[skill]}
                          min={0}
                          max={100}
                          step={1}
                          label={`${skill} proficiency for ${m.name}`}
                          unit="%"
                          className={skillCell}
                        />
                      ) : (
                        <span
                          className={`${skillCell} border-transparent ${m.proficiency[skill] ? "" : "text-ink-faint"}`}
                        >
                          {m.proficiency[skill]}%
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
