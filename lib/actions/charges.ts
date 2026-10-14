'use server'

import { prisma } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { formatMonthDisplay, parseStatementMonth } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import DecimalJS from 'decimal.js'

export type ChargeSourceType = 'loan_installment' | 'receivable_installment'

export interface MonthCharge {
  sourceType: ChargeSourceType
  sourceId: string
  personName: string
  description: string
  origin: string
  amount: string
  installmentLabel: string
  originMonth: string
  originLabel: string
  carried: boolean
  markedUnpaid: boolean
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}

function parseLoanDescription(description: string): { personName: string; detail: string } | null {
  const match = description.match(/^\[Empréstimo\] ([^:]+):(.*)$/)
  if (!match) return null
  return { personName: match[1].trim(), detail: match[2]?.trim() || 'Empréstimo' }
}

export async function getMonthCharges(statementMonth: string): Promise<MonthCharge[]> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const monthDate = parseStatementMonth(statementMonth)
  const nextMonth = new Date(monthDate)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  const flags = await prisma.unpaidCharge.findMany({
    where: { userId: session.userId },
  })
  const flagByKey = new Map(flags.map(flag => [`${flag.sourceType}:${flag.sourceId}`, flag]))
  const loanFlagIds = flags.filter(flag => flag.sourceType === 'loan_installment').map(flag => flag.sourceId)
  const receivableFlagIds = flags.filter(flag => flag.sourceType === 'receivable_installment').map(flag => flag.sourceId)

  const loanInstallments = await prisma.cardInstallment.findMany({
    where: {
      userId: session.userId,
      purchase: { description: { startsWith: '[Empréstimo]' } },
      OR: [
        { statementMonth: monthDate },
        ...(loanFlagIds.length > 0 ? [{ id: { in: loanFlagIds } }] : []),
      ],
    },
    include: {
      purchase: { select: { description: true, installments: true } },
      card: { select: { name: true } },
    },
  })

  const paidLoans = await prisma.cardLoan.findMany({
    where: { userId: session.userId, status: 'paid' },
    select: { borrowerName: true, description: true, cardId: true },
  })

  const receivableInstallments = await prisma.receivableInstallment.findMany({
    where: {
      userId: session.userId,
      status: { not: 'paid' },
      OR: [
        { dueDate: { gte: monthDate, lt: nextMonth } },
        ...(receivableFlagIds.length > 0 ? [{ id: { in: receivableFlagIds } }] : []),
      ],
    },
    include: {
      receivable: { select: { personName: true, description: true, category: true, installments: true } },
    },
  })

  const charges: MonthCharge[] = []

  for (const installment of loanInstallments) {
    const parsed = parseLoanDescription(installment.purchase.description)
    if (!parsed) continue

    const loanPaid = paidLoans.some(loan =>
      loan.borrowerName.toLowerCase() === parsed.personName.toLowerCase() &&
      loan.cardId === installment.cardId &&
      loan.description.trim().toLowerCase() === parsed.detail.trim().toLowerCase()
    )
    if (loanPaid) continue

    const origin = monthKey(installment.statementMonth)
    const flagged = flagByKey.has(`loan_installment:${installment.id}`)
    const carried = origin < statementMonth
    if (carried && !flagged) continue
    if (origin > statementMonth) continue

    charges.push({
      sourceType: 'loan_installment',
      sourceId: installment.id,
      personName: parsed.personName,
      description: parsed.detail,
      origin: installment.card.name,
      amount: installment.amount.toString(),
      installmentLabel: `${installment.installmentNumber}/${installment.purchase.installments}`,
      originMonth: origin,
      originLabel: formatMonthDisplay(parseStatementMonth(origin)),
      carried,
      markedUnpaid: flagged,
    })
  }

  for (const installment of receivableInstallments) {
    const origin = monthKey(installment.dueDate)
    const flagged = flagByKey.has(`receivable_installment:${installment.id}`)
    const carried = origin < statementMonth
    if (carried && !flagged) continue
    if (origin > statementMonth) continue

    const remaining = new DecimalJS(installment.amount.toString()).minus(installment.paidAmount.toString())
    if (remaining.lessThanOrEqualTo(0)) continue

    charges.push({
      sourceType: 'receivable_installment',
      sourceId: installment.id,
      personName: installment.receivable.personName,
      description: installment.receivable.description,
      origin: installment.receivable.category || 'A Receber',
      amount: remaining.toString(),
      installmentLabel: `${installment.installmentNumber}/${installment.receivable.installments}`,
      originMonth: origin,
      originLabel: formatMonthDisplay(parseStatementMonth(origin)),
      carried,
      markedUnpaid: flagged,
    })
  }

  return charges.sort((a, b) => a.personName.localeCompare(b.personName, 'pt-BR') || a.description.localeCompare(b.description, 'pt-BR'))
}

export async function toggleUnpaidCharge(input: {
  sourceType: ChargeSourceType
  sourceId: string
  statementMonth: string
}) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  if (input.sourceType === 'loan_installment') {
    const installment = await prisma.cardInstallment.findFirst({
      where: { id: input.sourceId, userId: session.userId },
    })
    if (!installment) throw new Error('Parcela não encontrada')
  } else {
    const installment = await prisma.receivableInstallment.findFirst({
      where: { id: input.sourceId, userId: session.userId },
    })
    if (!installment) throw new Error('Parcela não encontrada')
  }

  const existing = await prisma.unpaidCharge.findUnique({
    where: {
      userId_sourceType_sourceId: {
        userId: session.userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    },
  })

  if (existing) {
    await prisma.unpaidCharge.delete({ where: { id: existing.id } })
  } else {
    await prisma.unpaidCharge.create({
      data: {
        userId: session.userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        statementMonth: parseStatementMonth(input.statementMonth),
      },
    })
  }

  revalidatePath('/')
}
