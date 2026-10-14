'use server'

import { prisma } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { parseStatementMonth } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { Decimal } from '@prisma/client/runtime/library'

export interface RecurringData {
  id: string
  kind: string
  description: string
  amount: string
  category: string
  dayOfMonth: number
  active: boolean
}

export async function getRecurringTransactions(kind: 'debit' | 'income'): Promise<RecurringData[]> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const rows = await prisma.recurringTransaction.findMany({
    where: { userId: session.userId, kind, active: true },
    orderBy: { description: 'asc' },
  })

  return rows.map(row => ({
    id: row.id,
    kind: row.kind,
    description: row.description,
    amount: row.amount.toString(),
    category: row.category,
    dayOfMonth: row.dayOfMonth,
    active: row.active,
  }))
}

export async function createRecurringTransaction(data: {
  kind: 'debit' | 'income'
  description: string
  amount: string
  category: string
  dayOfMonth: number
}) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  if (!data.description || !data.amount) throw new Error('Descrição e valor são obrigatórios')
  if (data.dayOfMonth < 1 || data.dayOfMonth > 28) throw new Error('O dia deve ficar entre 1 e 28')

  await prisma.recurringTransaction.create({
    data: {
      userId: session.userId,
      kind: data.kind,
      description: data.description.trim(),
      amount: new Decimal(data.amount),
      category: data.category || 'Outros',
      dayOfMonth: data.dayOfMonth,
    },
  })

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  await generateRecurringForMonth(currentMonth)
  revalidatePath(data.kind === 'debit' ? '/debit' : '/income')
  revalidatePath('/')
}

export async function deleteRecurringTransaction(id: string) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const row = await prisma.recurringTransaction.findFirst({
    where: { id, userId: session.userId },
  })
  if (!row) throw new Error('Recorrência não encontrada')

  await prisma.recurringTransaction.update({
    where: { id },
    data: { active: false },
  })

  revalidatePath('/debit')
  revalidatePath('/income')
}

export async function generateRecurringForMonth(statementMonth: string) {
  const session = await verifySession()
  if (!session) return

  const monthDate = parseStatementMonth(statementMonth)
  const nextMonth = new Date(monthDate)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  const rules = await prisma.recurringTransaction.findMany({
    where: { userId: session.userId, active: true },
  })

  for (const rule of rules) {
    const startKey = rule.createdAt.toISOString().slice(0, 7)
    if (statementMonth < startKey) continue

    const day = Math.min(rule.dayOfMonth, 28)
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)

    if (rule.kind === 'debit') {
      const existing = await prisma.debitTransaction.findFirst({
        where: {
          userId: session.userId,
          recurringId: rule.id,
          date: { gte: monthDate, lt: nextMonth },
        },
      })
      if (existing) continue
      await prisma.debitTransaction.create({
        data: {
          userId: session.userId,
          description: rule.description,
          category: rule.category,
          amount: rule.amount,
          date,
          recurringId: rule.id,
        },
      })
    } else {
      const existing = await prisma.incomeTransaction.findFirst({
        where: {
          userId: session.userId,
          recurringId: rule.id,
          date: { gte: monthDate, lt: nextMonth },
        },
      })
      if (existing) continue
      await prisma.incomeTransaction.create({
        data: {
          userId: session.userId,
          description: rule.description,
          category: rule.category,
          amount: rule.amount,
          date,
          recurringId: rule.id,
        },
      })
    }
  }
}
