import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import { CalendarNote, CapacityCalendar, MonthNav } from "@/components/capacity-calendar";
import { calendarMonth, getCalendar } from "@/server/calendar";
import { requireViewer } from "@/server/session";

export default function PodCalendarPage({ params, searchParams }: PageProps<"/pods/[slug]/calendar">) {
  return (
    <Suspense fallback={<div aria-hidden className="h-[36rem] animate-pulse rounded-lg bg-fill" />}>
      <PodCalendar params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PodCalendar({ params, searchParams }: PageProps<"/pods/[slug]/calendar">) {
  const [{ slug }, { month }] = await Promise.all([params, searchParams, requireViewer()]);
  const calendar = await getCalendar(calendarMonth(typeof month === "string" ? month : undefined), slug);
  const { pod } = calendar;
  if (!pod) notFound();

  return (
    <div className="space-y-6">
      <header className="rise space-y-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Link href={`/pods/${pod.slug}`} className="hover:text-accent">
            {pod.name}
          </Link>
          <CaretRightIcon size={12} className="text-ink-faint" aria-hidden />
          <span aria-current="page">Calendar</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">{pod.name} calendar</h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Each person&apos;s booked hours against their plannable hours, day by day, from the tickets they own in each
          sprint. Hover a person for their tickets, or open them for the sprint.{" "}
          <Link href={`/calendar?month=${calendar.month}`} className="text-accent hover:underline">
            See all pods
          </Link>
        </p>
      </header>
      <div className="rise space-y-3" style={{ "--i": 1 } as React.CSSProperties}>
        <MonthNav month={calendar.month} path={`/pods/${pod.slug}/calendar`} />
        <CapacityCalendar calendar={calendar} />
        <CalendarNote focusPercent={calendar.focusPercent} />
      </div>
    </div>
  );
}
