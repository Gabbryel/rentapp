export default function UnauthorizedPage() {
  return (
    <main className="min-h-dvh grid place-items-center bg-gradient-to-br from-fuchsia-600 via-pink-600 to-orange-500 text-white p-6">
      <div className="max-w-xl w-full text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-white/15 backdrop-blur grid place-items-center shadow-lg">
          <span className="text-3xl">🔒</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Acces restricționat
        </h1>
        <p className="mt-3 text-white/90 text-balance">
          Doar proprietarii acestei aplicații au acces. Dacă ai primit
          invitație, autentifică-te cu adresa ta de email.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <a
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-white text-fuchsia-700 px-5 py-2.5 text-sm font-semibold shadow hover:bg-white/90"
          >
            Intră în cont
          </a>
          <a
            href="/about"
            className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white px-5 py-2.5 text-sm font-semibold ring-1 ring-white/25 hover:bg-white/15"
          >
            Află mai multe
          </a>
        </div>
      </div>
    </main>
  );
}
