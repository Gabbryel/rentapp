import { authenticate, createSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default function LoginPage() {
  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const user = await authenticate(email, password);
    if (!user) throw new Error("Email sau parolă greșită");
    await createSession(user);
    redirect("/");
  }
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-xl border border-foreground/10 bg-foreground/5 p-6">
        <h1 className="text-2xl font-bold mb-4">Autentificare</h1>
        <form action={action} className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-foreground/70">Email</span>
            <input name="email" type="email" required />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-foreground/70">Parolă</span>
            <input name="password" type="password" required />
          </label>
          <button className="mt-2 rounded-md bg-foreground text-background px-4 py-2 font-semibold hover:bg-foreground/90">
            Intră
          </button>
        </form>
      </div>
    </main>
  );
}
