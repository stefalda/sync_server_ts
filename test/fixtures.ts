import { randomUUID } from 'crypto';
import { DatabaseRepository } from '../src/repositories/database_repository';
import { UserRepository } from '../src/repositories/user_repository';
import { AuthenticationRepository } from '../src/repositories/authentication_repository';
import { encryptPassword } from '../src/helpers/utils';

const TEST_REALM = 'todo_test';

const createdIds: Array<{ table: string; id: string }> = [];

export function getTestRealm(): string {
  return TEST_REALM;
}

export async function createTestUser(): Promise<{
  id: string;
  name: string;
  email: string;
  password: string;
  salt: string;
}> {
  const db = await DatabaseRepository.getInstance();
  const id = randomUUID();
  const name = 'Test User';
  const email = `test_${id.slice(0, 8)}@test.com`;
  const password = 'testPassword123';
  const salt = randomUUID().slice(0, 16);
  const hashedPassword = encryptPassword(password, salt);

  const sql = `INSERT INTO public.users (id, name, email, password, salt) VALUES ($1, $2, $3, $4, $5)`;
  await db.query(sql, [id, name, email, hashedPassword, salt], {
    realm: TEST_REALM,
  });

  createdIds.push({ table: 'users', id });
  return { id, name, email, password, salt };
}

export async function createTestClient(
  userId: string,
  clientId?: string
): Promise<{ clientid: string; userid: string }> {
  const db = await DatabaseRepository.getInstance();
  const clientid = clientId || randomUUID();

  const sql = `INSERT INTO public.user_clients (clientid, userid) VALUES ($1, $2)`;
  await db.query(sql, [clientid, userId], { realm: TEST_REALM });

  createdIds.push({ table: 'user_clients', id: clientid });
  return { clientid, userid: userId };
}

export async function createTestToken(
  clientId: string
): Promise<{ token: string; refreshtoken: string; lastrefresh: number }> {
  return await AuthenticationRepository.getInstance().generateToken(
    TEST_REALM,
    clientId
  );
}

export async function createTestSyncData(
  userId: string,
  clientId: string,
  overrides?: {
    rowguid?: string;
    operation?: string;
    tablename?: string;
    clientdate?: number;
    serverdate?: number;
  }
): Promise<{ rowguid: string }> {
  const db = await DatabaseRepository.getInstance();
  const rowguid = overrides?.rowguid || randomUUID();

  const sql = `INSERT INTO public.sync_data (userid, clientid, tablename, rowguid, operation, clientdate, serverdate)
    VALUES ($1, $2, $3, $4, $5, $6, $7)`;
  await db.query(sql, [
    userId,
    clientId,
    overrides?.tablename || 'notes',
    rowguid,
    overrides?.operation || 'U',
    overrides?.clientdate || Date.now(),
    overrides?.serverdate || Date.now(),
  ], { realm: TEST_REALM });

  createdIds.push({ table: 'sync_data', id: rowguid });
  return { rowguid };
}

export async function createTestData(
  rowguid: string,
  jsonData: Record<string, unknown>
): Promise<void> {
  const db = await DatabaseRepository.getInstance();
  const sql = `INSERT INTO public.data (rowguid, json) VALUES ($1, $2)`;
  await db.query(sql, [rowguid, JSON.stringify(jsonData)], {
    realm: TEST_REALM,
  });
}

export function getCreatedIds(): Array<{ table: string; id: string }> {
  return [...createdIds];
}

export async function clearCreatedIds(): Promise<void> {
  const db = await DatabaseRepository.getInstance();
  const deleteOrder = [
    'sync_data',
    'data',
    'user_tokens',
    'user_clients',
    'users_pin',
    'users',
  ];
  for (const table of deleteOrder) {
    const idsToDelete = createdIds.filter((r) => r.table === table).map((r) => r.id);
    if (idsToDelete.length === 0) continue;
    const placeholders = idsToDelete.map((_, i) => `$${i + 1}`).join(', ');
    const idColumn = table === 'user_tokens' ? 'clientid' : table === 'user_clients' ? 'clientid' : table === 'users_pin' ? 'userid' : table === 'sync_data' ? 'rowguid' : 'id';
    await db.query(
      `DELETE FROM public.${table} WHERE ${idColumn} IN (${placeholders})`,
      idsToDelete,
      { realm: TEST_REALM }
    ).catch(() => {
      // ignore cleanup errors
    });
  }
  createdIds.length = 0;
}
