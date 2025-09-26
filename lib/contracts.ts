export type Contract = {
  id: string;
  name: string;
  partner: string;
  signedAt: string; // ISO date string
  startDate: string; // ISO date string
  endDate: string; // ISO date string
};

const MOCK_CONTRACTS: Contract[] = [
  {
    id: "c1",
    name: "Lease #1001",
    partner: "Acme Corp",
    signedAt: "2024-12-15",
    startDate: "2025-01-01",
    endDate: "2025-12-31",
  },
  {
    id: "c2",
    name: "Lease #1002",
    partner: "Globex LLC",
    signedAt: "2025-02-10",
    startDate: "2025-03-01",
    endDate: "2026-02-28",
  },
  {
    id: "c3",
    name: "Maintenance Agreement A",
    partner: "Initech",
    signedAt: "2025-05-05",
    startDate: "2025-05-15",
    endDate: "2025-11-15",
  },
  {
    id: "c4",
    name: "Service Contract 2025",
    partner: "Umbrella Co",
    signedAt: "2025-01-20",
    startDate: "2025-02-01",
    endDate: "2025-08-01",
  },
  {
    id: "c5",
    name: "Short-term Lease Q3",
    partner: "Stark Industries",
    signedAt: "2025-06-30",
    startDate: "2025-07-01",
    endDate: "2025-09-30",
  },
  {
    id: "c6",
    name: "Property Mgmt Alpha",
    partner: "Wayne Enterprises",
    signedAt: "2024-11-01",
    startDate: "2024-11-15",
    endDate: "2025-11-14",
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

export async function fetchContracts(): Promise<Contract[]> {
  // Simulate a network/database delay
  await new Promise((r) => setTimeout(r, 400));
  return MOCK_CONTRACTS;
}
