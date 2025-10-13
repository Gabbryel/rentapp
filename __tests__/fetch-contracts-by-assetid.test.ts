import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fetchContractsByAssetId } from '../lib/contracts';

async function writeLocalContracts(data: any[]) {
  const dir = path.join(process.cwd(), '.data');
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
  const p = path.join(dir, 'contracts.json');
  await fs.writeFile(p, JSON.stringify(data, null, 2));
}

async function cleanupLocal() {
  const p = path.join(process.cwd(), '.data', 'contracts.json');
  try { await fs.unlink(p); } catch {}
}

async function testInjectedDb() {
  const fakeDocs = [
    {
      id: 'test-1',
      name: 'C1',
      assetId: 'A1',
      partner: 'P1',
      owner: 'Owner LTD',
      signedAt: '2024-12-01',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      rentType: 'monthly',
      scans: [],
      rentHistory: [],
    },
    {
      id: 'test-2',
      name: 'C2',
      assetId: 'A2',
      partner: 'P2',
      owner: 'Owner LTD',
      signedAt: '2024-12-01',
      startDate: '2025-02-01',
      endDate: '2025-08-31',
      rentType: 'monthly',
      scans: [],
      rentHistory: [],
    },
  ];
  // simple fake db exposing collection().find().toArray()
  const fakeDb = {
    collection: () => ({
      find: (filter: any) => ({ toArray: async () => fakeDocs.filter(d => d.assetId === filter.assetId) })
    })
  };
  const res = await fetchContractsByAssetId('A1', fakeDb as any);
  assert(Array.isArray(res));
  assert(res.length === 1, 'Expected 1 contract for A1');
  assert(res[0].id === 'test-1');
}

async function testLocalFallback() {
  await writeLocalContracts([
    {
      id: 'l1',
      name: 'L1',
      assetId: 'LA',
      partner: 'LP',
      owner: 'Owner X',
      signedAt: '2023-01-01',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      rentType: 'monthly',
      scans: [],
      rentHistory: [],
    },
    {
      id: 'l2',
      name: 'L2',
      assetId: 'LB',
      partner: 'LP2',
      owner: 'Owner Y',
      signedAt: '2023-01-01',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      rentType: 'monthly',
      scans: [],
      rentHistory: [],
    },
  ]);
  const res = await fetchContractsByAssetId('LA');
  assert(Array.isArray(res), 'result should be array');
  assert(res.length === 1, 'expected 1 local contract');
  assert(res[0].id === 'l1');
  await cleanupLocal();
}

async function main() {
  try {
    await testInjectedDb();
    console.log('testInjectedDb: PASS');
    await testLocalFallback();
    console.log('testLocalFallback: PASS');
    console.log('All tests passed');
    process.exit(0);
  } catch (err) {
    console.error('Test failure:', err);
    process.exit(2);
  }
}

if (require.main === module) main();
