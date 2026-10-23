import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { GoogleLogoIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { e2eLoginEnabled, signIn } from "@/auth";
import { getViewer } from "@/server/session";
import { BrandMark } from "@/components/brand";

// Small blocking page: reads the session and the error param.
export const instant = false;

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { error } = await searchParams;
  if (!error && (await getViewer())) redirect("/");

  return (
    <main className="grid flex-1 place-items-center px-4 py-16 sm:px-6">
      <div className="rise w-full max-w-sm space-y-6 rounded-lg border border-line bg-surface p-6 shadow-card sm:p-8">
        <div className="space-y-4">
          <BrandMark size="lg" />
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">Pod capacity</h1>
            <p className="text-sm leading-relaxed text-ink-muted">
              See what each Delightree pod can take on this sprint, and who has room for more.
            </p>
          </div>
        </div>

        {error && <SignInError code={String(error)} />}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition hover:opacity-90 active:scale-[0.98]"
          >
            <GoogleLogoIcon size={16} weight="bold" aria-hidden />
            Sign in with Google
          </button>
        </form>

        {e2eLoginEnabled && (
          <form
            className="space-y-2 border-t border-line pt-6"
            action={async (formData: FormData) => {
              "use server";
              try {
                await signIn("e2e", { email: formData.get("email"), redirectTo: "/" });
              } catch (e) {
                if (e instanceof AuthError) redirect("/sign-in?error=AccessDenied");
                throw e;
              }
            }}
          >
            <label htmlFor="e2e-email" className="block text-sm font-medium">
              Test sign-in email
            </label>
            <input
              id="e2e-email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
            />
            <p className="text-xs text-ink-faint">Local test mode only.</p>
            <button type="submit" className="rounded-lg border border-line-strong px-3 py-1.5 text-sm">
              Test sign-in
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function SignInError({ code }: { code: string }) {
  const denied = code === "AccessDenied";
  return (
    <div role="alert" className="flex gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
      <WarningCircleIcon size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium text-danger">{denied ? "You do not have access" : "Sign-in failed"}</p>
        <p className="text-ink-muted">
          {denied
            ? "Pod capacity is open to allowlisted pod leads only. Ask Aman if you need access."
            : "Something went wrong while signing in. Try again."}
        </p>
      </div>
    </div>
  );
}
