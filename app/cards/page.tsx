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

  const dayOptions = Array.from({ length: 28 }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar isAdmin={isAdmin} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Cartões de Crédito</h1>
          <Button onClick={() => handleOpenModal()}>
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Cartão
          </Button>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4" />
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : cards.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum cartão cadastrado</h3>
              <p className="text-gray-500 mb-4">Comece adicionando seu primeiro cartão de crédito.</p>
              <Button onClick={() => handleOpenModal()}>Adicionar Cartão</Button>
            </div>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => (
              <Card key={card.id} className="relative group">
                <Link href={`/cards/${card.id}`} className="block">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-md" />
                    <div>
                      <h3 className="font-semibold text-gray-900">{card.name}</h3>
                      <p className="text-sm text-gray-500">Limite: {formatCurrency(card.creditLimit)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Fechamento</p>
                      <p className="font-medium">Dia {card.closingDay}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Vencimento</p>
                      <p className="font-medium">Dia {card.dueDay}</p>
                    </div>
                  </div>
                </Link>
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      handleOpenModal(card)
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded-md"
                    title="Editar"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      handleDelete(card)
                    }}
                    className="p-1.5 hover:bg-red-100 rounded-md"
                    title="Excluir"
                  >
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </Card>
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
          <form id="card-form" onSubmit={handleSubmit} className="space-y-4">
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
                <label htmlFor="closingDay" className="block text-sm font-medium text-gray-700 mb-1">
                  Dia de Fechamento
                </label>
                <select
                  id="closingDay"
                  name="closingDay"
                  defaultValue={editingCard?.closingDay || 1}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                <label htmlFor="dueDay" className="block text-sm font-medium text-gray-700 mb-1">
                  Dia de Vencimento
                </label>
                <select
                  id="dueDay"
                  name="dueDay"
                  defaultValue={editingCard?.dueDay || 10}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
