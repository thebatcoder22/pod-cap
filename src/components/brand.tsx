import { StackIcon } from "@phosphor-icons/react/dist/ssr";

/** The app's mark: a Phosphor glyph on the accent tile. */
export function BrandMark({ size = "sm" }: { size?: "sm" | "lg" }) {
  const lg = size === "lg";
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-lg bg-accent text-accent-ink ${lg ? "size-10" : "size-7"}`}
    >
      <StackIcon size={lg ? 22 : 16} weight="bold" />
    </span>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
