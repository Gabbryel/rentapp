import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createDeposit, listDepositsForContract, updateDeposit, deleteDepositById, toggleDepositDeposited } from '../lib/deposits';

const dataDir = path.join(process.cwd(), '.data');
const file = path.join(dataDir, 'deposits.json');

async function writeAll(arr:any[]) {
  try { await fs.mkdir(dataDir, { recursive: true }); } catch {}
  await fs.writeFile(file, JSON.stringify(arr, null, 2));
}

async function readAll() { try { const b = await fs.readFile(file); return JSON.parse(String(b)); } catch { return []; } }

async function cleanup() { try { await fs.unlink(file); } catch {} }

async function main(){
  await cleanup();
  // create
  const d1 = await createDeposit({ contractId: 'C1', type: 'bank_transfer', isDeposited: false, amountEUR: 100 });
  assert(d1.id, 'id created');
  const d2 = await createDeposit({ contractId: 'C1', type: 'check', isDeposited: false, amountEUR: 50 });
  const list = await listDepositsForContract('C1');
  assert(list.length === 2, 'two deposits');

  // toggle
  const ok = await toggleDepositDeposited(d1.id);
  assert(ok, 'toggle ok');
  const after = await listDepositsForContract('C1');
  const t1 = after.find((x:any)=>x.id===d1.id);
  assert(t1.isDeposited === true, 'should be deposited');

  // update
  d2.note = 'Updated note';
  const u = await updateDeposit(d2);
  assert(u.note === 'Updated note');

  // delete
  const del = await deleteDepositById(d1.id);
  assert(del === true);
  const final = await listDepositsForContract('C1');
  assert(final.length === 1, 'one left');

  console.log('All deposits tests passed');
  await cleanup();
}

if (require.main === module) main();
