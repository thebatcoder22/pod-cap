import { StackIcon } from "@phosphor-icons/react/dist/ssr";

/** The app's mark: a Phosphor glyph on the accent tile. */
export function BrandMark({ size = "sm" }: { size?: "sm" | "lg" }) {
  const lg = size === "lg";
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-lg bg-accent text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] ${lg ? "size-10" : "size-7"}`}
    >
      <StackIcon size={lg ? 22 : 16} weight="bold" />
    </span>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const AVATAR_SIZE = { xs: "size-5 text-[9px]", sm: "size-6 text-[10px]", md: "size-8 text-xs" };

/** A person's initials in a circle. `ring` separates overlapping avatars in a stack. */
export function Avatar({
  name,
  size = "sm",
  tone = "neutral",
  ring = false,
}: {
  name: string;
  size?: keyof typeof AVATAR_SIZE;
  tone?: "neutral" | "accent";
  ring?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-semibold tracking-tight ${AVATAR_SIZE[size]} ${
        tone === "accent" ? "bg-accent-soft text-accent" : "bg-fill text-ink-muted"
      } ${ring ? "ring-2 ring-surface" : ""}`}
    >
      {initials(name)}
    </span>
  );
}
