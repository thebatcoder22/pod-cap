"use client";

import { DesktopIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";

const next = { system: "light", light: "dark", dark: "system" } as const;
type Theme = keyof typeof next;

/**
 * Cycles system, light, dark. The current state lives only on <html data-theme>, and CSS picks which icon shows,
 * so the server render never disagrees with the stored choice.
 */
export function ThemeToggle({ className }: { className: string }) {
  function cycle() {
    const root = document.documentElement;
    const theme = next[(root.dataset.theme as Theme | undefined) ?? "system"];
    // Without this, every control with a colour transition fades through half-themed states for a moment.
    const freeze = document.head.appendChild(document.createElement("style"));
    freeze.textContent = "*,*::before,*::after{transition:none!important}";
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    root.getBoundingClientRect(); // Forces the new colours to apply while transitions are off.
    freeze.remove();
    try {
      if (theme === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", theme);
    } catch {
      // Storage blocked: the choice still holds for this page.
    }
  }

  return (
    <button type="button" onClick={cycle} title="Switch theme" className={className}>
      <span className="contents in-data-[theme]:hidden">
        <DesktopIcon size={16} aria-hidden />
        <span className="sr-only">Theme: system</span>
      </span>
      <span className="hidden in-data-[theme=light]:contents">
        <SunIcon size={16} aria-hidden />
        <span className="sr-only">Theme: light</span>
      </span>
      <span className="hidden in-data-[theme=dark]:contents">
        <MoonIcon size={16} aria-hidden />
        <span className="sr-only">Theme: dark</span>
      </span>
    </button>
  );
}
