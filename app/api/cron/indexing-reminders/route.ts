import { NextRequest, NextResponse } from "next/server";
import { fetchContracts, effectiveEndDate } from "@/lib/contracts";
import { sendMail } from "@/lib/email";
import { getAdminEmails } from "@/lib/admin-helpers";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Contract = Awaited<ReturnType<typeof fetchContracts>>[number];

function getNextIndexingDate(contract: Contract): string | null {
  const dates = ((contract as any).indexingDates || []) as Array<{
    forecastDate: string;
    done?: boolean;
  }>;
  const todayISO = new Date().toISOString().slice(0, 10);
  const nextDate = dates
    .filter((d) => !d.done && d.forecastDate >= todayISO)
    .map((d) => d.forecastDate)
    .sort()[0];
  return nextDate || null;
}

function getDaysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(isoDate);
    target.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // Security: Check for CRON_SECRET
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!process.env.MONGODB_URI) {
      return NextResponse.json({
        ok: false,
        message: "MongoDB not configured",
      });
    }

    const db = await getDb();
    const allContracts = await fetchContracts();
    const todayISO = new Date().toISOString().slice(0, 10);

    // Filter active contracts
    const activeContracts = allContracts.filter((c) => {
      const endDate = effectiveEndDate(c);
      return endDate >= todayISO;
    });

    const notificationThresholds = [60, 30, 20]; // Days before indexing
    const adminEmails = await getAdminEmails();

    if (adminEmails.length === 0) {
      return NextResponse.json({
        ok: false,
        message: "No admin emails configured",
      });
    }

    const notifications: Array<{
      contractId: string;
      contractName: string;
      nextIndexing: string;
      daysUntil: number;
      threshold: number;
    }> = [];

    for (const contract of activeContracts) {
      const nextIndexing = getNextIndexingDate(contract);
      if (!nextIndexing) continue;

      const daysUntil = getDaysUntil(nextIndexing);
      if (daysUntil === null) continue;

      // Check if we should send notification for this threshold
      for (const threshold of notificationThresholds) {
        if (daysUntil === threshold) {
          // Check if we already sent this notification
          const notificationKey = `indexing_reminder_${contract.id}_${nextIndexing}_${threshold}`;
          
          const existing = await db
            .collection("notification_log")
            .findOne({ key: notificationKey });

          if (!existing) {
            notifications.push({
              contractId: contract.id,
              contractName: (contract as any).name || contract.id,
              nextIndexing,
              daysUntil,
              threshold,
            });

            // Mark as sent
            await db.collection("notification_log").insertOne({
              key: notificationKey,
              contractId: contract.id,
              nextIndexing,
              threshold,
              sentAt: new Date(),
            });
          }
        }
      }
    }

    if (notifications.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No notifications to send",
        checked: activeContracts.length,
      });
    }

    // Group notifications by threshold for better email formatting
    const grouped = new Map<number, typeof notifications>();
    for (const notif of notifications) {
      const existing = grouped.get(notif.threshold) || [];
      existing.push(notif);
      grouped.set(notif.threshold, existing);
    }

    // Send emails for each threshold group
    for (const [threshold, items] of grouped.entries()) {
      const urgencyLabel =
        threshold === 60
          ? "Atenție"
          : threshold === 30
          ? "Aproape"
          : "URGENT";

      const subject = `[${urgencyLabel}] Indexări în ${threshold} zile`;

      const contractsList = items
        .map(
          (n) =>
            `- ${n.contractName}\n  Data indexării: ${n.nextIndexing}\n  Zile rămase: ${n.daysUntil}`
        )
        .join("\n\n");

      const text = `${urgencyLabel.toUpperCase()}: Următoarele contracte au indexări programate în ${threshold} zile:

${contractsList}

Accesează panoul de administrare pentru detalii:
${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/indexing-schedule

---
Notificare automată - Sistem de administrare contracte`;

      try {
        await sendMail({
          to: adminEmails,
          subject,
          text,
        });
      } catch (emailError) {
        console.error("Failed to send indexing reminder email:", emailError);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Sent ${notifications.length} reminder(s)`,
      notifications: notifications.map((n) => ({
        contract: n.contractName,
        indexing: n.nextIndexing,
        daysUntil: n.daysUntil,
        threshold: n.threshold,
      })),
    });
  } catch (error) {
    console.error("Indexing reminders cron error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
