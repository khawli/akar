import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    const pool =
      globalForPrisma.pgPool ??
      new Pool({
        connectionString: process.env.DATABASE_URL,
      });

    if (process.env.NODE_ENV !== "production") globalForPrisma.pgPool = pool;

    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  })();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
