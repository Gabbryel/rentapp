import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { getDb } from "@/lib/mongodb";
import { RegisterSchema, type User, UserSchema } from "@/lib/schemas/user";

type Session = { token: string; email: string; createdAt: Date };

// Very simple password hashing using sha256+salt for demo purposes.
// For production, use bcrypt/argon2. Here we avoid extra deps.
function hashPassword(password: string, salt: string) {
  return createHash("sha256").update(password + ":" + salt).digest("hex");
}

export async function registerUser(email: string, password: string): Promise<User> {
  const parsed = RegisterSchema.parse({ email, password });
  if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) {
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
  if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) return null;
  const db = await getDb();
  const user = await db.collection<User>("users").findOne({ email });
  if (!user) return null;
  const [hash, salt] = (user.passwordHash || ":").split(":");
  const calc = createHash("sha256").update(password + ":" + salt).digest("hex");
  return hash === calc ? user : null;
}

export async function createSession(user: User) {
  const token = randomBytes(24).toString("hex");
  if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) return;
  const db = await getDb();
  await db.collection<Session>("sessions").insertOne({ token, email: user.email, createdAt: new Date() });
  const cookieStore = await cookies();
  cookieStore.set("session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

export async function currentUser(): Promise<User | null> {
  if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  const db = await getDb();
  const session = await db.collection<Session>("sessions").findOne({ token });
  if (!session) return null;
  const user = await db.collection<User>("users").findOne({ email: session.email });
  return user ?? null;
}

export async function signOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (token && process.env.MONGODB_URI && process.env.MONGODB_DB) {
    const db = await getDb();
    await db.collection<Session>("sessions").deleteOne({ token });
  }
  cookieStore.delete("session");
}
