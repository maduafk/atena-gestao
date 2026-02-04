'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { CardData, getCards, createCard, updateCard, deleteCard } from '@/lib/actions/cards'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { getCurrentSession } from '@/lib/actions/auth'

export default function CardsPage() {
  const router = useRouter()
  const [cards, setCards] = useState<CardData[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<CardData | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Delete confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [cardToDelete, setCardToDelete] = useState<CardData | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadCards = async () => {
    try {
      const data = await getCards()
      setCards(data)
    } catch (error) {
      console.error('Error loading cards:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCards()
    getCurrentSession().then(session => setIsAdmin(session?.isAdmin ?? false))
  }, [])

  const handleOpenModal = (card?: CardData) => {
    setEditingCard(card || null)
    setFormError(null)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingCard(null)
    setFormError(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      creditLimit: formData.get('creditLimit') as string,
      closingDay: parseInt(formData.get('closingDay') as string),
      dueDay: parseInt(formData.get('dueDay') as string),
      color: formData.get('color') as string || '#1a1a1a',
    }

    try {
      if (editingCard) {
        await updateCard(editingCard.id, data)
      } else {
        await createCard(data)
      }
      handleCloseModal()
      loadCards()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao salvar cartão')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (card: CardData) => {
    setCardToDelete(card)
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!cardToDelete) return
    setDeleting(true)
    try {
      await deleteCard(cardToDelete.id)
      setDeleteModalOpen(false)
      setCardToDelete(null)
      loadCards()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao excluir cartão')
    } finally {
      setDeleting(false)
    }
  }

  // Cores disponíveis para os cartões
  const cardColors = [
    { value: '#1a1a1a', label: 'Preto' },
    { value: '#3d8585', label: 'Verde Água' },
    { value: '#6366f1', label: 'Roxo' },
    { value: '#ec4899', label: 'Rosa' },
    { value: '#f59e0b', label: 'Laranja' },
    { value: '#10b981', label: 'Verde' },
    { value: '#3b82f6', label: 'Azul' },
    { value: '#ef4444', label: 'Vermelho' },
    { value: '#8b5cf6', label: 'Violeta' },
    { value: '#06b6d4', label: 'Ciano' },
  ]

  const dayOptions = Array.from({ length: 28 }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  }))

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-neutral-950">
      <Navbar isAdmin={isAdmin} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-stone-800 dark:text-stone-100">Cartões de Crédito</h1>
          <Button onClick={() => handleOpenModal()}>
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            Novo Cartão
          </Button>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-neutral-900 rounded-2xl p-5 animate-pulse">
                <div className="h-6 bg-stone-200 dark:bg-neutral-800 rounded w-32 mb-4" />
                <div className="space-y-2">
                  <div className="h-4 bg-stone-200 dark:bg-neutral-800 rounded w-24" />
                  <div className="h-4 bg-stone-200 dark:bg-neutral-800 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : cards.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-stone-300 dark:text-neutral-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <h3 className="text-lg font-medium text-stone-800 dark:text-stone-100 mb-2">Nenhum cartão cadastrado</h3>
              <p className="text-stone-500 dark:text-stone-400 mb-4">Comece adicionando seu primeiro cartão de crédito.</p>
              <Button onClick={() => handleOpenModal()}>Adicionar Cartão</Button>
            </div>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {cards.map((card) => (
              <Link 
                key={card.id} 
                href={`/cards/${card.id}`}
                className="group block"
              >
                <div 
                  className="relative rounded-2xl p-5 hover-lift overflow-hidden"
                  style={{ backgroundColor: card.color || '#1a1a1a' }}
                >
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                  
                  {/* Card chip */}
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-10 h-7 rounded bg-gradient-to-br from-amber-300 to-amber-500 shadow-sm" />
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          handleOpenModal(card)
                        }}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          handleDelete(card)
                        }}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Card name and limit */}
                  <div className="mb-6">
                    <h3 className="font-semibold text-white text-lg mb-1">{card.name}</h3>
                    <p className="text-white/70 text-sm">Limite: {formatCurrency(card.creditLimit)}</p>
                  </div>

                  {/* Dates */}
                  <div className="flex justify-between text-sm">
                    <div>
                      <p className="text-white/50 text-xs">Fechamento</p>
                      <p className="text-white font-medium">Dia {card.closingDay}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/50 text-xs">Vencimento</p>
                      <p className="text-white font-medium">Dia {card.dueDay}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          title={editingCard ? 'Editar Cartão' : 'Novo Cartão'}
          footer={
            <>
              <Button variant="secondary" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button type="submit" form="card-form" loading={submitting}>
                {editingCard ? 'Salvar' : 'Criar'}
              </Button>
            </>
          }
        >
          <form id="card-form" onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="name"
              name="name"
              label="Nome do Cartão"
              placeholder="Ex: Nubank, Inter, Itaú..."
              defaultValue={editingCard?.name || ''}
              required
            />

            <Input
              id="creditLimit"
              name="creditLimit"
              type="number"
              step="0.01"
              min="0"
              label="Limite de Crédito"
              placeholder="0.00"
              defaultValue={editingCard?.creditLimit || ''}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="closingDay" className="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-2">
                  Dia de Fechamento
                </label>
                <select
                  id="closingDay"
                  name="closingDay"
                  defaultValue={editingCard?.closingDay || 1}
                  className="block w-full rounded-xl border border-stone-200 dark:border-neutral-700 px-4 py-2.5 text-stone-800 dark:text-stone-100 bg-white dark:bg-neutral-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
                  required
                >
                  {dayOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="dueDay" className="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-2">
                  Dia de Vencimento
                </label>
                <select
                  id="dueDay"
                  name="dueDay"
                  defaultValue={editingCard?.dueDay || 10}
                  className="block w-full rounded-xl border border-stone-200 dark:border-neutral-700 px-4 py-2.5 text-stone-800 dark:text-stone-100 bg-white dark:bg-neutral-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
                  required
                >
                  {dayOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-2">
                Cor do Cartão
              </label>
              <div className="flex flex-wrap gap-2">
                {cardColors.map((color) => (
                  <label key={color.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="color"
                      value={color.value}
                      defaultChecked={(editingCard?.color || '#1a1a1a') === color.value || (!editingCard && color.value === '#1a1a1a')}
                      className="sr-only peer"
                    />
                    <div 
                      className="w-8 h-8 rounded-lg ring-2 ring-transparent peer-checked:ring-primary-500 peer-checked:ring-offset-2 dark:ring-offset-neutral-900 transition-all hover:scale-110"
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  </label>
                ))}
              </div>
            </div>

            {formError && (
              <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm p-4 rounded-xl border border-rose-200 dark:border-rose-800/30">
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
            setCardToDelete(null)
          }}
          onConfirm={confirmDelete}
          title="Excluir Cartão"
          message={cardToDelete 
            ? `Tem certeza que deseja excluir o cartão "${cardToDelete.name}"?\n\nTodas as compras e pagamentos serão removidos permanentemente.`
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
