import { registerUser, currentUser } from "@/lib/auth";
import { issueToken } from "@/lib/auth-tokens";
import { sendVerificationEmail } from "@/lib/auth-email";
import { consumeToken } from "@/lib/auth-tokens";
import { logAction } from "@/lib/audit";
import { redirect } from "next/navigation";
import PasswordField from "@/components/password-field";
import AuthLayout from "@/components/auth-layout";
import EmailField from "@/components/email-field";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: { invite?: string; email?: string; sent?: string };
}) {
  // If already authenticated, don't show the register page
  const user = await currentUser();
  if (user) redirect("/");
  const invitedEmail = searchParams?.email || "";
  const inviteToken = searchParams?.invite || "";

  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "").trim();
    const emailConfirm = String(formData.get("emailConfirm") || "").trim();
    const password = String(formData.get("password") || "");
    const passwordConfirm = String(formData.get("passwordConfirm") || "");
    if (email !== emailConfirm) {
      throw new Error("Email-urile nu coincid");
    }
    if (password !== passwordConfirm) {
      throw new Error("Parolele nu coincid");
    }
    // Optionally enforce invite
    if (
      process.env.REGISTRATION_REQUIRES_INVITE === "1" ||
      process.env.REGISTRATION_REQUIRES_INVITE === "true"
    ) {
      const invite = await consumeToken(
        String(formData.get("invite")) || inviteToken,
        "invite"
      );
      if (!invite?.email) {
        throw new Error("Invitație absentă sau expirată");
      }
      // If invite has email, we can enforce email match — soft check here
      if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
        throw new Error("Adresa de email nu corespunde invitației");
      }
    }
    const user = await registerUser(email, password);
    // Issue verification token and email
    try {
      const token = await issueToken(user.email, "verify", 48);
      await sendVerificationEmail(user.email, token);
    } catch {}
    try {
      await logAction({
        action: "auth.register",
        targetType: "user",
        targetId: user.email,
        meta: {},
      });
    } catch {}
    redirect("/register?sent=1");
  }
  return (
    <AuthLayout
      title="Înregistrare"
      subtitle={
        searchParams?.sent
          ? "Am trimis un email cu un link de verificare. Verificați și folderul Spam."
          : "După înregistrare veți primi un email pentru verificarea contului."
      }
    >
      <form action={action} className="grid gap-3">
        <input type="hidden" name="invite" value={inviteToken} />
        <EmailField name="email" required defaultValue={invitedEmail} />
        <EmailField
          name="emailConfirm"
          label="Confirmă email"
          required
          defaultValue={invitedEmail}
        />
        <PasswordField name="password" required minLength={8} />
        <PasswordField
          name="passwordConfirm"
          label="Confirmă parola"
          required
          minLength={8}
        />
        <button className="mt-2 rounded-md bg-foreground text-background px-4 py-2 font-semibold hover:bg-foreground/90">
          Creează cont
        </button>
      </form>
    </AuthLayout>
  );
}
