import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { getDb } from "@/lib/mongodb";
import { RegisterSchema, type User, UserSchema } from "@/lib/schemas/user";

type Session = { token: string; email: string; createdAt: Date; lastActiveAt?: Date };
const TWO_WEEKS_SECONDS = 14 * 24 * 60 * 60; // 14 days

// Very simple password hashing using sha256+salt for demo purposes.
// For production, use bcrypt/argon2. Here we avoid extra deps.
function hashPassword(password: string, salt: string) {
  return createHash("sha256").update(password + ":" + salt).digest("hex");
}

export async function registerUser(email: string, password: string): Promise<User> {
  const parsed = RegisterSchema.parse({ email, password });
  if (!process.env.MONGODB_URI) {
    throw new Error("MongoDB nu este configurat");
  }
  const db = await getDb();
  const existing = await db.collection<User>("users").findOne({ email: parsed.email });
  if (existing) throw new Error("Utilizatorul există deja");
  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(parsed.password, salt) + ":" + salt;
  const user: User = UserSchema.parse({ email: parsed.email, passwordHash, createdAt: new Date(), isAdmin: false });
  await db.collection<User>("users").insertOne(user);
  return user;
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  if (!process.env.MONGODB_URI) return null;
  const db = await getDb();
  const user = await db.collection<User>("users").findOne({ email });
  if (!user) return null;
  const [hash, salt] = (user.passwordHash || ":").split(":");
  const calc = createHash("sha256").update(password + ":" + salt).digest("hex");
  return hash === calc ? user : null;
}

export async function createSession(user: User) {
  const token = randomBytes(24).toString("hex");
  if (!process.env.MONGODB_URI) return;
  const db = await getDb();
  const now = new Date();
  await db.collection<Session>("sessions").insertOne({ token, email: user.email, createdAt: now, lastActiveAt: now });
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TWO_WEEKS_SECONDS,
  });
}

export async function currentUser(): Promise<User | null> {
  if (!process.env.MONGODB_URI) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  const db = await getDb();
  const session = await db.collection<Session>("sessions").findOne({ token });
  if (!session) return null;
  // Rolling expiry: expire sessions 14 days after last activity
  const ref = session.lastActiveAt ?? session.createdAt;
  const refMs = new Date(ref).getTime();
  const expiredAt = refMs + TWO_WEEKS_SECONDS * 1000;
  if (Date.now() > expiredAt) {
    await db.collection<Session>("sessions").deleteOne({ token });
    return null;
  }
  // Refresh rolling window and cookie maxAge on access
  await db.collection<Session>("sessions").updateOne({ token }, { $set: { lastActiveAt: new Date() } });
  const user = await db.collection<User>("users").findOne({ email: session.email });
  return user ?? null;
}

export async function signOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (token && process.env.MONGODB_URI) {
    const db = await getDb();
    await db.collection<Session>("sessions").deleteOne({ token });
  }
  cookieStore.delete("session");
}

// Admin helpers
function adminEmailsFromEnv(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isEnvAdmin(email?: string | null): boolean {
  const admins = adminEmailsFromEnv();
  if (admins.length === 0) return false;
  return email ? admins.includes(email) : false;
}

export async function requireAdmin(): Promise<void> {
  const user = await currentUser();
  const admin = Boolean(user?.isAdmin || isEnvAdmin(user?.email ?? null));
  if (!admin) {
    throw new Error("Unauthorized");
  }
}
