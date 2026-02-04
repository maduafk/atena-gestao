'use server'

import { prisma } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { Decimal } from '@prisma/client/runtime/library'
import { parseLocalDate } from '@/lib/utils'
import DecimalJS from 'decimal.js'

export interface ReceivableData {
  id: string
  personName: string
  description: string
  category: string
  amountTotal: string
  dueDate: Date
  installments: number
  paidAmount: string
  paidAt: Date | null
  status: string
  createdAt: Date
  installmentsList: ReceivableInstallmentData[]
}

export interface ReceivableInstallmentData {
  id: string
  installmentNumber: number
  amount: string
  dueDate: Date
  paidAmount: string
  paidAt: Date | null
  status: string
}

// Buscar todos os recebíveis do usuário
export async function getReceivables(): Promise<ReceivableData[]> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const receivables = await prisma.receivable.findMany({
    where: { userId: session.userId },
    include: {
      installmentsList: {
        orderBy: { installmentNumber: 'asc' },
      },
    },
    orderBy: [
      { status: 'asc' }, // pending primeiro
      { dueDate: 'asc' },
    ],
  })

  return receivables.map(r => ({
    id: r.id,
    personName: r.personName,
    description: r.description,
    category: r.category,
    amountTotal: r.amountTotal.toString(),
    dueDate: r.dueDate,
    installments: r.installments,
    paidAmount: r.paidAmount.toString(),
    paidAt: r.paidAt,
    status: r.status,
    createdAt: r.createdAt,
    installmentsList: r.installmentsList.map(inst => ({
      id: inst.id,
      installmentNumber: inst.installmentNumber,
      amount: inst.amount.toString(),
      dueDate: inst.dueDate,
      paidAmount: inst.paidAmount.toString(),
      paidAt: inst.paidAt,
      status: inst.status,
    })),
  }))
}

// Buscar recebíveis agrupados por pessoa
export interface ReceivableSummaryByPerson {
  personName: string
  totalAmount: string
  paidAmount: string
  pendingAmount: string
  receivableCount: number
  nextDueDate: Date | null
}

export async function getReceivablesSummaryByPerson(): Promise<ReceivableSummaryByPerson[]> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const receivables = await prisma.receivable.findMany({
    where: { 
      userId: session.userId,
      status: { not: 'paid' },
    },
    include: {
      installmentsList: {
        where: { status: 'pending' },
        orderBy: { dueDate: 'asc' },
        take: 1,
      },
    },
  })

  // Agrupar por pessoa
  const byPerson: Record<string, {
    totalAmount: DecimalJS
    paidAmount: DecimalJS
    count: number
    nextDueDate: Date | null
  }> = {}

  for (const r of receivables) {
    if (!byPerson[r.personName]) {
      byPerson[r.personName] = {
        totalAmount: new DecimalJS(0),
        paidAmount: new DecimalJS(0),
        count: 0,
        nextDueDate: null,
      }
    }
    
    byPerson[r.personName].totalAmount = byPerson[r.personName].totalAmount.plus(r.amountTotal.toString())
    byPerson[r.personName].paidAmount = byPerson[r.personName].paidAmount.plus(r.paidAmount.toString())
    byPerson[r.personName].count++
    
    // Próximo vencimento
    if (r.installmentsList.length > 0) {
      const instDueDate = r.installmentsList[0].dueDate
      if (!byPerson[r.personName].nextDueDate || instDueDate < byPerson[r.personName].nextDueDate!) {
        byPerson[r.personName].nextDueDate = instDueDate
      }
    }
  }

  return Object.entries(byPerson)
    .map(([personName, data]) => ({
      personName,
      totalAmount: data.totalAmount.toString(),
      paidAmount: data.paidAmount.toString(),
      pendingAmount: data.totalAmount.minus(data.paidAmount).toString(),
      receivableCount: data.count,
      nextDueDate: data.nextDueDate,
    }))
    .sort((a, b) => Number(b.pendingAmount) - Number(a.pendingAmount))
}

