import { Suspense } from "react";
import { CalendarNote, CapacityCalendar, MonthNav } from "@/components/capacity-calendar";
import { calendarMonth, getCalendar } from "@/server/calendar";
import { requireViewer } from "@/server/session";

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <Suspense fallback={<div aria-hidden className="h-[36rem] animate-pulse rounded-lg bg-fill" />}>
      <AllPods searchParams={searchParams} />
    </Suspense>
  );
}

async function AllPods({ searchParams }: Pick<PageProps<"/calendar">, "searchParams">) {
  const [{ month }] = await Promise.all([searchParams, requireViewer()]);
  const calendar = await getCalendar(calendarMonth(typeof month === "string" ? month : undefined));

  return (
    <div className="space-y-6">
      <header className="rise space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Capacity calendar</h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Every pod&apos;s booked hours against its plannable hours, day by day, for the active and upcoming sprints.
          Open a pod to see its people.
        </p>
      </header>
      <div className="rise space-y-3" style={{ "--i": 1 } as React.CSSProperties}>
        <MonthNav month={calendar.month} path="/calendar" />
        <CapacityCalendar calendar={calendar} />
        <CalendarNote focusPercent={calendar.focusPercent} />
      </div>
    </div>
  );
}
