"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Pod = { slug: string; name: string; lead: string | null };

/** The lead's first name, so "RoadMap 1" reads as Shikhar's pod. */
function Lead({ pod }: { pod: Pod }) {
  if (!pod.lead) return null;
  return <span className="font-normal text-ink-faint"> - {pod.lead.split(" ")[0]}</span>;
}

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** The pods in the desktop sidebar. */
export function PodNav({ pods, ownSlug }: { pods: Pod[]; ownSlug: string | null }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Pods" className="space-y-px">
      {pods.map((pod) => {
        const href = `/pods/${pod.slug}`;
        const active = isActive(pathname, href);
        return (
          <Link
            key={pod.slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group flex h-8 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors ${
              active ? "bg-surface font-medium text-ink shadow-card" : "text-ink-muted hover:bg-fill hover:text-ink"
            }`}
          >
            <span
              aria-hidden
              className={`grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-semibold ${
                active ? "bg-accent text-accent-ink" : "bg-fill text-ink-faint group-hover:text-ink-muted"
              }`}
            >
              {pod.name[0]}
              {pod.name.match(/\d+$/)?.[0]}
            </span>
            <span className="truncate">
              {pod.name}
              <Lead pod={pod} />
            </span>
            {pod.slug === ownSlug && (
              <span className="ml-auto text-xs font-normal text-ink-faint">
                <span aria-hidden>You</span>
                <span className="sr-only">(your pod)</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** The pods as a scrolling tab strip on small screens. */
export function PodTabs({ pods, ownSlug }: { pods: Pod[]; ownSlug: string | null }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Pods" className="-mx-4 flex items-center gap-1 overflow-x-auto px-4">
      {pods.map((pod) => {
        const href = `/pods/${pod.slug}`;
        const active = isActive(pathname, href);
        return (
          <Link
            key={pod.slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${
              active ? "bg-fill font-medium text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {pod.name}
            <Lead pod={pod} />
            {pod.slug === ownSlug && <span className="sr-only"> (your pod)</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** A link that shows when its page is open. */
export function NavLink({
  href,
  className,
  activeClassName,
  children,
}: {
  href: string;
  className: string;
  activeClassName: string;
  children: React.ReactNode;
}) {
  const active = isActive(usePathname(), href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${className} ${active ? activeClassName : ""}`}
    >
      {children}
    </Link>
  );
}
