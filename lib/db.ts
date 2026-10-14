import { PrismaClient } from '@prisma/client'
import { unwrapDatabaseUrl } from './database-url'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const databaseUrl = unwrapDatabaseUrl(process.env.DATABASE_URL)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    databaseUrl
      ? {
          datasources: {
            db: { url: databaseUrl },
          },
        }
      : undefined
  )

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