// Buscar nomes de pessoas (autocomplete) - combina com empréstimos
export async function getPersonNames(): Promise<string[]> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  // Buscar de receivables
  const receivableNames = await prisma.receivable.findMany({
    where: { userId: session.userId },
    select: { personName: true },
    distinct: ['personName'],
  })

  // Buscar de loans (empréstimos)
  const loanNames = await prisma.cardLoan.findMany({
    where: { userId: session.userId },
    select: { borrowerName: true },
    distinct: ['borrowerName'],
  })

  // Combinar e remover duplicados
  const allNames = new Set([
    ...receivableNames.map(r => r.personName),
    ...loanNames.map(l => l.borrowerName),
  ])

  return Array.from(allNames).sort()
}

// Criar novo recebível
export interface CreateReceivableInput {
  personName: string
  description: string
  category: string
  amountTotal: string
  dueDate: string
  installments: number
}

export async function createReceivable(data: CreateReceivableInput) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  if (!data.personName || !data.description || !data.amountTotal) {
    throw new Error('Pessoa, descrição e valor são obrigatórios')
  }

  const installments = data.installments || 1
  const totalAmount = new DecimalJS(data.amountTotal)
  const installmentAmount = totalAmount.dividedBy(installments).toDecimalPlaces(2)
  const firstDueDate = parseLocalDate(data.dueDate)

  const receivable = await prisma.$transaction(async (tx) => {
    // Criar o recebível
    const created = await tx.receivable.create({
      data: {
        userId: session.userId,
        personName: data.personName.trim(),
        description: data.description.trim(),
        category: data.category || 'Outros',
        amountTotal: new Decimal(data.amountTotal),
        dueDate: firstDueDate,
        installments,
        status: 'pending',
      },
    })

    // Criar as parcelas
    for (let i = 1; i <= installments; i++) {
      const dueDate = new Date(firstDueDate)
      dueDate.setMonth(dueDate.getMonth() + (i - 1))

      // Última parcela pega o resto para evitar problemas de arredondamento
      const amount = i === installments 
        ? totalAmount.minus(installmentAmount.times(installments - 1))
        : installmentAmount

      await tx.receivableInstallment.create({
        data: {
          userId: session.userId,
          receivableId: created.id,
          installmentNumber: i,
          amount: new Decimal(amount.toString()),
          dueDate,
          status: 'pending',
        },
      })
    }

    return created
  })

  revalidatePath('/receivables')
  revalidatePath('/')

  return receivable
}

// Registrar pagamento de parcela
export async function registerReceivablePayment(installmentId: string, amount?: string) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const installment = await prisma.receivableInstallment.findFirst({
    where: { id: installmentId, userId: session.userId },
    include: { receivable: true },
  })

  if (!installment) throw new Error('Parcela não encontrada')

  const paymentAmount = amount 
    ? new DecimalJS(amount) 
    : new DecimalJS(installment.amount.toString()).minus(installment.paidAmount.toString())

  await prisma.$transaction(async (tx) => {
    // Atualizar parcela
    const newPaidAmount = new DecimalJS(installment.paidAmount.toString()).plus(paymentAmount)
    const isPaid = newPaidAmount.greaterThanOrEqualTo(installment.amount.toString())

    await tx.receivableInstallment.update({
      where: { id: installmentId },
      data: {
        paidAmount: new Decimal(newPaidAmount.toString()),
        paidAt: isPaid ? new Date() : null,
        status: isPaid ? 'paid' : 'pending',
      },
    })

    // Atualizar recebível pai
    const totalPaid = new DecimalJS(installment.receivable.paidAmount.toString()).plus(paymentAmount)
    const isFullyPaid = totalPaid.greaterThanOrEqualTo(installment.receivable.amountTotal.toString())

    await tx.receivable.update({
      where: { id: installment.receivableId },
      data: {
        paidAmount: new Decimal(totalPaid.toString()),
        paidAt: isFullyPaid ? new Date() : null,
        status: isFullyPaid ? 'paid' : 'partial',
      },
    })
  })

  revalidatePath('/receivables')
  revalidatePath('/')
}

