import { currentUser } from "@/lib/auth";
import { consumeToken } from "@/lib/auth-tokens";
import { getDb } from "@/lib/mongodb";
import { redirect } from "next/navigation";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const me = await currentUser();
  if (me?.isVerified) redirect("/");
  let status: "ok" | "invalid" | "missing" = "missing";
  const sp = (await searchParams) ?? {};
  if (sp?.token) {
    const tok = await consumeToken(sp.token, "verify");
    if (tok?.email) {
      const db = await getDb();
      await db
        .collection("users")
        .updateOne({ email: tok.email }, { $set: { isVerified: true } });
      status = "ok";
    } else {
      status = "invalid";
    }
  }
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-xl border border-foreground/10 bg-foreground/5 p-6">
        <h1 className="text-2xl font-bold mb-4">Verificare email</h1>
        {status === "missing" && <p>Lipsește tokenul de verificare.</p>}
        {status === "invalid" && <p>Link de verificare invalid sau expirat.</p>}
        {status === "ok" && (
          <div>
            <p>Contul a fost verificat.</p>
            <p className="mt-2">
              <a className="underline" href="/login">
                Mergi la autentificare
              </a>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
