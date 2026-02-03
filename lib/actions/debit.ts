'use server'

import { prisma } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { Decimal } from '@prisma/client/runtime/library'
import { parseStatementMonth, parseLocalDate } from '@/lib/utils'

export interface DebitTransactionData {
  id: string
  description: string
  amount: string
  date: Date
  createdAt: Date
}

export async function getDebitTransactions(statementMonth: string): Promise<DebitTransactionData[]> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const monthDate = parseStatementMonth(statementMonth)
  const nextMonth = new Date(monthDate)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  const transactions = await prisma.debitTransaction.findMany({
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
    amount: t.amount.toString(),
    date: t.date,
    createdAt: t.createdAt,
  }))
}

export interface CreateDebitInput {
  description: string
  amount: string
  date: string
}

export async function createDebitTransaction(data: CreateDebitInput) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  if (!data.description || !data.amount) {
    throw new Error('Descrição e valor são obrigatórios')
  }

  const transaction = await prisma.debitTransaction.create({
    data: {
      userId: session.userId,
      description: data.description,
      amount: new Decimal(data.amount),
      date: parseLocalDate(data.date),
    },
  })

  revalidatePath('/debit')
  revalidatePath('/')

  return transaction
}

export async function deleteDebitTransaction(id: string) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const transaction = await prisma.debitTransaction.findFirst({
    where: { id, userId: session.userId },
  })

  if (!transaction) throw new Error('Transação não encontrada')

  await prisma.debitTransaction.delete({ where: { id } })

  revalidatePath('/debit')
  revalidatePath('/')
}

export async function getDebitTotal(statementMonth: string): Promise<string> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const monthDate = parseStatementMonth(statementMonth)
  const nextMonth = new Date(monthDate)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  const result = await prisma.debitTransaction.aggregate({
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
