'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import MonthSelector from '@/components/MonthSelector'
import Card, { CardStat } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { 
  getDebitTransactions, 
  createDebitTransaction, 
  deleteDebitTransaction,
  getDebitTotal,
  DebitTransactionData 
} from '@/lib/actions/debit'
import { getCurrentSession } from '@/lib/actions/auth'
import { formatCurrency, formatDateDisplay, formatStatementMonth } from '@/lib/utils'

function DebitContent({ isAdmin }: { isAdmin: boolean }) {
  const searchParams = useSearchParams()
  const now = new Date()
  const currentMonth = searchParams.get('month') || formatStatementMonth(now)

  const [transactions, setTransactions] = useState<DebitTransactionData[]>([])
  const [total, setTotal] = useState('0')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Delete confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<DebitTransactionData | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    try {
      const [transactionsData, totalData] = await Promise.all([
        getDebitTransactions(currentMonth),
        getDebitTotal(currentMonth),
      ])
      setTransactions(transactionsData)
      setTotal(totalData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadData()
  }, [currentMonth])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      description: formData.get('description') as string,
      amount: formData.get('amount') as string,
      date: formData.get('date') as string,
    }

    try {
      await createDebitTransaction(data)
      setModalOpen(false)
      loadData()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao registrar transação')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (transaction: DebitTransactionData) => {
    setTransactionToDelete(transaction)
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!transactionToDelete) return
    setDeleting(true)
    try {
      await deleteDebitTransaction(transactionToDelete.id)
      setDeleteModalOpen(false)
      setTransactionToDelete(null)
      loadData()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao excluir transação')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Gastos em Débito</h1>
        <MonthSelector currentMonth={currentMonth} />
      </div>

      {/* Summary */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <CardStat label="Total do Mês" value={formatCurrency(total)} variant="danger" />
          <Button onClick={() => { setFormError(null); setModalOpen(true) }}>
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Transação
          </Button>
        </div>
      </Card>

      {/* Transactions List */}
      <Card title="Transações" subtitle={`${transactions.length} transações`}>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-stone-800 mb-2">Nenhuma transação</h3>
            <p className="text-stone-500 mb-4">Adicione sua primeira transação de débito.</p>
            <Button onClick={() => setModalOpen(true)}>Adicionar Transação</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <div 
                key={transaction.id} 
                className="flex items-center justify-between p-3 bg-stone-50 dark:bg-neutral-900 rounded-lg group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-stone-800">{transaction.description}</p>
                    <p className="text-xs text-stone-500">{formatDateDisplay(transaction.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-red-600">
                    -{formatCurrency(transaction.amount)}
                  </span>
                  <button
                    onClick={() => handleDelete(transaction)}
                    className="p-1.5 hover:bg-red-100 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Excluir"
                  >
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova Transação de Débito"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="debit-form" loading={submitting}>
              Registrar
            </Button>
          </>
        }
      >
        <form id="debit-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="description"
            name="description"
            label="Descrição"
            placeholder="Ex: Uber, Farmácia..."
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
            id="date"
            name="date"
            type="date"
            label="Data"
            defaultValue={new Date().toISOString().split('T')[0]}
            required
          />

          {formError && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
              {formError}
            </div>
          )}
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setTransactionToDelete(null)
        }}
        onConfirm={confirmDelete}
        title="Excluir Transação"
        message={transactionToDelete 
          ? `Tem certeza que deseja excluir "${transactionToDelete.description}"?`
          : ''
        }
        confirmText="Excluir"
        variant="danger"
        loading={deleting}
      />
    </>
  )
}

export default function DebitPage() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    getCurrentSession().then(session => setIsAdmin(session?.isAdmin ?? false))
  }, [])

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-neutral-900">
      <Navbar isAdmin={isAdmin} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Suspense fallback={
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="h-24 bg-gray-200 rounded" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        }>
          <DebitContent isAdmin={isAdmin} />
        </Suspense>
      </main>
    </div>
  )
}
