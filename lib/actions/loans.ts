'use server'

import { prisma } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { Decimal } from '@prisma/client/runtime/library'
import DecimalJS from 'decimal.js'
import { getStatementMonthForPurchase, splitIntoInstallments, addMonths, parseLocalDate } from '@/lib/utils'
import {
  sanitizeString,
  sanitizeDescription,
  sanitizeMoneyValue,
  validateUUID,
  validateDate,
  validateMoneyValue,
  secureLog
} from '@/lib/security'

export interface LoanData {
  id: string
  cardId: string
  borrowerName: string
  description: string
  amount: string
  loanDate: Date
  paidAmount: string
  paidAt: Date | null
  status: 'pending' | 'partial' | 'paid'
  remainingAmount: string
  createdAt: Date
}

export interface CreateLoanInput {
  cardId: string
  borrowerName: string
  description: string
  amount: string
  loanDate: string
  installments: number
}

export async function createLoan(data: CreateLoanInput) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  // Validar UUID do cartão
  const cardIdValidation = validateUUID(data.cardId)
  if (!cardIdValidation.valid) {
    throw new Error('Cartão inválido')
  }

  // Sanitizar inputs
  const borrowerName = sanitizeString(data.borrowerName).slice(0, 100)
  const description = sanitizeDescription(data.description)
  const amountStr = sanitizeMoneyValue(data.amount)

  // Validações
  if (!borrowerName || borrowerName.length < 2) {
    throw new Error('Nome deve ter pelo menos 2 caracteres')
  }

  if (!description || description.length < 2) {
    throw new Error('Descrição deve ter pelo menos 2 caracteres')
  }

  const amountValidation = validateMoneyValue(amountStr)
  if (!amountValidation.valid) {
    throw new Error(amountValidation.error)
  }

  const dateValidation = validateDate(data.loanDate)
  if (!dateValidation.valid) {
    throw new Error(dateValidation.error)
  }

  const installments = data.installments || 1
  if (installments < 1 || installments > 48) {
    throw new Error('Número de parcelas deve ser entre 1 e 48')
  }

  // Validate card belongs to user
  const card = await prisma.card.findFirst({
    where: { id: data.cardId, userId: session.userId },
  })

  if (!card) {
    secureLog('warn', {
      action: 'loan_card_not_found',
      userId: session.userId,
      details: { cardId: data.cardId }
    })
    throw new Error('Cartão não encontrado')
  }

  const amount = new DecimalJS(amountStr)
  const loanDate = parseLocalDate(data.loanDate)
  const baseStatementMonth = getStatementMonthForPurchase(loanDate, card.closingDay)

  // Split amount into installments
  const installmentAmounts = splitIntoInstallments(amount, installments)

  // Create loan, purchase and installments in a transaction

  // Create loan, purchase and installments in a transaction
  const loan = await prisma.$transaction(async (tx: any) => {
    // Create loan record
    const newLoan = await tx.cardLoan.create({
      data: {
        userId: session.userId,
        cardId: data.cardId,
        borrowerName: data.borrowerName,
        description: data.description,
        amount: new Decimal(data.amount),
        loanDate,
        status: 'pending',
      },
    })

    // Create a purchase so it appears on the card statement
    const purchase = await tx.cardPurchase.create({
      data: {
        userId: session.userId,
        cardId: data.cardId,
        description: `[Empréstimo] ${data.borrowerName}: ${data.description}`,
        amountTotal: new Decimal(data.amount),
        purchaseDate: loanDate,
        installments,
      },
    })

    // Create installments
    for (let i = 0; i < installments; i++) {
      const statementMonth = addMonths(baseStatementMonth, i)
      
      await tx.cardInstallment.create({
        data: {
          userId: session.userId,
          cardId: data.cardId,
          purchaseId: purchase.id,
          installmentNumber: i + 1,
          amount: new Decimal(installmentAmounts[i].toString()),
          statementMonth,
          status: 'open',
        },
      })
    }

    return newLoan
  })

  revalidatePath(`/cards/${data.cardId}`)
  revalidatePath('/')
  return loan
}

