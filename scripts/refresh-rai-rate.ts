import { getDailyRaiEurSell } from "@/lib/exchange-rai";

async function main() {
  try {
    const res = await getDailyRaiEurSell({ forceRefresh: true });
    // eslint-disable-next-line no-console
    console.log(`RAI EUR sell ${res.rate.toFixed(4)} on ${res.date}`);
    process.exit(0);
  } catch (e: unknown) {
    // eslint-disable-next-line no-console
    console.error("Failed to refresh RAI rate:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main();
