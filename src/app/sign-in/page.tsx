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
    <main className="relative grid flex-1 place-items-center overflow-hidden px-4 py-16 sm:px-6">
      {/* A faint wash of the accent behind the form; decoration only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(55%_65%_at_50%_0%,var(--accent-soft),transparent)]"
      />
      <div className="rise relative w-full max-w-[22rem]">
        <BrandMark size="lg" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in to Pod capacity</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          See what each Delightree pod can take on this sprint, and who has room for more.
        </p>

        {error && (
          <div className="mt-6">
            <SignInError code={String(error)} />
          </div>
        )}

        <form
          className="mt-8"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium shadow-pop transition hover:bg-fill active:scale-[0.98]"
          >
            <GoogleLogoIcon size={16} weight="bold" aria-hidden />
            Sign in with Google
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-ink-faint">Open to allowlisted Delightree pod leads.</p>

        {e2eLoginEnabled && (
          <form
            className="mt-8 space-y-2 rounded-lg border border-dashed border-line-strong p-4"
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
            <div className="flex gap-2">
              <input
                id="e2e-email"
                name="email"
                type="email"
                required
                className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-accent"
              />
              <button
                type="submit"
                className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium transition hover:bg-fill"
              >
                Test sign-in
              </button>
            </div>
            <p className="text-xs text-ink-faint">Local test mode only.</p>
          </form>
        )}
      </div>
    </main>
  );
}

function SignInError({ code }: { code: string }) {
  const denied = code === "AccessDenied";
  return (
    <div role="alert" className="flex gap-3 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm">
      <WarningCircleIcon size={18} weight="fill" className="mt-px shrink-0 text-danger" aria-hidden />
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
