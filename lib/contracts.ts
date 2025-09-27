import { ContractSchema, type Contract as ContractType } from "@/lib/schemas/contract";
import { getDb } from "@/lib/mongodb";

const MOCK_CONTRACTS: ContractType[] = [
  {
    id: "c1",
    name: "Lease #1001",
    partner: "Acme Corp",
    signedAt: "2024-12-15",
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    scanUrl: "/contract-scan.svg",
  },
  {
    id: "c2",
    name: "Lease #1002",
    partner: "Globex LLC",
    signedAt: "2025-02-10",
    startDate: "2025-03-01",
    endDate: "2026-02-28",
    scanUrl: "/contract-scan.svg",
  },
  {
    id: "c3",
    name: "Maintenance Agreement A",
    partner: "Initech",
    signedAt: "2025-05-05",
    startDate: "2025-05-15",
    endDate: "2025-11-15",
    scanUrl: "/contract-scan.svg",
  },
  {
    id: "c4",
    name: "Service Contract 2025",
    partner: "Umbrella Co",
    signedAt: "2025-01-20",
    startDate: "2025-02-01",
    endDate: "2025-08-01",
    scanUrl: "/contract-scan.svg",
  },
  {
    id: "c5",
    name: "Short-term Lease Q3",
    partner: "Stark Industries",
    signedAt: "2025-06-30",
    startDate: "2025-07-01",
    endDate: "2025-09-30",
    scanUrl: "/contract-scan.svg",
  },
  {
    id: "c6",
    name: "Property Mgmt Alpha",
    partner: "Wayne Enterprises",
    signedAt: "2024-11-01",
    startDate: "2024-11-15",
    endDate: "2025-11-14",
    scanUrl: "/contract-scan.svg",
  },
  {
    id: "c7",
    name: "Renewal Lease #2001",
    partner: "Hooli",
    signedAt: "2025-03-12",
    startDate: "2025-04-01",
    endDate: "2026-03-31",
  },
  {
    id: "c8",
    name: "Equipment Rental B",
    partner: "Soylent Corp",
    signedAt: "2025-04-05",
    startDate: "2025-04-15",
    endDate: "2025-10-15",
  },
  {
    id: "c9",
    name: "Parking Spaces 12-20",
    partner: "Duff Beer",
    signedAt: "2024-09-01",
    startDate: "2024-09-15",
    endDate: "2025-09-14",
  },
  {
    id: "c10",
    name: "Seasonal Lease Winter",
    partner: "Cyberdyne Systems",
    signedAt: "2024-10-10",
    startDate: "2024-12-01",
    endDate: "2025-03-01",
  },
  {
    id: "c11",
    name: "Service Level Addendum",
    partner: "MomCorp",
    signedAt: "2025-07-01",
    startDate: "2025-07-10",
    endDate: "2026-07-09",
  },
  {
    id: "c12",
    name: "Property Mgmt Beta",
    partner: "Tyrell Corporation",
    signedAt: "2025-01-05",
    startDate: "2025-01-15",
    endDate: "2026-01-14",
  },
  {
    id: "c13",
    name: "Warehouse Lease A",
    partner: "Oscorp",
    signedAt: "2024-07-20",
    startDate: "2024-08-01",
    endDate: "2025-07-31",
  },
  {
    id: "c14",
    name: "Short-term Lease Q4",
    partner: "Aperture Science",
    signedAt: "2025-09-10",
    startDate: "2025-10-01",
    endDate: "2025-12-31",
  },
  {
    id: "c15",
    name: "Office Expansion East",
    partner: "Black Mesa",
    signedAt: "2025-05-25",
    startDate: "2025-06-01",
    endDate: "2026-05-31",
  },
  {
    id: "c16",
    name: "Retail Kiosk Summer",
    partner: "Nuka-Cola",
    signedAt: "2025-03-28",
    startDate: "2025-05-01",
    endDate: "2025-09-01",
  },
  {
    id: "c17",
    name: "Maintenance Agreement B",
    partner: "Wonka Industries",
    signedAt: "2024-12-01",
    startDate: "2025-01-10",
    endDate: "2025-07-10",
  },
  {
    id: "c18",
    name: "Service Contract 2026",
    partner: "Blue Sun",
    signedAt: "2025-08-15",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  },
  {
    id: "c19",
    name: "Lease #3003",
    partner: "Gringotts Bank",
    signedAt: "2025-02-02",
    startDate: "2025-02-15",
    endDate: "2026-02-14",
  },
  {
    id: "c20",
    name: "Storage Units Block C",
    partner: "Vault-Tec",
    signedAt: "2025-06-05",
    startDate: "2025-06-15",
    endDate: "2026-06-14",
  },
];

// Validate mock data at module load (throws if invalid during dev)
for (const c of MOCK_CONTRACTS) ContractSchema.parse(c);

export async function fetchContracts(): Promise<ContractType[]> {
  // If MongoDB is configured, read from DB; else fallback to mocks
  if (process.env.MONGODB_URI && process.env.MONGODB_DB) {
    try {
      const db = await getDb();
      const docs = await db
        .collection<ContractType>("contracts")
        .find({}, { projection: { _id: 0 } })
        .toArray();
      // Validate and return
      return docs.map((d: unknown) => ContractSchema.parse(d));
    } catch (err) {
      console.warn("Mongo indisponibil în prezent; folosesc datele mock.", err);
    }
  }
  await new Promise((r) => setTimeout(r, 200));
  return MOCK_CONTRACTS;
}

export async function fetchContractById(id: string): Promise<ContractType | null> {
  if (process.env.MONGODB_URI && process.env.MONGODB_DB) {
    try {
      const db = await getDb();
      const doc = await db
        .collection<ContractType>("contracts")
        .findOne({ id }, { projection: { _id: 0 } });
      return doc ? ContractSchema.parse(doc) : null;
    } catch (err) {
      console.warn("Mongo indisponibil; căutare în dataset-ul mock.", err);
    }
  }
  await new Promise((r) => setTimeout(r, 100));
  return MOCK_CONTRACTS.find((c) => c.id === id) ?? null;
}

export async function upsertContract(contract: ContractType) {
  ContractSchema.parse(contract);
  if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) {
    throw new Error("MongoDB nu este configurat. Setați MONGODB_URI și MONGODB_DB.");
  }
  const db = await getDb();
  await db
    .collection<ContractType>("contracts")
    .updateOne({ id: contract.id }, { $set: contract }, { upsert: true });
}

export async function deleteContractById(id: string): Promise<boolean> {
  if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) {
    throw new Error("MongoDB nu este configurat. Setați MONGODB_URI și MONGODB_DB.");
  }
  const db = await getDb();
  const res = await db.collection<ContractType>("contracts").deleteOne({ id });
  return Boolean(res.acknowledged && res.deletedCount && res.deletedCount > 0);
}

// Helper used by seeding scripts to load the static mock dataset regardless of DB config
export function getMockContracts(): ContractType[] {
  return MOCK_CONTRACTS;
}
