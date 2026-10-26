import Link from "next/link";
import { CalendarDotsIcon, GearSixIcon, ListChecksIcon, SignOutIcon } from "@phosphor-icons/react/dist/ssr";
import { Avatar, BrandMark } from "./brand";
import { signOut } from "@/auth";
import { listPods } from "@/server/pods";
import { getViewer } from "@/server/session";
import { NavLink, PodNav, PodTabs } from "./pod-tabs";

function Brand() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg">
      <BrandMark />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold tracking-tight">Pod capacity</span>
        <span className="block truncate text-xs text-ink-faint">Delightree engineering</span>
      </span>
    </Link>
  );
}

function SignOutButton({ className, label }: { className: string; label: "visible" | "hidden" }) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/sign-in" });
      }}
    >
      <button type="submit" title="Sign out" className={className}>
        <SignOutIcon size={16} aria-hidden />
        <span className={label === "hidden" ? "sr-only" : ""}>Sign out</span>
      </button>
    </form>
  );
}

/** Shown while the session loads, and to signed-out visitors: the frame without the navigation. */
export function ShellFrame() {
  return (
    <>
      <aside className="hidden border-r border-line bg-sidebar lg:block" aria-hidden />
      <div className="flex h-14 items-center border-b border-line bg-surface px-4 lg:hidden">
        <BrandMark />
      </div>
    </>
  );
}

const iconButton =
  "grid size-8 place-items-center rounded-lg text-ink-muted transition hover:bg-fill hover:text-ink active:scale-[0.96]";

export async function AppShell() {
  const [viewer, pods] = await Promise.all([getViewer(), listPods()]);
  if (!viewer) return <ShellFrame />;
  const own = viewer.pod?.slug ?? null;

  return (
    <>
      {/* Desktop: a fixed sidebar. */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-sidebar px-3 py-4 lg:flex">
        <div className="px-1.5">
          <Brand />
        </div>

        <p className="mt-8 mb-1.5 px-2 text-xs font-medium text-ink-faint">Pods</p>
        <PodNav pods={pods} ownSlug={own} />

        <p className="mt-8 mb-1.5 px-2 text-xs font-medium text-ink-faint">For PMs</p>
        <nav aria-label="For PMs" className="space-y-px">
          <NavLink
            href="/pending"
            className="flex h-8 items-center gap-2.5 rounded-lg px-2 text-sm text-ink-muted transition-colors hover:bg-fill hover:text-ink"
            activeClassName="bg-surface font-medium text-ink shadow-card hover:bg-surface"
          >
            <ListChecksIcon size={18} aria-hidden className="mx-px" />
            Pending in Jira
          </NavLink>
          <NavLink
            href="/calendar"
            className="flex h-8 items-center gap-2.5 rounded-lg px-2 text-sm text-ink-muted transition-colors hover:bg-fill hover:text-ink"
            activeClassName="bg-surface font-medium text-ink shadow-card hover:bg-surface"
          >
            <CalendarDotsIcon size={18} aria-hidden className="mx-px" />
            Capacity calendar
          </NavLink>
        </nav>

        <div className="mt-auto space-y-3">
          {viewer.isAdmin && (
            <NavLink
              href="/settings"
              className="flex h-8 items-center gap-2.5 rounded-lg px-2 text-sm text-ink-muted transition-colors hover:bg-fill hover:text-ink"
              activeClassName="bg-surface font-medium text-ink shadow-card hover:bg-surface"
            >
              <GearSixIcon size={18} aria-hidden className="mx-px" />
              Settings
            </NavLink>
          )}
          <div className="flex items-center gap-2.5 border-t border-line px-1.5 pt-3">
            <Avatar name={viewer.name} size="md" tone="accent" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">{viewer.name}</span>
              <span className="block truncate text-xs text-ink-faint">{viewer.email}</span>
            </span>
            <SignOutButton className={iconButton} label="hidden" />
          </div>
        </div>
      </aside>

      {/* Small screens: a top bar with the pods as tabs. */}
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <Brand />
          <div className="ml-auto flex items-center gap-1">
            <NavLink href="/pending" className={iconButton} activeClassName="bg-fill text-ink">
              <ListChecksIcon size={18} aria-hidden />
              <span className="sr-only">Pending in Jira</span>
            </NavLink>
            <NavLink href="/calendar" className={iconButton} activeClassName="bg-fill text-ink">
              <CalendarDotsIcon size={18} aria-hidden />
              <span className="sr-only">Capacity calendar</span>
            </NavLink>
            {viewer.isAdmin && (
              <NavLink href="/settings" className={iconButton} activeClassName="bg-fill text-ink">
                <GearSixIcon size={18} aria-hidden />
                <span className="sr-only">Settings</span>
              </NavLink>
            )}
            <SignOutButton className={iconButton} label="hidden" />
          </div>
        </div>
        <div className="pb-2">
          <div className="px-4">
            <PodTabs pods={pods} ownSlug={own} />
          </div>
        </div>
      </header>
    </>
  );
}
