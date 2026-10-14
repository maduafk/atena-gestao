'use server'

import { prisma } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { parseStatementMonth } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { Decimal } from '@prisma/client/runtime/library'
import DecimalJS from 'decimal.js'

export async function getMonthlyBudget(statementMonth: string): Promise<string | null> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const budget = await prisma.monthlyBudget.findUnique({
    where: {
      userId_statementMonth: {
        userId: session.userId,
        statementMonth: parseStatementMonth(statementMonth),
      },
    },
  })

  return budget?.amount.toString() || null
}

export async function saveMonthlyBudget(statementMonth: string, amount: string) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const value = new DecimalJS(amount)
  if (value.lessThanOrEqualTo(0)) throw new Error('O teto precisa ser maior que zero')

  const monthDate = parseStatementMonth(statementMonth)
  await prisma.monthlyBudget.upsert({
    where: {
      userId_statementMonth: {
        userId: session.userId,
        statementMonth: monthDate,
      },
    },
    update: { amount: new Decimal(value.toFixed(2)) },
    create: {
      userId: session.userId,
      statementMonth: monthDate,
      amount: new Decimal(value.toFixed(2)),
    },
  })

  revalidatePath('/')
}
