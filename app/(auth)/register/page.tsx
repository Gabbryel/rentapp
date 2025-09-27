import { registerUser, createSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default function RegisterPage() {
  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const user = await registerUser(email, password);
    await createSession(user);
    redirect("/");
  }
  return (
    <main className="min-h-screen px-4 py-10 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Înregistrare</h1>
      <form action={action} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm text-foreground/70">Email</span>
          <input name="email" type="email" required className="border rounded px-3 py-2" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-foreground/70">Parolă</span>
          <input name="password" type="password" required minLength={8} className="border rounded px-3 py-2" />
        </label>
        <button className="rounded-md bg-black text-white px-4 py-2">Creează cont</button>
      </form>
    </main>
  );
}
