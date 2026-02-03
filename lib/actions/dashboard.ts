'use server'

import { prisma } from '@/lib/db'
import { verifySession } from '@/lib/auth'
import { parseStatementMonth, getClosingDate, getDueDate, formatStatementMonth, getCurrentStatementMonthForCard } from '@/lib/utils'
import DecimalJS from 'decimal.js'

export interface CardSummary {
  id: string
  name: string
  statementTotal: string
  paidTotal: string
  openTotal: string
  closingDate: Date
  dueDate: Date
}

export interface DashboardData {
  totalCreditSpending: string
  totalPaidTowardsCards: string
  totalOpenOnCards: string
  totalDebitSpending: string
  totalIncome: string
  balance: string
  cards: CardSummary[]
  recentActivity: ActivityItem[]
  // Loans data (only if enabled)
  loansEnabled: boolean
  loansSummary?: LoanBorrowerSummary[]
  totalLoaned?: string
  totalLoansPaid?: string
  totalLoansOwed?: string
  totalLoansThisMonth?: string  // Total de parcelas de empréstimos DESTE MÊS
}

export interface LoanBorrowerSummary {
  borrowerName: string
  monthAmount: string  // Valor das parcelas DESTE MÊS
  totalOwed: string    // Total ainda devido (todas as parcelas futuras)
  loanCount: number
  // Detalhes por cartão
  cardDetails?: LoanCardDetail[]
}

export interface LoanCardDetail {
  cardId: string
  cardName: string
  loanDescription: string
  totalAmount: string
  remainingAmount: string
  currentInstallment: number
  totalInstallments: number
  monthAmount: string
}

export interface ActivityItem {
  id: string
  type: 'purchase' | 'payment' | 'debit' | 'income'
  description: string
  amount: string
  date: Date
  cardName?: string
}

