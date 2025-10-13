import { issueToken } from "@/lib/auth-tokens";
import { sendResetEmail } from "@/lib/auth-email";
import { getDb } from "@/lib/mongodb";
import { currentUser } from "@/lib/auth";
import AuthLayout from "@/components/auth-layout";
import EmailField from "@/components/email-field";

export default async function ForgotPasswordPage() {
  const me = await currentUser();
  if (me) {
    // Already logged in; show a hint only.
  }
  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    if (!process.env.MONGODB_URI) return;
    const db = await getDb();
    const user = await db.collection("users").findOne({ email });
    if (!user) return; // do not reveal existence
    const token = await issueToken(email, "reset", 2);
    await sendResetEmail(email, token);
  }
  return (
    <AuthLayout
      title="Resetare parolă"
      subtitle="Introduceți emailul pentru a primi un link de resetare"
    >
      <form action={action} className="grid gap-3">
        <EmailField name="email" required />
        <button className="mt-2 rounded-md bg-foreground text-background px-4 py-2 font-semibold hover:bg-foreground/90">
          Trimite link
        </button>
      </form>
      <p className="text-sm text-foreground/70 mt-2">
        Dacă adresa există, veți primi un email cu instrucțiuni.
      </p>
    </AuthLayout>
  );
}
