'use server'

import { prisma } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export interface UserSettingsData {
  enableLoans: boolean
}

export async function getUserSettings(): Promise<UserSettingsData> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  let settings = await prisma.userSettings.findUnique({
    where: { userId: session.userId },
  })

  // Create default settings if not exists
  if (!settings) {
    settings = await prisma.userSettings.create({
      data: {
        userId: session.userId,
        enableLoans: false,
      },
    })
  }

  return {
    enableLoans: settings.enableLoans,
  }
}

export async function updateUserSettings(data: Partial<UserSettingsData>) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  await prisma.userSettings.upsert({
    where: { userId: session.userId },
    create: {
      userId: session.userId,
      enableLoans: data.enableLoans ?? false,
    },
    update: {
      enableLoans: data.enableLoans,
    },
  })

  revalidatePath('/')
  revalidatePath('/settings')
}
