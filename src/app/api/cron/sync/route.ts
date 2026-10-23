import { runSync } from "@/server/sync";

// A full sync pages through ~3k tickets; give it the whole Vercel function budget.
export const maxDuration = 300;

// Vercel Cron calls this daily at 08:00 IST (see vercel.json; Hobby allows no more) with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runSync();
  // A failed sync shows as a failed cron invocation in Vercel's logs too.
  return Response.json(result, { status: result.status === "failed" ? 500 : 200 });
}
