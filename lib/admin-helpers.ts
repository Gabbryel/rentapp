/**
 * Helper functions for admin operations
 */

import { getDb } from "./mongodb";
import type { User } from "./schemas/user";

/**
 * Get all admin email addresses from ADMIN_EMAILS env var and database users with isAdmin flag
 */
export async function getAdminEmails(): Promise<string[]> {
  const emails = new Set<string>();

  // Get from environment variable
  const envAdmins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  
  envAdmins.forEach((email) => emails.add(email));

  // Get from database
  try {
    if (process.env.MONGODB_URI) {
      const db = await getDb();
      const adminUsers = await db
        .collection<User>("users")
        .find({ isAdmin: true }, { projection: { email: 1, _id: 0 } })
        .toArray();
      
      adminUsers.forEach((user) => {
        if (user.email) emails.add(user.email);
      });
    }
  } catch (error) {
    console.error("Error fetching admin users from database:", error);
  }

  return Array.from(emails);
}
