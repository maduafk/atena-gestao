'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  getUsers, 
  createUser, 
  toggleUserActive, 
  toggleUserAdmin,
  resetUserPassword, 
  deleteUser 
} from '@/lib/actions/admin'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface User {
  id: string
  email: string
  isAdmin: boolean
  isActive: boolean
  mustChangePassword: boolean
  createdAt: Date
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState<User | null>(null)
  const [showTempPassword, setShowTempPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Form state
  const [newEmail, setNewEmail] = useState('')
  const [newIsAdmin, setNewIsAdmin] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    try {
      const data = await getUsers()
      setUsers(data)
    } catch {
      setError('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setCreateLoading(true)
    setError(null)

    try {
      const result = await createUser(newEmail, newIsAdmin)
      
      if (result.success) {
        setShowCreateModal(false)
        setNewEmail('')
        setNewIsAdmin(false)
        if (result.tempPassword) {
          setShowTempPassword(result.tempPassword)
        }
        await loadUsers()
      } else {
        setError(result.error || 'Erro ao criar usuário')
      }
    } catch {
      setError('Erro ao criar usuário')
    } finally {
      setCreateLoading(false)
    }
  }

  async function handleToggleActive(user: User) {
    setActionLoading(user.id)
    try {
      const result = await toggleUserActive(user.id)
      if (result.success) {
        await loadUsers()
      } else {
        setError(result.error || 'Erro ao atualizar usuário')
      }
    } catch {
      setError('Erro ao atualizar usuário')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleToggleAdmin(user: User) {
    setActionLoading(user.id)
    try {
      const result = await toggleUserAdmin(user.id)
      if (result.success) {
        await loadUsers()
      } else {
        setError(result.error || 'Erro ao atualizar usuário')
      }
    } catch {
      setError('Erro ao atualizar usuário')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleResetPassword(user: User) {
    setActionLoading(user.id)
    try {
      const result = await resetUserPassword(user.id)
      if (result.success) {
        if (result.tempPassword) {
          setShowTempPassword(result.tempPassword)
        }
        await loadUsers()
      } else {
        setError(result.error || 'Erro ao resetar senha')
      }
    } catch {
      setError('Erro ao resetar senha')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeleteUser() {
    if (!showDeleteModal) return
    
    setActionLoading(showDeleteModal.id)
    try {
      const result = await deleteUser(showDeleteModal.id)
      if (result.success) {
        setShowDeleteModal(null)
        await loadUsers()
      } else {
        setError(result.error || 'Erro ao deletar usuário')
      }
    } catch {
      setError('Erro ao deletar usuário')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Gerenciar Usuários
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Administração de contas do sistema
                </p>
              </div>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Novo Usuário
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-300 text-sm p-3 rounded-lg">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Fechar</button>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Senha
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className={!user.isActive ? 'opacity-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.email}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Criado em {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(user)}
                      disabled={actionLoading === user.id}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                      }`}
                    >
                      {user.isActive ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleAdmin(user)}
                      disabled={actionLoading === user.id}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.isAdmin
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {user.isAdmin ? 'Admin' : 'Usuário'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.mustChangePassword ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                        Pendente
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleResetPassword(user)}
                        disabled={actionLoading === user.id}
                        className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                        title="Resetar Senha"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setShowDeleteModal(user)}
                        disabled={actionLoading === user.id}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        title="Deletar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Nenhum usuário encontrado
            </div>
          )}
        </div>
      </main>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Novo Usuário"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            id="email"
            type="email"
            label="Email"
            placeholder="usuario@exemplo.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newIsAdmin}
              onChange={(e) => setNewIsAdmin(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Administrador
            </span>
          </label>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Uma senha temporária será gerada e enviada por email.
            O usuário deverá trocar a senha no primeiro acesso.
          </p>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={createLoading}>
              Criar Usuário
            </Button>
          </div>
        </form>
      </Modal>

      {/* Temp Password Modal */}
      <Modal
        isOpen={!!showTempPassword}
        onClose={() => setShowTempPassword(null)}
        title="Senha Temporária"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            A senha temporária foi gerada e enviada por email.
            Você também pode compartilhar diretamente:
          </p>
          
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
            <span className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
              {showTempPassword}
            </span>
          </div>

          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⚠️ O usuário será obrigado a trocar esta senha no primeiro acesso.
          </p>

          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowTempPassword(null)}>
              Entendi
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!showDeleteModal}
        onClose={() => setShowDeleteModal(null)}
        onConfirm={handleDeleteUser}
        title="Deletar Usuário"
        message={`Tem certeza que deseja deletar o usuário "${showDeleteModal?.email}"? Esta ação não pode ser desfeita e todos os dados do usuário serão perdidos.`}
        confirmText="Deletar"
        variant="danger"
      />
    </div>
  )
}
