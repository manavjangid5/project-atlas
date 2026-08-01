import { PrismaClient, Prisma } from "@prisma/client";

console.log("@atlas/database module loading, DATABASE_URL present:", !!process.env.DATABASE_URL);

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma || new PrismaClient();

console.log("@atlas/database prisma client created:", !!prisma);

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export { PrismaClient, Prisma };
export * from "@prisma/client";