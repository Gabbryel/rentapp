import { getDb } from "@/lib/mongodb";
import { NotificationSettingsSchema, type NotificationSettings } from "@/lib/schemas/notification-settings";

export async function getNotificationSettings(userEmail: string): Promise<NotificationSettings> {
  if (!process.env.MONGODB_URI) {
    // If DB isn't configured, return defaults
    return NotificationSettingsSchema.parse({
      userEmail,
      onChanges: false,
      onNewContracts: false,
      onNewInvoices: false,
      indexingNext60: false,
      indexingNext15: false,
      indexingNext1: false,
      updatedAt: new Date(),
    });
  }
  const db = await getDb();
  const doc = await db.collection<NotificationSettings>("notification_settings").findOne({ userEmail });
  if (doc) return NotificationSettingsSchema.parse(doc);
  const defaults = NotificationSettingsSchema.parse({ userEmail });
  await db.collection<NotificationSettings>("notification_settings").insertOne(defaults);
  return defaults;
}

export async function saveNotificationSettings(settings: NotificationSettings) {
  if (!process.env.MONGODB_URI) return;
  const db = await getDb();
  const toSave = NotificationSettingsSchema.parse({ ...settings, updatedAt: new Date() });
  await db
    .collection<NotificationSettings>("notification_settings")
    .updateOne({ userEmail: toSave.userEmail }, { $set: toSave }, { upsert: true });
}
