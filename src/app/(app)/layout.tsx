import { Suspense } from "react";
import { AppHeader, HeaderFrame } from "@/components/app-header";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<HeaderFrame />}>
        <AppHeader />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </>
  );
}
