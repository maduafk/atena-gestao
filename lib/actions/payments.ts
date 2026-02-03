'use server'

import { prisma } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { Decimal } from '@prisma/client/runtime/library'
import { parseStatementMonth, parseLocalDate } from '@/lib/utils'
import DecimalJS from 'decimal.js'

export interface StatementSummary {
  statementTotal: string
  paidTotal: string
  openTotal: string
}

export async function getStatementSummary(
  cardId: string,
  statementMonth: string
): Promise<StatementSummary> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const monthDate = parseStatementMonth(statementMonth)

  // Get total of installments for this statement
  const installmentsAgg = await prisma.cardInstallment.aggregate({
    where: {
      cardId,
      userId: session.userId,
      statementMonth: monthDate,
    },
    _sum: { amount: true },
  })

  // Get total payments for this statement
  const paymentsAgg = await prisma.cardPayment.aggregate({
    where: {
      cardId,
      userId: session.userId,
      statementMonth: monthDate,
    },
    _sum: { amount: true },
  })

  const statementTotal = new DecimalJS(installmentsAgg._sum.amount?.toString() || '0')
  const paidTotal = new DecimalJS(paymentsAgg._sum.amount?.toString() || '0')
  const openTotal = statementTotal.minus(paidTotal)

  return {
    statementTotal: statementTotal.toString(),
    paidTotal: paidTotal.toString(),
    openTotal: openTotal.greaterThan(0) ? openTotal.toString() : '0',
  }
}

export interface CreatePaymentInput {
  cardId: string
  statementMonth: string
  amount: string
  paymentDate: string
  method: string
  note?: string
}

export async function createPayment(data: CreatePaymentInput) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  // Validate card belongs to user
  const card = await prisma.card.findFirst({
    where: { id: data.cardId, userId: session.userId },
  })

  if (!card) throw new Error('Cartão não encontrado')

  const monthDate = parseStatementMonth(data.statementMonth)
  const paymentAmount = new DecimalJS(data.amount)

  // Check open total
  const summary = await getStatementSummary(data.cardId, data.statementMonth)
  const openTotal = new DecimalJS(summary.openTotal)

  if (paymentAmount.greaterThan(openTotal)) {
    throw new Error(`Valor do pagamento excede o total em aberto (${summary.openTotal})`)
  }

  if (paymentAmount.lessThanOrEqualTo(0)) {
    throw new Error('Valor do pagamento deve ser maior que zero')
  }

  // Create payment and allocate to installments
  await prisma.$transaction(async (tx) => {
    // Create payment
    const payment = await tx.cardPayment.create({
      data: {
        userId: session.userId,
        cardId: data.cardId,
        statementMonth: monthDate,
        paymentDate: parseLocalDate(data.paymentDate),
        amount: new Decimal(data.amount),
        method: data.method || 'other',
        note: data.note || null,
      },
    })

    // Get open installments for this statement, ordered by installmentNumber then createdAt
    const openInstallments = await tx.cardInstallment.findMany({
      where: {
        cardId: data.cardId,
        userId: session.userId,
        statementMonth: monthDate,
        status: 'open',
      },
      orderBy: [
        { installmentNumber: 'asc' },
        { createdAt: 'asc' },
      ],
    })

    // Allocate payment to installments (oldest first)
    let remainingPayment = paymentAmount

    for (const installment of openInstallments) {
      if (remainingPayment.lessThanOrEqualTo(0)) break

      // Get already allocated amount for this installment
      const allocatedAgg = await tx.cardPaymentAllocation.aggregate({
        where: { installmentId: installment.id },
        _sum: { amount: true },
      })
      
      const alreadyAllocated = new DecimalJS(allocatedAgg._sum.amount?.toString() || '0')
      const installmentAmount = new DecimalJS(installment.amount.toString())
      const remainingOnInstallment = installmentAmount.minus(alreadyAllocated)

      if (remainingOnInstallment.lessThanOrEqualTo(0)) continue

      // Determine allocation amount
      const allocationAmount = DecimalJS.min(remainingPayment, remainingOnInstallment)

      // Create allocation
      await tx.cardPaymentAllocation.create({
        data: {
          userId: session.userId,
          paymentId: payment.id,
          installmentId: installment.id,
          amount: new Decimal(allocationAmount.toString()),
        },
      })

      // Check if installment is now fully paid
      const newAllocatedTotal = alreadyAllocated.plus(allocationAmount)
      if (newAllocatedTotal.greaterThanOrEqualTo(installmentAmount)) {
        await tx.cardInstallment.update({
          where: { id: installment.id },
          data: { status: 'paid' },
        })
      }

      remainingPayment = remainingPayment.minus(allocationAmount)
    }

    return payment
  })

  revalidatePath(`/cards/${data.cardId}`)
  revalidatePath('/')
}

export interface PaymentData {
  id: string
  amount: string
  paymentDate: Date
  method: string
  note: string | null
  createdAt: Date
}

export async function getPaymentsForStatement(
  cardId: string,
  statementMonth: string
): Promise<PaymentData[]> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const monthDate = parseStatementMonth(statementMonth)

  const payments = await prisma.cardPayment.findMany({
    where: {
      cardId,
      userId: session.userId,
      statementMonth: monthDate,
    },
    orderBy: { paymentDate: 'desc' },
  })

  return payments.map(p => ({
    id: p.id,
    amount: p.amount.toString(),
    paymentDate: p.paymentDate,
    method: p.method,
    note: p.note,
    createdAt: p.createdAt,
  }))
}
