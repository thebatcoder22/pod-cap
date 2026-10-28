"use client";

import { useActionState } from "react";
import { Avatar } from "@/components/brand";
import type { PeopleAdmin } from "@/server/people";
import {
  addFromJiraAction,
  addToPodAction,
  confirmJiraAccountAction,
  movePersonAction,
  removePersonAction,
  setShareAction,
} from "./actions";
import { ghostDanger, input, list, Live, plural, row, secondary, select } from "./form-ui";

// Who is in which pod, and who they are in Jira.

export function ConfirmJira({ rows, others }: { rows: PeopleAdmin["toConfirm"]; others: PeopleAdmin["noPod"] }) {
  const [state, confirm, confirming] = useActionState(confirmJiraAccountAction, null);
  return (
    <>
      <Live states={[state]} />
      <ul className={list}>
        {rows.map((p) => (
          <li key={p.id} className={row}>
            <Avatar name={p.name} size="md" />
            <div className="min-w-0 flex-[1_1_10rem]">
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
    </>
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
    <>
      <Live states={[state]} />
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-muted">
          No one waiting. Jira users on DTP tickets who are in no pod show up here after a sync.
        </p>
      ) : (
        <ul className={list}>
          {rows.map((u) => (
            <li key={u.accountId} className={row}>
              <Avatar name={u.displayName} size="md" />
              <div className="min-w-0 flex-[1_1_10rem]">
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
    </>
  );
}

export function Members({ rows, pods }: { rows: PeopleAdmin["members"]; pods: PeopleAdmin["pods"] }) {
  const [moved, move, moving] = useActionState(movePersonAction, null);
  const [added, addTo, adding] = useActionState(addToPodAction, null);
  const [shared, share, sharing] = useActionState(setShareAction, null);
  const [removed, remove, removing] = useActionState(removePersonAction, null);
  return (
    <>
      <Live states={[moved, added, shared, removed]} />
      {pods.map((pod) => {
        const members = rows.filter((m) => m.pod.id === pod.id);
        return (
          <section key={pod.id} aria-label={pod.name} className="border-b border-line last:border-b-0">
            <h4 className="flex items-baseline gap-2 border-b border-line bg-fill/50 px-5 py-2 text-xs font-medium">
              {pod.name}
              <span className="font-normal text-ink-faint">{plural(members.length, "person", "people")}</span>
            </h4>
            {members.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-muted">No one in {pod.name} yet.</p>
            ) : (
              <ul className={list}>
                {members.map((m) => (
                  <li key={m.id} className={row}>
                    <Avatar name={m.name} size="md" tone={m.isLead ? "accent" : "neutral"} />
                    <div className="min-w-0 flex-[1_1_10rem]">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        <span className="rounded-md bg-fill px-1.5 py-px font-mono text-xs text-ink-muted">
                          {m.mainSkill}
                        </span>
                        {m.isLead && <span className="text-xs text-ink-faint">Lead</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {m.jira
                          ? `Jira: ${m.jira.displayName ?? "linked, on no synced ticket"}`
                          : "Not linked to Jira yet"}
                        {m.alsoIn && ` - also in ${m.alsoIn.name}`}
                      </p>
                    </div>
                    {m.alsoIn && (
                      // Saves on Enter or on leaving the field, like leave and proficiency. Keyed by the saved share,
                      // so the field shows it again after each save.
                      <form key={m.share} action={share}>
                        <input type="hidden" name="personId" value={m.id} />
                        <input type="hidden" name="podId" value={pod.id} />
                        <label className="relative block" title={`Share of ${m.name}'s time in ${pod.name}`}>
                          <input
                            name="share"
                            type="number"
                            inputMode="numeric"
                            required
                            min={1}
                            max={99}
                            step={1}
                            defaultValue={m.share}
                            disabled={sharing}
                            aria-label={`Share of ${m.name}'s time in ${pod.name}`}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter") return;
                              e.preventDefault();
                              e.currentTarget.blur();
                            }}
                            onBlur={(e) => {
                              const field = e.target;
                              if (field.value === field.defaultValue) return;
                              if (field.checkValidity()) field.form?.requestSubmit();
                              else field.value = field.defaultValue;
                            }}
                            className={`${input} w-[4.5rem] pr-6 text-right tabular-nums`}
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-ink-faint">
                            %
                          </span>
                        </label>
                      </form>
                    )}
                    {m.isLead ? (
                      <span className="text-xs text-ink-faint">Leads stay in their pod</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <form action={move} className="flex items-center gap-2">
                          <input type="hidden" name="personId" value={m.id} />
                          <input type="hidden" name="fromPodId" value={pod.id} />
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
                          {!m.alsoIn && (
                            <button
                              type="submit"
                              formAction={addTo}
                              disabled={adding}
                              title="Also in the picked pod, with half of their time in each"
                              aria-label={`Add ${m.name} to another pod too`}
                              className={secondary}
                            >
                              Add
                            </button>
                          )}
                        </form>
                        <form
                          action={remove}
                          onSubmit={(e) => {
                            const ask = m.alsoIn
                              ? `Take ${m.name} out of ${pod.name}? All of their time goes to ${m.alsoIn.name}.`
                              : `Remove ${m.name}? They stop counting toward any pod.`;
                            if (!confirm(ask)) e.preventDefault();
                          }}
                        >
                          <input type="hidden" name="personId" value={m.id} />
                          <input type="hidden" name="podId" value={pod.id} />
                          <button
                            type="submit"
                            disabled={removing}
                            aria-label={`Remove ${m.name}`}
                            className={ghostDanger}
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
    </>
  );
}
