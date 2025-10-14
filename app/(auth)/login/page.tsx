import { authenticate, createSession, currentUser } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import PasswordField from "@/components/password-field";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  // If already authenticated, don't show the login page
  const user = await currentUser();
  if (user) redirect("/");

  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const user = await authenticate(email, password);
    if (!user) throw new Error("Email/parolă greșită sau cont neverificat");
    await createSession(user);
    try {
      await logAction({
        action: "auth.login",
        targetType: "user",
        targetId: user.email,
        meta: {},
      });
    } catch {}
    redirect("/");
  }
  return (
    <main className="relative min-h-screen px-4 py-10 grid place-items-center overflow-hidden">
      {/* Large semi-transparent AppRent branding (5% opacity, 30vw) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0 overflow-hidden">
        <span className="w-full text-center font-extrabold leading-none tracking-tight whitespace-nowrap text-foreground/5 text-[30vw] opacity-[.05]">
          RentApp
        </span>
      </div>
      <div className="relative z-10 mx-auto w-full max-w-md rounded-xl border border-foreground/10 bg-foreground/5 p-6">
        <h1 className="text-2xl font-bold mb-4">Autentificare</h1>
        <form action={action} className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-foreground/70">Email</span>
            <input name="email" type="email" required />
          </label>
          <PasswordField name="password" required />
          <button className="mt-2 rounded-md bg-foreground text-background px-4 py-2 font-semibold hover:bg-foreground/90">
            Intră
          </button>
        </form>
        <div className="mt-3 text-sm flex flex-col gap-2">
          <a className="text-foreground/80 underline" href="/forgot-password">
            Ai uitat parola?
          </a>
          <a
            className="text-indigo-700 underline font-semibold"
            href="/register"
          >
            Nu ai cont? Înregistrează-te
          </a>
        </div>
      </div>
    </main>
  );
}