export async function getLoansForCard(cardId: string): Promise<LoanData[]> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const loans = await prisma.cardLoan.findMany({
    where: {
      cardId,
      userId: session.userId,
    },
    orderBy: [
      { status: 'asc' }, // pending first
      { loanDate: 'desc' },
    ],
  })

  return loans.map(loan => {
    const amount = new DecimalJS(loan.amount.toString())
    const paidAmount = new DecimalJS(loan.paidAmount.toString())
    const remainingAmount = amount.minus(paidAmount)
    
    return {
      id: loan.id,
      cardId: loan.cardId,
      borrowerName: loan.borrowerName,
      description: loan.description,
      amount: loan.amount.toString(),
      loanDate: loan.loanDate,
      paidAmount: loan.paidAmount.toString(),
      paidAt: loan.paidAt,
      status: loan.status as 'pending' | 'partial' | 'paid',
      remainingAmount: remainingAmount.toString(),
      createdAt: loan.createdAt,
    }
  })
}

// Get unique borrower names for autocomplete - from ALL user's cards
export async function getBorrowerNames(cardId?: string): Promise<string[]> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  // Busca nomes de TODOS os cartões do usuário para compartilhar pessoas
  const loans = await prisma.cardLoan.findMany({
    where: {
      userId: session.userId,
    },
    select: {
      borrowerName: true,
    },
    distinct: ['borrowerName'],
    orderBy: {
      borrowerName: 'asc',
    },
  })

  return loans.map(l => l.borrowerName)
}

export async function getLoansSummaryByBorrower(cardId: string) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const loans = await prisma.cardLoan.findMany({
    where: {
      cardId,
      userId: session.userId,
      status: { not: 'paid' },
    },
  })

  // Group by borrower
  const byBorrower: Record<string, { total: DecimalJS, paid: DecimalJS, count: number }> = {}
  
  for (const loan of loans) {
    const name = loan.borrowerName
    if (!byBorrower[name]) {
      byBorrower[name] = { total: new DecimalJS(0), paid: new DecimalJS(0), count: 0 }
    }
    byBorrower[name].total = byBorrower[name].total.plus(loan.amount.toString())
    byBorrower[name].paid = byBorrower[name].paid.plus(loan.paidAmount.toString())
    byBorrower[name].count++
  }

  return Object.entries(byBorrower).map(([name, data]) => ({
    borrowerName: name,
    totalOwed: data.total.minus(data.paid).toString(),
    totalLoaned: data.total.toString(),
    totalPaid: data.paid.toString(),
    loanCount: data.count,
  }))
}

export interface RegisterLoanPaymentInput {
  loanId: string
  amount: string
}

export async function registerLoanPayment(data: RegisterLoanPaymentInput) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const loan = await prisma.cardLoan.findFirst({
    where: { id: data.loanId, userId: session.userId },
  })

  if (!loan) throw new Error('Empréstimo não encontrado')

  const paymentAmount = new DecimalJS(data.amount)
  const currentPaid = new DecimalJS(loan.paidAmount.toString())
  const totalAmount = new DecimalJS(loan.amount.toString())
  const remaining = totalAmount.minus(currentPaid)

  if (paymentAmount.lessThanOrEqualTo(0)) {
    throw new Error('Valor deve ser maior que zero')
  }

  if (paymentAmount.greaterThan(remaining)) {
    throw new Error(`Valor excede o restante (R$ ${remaining.toFixed(2).replace('.', ',')})`)
  }

  const newPaidAmount = currentPaid.plus(paymentAmount)
  const isFullyPaid = newPaidAmount.greaterThanOrEqualTo(totalAmount)

  await prisma.cardLoan.update({
    where: { id: data.loanId },
    data: {
      paidAmount: new Decimal(newPaidAmount.toString()),
      status: isFullyPaid ? 'paid' : 'partial',
      paidAt: isFullyPaid ? new Date() : null,
    },
  })

  revalidatePath(`/cards/${loan.cardId}`)
}

export async function deleteLoan(loanId: string) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const loan = await prisma.cardLoan.findFirst({
    where: { id: loanId, userId: session.userId },
  })

  if (!loan) throw new Error('Empréstimo não encontrado')

  await prisma.cardLoan.delete({ where: { id: loanId } })

  revalidatePath(`/cards/${loan.cardId}`)
}
