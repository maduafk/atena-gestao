'use server'

import { prisma } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { Decimal } from '@prisma/client/runtime/library'
import { parseStatementMonth, parseLocalDate } from '@/lib/utils'
import { generateRecurringForMonth } from '@/lib/actions/recurring'

export interface IncomeTransactionData {
  id: string
  description: string
  category: string
  amount: string
  date: Date
  createdAt: Date
}

export async function getIncomeTransactions(statementMonth: string): Promise<IncomeTransactionData[]> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  await generateRecurringForMonth(statementMonth)

  const monthDate = parseStatementMonth(statementMonth)
  const nextMonth = new Date(monthDate)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  const transactions = await prisma.incomeTransaction.findMany({
    where: {
      userId: session.userId,
      date: {
        gte: monthDate,
        lt: nextMonth,
      },
    },
    orderBy: { date: 'desc' },
  })

  return transactions.map(t => ({
    id: t.id,
    description: t.description,
    category: t.category,
    amount: t.amount.toString(),
    date: t.date,
    createdAt: t.createdAt,
  }))
}

export interface CreateIncomeInput {
  description: string
  amount: string
  date: string
  category?: string
}

export async function createIncomeTransaction(data: CreateIncomeInput) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  if (!data.description || !data.amount) {
    throw new Error('Descrição e valor são obrigatórios')
  }

  const transaction = await prisma.incomeTransaction.create({
    data: {
      userId: session.userId,
      description: data.description,
      category: data.category || 'Outros',
      amount: new Decimal(data.amount),
      date: parseLocalDate(data.date),
    },
  })

  revalidatePath('/income')
  revalidatePath('/')

  return transaction
}

export async function updateIncomeTransaction(id: string, data: CreateIncomeInput) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  if (!data.description || !data.amount) {
    throw new Error('Descrição e valor são obrigatórios')
  }

  const transaction = await prisma.incomeTransaction.findFirst({
    where: { id, userId: session.userId },
  })
  if (!transaction) throw new Error('Receita não encontrada')

  await prisma.incomeTransaction.update({
    where: { id },
    data: {
      description: data.description,
      category: data.category || 'Outros',
      amount: new Decimal(data.amount),
      date: parseLocalDate(data.date),
    },
  })

  revalidatePath('/income')
  revalidatePath('/')
}

export async function deleteIncomeTransaction(id: string) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const transaction = await prisma.incomeTransaction.findFirst({
    where: { id, userId: session.userId },
  })

  if (!transaction) throw new Error('Transação não encontrada')

  await prisma.incomeTransaction.delete({ where: { id } })

  revalidatePath('/income')
  revalidatePath('/')
}

export async function getIncomeTotal(statementMonth: string): Promise<string> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const monthDate = parseStatementMonth(statementMonth)
  const nextMonth = new Date(monthDate)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  const result = await prisma.incomeTransaction.aggregate({
    where: {
      userId: session.userId,
      date: {
        gte: monthDate,
        lt: nextMonth,
      },
    },
    _sum: { amount: true },
  })

  return result._sum.amount?.toString() || '0'
}
