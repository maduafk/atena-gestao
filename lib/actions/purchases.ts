'use server'

import { prisma } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { Decimal } from '@prisma/client/runtime/library'
import { 
  getStatementMonthForPurchase, 
  splitIntoInstallments, 
  addMonths,
  parseStatementMonth,
  parseLocalDate 
} from '@/lib/utils'
import {
  sanitizeDescription,
  sanitizeMoneyValue,
  validateUUID,
  validateDate,
  validateMoneyValue,
  secureLog
} from '@/lib/security'
import DecimalJS from 'decimal.js'

export interface PurchaseData {
  id: string
  cardId: string
  description: string
  amountTotal: string
  purchaseDate: Date
  installments: number
  createdAt: Date
}

export interface CreatePurchaseInput {
  cardId: string
  description: string
  amountTotal: string
  purchaseDate: string
  installments: number
}

export async function createPurchase(data: CreatePurchaseInput) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  // Validar UUID do cartão
  const cardIdValidation = validateUUID(data.cardId)
  if (!cardIdValidation.valid) {
    throw new Error('Cartão inválido')
  }

  // Sanitizar inputs
  const description = sanitizeDescription(data.description)
  const amountStr = sanitizeMoneyValue(data.amountTotal)
  
  // Validar descrição
  if (!description || description.length < 2) {
    throw new Error('Descrição deve ter pelo menos 2 caracteres')
  }

  // Validar valor
  const amountValidation = validateMoneyValue(amountStr)
  if (!amountValidation.valid) {
    throw new Error(amountValidation.error)
  }

  // Validar data
  const dateValidation = validateDate(data.purchaseDate)
  if (!dateValidation.valid) {
    throw new Error(dateValidation.error)
  }

  // Validar parcelas
  if (data.installments < 1 || data.installments > 48) {
    throw new Error('Número de parcelas deve ser entre 1 e 48')
  }

  // Validate card belongs to user
  const card = await prisma.card.findFirst({
    where: { id: data.cardId, userId: session.userId },
  })

  if (!card) {
    secureLog('warn', {
      action: 'purchase_card_not_found',
      userId: session.userId,
      details: { cardId: data.cardId }
    })
    throw new Error('Cartão não encontrado')
  }

  const purchaseDate = parseLocalDate(data.purchaseDate)
  const amountTotal = new DecimalJS(amountStr)
  
  // Validate against card limit
  const cardLimit = new DecimalJS(card.creditLimit.toString())
  if (amountTotal.greaterThan(cardLimit)) {
    throw new Error(`Valor excede o limite do cartão (R$ ${cardLimit.toFixed(2).replace('.', ',')})`)
  }

  // Calculate base statement month and current statement month
  const baseStatementMonth = getStatementMonthForPurchase(purchaseDate, card.closingDay)
  const currentStatementMonth = getStatementMonthForPurchase(new Date(), card.closingDay)
  
  // Split amount into installments
  const installmentAmounts = splitIntoInstallments(amountTotal, data.installments)
  
  // Calculate how much of this purchase will be "open" (future installments only)
  let futureInstallmentsAmount = new DecimalJS(0)
  for (let i = 0; i < data.installments; i++) {
    const statementMonth = addMonths(baseStatementMonth, i)
    // Only count installments from current month onwards
    if (statementMonth >= currentStatementMonth) {
      futureInstallmentsAmount = futureInstallmentsAmount.plus(installmentAmounts[i])
    }
  }

  // Check available limit (limit - open installments)
  const openInstallments = await prisma.cardInstallment.aggregate({
    where: {
      cardId: data.cardId,
      status: 'open',
    },
    _sum: {
      amount: true,
    },
  })
  
  const usedLimit = new DecimalJS(openInstallments._sum.amount?.toString() || '0')
  const availableLimit = cardLimit.minus(usedLimit)
  
  // Only validate against future installments (past ones will be marked as paid)
  if (futureInstallmentsAmount.greaterThan(availableLimit)) {
    throw new Error(`Limite disponível insuficiente. Disponível: R$ ${availableLimit.toFixed(2).replace('.', ',')}`)
  }

  // Create purchase and installments in a transaction
  const purchase = await prisma.$transaction(async (tx) => {
    // Create purchase
    const newPurchase = await tx.cardPurchase.create({
      data: {
        userId: session.userId,
        cardId: data.cardId,
        description: data.description,
        amountTotal: new Decimal(data.amountTotal),
        purchaseDate,
        installments: data.installments,
      },
    })

    // Create installments
    for (let i = 0; i < data.installments; i++) {
      const statementMonth = addMonths(baseStatementMonth, i)
      
      // Parcelas de meses anteriores ao atual são marcadas como pagas automaticamente
      const isPastInstallment = statementMonth < currentStatementMonth
      
      await tx.cardInstallment.create({
        data: {
          userId: session.userId,
          cardId: data.cardId,
          purchaseId: newPurchase.id,
          installmentNumber: i + 1,
          amount: new Decimal(installmentAmounts[i].toString()),
          statementMonth,
          status: isPastInstallment ? 'paid' : 'open',
        },
      })
    }

    return newPurchase
  })

  revalidatePath(`/cards/${data.cardId}`)
  revalidatePath('/')
  
  return purchase
}

export interface InstallmentData {
  id: string
  purchaseId: string
  installmentNumber: number
  amount: string
  statementMonth: Date
  status: 'open' | 'paid'
  description: string
  purchaseDate: Date
  totalInstallments: number
}

export async function getInstallmentsForStatement(
  cardId: string, 
  statementMonth: string
): Promise<InstallmentData[]> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const monthDate = parseStatementMonth(statementMonth)

  const installments = await prisma.cardInstallment.findMany({
    where: {
      cardId,
      userId: session.userId,
      statementMonth: monthDate,
    },
    include: {
      purchase: true,
    },
    orderBy: [
      { installmentNumber: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  return installments.map(inst => ({
    id: inst.id,
    purchaseId: inst.purchaseId,
    installmentNumber: inst.installmentNumber,
    amount: inst.amount.toString(),
    statementMonth: inst.statementMonth,
    status: inst.status,
    description: inst.purchase.description,
    purchaseDate: inst.purchase.purchaseDate,
    totalInstallments: inst.purchase.installments,
  }))
}

export async function deletePurchase(purchaseId: string) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const purchase = await prisma.cardPurchase.findFirst({
    where: { id: purchaseId, userId: session.userId },
  })

  if (!purchase) throw new Error('Compra não encontrada')

  await prisma.cardPurchase.delete({ where: { id: purchaseId } })

  revalidatePath(`/cards/${purchase.cardId}`)
  revalidatePath('/')
}