export async function getDashboardData(statementMonth: string): Promise<DashboardData> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const monthDate = parseStatementMonth(statementMonth)
  const nextMonth = new Date(monthDate)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  // Get all user's cards
  const cards = await prisma.card.findMany({
    where: { userId: session.userId },
  })

  // Calculate summaries for each card
  const cardSummaries: CardSummary[] = []
  let totalCreditSpending = new DecimalJS(0)
  let totalPaidTowardsCards = new DecimalJS(0)

  for (const card of cards) {
    // Get statement total for card
    const installmentsAgg = await prisma.cardInstallment.aggregate({
      where: {
        cardId: card.id,
        userId: session.userId,
        statementMonth: monthDate,
      },
      _sum: { amount: true },
    })

    // Get payments total for card
    const paymentsAgg = await prisma.cardPayment.aggregate({
      where: {
        cardId: card.id,
        userId: session.userId,
        statementMonth: monthDate,
      },
      _sum: { amount: true },
    })

    const statementTotal = new DecimalJS(installmentsAgg._sum.amount?.toString() || '0')
    const paidTotal = new DecimalJS(paymentsAgg._sum.amount?.toString() || '0')
    const openTotal = DecimalJS.max(statementTotal.minus(paidTotal), 0)

    totalCreditSpending = totalCreditSpending.plus(statementTotal)
    totalPaidTowardsCards = totalPaidTowardsCards.plus(paidTotal)

    cardSummaries.push({
      id: card.id,
      name: card.name,
      statementTotal: statementTotal.toString(),
      paidTotal: paidTotal.toString(),
      openTotal: openTotal.toString(),
      closingDate: getClosingDate(monthDate, card.closingDay),
      dueDate: getDueDate(monthDate, card.closingDay, card.dueDay),
    })
  }

  const totalOpenOnCards = DecimalJS.max(totalCreditSpending.minus(totalPaidTowardsCards), 0)

  // Get debit total
  const debitAgg = await prisma.debitTransaction.aggregate({
    where: {
      userId: session.userId,
      date: {
        gte: monthDate,
        lt: nextMonth,
      },
    },
    _sum: { amount: true },
  })
  const totalDebitSpending = new DecimalJS(debitAgg._sum.amount?.toString() || '0')

  // Get income total
  const incomeAgg = await prisma.incomeTransaction.aggregate({
    where: {
      userId: session.userId,
      date: {
        gte: monthDate,
        lt: nextMonth,
      },
    },
    _sum: { amount: true },
  })
  const totalIncome = new DecimalJS(incomeAgg._sum.amount?.toString() || '0')

  // Calculate balance: income - debit spending - card payments (not card purchases!)
  // Card purchases are credit, only affects balance when you actually pay the bill
  const balance = totalIncome.minus(totalDebitSpending).minus(totalPaidTowardsCards)

  // Get recent activity (last 10 items)
  const recentActivity = await getRecentActivity(session.userId, 10)

  // Check if loans are enabled
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId: session.userId },
  })
  const loansEnabled = userSettings?.enableLoans ?? false

  // Get loans data if enabled
  let loansSummary: LoanBorrowerSummary[] = []
  let totalLoaned = new DecimalJS(0)
  let totalLoansPaid = new DecimalJS(0)
  let totalLoansOwed = new DecimalJS(0)
  let totalLoansThisMonth = new DecimalJS(0)

  if (loansEnabled) {
    const allLoans = await prisma.cardLoan.findMany({
      where: {
        userId: session.userId,
        status: { not: 'paid' },
      },
      include: {
        card: { select: { id: true, name: true } },
      },
    })

    // Get loan-related installments for this month
    // First, get all purchases that are loans (description starts with [Empréstimo])
    const loanPurchases = await prisma.cardPurchase.findMany({
      where: {
        userId: session.userId,
        description: { startsWith: '[Empréstimo]' },
      },
      select: { id: true, description: true, installments: true, cardId: true },
    })

    // Get installments for this month from loan purchases
    const loanPurchaseIds = loanPurchases.map(p => p.id)
    const monthInstallments = await prisma.cardInstallment.findMany({
      where: {
        userId: session.userId,
        purchaseId: { in: loanPurchaseIds },
        statementMonth: monthDate,
      },
      include: { 
        purchase: true,
        card: { select: { id: true, name: true } },
      },
    })

    // Calculate month amounts by borrower name (extracted from description)
    const monthByBorrower: Record<string, DecimalJS> = {}
    // Track details by borrower and card
    const detailsByBorrower: Record<string, LoanCardDetail[]> = {}
    
    for (const inst of monthInstallments) {
      // Extract borrower name from description: "[Empréstimo] Nome: descrição"
      const match = inst.purchase.description.match(/\[Empréstimo\] ([^:]+):(.*)/)
      if (match) {
        const name = match[1].trim()
        const loanDesc = match[2]?.trim() || ''
        
        if (!monthByBorrower[name]) {
          monthByBorrower[name] = new DecimalJS(0)
          detailsByBorrower[name] = []
        }
        monthByBorrower[name] = monthByBorrower[name].plus(new DecimalJS(inst.amount.toString()))
        
        // Find corresponding loan for remaining amount
        const correspondingLoan = allLoans.find(l => 
          l.borrowerName === name && 
          l.cardId === inst.cardId &&
          l.description.toLowerCase().includes(loanDesc.toLowerCase().substring(0, 10))
        )
        
        // Check if we already have this card+description combo
        const existingDetail = detailsByBorrower[name].find(d => 
          d.cardId === inst.card.id && 
          d.loanDescription === loanDesc
        )
        
        if (!existingDetail) {
          detailsByBorrower[name].push({
            cardId: inst.card.id,
            cardName: inst.card.name,
            loanDescription: loanDesc,
            totalAmount: inst.purchase.amountTotal.toString(),
            remainingAmount: correspondingLoan 
              ? new DecimalJS(correspondingLoan.amount.toString()).minus(correspondingLoan.paidAmount.toString()).toString()
              : '0',
            currentInstallment: inst.installmentNumber,
            totalInstallments: inst.purchase.installments,
            monthAmount: inst.amount.toString(),
          })
        }
      }
      // Sum all month installments for totalLoansThisMonth
      totalLoansThisMonth = totalLoansThisMonth.plus(new DecimalJS(inst.amount.toString()))
    }

    // Calculate totals from loans
    const byBorrower: Record<string, { total: DecimalJS, paid: DecimalJS, count: number }> = {}
    
    for (const loan of allLoans) {
      const amount = new DecimalJS(loan.amount.toString())
      const paid = new DecimalJS(loan.paidAmount.toString())
      
      totalLoaned = totalLoaned.plus(amount)
      totalLoansPaid = totalLoansPaid.plus(paid)
      
      const name = loan.borrowerName
      if (!byBorrower[name]) {
        byBorrower[name] = { total: new DecimalJS(0), paid: new DecimalJS(0), count: 0 }
      }
      byBorrower[name].total = byBorrower[name].total.plus(amount)
      byBorrower[name].paid = byBorrower[name].paid.plus(paid)
      byBorrower[name].count++
    }

    totalLoansOwed = totalLoaned.minus(totalLoansPaid)

    loansSummary = Object.entries(byBorrower).map(([name, data]) => ({
      borrowerName: name,
      monthAmount: (monthByBorrower[name] || new DecimalJS(0)).toString(),
      totalOwed: data.total.minus(data.paid).toString(),
      loanCount: data.count,
      cardDetails: detailsByBorrower[name] || [],
    })).filter(b => Number(b.monthAmount) > 0 || Number(b.totalOwed) > 0)
      .sort((a, b) => Number(b.monthAmount) - Number(a.monthAmount))
  }

  return {
    totalCreditSpending: totalCreditSpending.toString(),
    totalPaidTowardsCards: totalPaidTowardsCards.toString(),
    totalOpenOnCards: totalOpenOnCards.toString(),
    totalDebitSpending: totalDebitSpending.toString(),
    totalIncome: totalIncome.toString(),
    balance: balance.toString(),
    cards: cardSummaries,
    recentActivity,
    loansEnabled,
    loansSummary: loansEnabled ? loansSummary : undefined,
    totalLoaned: loansEnabled ? totalLoaned.toString() : undefined,
    totalLoansPaid: loansEnabled ? totalLoansPaid.toString() : undefined,
    totalLoansOwed: loansEnabled ? totalLoansOwed.toString() : undefined,
    totalLoansThisMonth: loansEnabled ? totalLoansThisMonth.toString() : undefined,
  }
}

