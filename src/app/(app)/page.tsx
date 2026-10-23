import { notFound, redirect } from "next/navigation";
import { listPods } from "@/server/pods";
import { requireViewer } from "@/server/session";

// Redirect only, nothing to stream.
export const instant = false;

export default async function Home() {
  const viewer = await requireViewer();
  const slug = viewer.pod?.slug ?? (await listPods())[0]?.slug;
  if (!slug) notFound();
  redirect(`/pods/${slug}`);
}
