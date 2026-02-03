'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import MonthSelector from '@/components/MonthSelector'
import Card, { CardStat } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { getCard, deleteCard, CardData } from '@/lib/actions/cards'
import { createPurchase, getInstallmentsForStatement, deletePurchase, InstallmentData } from '@/lib/actions/purchases'
import { getStatementSummary, createPayment, getPaymentsForStatement, PaymentData, StatementSummary } from '@/lib/actions/payments'
import { createLoan, getLoansForCard, registerLoanPayment, deleteLoan, LoanData, getLoansSummaryByBorrower, getBorrowerNames } from '@/lib/actions/loans'
import { getUserSettings } from '@/lib/actions/settings'
import { getCurrentSession } from '@/lib/actions/auth'
import { formatCurrency, formatDateDisplay, formatStatementMonth, getClosingDate, getDueDate, parseStatementMonth, getCurrentStatementMonthForCard } from '@/lib/utils'

export default function CardDetailPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [card, setCard] = useState<CardData | null>(null)
  const [currentMonth, setCurrentMonth] = useState<string>(searchParams.get('month') || '')
  const [summary, setSummary] = useState<StatementSummary | null>(null)
  const [installments, setInstallments] = useState<InstallmentData[]>([])
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [loading, setLoading] = useState(true)

  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Delete confirmation states
  const [deleteCardModalOpen, setDeleteCardModalOpen] = useState(false)
  const [deletePurchaseModalOpen, setDeletePurchaseModalOpen] = useState(false)
  const [purchaseToDelete, setPurchaseToDelete] = useState<InstallmentData | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Loans states
  const [loansEnabled, setLoansEnabled] = useState(false)
  const [activeTab, setActiveTab] = useState<'fatura' | 'emprestimos'>('fatura')
  const [loans, setLoans] = useState<LoanData[]>([])
  const [borrowersSummary, setBorrowersSummary] = useState<{ borrowerName: string, totalOwed: string, loanCount: number }[]>([])
  const [borrowerNames, setBorrowerNames] = useState<string[]>([])
  const [loanModalOpen, setLoanModalOpen] = useState(false)
  const [loanWarningOpen, setLoanWarningOpen] = useState(false)
  const [loanPaymentModalOpen, setLoanPaymentModalOpen] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState<LoanData | null>(null)
  const [deleteLoanModalOpen, setDeleteLoanModalOpen] = useState(false)
  const [loanToDelete, setLoanToDelete] = useState<LoanData | null>(null)
  const [selectedBorrower, setSelectedBorrower] = useState<string>('')
  const [isAdmin, setIsAdmin] = useState(false)

  const cardId = params.id

  // Load settings to check if loans are enabled
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getUserSettings()
        setLoansEnabled(settings.enableLoans)
      } catch (error) {
        console.error('Error loading settings:', error)
      }
    }
    loadSettings()
    getCurrentSession().then(session => setIsAdmin(session?.isAdmin ?? false))
  }, [])

  // Load card first to get closing day, then determine current statement month
  useEffect(() => {
    const loadCard = async () => {
      const cardData = await getCard(cardId)
      setCard(cardData)
      
      // If no month in URL, calculate current statement month based on card's closing day
      if (!searchParams.get('month') && cardData) {
        const statementMonth = getCurrentStatementMonthForCard(cardData.closingDay)
        setCurrentMonth(formatStatementMonth(statementMonth))
      } else if (searchParams.get('month')) {
        setCurrentMonth(searchParams.get('month')!)
      } else {
        // Fallback to current calendar month
        setCurrentMonth(formatStatementMonth(new Date()))
      }
    }
    loadCard()
  }, [cardId, searchParams])

  const loadData = async () => {
    if (!currentMonth || !card) return
    
    try {
      const basePromises = [
        getStatementSummary(cardId, currentMonth),
        getInstallmentsForStatement(cardId, currentMonth),
        getPaymentsForStatement(cardId, currentMonth),
      ]
      
      const [summaryData, installmentsData, paymentsData] = await Promise.all(basePromises)
      
      setSummary(summaryData as StatementSummary)
      setInstallments(installmentsData as InstallmentData[])
      setPayments(paymentsData as PaymentData[])
      
      // Load loans only if enabled
      if (loansEnabled) {
        const [loansData, borrowersData, names] = await Promise.all([
          getLoansForCard(cardId),
          getLoansSummaryByBorrower(cardId),
          getBorrowerNames(), // Busca de todos os cartões para autocomplete global
        ])
        setLoans(loansData)
        setBorrowersSummary(borrowersData)
        setBorrowerNames(names)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentMonth && card) {
      setLoading(true)
      loadData()
    }
  }, [cardId, currentMonth, card, loansEnabled])

  const handlePurchaseSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      cardId: cardId,
      description: formData.get('description') as string,
      amountTotal: formData.get('amountTotal') as string,
      purchaseDate: formData.get('purchaseDate') as string,
      installments: parseInt(formData.get('installments') as string),
    }

    try {
      await createPurchase(data)
      setPurchaseModalOpen(false)
      loadData()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao registrar compra')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePaymentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      cardId: cardId,
      statementMonth: currentMonth,
      amount: formData.get('amount') as string,
      paymentDate: formData.get('paymentDate') as string,
      method: formData.get('method') as string,
      note: formData.get('note') as string,
    }

    try {
      await createPayment(data)
      setPaymentModalOpen(false)
      loadData()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao registrar pagamento')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLoanSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      cardId: cardId,
      borrowerName: formData.get('borrowerName') as string,
      description: formData.get('description') as string,
      amount: formData.get('amount') as string,
      loanDate: formData.get('loanDate') as string,
      installments: parseInt(formData.get('installments') as string) || 1,
    }

    try {
      await createLoan(data)
      setLoanModalOpen(false)
      setSelectedBorrower('')
      loadData()
      router.refresh()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao registrar empréstimo')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLoanPaymentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedLoan) return
    
    setFormError(null)
    setSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      loanId: selectedLoan.id,
      amount: formData.get('amount') as string,
    }

    try {
      await registerLoanPayment(data)
      setLoanPaymentModalOpen(false)
      setSelectedLoan(null)
      loadData()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao registrar pagamento')
    } finally {
      setSubmitting(false)
    }
  }

  if (!card || !currentMonth || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar isAdmin={isAdmin} />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="h-32 bg-gray-200 rounded" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </main>
      </div>
    )
  }

  const monthDate = parseStatementMonth(currentMonth)
  const closingDate = getClosingDate(monthDate, card.closingDay)
  const dueDate = getDueDate(monthDate, card.closingDay, card.dueDay)
  const openTotal = Number(summary?.openTotal || 0)

  // Format month name in Portuguese
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const displayMonth = `${monthNames[monthDate.getMonth()]} de ${monthDate.getFullYear()}`

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar isAdmin={isAdmin} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link 
              href="/cards" 
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{card.name}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Limite: {formatCurrency(card.creditLimit)}</p>
            </div>
            <button
              onClick={() => setDeleteCardModalOpen(true)}
              className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors ml-2"
              title="Excluir cartão"
            >
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
          <MonthSelector currentMonth={currentMonth} />
        </div>

        {/* Current Month Banner */}
        <div className="bg-primary-600 dark:bg-primary-700 text-white rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-primary-200 text-sm">Visualizando fatura de</p>
            <p className="text-2xl font-bold">{displayMonth}</p>
          </div>
          <div className="text-right">
            <p className="text-primary-200 text-sm">Vencimento</p>
            <p className="text-lg font-semibold">{formatDateDisplay(dueDate)}</p>
          </div>
        </div>

        {/* Summary */}
        <Card className="mb-6">
          {openTotal <= 0 && Number(summary?.paidTotal || 0) > 0 ? (
            // Fatura quitada - layout simplificado
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-green-800 dark:text-green-400 mb-1">Fatura Quitada!</h3>
              <p className="text-gray-600 dark:text-gray-300">Você pagou <span className="font-semibold">{formatCurrency(summary?.paidTotal || '0')}</span> antecipadamente</p>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Total gasto no mês: <span className="font-semibold text-gray-700 dark:text-gray-200">{formatCurrency(summary?.statementTotal || '0')}</span></p>
              <div className="flex justify-center gap-8 mt-4 text-sm text-gray-500 dark:text-gray-400">
                <span>Fechamento: {formatDateDisplay(closingDate)}</span>
                <span>Vencimento: {formatDateDisplay(dueDate)}</span>
              </div>
            </div>
          ) : (
            // Fatura em aberto - layout normal
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <CardStat label="Total da Fatura" value={formatCurrency(summary?.statementTotal || '0')} />
              <CardStat label="Total Pago" value={formatCurrency(summary?.paidTotal || '0')} variant="success" />
              <CardStat 
                label="Em Aberto" 
                value={formatCurrency(summary?.openTotal || '0')} 
                variant={openTotal > 0 ? 'warning' : 'success'} 
              />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Fechamento</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatDateDisplay(closingDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Vencimento</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatDateDisplay(dueDate)}</p>
              </div>
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <Button onClick={() => { setFormError(null); setPurchaseModalOpen(true) }}>
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Compra
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => { setFormError(null); setPaymentModalOpen(true) }}
            disabled={openTotal <= 0}
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Registrar Pagamento
          </Button>
        </div>

        {/* Tabs - only show if loans are enabled */}
        {loansEnabled && (
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('fatura')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'fatura'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Fatura
            </button>
            <button
              onClick={() => setActiveTab('emprestimos')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'emprestimos'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Empréstimos
              {borrowersSummary.length > 0 && (
                <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                  {borrowersSummary.length}
                </span>
              )}
            </button>
          </div>
        )}

        {(!loansEnabled || activeTab === 'fatura') ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Installments */}
          <Card title="Parcelas da Fatura" subtitle={`${installments.length} parcelas`}>
            {installments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhuma parcela neste mês
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Descrição</th>
                      <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">Parcela</th>
                      <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Valor</th>
                      <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400">Status</th>
                      <th className="text-center py-2 font-medium text-gray-500 dark:text-gray-400"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map((inst) => (
                      <tr key={inst.id} className="border-b border-gray-50 dark:border-gray-700 group">
                        <td className="py-2">
                          <p className="font-medium text-gray-900 dark:text-white">{inst.description}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateDisplay(inst.purchaseDate)}</p>
                        </td>
                        <td className="py-2 text-center text-gray-600 dark:text-gray-300">
                          {inst.installmentNumber}/{inst.totalInstallments}
                        </td>
                        <td className="py-2 text-right font-medium dark:text-white">
                          {formatCurrency(inst.amount)}
                        </td>
                        <td className="py-2 text-center">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            inst.status === 'paid' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                          }`}>
                            {inst.status === 'paid' ? 'Pago' : 'Aberto'}
                          </span>
                        </td>
                        <td className="py-2 text-center">
                          <button
                            onClick={() => {
                              setPurchaseToDelete(inst)
                              setDeletePurchaseModalOpen(true)
                            }}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Excluir compra"
                          >
                            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Payments */}
          <Card title="Pagamentos" subtitle={`${payments.length} pagamentos`}>
            {payments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhum pagamento registrado
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-gray-500">
                        {formatDateDisplay(payment.paymentDate)} • {payment.method}
                      </p>
                      {payment.note && (
                        <p className="text-xs text-gray-400 mt-1">{payment.note}</p>
                      )}
                    </div>
                    <div className="text-green-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
        ) : (
        /* Loans Tab */
        <div className="space-y-6">
          {/* Warning Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h4 className="font-semibold text-amber-800">Atenção: Área de Empréstimos</h4>
                <p className="text-sm text-amber-700 mt-1">
                  Emprestar o cartão para outras pessoas é uma prática arriscada. Use esta área apenas para controle, 
                  mas lembre-se que a responsabilidade da fatura é sempre sua.
                </p>
              </div>
            </div>
          </div>

          {/* Borrowers Summary */}
          {borrowersSummary.length > 0 && (
            <Card title="Resumo por Pessoa" subtitle="Valores em aberto">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {borrowersSummary.map((borrower) => (
                  <div key={borrower.borrowerName} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold">
                        {borrower.borrowerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{borrower.borrowerName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{borrower.loanCount} empréstimo(s)</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedBorrower(borrower.borrowerName)
                          setFormError(null)
                          setLoanModalOpen(true)
                        }}
                        className="p-2 hover:bg-primary-100 dark:hover:bg-primary-900/50 rounded-lg transition-colors"
                        title="Emprestar mais para esta pessoa"
                      >
                        <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      Deve: {formatCurrency(borrower.totalOwed)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Add Loan Button */}
          <div className="flex gap-3">
            <Button onClick={() => setLoanWarningOpen(true)}>
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Registrar Empréstimo
            </Button>
          </div>

          {/* Loans List */}
          <Card title="Empréstimos" subtitle={`${loans.length} registros`}>
            {loans.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhum empréstimo registrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 font-medium text-gray-500">Pessoa</th>
                      <th className="text-left py-2 font-medium text-gray-500">Descrição</th>
                      <th className="text-right py-2 font-medium text-gray-500">Valor</th>
                      <th className="text-right py-2 font-medium text-gray-500">Pago</th>
                      <th className="text-right py-2 font-medium text-gray-500">Restante</th>
                      <th className="text-center py-2 font-medium text-gray-500">Status</th>
                      <th className="text-center py-2 font-medium text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map((loan) => (
                      <tr key={loan.id} className="border-b border-gray-50 group">
                        <td className="py-2">
                          <p className="font-medium text-gray-900">{loan.borrowerName}</p>
                          <p className="text-xs text-gray-500">{formatDateDisplay(loan.loanDate)}</p>
                        </td>
                        <td className="py-2 text-gray-600">{loan.description}</td>
                        <td className="py-2 text-right font-medium">{formatCurrency(loan.amount)}</td>
                        <td className="py-2 text-right text-green-600">{formatCurrency(loan.paidAmount)}</td>
                        <td className="py-2 text-right text-orange-600 font-medium">{formatCurrency(loan.remainingAmount)}</td>
                        <td className="py-2 text-center">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            loan.status === 'paid' 
                              ? 'bg-green-100 text-green-800' 
                              : loan.status === 'partial'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {loan.status === 'paid' ? 'Quitado' : loan.status === 'partial' ? 'Parcial' : 'Pendente'}
                          </span>
                        </td>
                        <td className="py-2 text-center">
                          <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {loan.status !== 'paid' && (
                              <button
                                onClick={() => {
                                  setSelectedLoan(loan)
                                  setFormError(null)
                                  setLoanPaymentModalOpen(true)
                                }}
                                className="p-1.5 hover:bg-green-100 rounded-md"
                                title="Registrar pagamento"
                              >
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setLoanToDelete(loan)
                                setDeleteLoanModalOpen(true)
                              }}
                              className="p-1.5 hover:bg-red-100 rounded-md"
                              title="Excluir empréstimo"
                            >
                              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        )}

        {/* Purchase Modal */}
        <Modal
          isOpen={purchaseModalOpen}
          onClose={() => setPurchaseModalOpen(false)}
          title="Nova Compra"
          footer={
            <>
              <Button variant="secondary" onClick={() => setPurchaseModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" form="purchase-form" loading={submitting}>
                Registrar
              </Button>
            </>
          }
        >
          <form id="purchase-form" onSubmit={handlePurchaseSubmit} className="space-y-4">
            <Input
              id="description"
              name="description"
              label="Descrição"
              placeholder="Ex: Mercado, Restaurante..."
              required
            />

            <Input
              id="amountTotal"
              name="amountTotal"
              type="number"
              step="0.01"
              min="0.01"
              label="Valor Total"
              placeholder="0.00"
              required
            />

            <Input
              id="purchaseDate"
              name="purchaseDate"
              type="date"
              label="Data da Compra"
              defaultValue={new Date().toISOString().split('T')[0]}
              required
            />

            <div>
              <label htmlFor="installments" className="block text-sm font-medium text-gray-700 mb-1">
                Parcelas
              </label>
              <select
                id="installments"
                name="installments"
                defaultValue={1}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                required
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}x
                  </option>
                ))}
              </select>
            </div>

            {formError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                {formError}
              </div>
            )}
          </form>
        </Modal>

        {/* Payment Modal */}
        <Modal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          title="Registrar Pagamento"
          footer={
            <>
              <Button variant="secondary" onClick={() => setPaymentModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" form="payment-form" loading={submitting}>
                Registrar
              </Button>
            </>
          }
        >
          <form id="payment-form" onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <p className="text-sm text-gray-500">Valor em aberto</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(summary?.openTotal || '0')}</p>
            </div>

            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={summary?.openTotal || '0'}
              label="Valor do Pagamento"
              placeholder="0.00"
              defaultValue={summary?.openTotal || ''}
              required
            />

            <Input
              id="paymentDate"
              name="paymentDate"
              type="date"
              label="Data do Pagamento"
              defaultValue={new Date().toISOString().split('T')[0]}
              required
            />

            <div>
              <label htmlFor="method" className="block text-sm font-medium text-gray-700 mb-1">
                Método
              </label>
              <select
                id="method"
                name="method"
                defaultValue="pix"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="debito">Débito em Conta</option>
                <option value="other">Outro</option>
              </select>
            </div>

            <Input
              id="note"
              name="note"
              label="Observação"
              placeholder="Opcional"
            />

            {formError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                {formError}
              </div>
            )}
          </form>
        </Modal>

        {/* Delete Card Confirmation Modal */}
        <ConfirmModal
          isOpen={deleteCardModalOpen}
          onClose={() => setDeleteCardModalOpen(false)}
          onConfirm={async () => {
            setDeleting(true)
            try {
              await deleteCard(card.id)
              router.push('/cards')
            } catch (error) {
              alert(error instanceof Error ? error.message : 'Erro ao excluir cartão')
              setDeleting(false)
              setDeleteCardModalOpen(false)
            }
          }}
          title="Excluir Cartão"
          message={`Tem certeza que deseja excluir o cartão "${card.name}"?\n\nIsso irá apagar PERMANENTEMENTE:\n• Todas as compras\n• Todas as parcelas\n• Todos os pagamentos\n\nEssa ação NÃO pode ser desfeita!`}
          confirmText="Excluir Cartão"
          variant="danger"
          loading={deleting}
        />

        {/* Delete Purchase Confirmation Modal */}
        <ConfirmModal
          isOpen={deletePurchaseModalOpen}
          onClose={() => {
            setDeletePurchaseModalOpen(false)
            setPurchaseToDelete(null)
          }}
          onConfirm={async () => {
            if (!purchaseToDelete) return
            setDeleting(true)
            try {
              await deletePurchase(purchaseToDelete.purchaseId)
              setDeletePurchaseModalOpen(false)
              setPurchaseToDelete(null)
              loadData()
            } catch (error) {
              alert(error instanceof Error ? error.message : 'Erro ao excluir')
            } finally {
              setDeleting(false)
            }
          }}
          title="Excluir Compra"
          message={purchaseToDelete 
            ? `Excluir a compra "${purchaseToDelete.description}"?\n\nIsso irá apagar todas as ${purchaseToDelete.totalInstallments} parcela(s) desta compra.`
            : ''
          }
          confirmText="Excluir Compra"
          variant="danger"
          loading={deleting}
        />

        {/* Loan Warning Modal */}
        <ConfirmModal
          isOpen={loanWarningOpen}
          onClose={() => setLoanWarningOpen(false)}
          onConfirm={() => {
            setLoanWarningOpen(false)
            setFormError(null)
            setLoanModalOpen(true)
          }}
          title="⚠️ Atenção: Riscos de Emprestar o Cartão"
          message={`Emprestar seu cartão de crédito para outras pessoas pode ser arriscado:\n\n• A fatura continua sendo SUA responsabilidade\n• Se a pessoa não pagar, você terá que arcar com o valor\n• Pode afetar seu score de crédito\n• Difícil recuperar o dinheiro em caso de calote\n\nSó registre empréstimos para pessoas de confiança e mantenha controle rigoroso dos valores.`}
          confirmText="Entendi, continuar"
          variant="warning"
        />

        {/* Loan Modal */}
        <Modal
          isOpen={loanModalOpen}
          onClose={() => {
            setLoanModalOpen(false)
            setSelectedBorrower('')
          }}
          title="Registrar Empréstimo"
          footer={
            <>
              <Button variant="secondary" onClick={() => {
                setLoanModalOpen(false)
                setSelectedBorrower('')
              }}>
                Cancelar
              </Button>
              <Button type="submit" form="loan-form" loading={submitting}>
                Registrar
              </Button>
            </>
          }
        >
          <form id="loan-form" onSubmit={handleLoanSubmit} className="space-y-4">
            {/* Select existing borrower or add new */}
            {borrowerNames.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Pessoa
                </label>
                <select
                  value={selectedBorrower}
                  onChange={(e) => setSelectedBorrower(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">+ Nova pessoa</option>
                  {borrowerNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Show input for new person only if no existing selected */}
            {(borrowerNames.length === 0 || selectedBorrower === '') && (
              <Input
                id="borrowerName"
                name="borrowerName"
                label={borrowerNames.length > 0 ? "Nome da Nova Pessoa" : "Nome da Pessoa"}
                placeholder="Quem está pegando emprestado"
                required={selectedBorrower === ''}
              />
            )}

            {/* Hidden input for selected borrower */}
            {selectedBorrower && (
              <input type="hidden" name="borrowerName" value={selectedBorrower} />
            )}

            <Input
              id="description"
              name="description"
              label="Descrição"
              placeholder="Ex: Compra de celular, Emergência..."
              required
            />

            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              label="Valor"
              placeholder="0.00"
              required
            />

            <Input
              id="loanDate"
              name="loanDate"
              type="date"
              label="Data do Empréstimo"
              defaultValue={new Date().toISOString().split('T')[0]}
              required
            />

            <div>
              <label htmlFor="installments" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Parcelas
              </label>
              <select
                id="installments"
                name="installments"
                defaultValue={1}
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                required
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}x {i === 0 ? '(à vista)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
              💡 Este valor será adicionado à fatura do cartão
            </div>

            {formError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                {formError}
              </div>
            )}
          </form>
        </Modal>

        {/* Loan Payment Modal */}
        <Modal
          isOpen={loanPaymentModalOpen}
          onClose={() => {
            setLoanPaymentModalOpen(false)
            setSelectedLoan(null)
          }}
          title="Registrar Pagamento do Empréstimo"
          footer={
            <>
              <Button variant="secondary" onClick={() => {
                setLoanPaymentModalOpen(false)
                setSelectedLoan(null)
              }}>
                Cancelar
              </Button>
              <Button type="submit" form="loan-payment-form" loading={submitting}>
                Registrar
              </Button>
            </>
          }
        >
          <form id="loan-payment-form" onSubmit={handleLoanPaymentSubmit} className="space-y-4">
            {selectedLoan && (
              <div className="bg-gray-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-gray-500">Empréstimo para <strong>{selectedLoan.borrowerName}</strong></p>
                <p className="text-sm text-gray-500 mt-1">{selectedLoan.description}</p>
                <div className="flex justify-between mt-2">
                  <span className="text-sm">Valor restante:</span>
                  <span className="font-bold text-orange-600">{formatCurrency(selectedLoan.remainingAmount)}</span>
                </div>
              </div>
            )}

            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              label="Valor Recebido"
              placeholder="0.00"
              defaultValue={selectedLoan?.remainingAmount || ''}
              required
            />

            {formError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                {formError}
              </div>
            )}
          </form>
        </Modal>

        {/* Delete Loan Confirmation Modal */}
        <ConfirmModal
          isOpen={deleteLoanModalOpen}
          onClose={() => {
            setDeleteLoanModalOpen(false)
            setLoanToDelete(null)
          }}
          onConfirm={async () => {
            if (!loanToDelete) return
            setDeleting(true)
            try {
              await deleteLoan(loanToDelete.id)
              setDeleteLoanModalOpen(false)
              setLoanToDelete(null)
              loadData()
            } catch (error) {
              alert(error instanceof Error ? error.message : 'Erro ao excluir')
            } finally {
              setDeleting(false)
            }
          }}
          title="Excluir Empréstimo"
          message={loanToDelete 
            ? `Excluir o empréstimo de "${loanToDelete.borrowerName}" (${loanToDelete.description})?\n\nValor: ${formatCurrency(loanToDelete.amount)}`
            : ''
          }
          confirmText="Excluir"
          variant="danger"
          loading={deleting}
        />
      </main>
    </div>
  )
}
