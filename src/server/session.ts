import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { viewerForEmail, type Viewer } from "./viewer";

const getSession = cache(async () => {
  // Auth.js touches crypto before any request API, which Cache Components rejects during prerender.
  await connection();
  return auth();
});

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const email = (await getSession())?.user?.email;
  return email ? viewerForEmail(email) : null;
});

/** For pages: signed out goes to sign-in, a revoked address sees the access-denied message. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer) return viewer;
  redirect((await getSession()) ? "/sign-in?error=AccessDenied" : "/sign-in");
}
