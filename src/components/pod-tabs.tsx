"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PodTabs({ pods, ownSlug }: { pods: { slug: string; name: string }[]; ownSlug: string | null }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Pods"
      className="order-last -mx-3 flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto"
    >
      {pods.map((pod) => {
        const href = `/pods/${pod.slug}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={pod.slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${
              active ? "bg-accent-soft font-medium text-accent" : "text-ink-muted hover:bg-line/60 hover:text-ink"
            }`}
          >
            {pod.name}
            {pod.slug === ownSlug && <span className="sr-only"> (your pod)</span>}
          </Link>
        );
      })}
    </nav>
  );
}
