import Decimal from 'decimal.js'

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Parse a date string (YYYY-MM-DD) to local Date without timezone issues
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Get the first day of a month as Date
 */
export function getFirstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1)
}

/**
 * Parse a statement month string (YYYY-MM) to Date (first day of month)
 */
export function parseStatementMonth(monthStr: string): Date {
  const [year, month] = monthStr.split('-').map(Number)
  return getFirstDayOfMonth(year, month)
}

/**
 * Format a Date to statement month string (YYYY-MM)
 */
export function formatStatementMonth(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Add months to a date (returns first day of resulting month)
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return new Date(result.getFullYear(), result.getMonth(), 1)
}

/**
 * Determine the statement month for a purchase based on closing day
 * 
 * Statement month = the month when the bill CLOSES
 * 
 * Example: Card closes on day 15
 *   - Purchase on Dec 13 → enters statement that closes Dec 15 → statement = December
 *   - Purchase on Dec 14 or later → enters statement that closes Jan 15 → statement = January
 */
export function getStatementMonthForPurchase(purchaseDate: Date, closingDay: number): Date {
  const purchaseDay = purchaseDate.getDate()
  const purchaseMonth = purchaseDate.getMonth()
  const purchaseYear = purchaseDate.getFullYear()

  // Purchases made on closing day or 1 day before go to the NEXT month's statement
  // (banks need processing time)
  if (purchaseDay >= closingDay - 1) {
    // Goes to next month's statement
    return new Date(purchaseYear, purchaseMonth + 1, 1)
  } else {
    // Goes to this month's statement
    return new Date(purchaseYear, purchaseMonth, 1)
  }
}

/**
 * Get closing date for a statement month
 * Closing is on the closing day of the statement month
 */
export function getClosingDate(statementMonth: Date, closingDay: number): Date {
  return new Date(statementMonth.getFullYear(), statementMonth.getMonth(), closingDay)
}

/**
 * Get due date for a statement month based on closing day and due day
 * Due date is a few days after closing, in the same month or next if dueDay < closingDay
 */
export function getDueDate(statementMonth: Date, closingDay: number, dueDay: number): Date {
  const year = statementMonth.getFullYear()
  const month = statementMonth.getMonth()

  if (dueDay > closingDay) {
    // Due date is in the same month (e.g., closes 15, due 20)
    return new Date(year, month, dueDay)
  } else {
    // Due date is in the next month (e.g., closes 25, due 5)
    return new Date(year, month + 1, dueDay)
  }
}

/**
 * Split an amount into N installments using integer cents to avoid floating point errors
 * Returns array of Decimal amounts that sum exactly to total
 */
export function splitIntoInstallments(totalAmount: Decimal, numInstallments: number): Decimal[] {
  if (numInstallments < 1) {
    throw new Error('Number of installments must be at least 1')
  }

  // Convert to cents (integer)
  const totalCents = totalAmount.mul(100).round().toNumber()
  const baseCents = Math.floor(totalCents / numInstallments)
  const remainder = totalCents - (baseCents * numInstallments)

  const installments: Decimal[] = []
  
  for (let i = 0; i < numInstallments; i++) {
    // Add extra cents to the FIRST installment (like banks do)
    const cents = i === 0 ? baseCents + remainder : baseCents
    installments.push(new Decimal(cents).div(100))
  }

  return installments
}

/**
 * Format currency for display (BRL)
 */
export function formatCurrency(value: number | Decimal | string): string {
  const num = typeof value === 'number' ? value : Number(value)
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num)
}

/**
 * Format date for display (pt-BR)
 */
export function formatDateDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/**
 * Format month for display (e.g., "Janeiro 2026")
 */
export function formatMonthDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(d)
}

/**
 * Get current statement month (first day of current month)
 */
export function getCurrentStatementMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

/**
 * Get the current open statement month for a card based on closing day
 * 
 * If today is after closing day, current open statement closes NEXT month
 * If today is on or before closing day, current open statement closes THIS month
 */
export function getCurrentStatementMonthForCard(closingDay: number): Date {
  const now = new Date()
  const today = now.getDate()
  
  // If we're past the closing day, current statement closes next month
  if (today > closingDay) {
    return new Date(now.getFullYear(), now.getMonth() + 1, 1)
  } else {
    // Current statement closes this month
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
}
