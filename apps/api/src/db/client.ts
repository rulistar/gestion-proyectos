import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export type Db = PrismaClient;

/** Crea el cliente de Prisma conectado a PostgreSQL mediante el driver `pg` (ADR-0002 §8). */
export function createDb(databaseUrl: string): Db {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}
