'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { 
  getReceivables, 
  getPersonNames, 
  createReceivable, 
  registerReceivablePayment,
  markReceivableAsPaid,
  deleteReceivable,
  ReceivableData,
  getReceivablesSummaryByPerson,
  ReceivableSummaryByPerson
} from '@/lib/actions/receivables'
import { getCurrentSession } from '@/lib/actions/auth'
import { formatCurrency, formatDateDisplay } from '@/lib/utils'

const CATEGORIES = [
  'Trabalho',
  'Freelance',
  'Venda',
  'Empréstimo Pessoal',
  'Serviço',
  'Outros',
]

export default function ReceivablesPage() {
  const [receivables, setReceivables] = useState<ReceivableData[]>([])
  const [summaryByPerson, setSummaryByPerson] = useState<ReceivableSummaryByPerson[]>([])
  const [personNames, setPersonNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedReceivable, setSelectedReceivable] = useState<ReceivableData | null>(null)
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string | null>(null)
  
  // Form states
  const [formError, setFormError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'byPerson'>('byPerson')
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<string>('')

  useEffect(() => {
    loadData()
    getCurrentSession().then(session => setIsAdmin(session?.isAdmin ?? false))
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [receivablesData, namesData, summaryData] = await Promise.all([
        getReceivables(),
        getPersonNames(),
        getReceivablesSummaryByPerson(),
      ])
      setReceivables(receivablesData)
      setPersonNames(namesData)
      setSummaryByPerson(summaryData)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      personName: formData.get('personName') as string,
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      amountTotal: formData.get('amountTotal') as string,
      dueDate: formData.get('dueDate') as string,
      installments: parseInt(formData.get('installments') as string) || 1,
    }

    try {
      await createReceivable(data)
      setCreateModalOpen(false)
      loadData()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao criar')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePayInstallment = async () => {
    if (!selectedInstallmentId) return
    setSubmitting(true)
    try {
      await registerReceivablePayment(selectedInstallmentId)
      setPaymentModalOpen(false)
      setSelectedInstallmentId(null)
      loadData()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Erro ao registrar pagamento')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkAsPaid = async (receivableId: string) => {
    setSubmitting(true)
    try {
      await markReceivableAsPaid(receivableId)
      loadData()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Erro ao marcar como pago')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedReceivable) return
    setSubmitting(true)
    try {
      await deleteReceivable(selectedReceivable.id)
      setDeleteModalOpen(false)
      setSelectedReceivable(null)
      loadData()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Erro ao excluir')
    } finally {
      setSubmitting(false)
    }
  }

  // Calcular totais
  const totalPending = receivables
    .filter(r => r.status !== 'paid')
    .reduce((sum, r) => sum + (Number(r.amountTotal) - Number(r.paidAmount)), 0)

  const totalThisMonth = receivables
    .filter(r => r.status !== 'paid')
    .flatMap(r => r.installmentsList)
    .filter(inst => {
      if (inst.status === 'paid') return false
      const now = new Date()
      const dueDate = new Date(inst.dueDate)
      return dueDate.getMonth() === now.getMonth() && dueDate.getFullYear() === now.getFullYear()
    })
    .reduce((sum, inst) => sum + (Number(inst.amount) - Number(inst.paidAmount)), 0)

  const getReceivablesForPerson = (personName: string) => {
    return receivables.filter(r => r.personName === personName && r.status !== 'paid')
  }

  return (
    <div className="min-h-screen">
      <Navbar isAdmin={isAdmin} />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-800 dark:text-white">A Receber</h1>
            <p className="text-stone-500 dark:text-stone-400">Valores que pessoas vão te pagar</p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo A Receber
          </Button>
        </div>
        {actionError && (
          <p className="mb-4 text-sm text-rose-600 dark:text-rose-400">{actionError}</p>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-stone-500 dark:text-stone-400">Total a Receber</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(totalPending.toString())}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-stone-500 dark:text-stone-400">Vence Este Mês</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(totalThisMonth.toString())}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-stone-500 dark:text-stone-400">Pessoas</p>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {summaryByPerson.length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode('byPerson')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'byPerson'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-neutral-900 text-gray-700 dark:text-stone-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Por Pessoa
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-neutral-900 text-gray-700 dark:text-stone-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Lista
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <Card>
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-neutral-900 rounded" />
              ))}
            </div>
          </Card>
        ) : receivables.filter(r => r.status !== 'paid').length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-stone-500 dark:text-stone-400 mb-4">Nenhum valor a receber</p>
              <Button onClick={() => setCreateModalOpen(true)}>
                Adicionar primeiro
              </Button>
            </div>
          </Card>
        ) : viewMode === 'byPerson' ? (
          // View by Person
          <div className="space-y-4">
            {summaryByPerson.map((person) => (
              <Card key={person.personName} className="overflow-hidden">
                <button
                  onClick={() => setExpandedPerson(expandedPerson === person.personName ? null : person.personName)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-lg">
                      {person.personName.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-stone-800 dark:text-white">{person.personName}</h3>
                      <p className="text-sm text-stone-500 dark:text-stone-400">
                        {person.receivableCount} {person.receivableCount === 1 ? 'item' : 'itens'}
                        {person.nextDueDate && (
                          <span className="ml-2">
                            • Próx: {formatDateDisplay(person.nextDueDate)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(person.pendingAmount)}
                      </p>
                      <p className="text-xs text-stone-500">a receber</p>
                    </div>
                    <svg 
                      className={`w-5 h-5 text-stone-400 transition-transform ${expandedPerson === person.personName ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded content */}
                {expandedPerson === person.personName && (
                  <div className="border-t border-stone-100 dark:border-neutral-800 px-4 pb-4">
                    {getReceivablesForPerson(person.personName).map((receivable) => (
                      <div key={receivable.id} className="mt-4 p-4 bg-gray-50 dark:bg-neutral-900/50 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-stone-800 dark:text-white">{receivable.description}</h4>
                            <p className="text-sm text-stone-500 dark:text-stone-400">
                              <span className="inline-block px-2 py-0.5 bg-gray-200 dark:bg-neutral-800 rounded text-xs mr-2">
                                {receivable.category}
                              </span>
                              {receivable.installments > 1 && `${receivable.installments}x de ${formatCurrency((Number(receivable.amountTotal) / receivable.installments).toString())}`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMarkAsPaid(receivable.id)}
                              className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                              title="Marcar tudo como pago"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => { setSelectedReceivable(receivable); setDeleteModalOpen(true) }}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Installments */}
                        <div className="space-y-2">
                          {receivable.installmentsList.map((inst) => (
                            <div 
                              key={inst.id}
                              className={`flex items-center justify-between p-2 rounded ${
                                inst.status === 'paid' 
                                  ? 'bg-green-50 dark:bg-green-900/20' 
                                  : new Date(inst.dueDate) < new Date() 
                                    ? 'bg-red-50 dark:bg-red-900/20'
                                    : 'bg-white dark:bg-neutral-800'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`text-sm font-medium ${
                                  inst.status === 'paid' ? 'text-green-600' : 'text-gray-700 dark:text-stone-300'
                                }`}>
                                  {receivable.installments > 1 ? `${inst.installmentNumber}/${receivable.installments}` : '1x'}
                                </span>
                                <span className="text-sm text-stone-500">
                                  {formatDateDisplay(inst.dueDate)}
                                </span>
                                {new Date(inst.dueDate) < new Date() && inst.status !== 'paid' && (
                                  <span className="text-xs text-red-600 font-medium">VENCIDO</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`font-medium ${
                                  inst.status === 'paid' ? 'text-green-600 line-through' : 'text-stone-800 dark:text-white'
                                }`}>
                                  {formatCurrency(inst.amount)}
                                </span>
                                {inst.status !== 'paid' && (
                                  <button
                                    onClick={() => { setSelectedInstallmentId(inst.id); setPaymentModalOpen(true) }}
                                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                  >
                                    Receber
                                  </button>
                                )}
                                {inst.status === 'paid' && (
                                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          // List View
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-neutral-800">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-stone-300">Pessoa</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-stone-300">Descrição</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-stone-300">Categoria</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-stone-300">Valor</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-stone-300">Parcelas</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-stone-300">Vencimento</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-stone-300">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.filter(r => r.status !== 'paid').map((receivable) => (
                    <tr key={receivable.id} className="border-b border-stone-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium text-sm">
                            {receivable.personName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-stone-800 dark:text-white">{receivable.personName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-700 dark:text-stone-300">{receivable.description}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-stone-300 rounded text-sm">
                          {receivable.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-green-600 dark:text-green-400">
                        {formatCurrency((Number(receivable.amountTotal) - Number(receivable.paidAmount)).toString())}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600 dark:text-stone-400">
                        {receivable.installmentsList.filter(i => i.status === 'paid').length}/{receivable.installments}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600 dark:text-stone-400">
                        {formatDateDisplay(receivable.dueDate)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => handleMarkAsPaid(receivable.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                            title="Marcar como pago"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => { setSelectedReceivable(receivable); setDeleteModalOpen(true) }}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Excluir"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          </Card>
        )}

        {/* Create Modal */}
        <Modal
          isOpen={createModalOpen}
          onClose={() => { setCreateModalOpen(false); setSelectedPerson('') }}
          title="Novo A Receber"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
                {formError}
              </div>
            )}

            {/* Select existing person or add new */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-stone-300 mb-1">
                Pessoa *
              </label>
              {personNames.length > 0 ? (
                <select
                  value={selectedPerson}
                  onChange={(e) => setSelectedPerson(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 dark:border-neutral-700 px-3 py-2.5 text-stone-800 dark:text-white bg-white dark:bg-neutral-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">+ Nova pessoa</option>
                  {personNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              ) : null}
            </div>

            {/* Show name input if "Nova pessoa" selected or no people yet */}
            {(selectedPerson === '' || personNames.length === 0) && (
              <Input
                label={personNames.length > 0 ? "Nome da nova pessoa *" : "Nome da pessoa *"}
                name="personName"
                required
                placeholder="Digite o nome"
              />
            )}
            {selectedPerson !== '' && (
              <input type="hidden" name="personName" value={selectedPerson} />
            )}

            <Input
              label="Descrição *"
              name="description"
              required
              placeholder="Ex: Trabalho de design"
            />

            <Select
              label="Categoria"
              name="category"
              options={CATEGORIES.map(c => ({ value: c, label: c }))}
            />

            <Input
              label="Valor Total *"
              name="amountTotal"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0,00"
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Primeiro Vencimento *"
                name="dueDate"
                type="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
              />
              <Input
                label="Parcelas"
                name="installments"
                type="number"
                min="1"
                max="48"
                defaultValue="1"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Payment Confirmation Modal */}
        <ConfirmModal
          isOpen={paymentModalOpen}
          onClose={() => { setPaymentModalOpen(false); setSelectedInstallmentId(null) }}
          onConfirm={handlePayInstallment}
          title="Confirmar Recebimento"
          message="Deseja marcar esta parcela como recebida?"
          confirmText={submitting ? 'Processando...' : 'Confirmar'}
          variant="info"
        />

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={deleteModalOpen}
          onClose={() => { setDeleteModalOpen(false); setSelectedReceivable(null) }}
          onConfirm={handleDelete}
          title="Excluir A Receber"
          message={`Tem certeza que deseja excluir "${selectedReceivable?.description}"? Esta ação não pode ser desfeita.`}
          confirmText={submitting ? 'Excluindo...' : 'Excluir'}
          variant="danger"
        />
      </main>
    </div>
  )
}
