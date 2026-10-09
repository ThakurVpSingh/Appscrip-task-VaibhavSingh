import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

let isDbAvailable: boolean | null = null;
let lastCheckTime = 0;

export async function checkDatabaseAvailability(): Promise<boolean> {
  const now = Date.now();
  if (isDbAvailable !== null && now - lastCheckTime < 15000) {
    return isDbAvailable;
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("DB connection timeout")), 1500);
    });
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeoutPromise]);
    isDbAvailable = true;
  } catch {
    isDbAvailable = false;
  }
  lastCheckTime = now;
  return isDbAvailable;
}
