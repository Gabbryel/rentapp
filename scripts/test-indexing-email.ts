import { fetchContracts, effectiveEndDate } from "../lib/contracts";
import { sendMail } from "../lib/email";

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

async function main() {
  console.log("🔍 Searching for contracts with indexing due in ~30 days...\n");

  const allContracts = await fetchContracts();
  const todayISO = new Date().toISOString().slice(0, 10);

  // Filter active contracts
  const activeContracts = allContracts.filter((c) => {
    const endDate = effectiveEndDate(c);
    return endDate >= todayISO;
  });

  console.log(`Found ${activeContracts.length} active contracts\n`);

  // Find contracts with indexing in 25-35 days range
  const candidates: Array<{
    contract: Contract;
    nextIndexing: string;
    daysUntil: number;
  }> = [];

  for (const contract of activeContracts) {
    const nextIndexing = getNextIndexingDate(contract);
    if (!nextIndexing) continue;

    const daysUntil = getDaysUntil(nextIndexing);
    if (daysUntil === null) continue;

    if (daysUntil >= 25 && daysUntil <= 35) {
      candidates.push({
        contract,
        nextIndexing,
        daysUntil,
      });
    }
  }

  if (candidates.length === 0) {
    console.log("❌ No contracts found with indexing due in ~30 days");
    console.log("\nCreating simulated test notification...\n");

    // Use any active contract and simulate 30 days
    if (activeContracts.length === 0) {
      console.log("❌ No active contracts found");
      process.exit(1);
    }

    const contract = activeContracts[0];
    const contractName = (contract as any).name || contract.id;
    
    // Simulate indexing date 30 days from now
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const nextIndexing = futureDate.toISOString().slice(0, 10);
    const daysUntil = 30;

    candidates.push({ contract, nextIndexing, daysUntil });
  }

  // Pick the first candidate
  const { contract, nextIndexing, daysUntil } = candidates[0];
  const contractName = (contract as any).name || contract.id;

  console.log(`✓ Found contract: ${contractName}`);
  console.log(`  Next indexing: ${nextIndexing}`);
  console.log(`  Days until: ${daysUntil}\n`);

  const urgencyLabel = daysUntil < 20 ? "URGENT" : daysUntil < 60 ? "Aproape" : "Atenție";
  const threshold = daysUntil < 20 ? 20 : daysUntil < 60 ? 30 : 60;

  const subject = `[TEST] [${urgencyLabel}] Indexare în ${daysUntil} zile`;

  const text = `ACEASTA ESTE O NOTIFICARE DE TEST

${urgencyLabel.toUpperCase()}: Următorul contract are indexare programată în ${daysUntil} zile:

Contract: ${contractName}
Data indexării: ${nextIndexing}
Zile rămase: ${daysUntil}
Prag notificare: ${threshold} zile

Accesează panoul de administrare pentru detalii:
${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/indexing-schedule

---
Notificare de test - Sistem de administrare contracte`;

  console.log("📧 Sending test email to gabriel@markov.ro...\n");

  try {
    await sendMail({
      to: ["gabriel@markov.ro"],
      subject,
      text,
    });

    console.log("✅ Email sent successfully!");
    console.log(`\nSubject: ${subject}`);
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