async function getRecentActivity(userId: string, limit: number): Promise<ActivityItem[]> {
  // Get recent purchases
  const purchases = await prisma.cardPurchase.findMany({
    where: { userId },
    include: { card: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // Get recent payments
  const payments = await prisma.cardPayment.findMany({
    where: { userId },
    include: { card: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // Get recent debit transactions
  const debits = await prisma.debitTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // Get recent income transactions
  const incomes = await prisma.incomeTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // Combine and sort
  const activities: ActivityItem[] = [
    ...purchases.map(p => ({
      id: p.id,
      type: 'purchase' as const,
      description: p.description,
      amount: p.amountTotal.toString(),
      date: p.createdAt,
      cardName: p.card.name,
    })),
    ...payments.map(p => ({
      id: p.id,
      type: 'payment' as const,
      description: `Pagamento - ${p.method}`,
      amount: p.amount.toString(),
      date: p.createdAt,
      cardName: p.card.name,
    })),
    ...debits.map(d => ({
      id: d.id,
      type: 'debit' as const,
      description: d.description,
      amount: d.amount.toString(),
      date: d.createdAt,
    })),
    ...incomes.map(i => ({
      id: i.id,
      type: 'income' as const,
      description: i.description,
      amount: i.amount.toString(),
      date: i.createdAt,
    })),
  ]

  // Sort by date desc and take limit
  return activities
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, limit)
}

// Interface for detailed month data (for spreadsheet)
export interface MonthDetailRow {
  date: string
  type: 'Cartão de Crédito' | 'Débito' | 'Receita' | 'Pagamento Cartão'
  description: string
  category: string
  amount: number
  cardName?: string
}

export interface MonthDetailData {
  rows: MonthDetailRow[]
  summary: {
    totalIncome: number
    totalDebit: number
    totalCredit: number
    totalPayments: number
    balance: number
  }
}

export async function getMonthDetailData(statementMonth: string): Promise<MonthDetailData> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const monthDate = parseStatementMonth(statementMonth)
  const nextMonth = new Date(monthDate)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  const rows: MonthDetailRow[] = []

  // Get all installments for this month (credit card spending)
  const installments = await prisma.cardInstallment.findMany({
    where: {
      userId: session.userId,
      statementMonth: monthDate,
    },
    include: {
      purchase: true,
      card: true,
    },
    orderBy: { purchase: { purchaseDate: 'asc' } },
  })

  for (const inst of installments) {
    rows.push({
      date: inst.purchase.purchaseDate.toISOString().split('T')[0],
      type: 'Cartão de Crédito',
      description: inst.purchase.installments > 1 
        ? `${inst.purchase.description} (${inst.installmentNumber}/${inst.purchase.installments})`
        : inst.purchase.description,
      category: inst.card.name,
      amount: -Number(inst.amount),
      cardName: inst.card.name,
    })
  }

  // Get debit transactions
  const debits = await prisma.debitTransaction.findMany({
    where: {
      userId: session.userId,
      date: {
        gte: monthDate,
        lt: nextMonth,
      },
    },
    orderBy: { date: 'asc' },
  })

  for (const debit of debits) {
    rows.push({
      date: debit.date.toISOString().split('T')[0],
      type: 'Débito',
      description: debit.description,
      category: 'Débito',
      amount: -Number(debit.amount),
    })
  }

  // Get income transactions
  const incomes = await prisma.incomeTransaction.findMany({
    where: {
      userId: session.userId,
      date: {
        gte: monthDate,
        lt: nextMonth,
      },
    },
    orderBy: { date: 'asc' },
  })

  for (const income of incomes) {
    rows.push({
      date: income.date.toISOString().split('T')[0],
      type: 'Receita',
      description: income.description,
      category: 'Receita',
      amount: Number(income.amount),
    })
  }

  // Get card payments
  const payments = await prisma.cardPayment.findMany({
    where: {
      userId: session.userId,
      statementMonth: monthDate,
    },
    include: { card: true },
    orderBy: { paymentDate: 'asc' },
  })

  for (const payment of payments) {
    rows.push({
      date: payment.paymentDate.toISOString().split('T')[0],
      type: 'Pagamento Cartão',
      description: `Pagamento ${payment.card.name} - ${payment.method}`,
      category: payment.card.name,
      amount: Number(payment.amount), // Positive because it's paying off debt
      cardName: payment.card.name,
    })
  }

  // Sort all rows by date
  rows.sort((a, b) => a.date.localeCompare(b.date))

  // Calculate summary
  const totalIncome = rows
    .filter(r => r.type === 'Receita')
    .reduce((sum, r) => sum + r.amount, 0)

  const totalDebit = rows
    .filter(r => r.type === 'Débito')
    .reduce((sum, r) => sum + Math.abs(r.amount), 0)

  const totalCredit = rows
    .filter(r => r.type === 'Cartão de Crédito')
    .reduce((sum, r) => sum + Math.abs(r.amount), 0)

  const totalPayments = rows
    .filter(r => r.type === 'Pagamento Cartão')
    .reduce((sum, r) => sum + r.amount, 0)

  const balance = totalIncome - totalDebit - totalCredit

  return {
    rows,
    summary: {
      totalIncome,
      totalDebit,
      totalCredit,
      totalPayments,
      balance,
    },
  }
}

/**
 * Get the recommended statement month for the dashboard
 * Based on the user's cards closing days - uses the most common closing day
 * or falls back to day 15 if no cards
 */
export async function getRecommendedStatementMonth(): Promise<string> {
  const session = await verifySession()
  if (!session) {
    // Fallback to current month
    return formatStatementMonth(new Date())
  }

  const cards = await prisma.card.findMany({
    where: { userId: session.userId },
    select: { closingDay: true },
  })

  if (cards.length === 0) {
    // No cards, use current month
    return formatStatementMonth(new Date())
  }

  // Use the closing day of the first card (or average/most common if you prefer)
  const closingDay = cards[0].closingDay
  const statementMonth = getCurrentStatementMonthForCard(closingDay)
  
  return formatStatementMonth(statementMonth)
}

export interface LoanExportRow {
  pessoa: string
  descricao: string
  cartao: string
  valorTotal: string
  valorRestante: string
  parcelaAtual: string
  totalParcelas: string
  valorParcela: string
  status: string
}

export interface LoanExportData {
  borrowerName: string
  statementMonth: string
  generatedAt: string
  rows: LoanExportRow[]
  totals: {
    totalGeral: string
    totalRestante: string
    totalMes: string
  }
}

/**
 * Exporta dados de empréstimos de UMA PESSOA específica
 * Retorna dados estruturados para geração de PDF
 */
export async function exportLoansByBorrower(borrowerName: string, statementMonth: string): Promise<LoanExportData> {
  const session = await verifySession()
  if (!session) throw new Error('Não autorizado')

  const monthDate = parseStatementMonth(statementMonth)

  // Buscar todos os empréstimos desta pessoa (todos os cartões)
  const loans = await prisma.cardLoan.findMany({
    where: {
      userId: session.userId,
      borrowerName: borrowerName,
      status: { not: 'paid' },
    },
    include: {
      card: { select: { name: true } },
    },
    orderBy: { loanDate: 'desc' },
  })

  // Buscar compras de empréstimo desta pessoa
  const loanPurchases = await prisma.cardPurchase.findMany({
    where: {
      userId: session.userId,
      description: { contains: borrowerName },
    },
    include: {
      card: { select: { name: true } },
      cardInstallments: {
        where: { statementMonth: monthDate },
      },
    },
  })

  // Montar linhas do CSV
  const rows: LoanExportRow[] = []
  let totalGeral = new DecimalJS(0)
  let totalRestante = new DecimalJS(0)
  let totalMes = new DecimalJS(0)

  for (const loan of loans) {
    // Encontrar a compra correspondente para pegar info de parcelas
    const matchingPurchase = loanPurchases.find(p => 
      p.cardId === loan.cardId &&
      p.description.includes(loan.borrowerName) &&
      p.description.toLowerCase().includes(loan.description.toLowerCase().substring(0, 10))
    )

    const currentInstallment = matchingPurchase?.cardInstallments[0]
    const totalInstallments = matchingPurchase?.installments || 1
    const installmentNumber = currentInstallment?.installmentNumber || '-'
    
    const valorTotal = new DecimalJS(loan.amount.toString())
    const valorPago = new DecimalJS(loan.paidAmount.toString())
    const valorRestante = valorTotal.minus(valorPago)
    const valorParcela = currentInstallment ? new DecimalJS(currentInstallment.amount.toString()) : new DecimalJS(0)

    totalGeral = totalGeral.plus(valorTotal)
    totalRestante = totalRestante.plus(valorRestante)
    if (currentInstallment) {
      totalMes = totalMes.plus(valorParcela)
    }

    rows.push({
      pessoa: loan.borrowerName,
      descricao: loan.description,
      cartao: loan.card.name,
      valorTotal: valorTotal.toFixed(2),
      valorRestante: valorRestante.toFixed(2),
      parcelaAtual: String(installmentNumber),
      totalParcelas: String(totalInstallments),
      valorParcela: currentInstallment ? valorParcela.toFixed(2) : '-',
      status: loan.status === 'pending' ? 'Pendente' : loan.status === 'partial' ? 'Parcial' : 'Pago',
    })
  }

  // Gerar dados estruturados para PDF
  return {
    borrowerName,
    statementMonth,
    generatedAt: new Date().toLocaleDateString('pt-BR'),
    rows,
    totals: {
      totalGeral: totalGeral.toFixed(2),
      totalRestante: totalRestante.toFixed(2),
      totalMes: totalMes.toFixed(2),
    }
  }
}
