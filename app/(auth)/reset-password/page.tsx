import { consumeToken } from "@/lib/auth-tokens";
import { getDb } from "@/lib/mongodb";
import { createHash, randomBytes } from "crypto";
import { redirect } from "next/navigation";
import PasswordField from "@/components/password-field";
import AuthLayout from "@/components/auth-layout";

function hashPassword(password: string, salt: string) {
  return createHash("sha256")
    .update(password + ":" + salt)
    .digest("hex");
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const token = sp?.token || "";
  const valid = Boolean(token);

  async function action(formData: FormData) {
    "use server";
    const token = String(formData.get("token") || "");
    const password = String(formData.get("password") || "");
    const passwordConfirm = String(formData.get("passwordConfirm") || "");
    if (!token || password.length < 8) return;
    if (password !== passwordConfirm) return;
    const tok = await consumeToken(token, "reset");
    if (!tok?.email) return;
    const db = await getDb();
    const salt = randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, salt) + ":" + salt;
    await db
      .collection("users")
      .updateOne({ email: tok.email }, { $set: { passwordHash } });
    redirect("/login");
  }

  return (
    <AuthLayout
      title="Setare parolă nouă"
      subtitle="Introduceți o parolă nouă pentru contul dvs."
    >
      {!valid && <p>Lipsește tokenul de resetare.</p>}
      {valid && (
        <form action={action} className="grid gap-3">
          <input type="hidden" name="token" value={token} />
          <PasswordField
            name="password"
            label="Parolă nouă"
            required
            minLength={8}
          />
          <PasswordField
            name="passwordConfirm"
            label="Confirmă parola"
            required
            minLength={8}
          />
          <button className="mt-2 rounded-md bg-foreground text-background px-4 py-2 font-semibold hover:bg-foreground/90">
            Salvează
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
