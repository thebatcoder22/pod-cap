import { Suspense } from "react";
import { AppShell, ShellFrame } from "@/components/app-header";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex-1 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <Suspense fallback={<ShellFrame />}>
        <AppShell />
      </Suspense>
      <main className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 lg:col-start-2 lg:row-start-1 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}
