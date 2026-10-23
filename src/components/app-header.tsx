import Link from "next/link";
import { GearSixIcon, SignOutIcon } from "@phosphor-icons/react/dist/ssr";
import { BrandMark, initials } from "./brand";
import { signOut } from "@/auth";
import { listPods } from "@/server/pods";
import { getViewer } from "@/server/session";
import { HeaderLink, PodTabs } from "./pod-tabs";

const headerAction =
  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-muted transition hover:bg-line/60 hover:text-ink active:scale-[0.98]";

export function HeaderFrame({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-2.5 sm:h-14 sm:flex-nowrap sm:py-0">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg text-sm font-semibold tracking-tight">
          <BrandMark />
          Pod capacity
        </Link>
        {children}
      </div>
    </header>
  );
}

export async function AppHeader() {
  const [viewer, pods] = await Promise.all([getViewer(), listPods()]);
  if (!viewer) return <HeaderFrame />;

  return (
    <HeaderFrame>
      <PodTabs pods={pods} ownSlug={viewer.pod?.slug ?? null} />
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
        <span className="hidden items-center gap-2 text-sm text-ink-muted sm:flex">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-lg bg-accent-soft text-[11px] font-semibold text-accent"
          >
            {initials(viewer.name)}
          </span>
          {viewer.name}
        </span>
        {viewer.isAdmin && (
          <HeaderLink href="/settings" className={headerAction}>
            <GearSixIcon size={16} weight="regular" aria-hidden />
            <span className="sr-only sm:not-sr-only">Settings</span>
          </HeaderLink>
        )}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/sign-in" });
          }}
        >
          <button type="submit" className={headerAction}>
            <SignOutIcon size={16} weight="regular" aria-hidden />
            <span className="sr-only sm:not-sr-only">Sign out</span>
          </button>
        </form>
      </div>
    </HeaderFrame>
  );
}
