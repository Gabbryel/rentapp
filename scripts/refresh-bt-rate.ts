import { getDailyBtEurSell } from "@/lib/exchange-bt";

async function main() {
  try {
    const res = await getDailyBtEurSell({ forceRefresh: true });
    // eslint-disable-next-line no-console
    console.log(`BT EUR sell ${res.rate.toFixed(4)} on ${res.date}`);
    process.exit(0);
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("Failed to refresh BT rate:", e?.message ?? e);
    process.exit(1);
  }
}

main();