// Marcar recebível inteiro como pago
export async function markReceivableAsPaid(receivableId: string) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const receivable = await prisma.receivable.findFirst({
    where: { id: receivableId, userId: session.userId },
  })

  if (!receivable) throw new Error('Recebível não encontrado')

  await prisma.$transaction(async (tx) => {
    // Marcar todas as parcelas como pagas
    await tx.receivableInstallment.updateMany({
      where: { receivableId },
      data: {
        paidAmount: prisma.receivableInstallment.fields.amount,
        paidAt: new Date(),
        status: 'paid',
      },
    })

    // Atualizar parcelas individualmente para pegar o amount correto
    const installments = await tx.receivableInstallment.findMany({
      where: { receivableId },
    })
    
    for (const inst of installments) {
      await tx.receivableInstallment.update({
        where: { id: inst.id },
        data: {
          paidAmount: inst.amount,
          paidAt: new Date(),
          status: 'paid',
        },
      })
    }

    // Marcar recebível como pago
    await tx.receivable.update({
      where: { id: receivableId },
      data: {
        paidAmount: receivable.amountTotal,
        paidAt: new Date(),
        status: 'paid',
      },
    })
  })

  revalidatePath('/receivables')
  revalidatePath('/')
}

// Deletar recebível
export async function deleteReceivable(receivableId: string) {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const receivable = await prisma.receivable.findFirst({
    where: { id: receivableId, userId: session.userId },
  })

  if (!receivable) throw new Error('Recebível não encontrado')

  await prisma.receivable.delete({
    where: { id: receivableId },
  })

  revalidatePath('/receivables')
  revalidatePath('/')
}

// Totais para o dashboard
export interface ReceivablesTotals {
  totalAmount: string
  totalPaid: string
  totalPending: string
  thisMonthAmount: string // Parcelas vencendo este mês
  overdueAmount: string // Parcelas vencidas não pagas
}

export async function getReceivablesTotals(statementMonth: string): Promise<ReceivablesTotals> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const [year, month] = statementMonth.split('-').map(Number)
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59)
  const today = new Date()

  // Total geral
  const receivables = await prisma.receivable.findMany({
    where: { 
      userId: session.userId,
      status: { not: 'paid' },
    },
  })

  let totalAmount = new DecimalJS(0)
  let totalPaid = new DecimalJS(0)

  for (const r of receivables) {
    totalAmount = totalAmount.plus(r.amountTotal.toString())
    totalPaid = totalPaid.plus(r.paidAmount.toString())
  }

  // Parcelas deste mês
  const thisMonthInstallments = await prisma.receivableInstallment.findMany({
    where: {
      userId: session.userId,
      status: 'pending',
      dueDate: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
  })

  let thisMonthAmount = new DecimalJS(0)
  for (const inst of thisMonthInstallments) {
    thisMonthAmount = thisMonthAmount.plus(
      new DecimalJS(inst.amount.toString()).minus(inst.paidAmount.toString())
    )
  }

  // Parcelas vencidas
  const overdueInstallments = await prisma.receivableInstallment.findMany({
    where: {
      userId: session.userId,
      status: 'pending',
      dueDate: { lt: today },
    },
  })

  let overdueAmount = new DecimalJS(0)
  for (const inst of overdueInstallments) {
    overdueAmount = overdueAmount.plus(
      new DecimalJS(inst.amount.toString()).minus(inst.paidAmount.toString())
    )
  }

  return {
    totalAmount: totalAmount.toString(),
    totalPaid: totalPaid.toString(),
    totalPending: totalAmount.minus(totalPaid).toString(),
    thisMonthAmount: thisMonthAmount.toString(),
    overdueAmount: overdueAmount.toString(),
  }
}
