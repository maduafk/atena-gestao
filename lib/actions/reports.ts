'use server'

import { prisma } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import DecimalJS from 'decimal.js'

export interface YearMonthRow {
  month: string
  income: string
  debit: string
  card: string
  balance: string
}

export async function getYearReport(year: number): Promise<YearMonthRow[]> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year + 1, 0, 1))

  const [incomes, debits, installments] = await Promise.all([
    prisma.incomeTransaction.findMany({
      where: { userId: session.userId, date: { gte: start, lt: end } },
      select: { amount: true, date: true },
    }),
    prisma.debitTransaction.findMany({
      where: { userId: session.userId, date: { gte: start, lt: end } },
      select: { amount: true, date: true },
    }),
    prisma.cardInstallment.findMany({
      where: { userId: session.userId, statementMonth: { gte: start, lt: end } },
      select: { amount: true, statementMonth: true },
    }),
  ])

  const rows: YearMonthRow[] = []
  for (let month = 0; month < 12; month++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}`
    const income = incomes
      .filter(item => item.date.toISOString().slice(0, 7) === key)
      .reduce((sum, item) => sum.plus(item.amount.toString()), new DecimalJS(0))
    const debit = debits
      .filter(item => item.date.toISOString().slice(0, 7) === key)
      .reduce((sum, item) => sum.plus(item.amount.toString()), new DecimalJS(0))
    const card = installments
      .filter(item => item.statementMonth.toISOString().slice(0, 7) === key)
      .reduce((sum, item) => sum.plus(item.amount.toString()), new DecimalJS(0))
    rows.push({
      month: key,
      income: income.toFixed(2),
      debit: debit.toFixed(2),
      card: card.toFixed(2),
      balance: income.minus(debit).minus(card).toFixed(2),
    })
  }

  return rows
}

export async function getCategoryTotals(statementMonth: string) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const [year, month] = statementMonth.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))

  const [debits, installments] = await Promise.all([
    prisma.debitTransaction.findMany({
      where: { userId: session.userId, date: { gte: start, lt: end } },
      select: { category: true, amount: true },
    }),
    prisma.cardInstallment.findMany({
      where: { userId: session.userId, statementMonth: { gte: start, lt: end } },
      include: { purchase: { select: { category: true } } },
    }),
  ])

  const totals = new Map<string, DecimalJS>()
  for (const debit of debits) {
    const key = debit.category || 'Outros'
    totals.set(key, (totals.get(key) || new DecimalJS(0)).plus(debit.amount.toString()))
  }
  for (const installment of installments) {
    const key = installment.purchase.category || 'Outros'
    totals.set(key, (totals.get(key) || new DecimalJS(0)).plus(installment.amount.toString()))
  }

  return Array.from(totals.entries())
    .map(([category, amount]) => ({ category, amount: amount.toFixed(2) }))
    .sort((a, b) => Number(b.amount) - Number(a.amount))
}
