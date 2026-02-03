'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { changePassword } from '@/lib/actions/auth'
import { checkMustChangePassword } from '@/lib/actions/admin'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)

  useEffect(() => {
    // Verificar se realmente precisa trocar senha
    async function checkAccess() {
      const mustChange = await checkMustChangePassword()
      if (!mustChange) {
        router.push('/')
      } else {
        setCheckingAccess(false)
      }
    }
    checkAccess()
  }, [router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const currentPassword = formData.get('currentPassword') as string
    const newPassword = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmPassword') as string

    // Validações client-side
    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres')
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não conferem')
      setLoading(false)
      return
    }

    try {
      const result = await changePassword(currentPassword, newPassword)

      if (result.success) {
        router.push('/')
        router.refresh()
      } else {
        setError(result.error || 'Erro ao trocar senha')
      }
    } catch {
      setError('Erro ao trocar senha')
    } finally {
      setLoading(false)
    }
  }

  if (checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trocar Senha</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
              Por segurança, você precisa criar uma nova senha antes de continuar.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              label="Senha Atual (temporária)"
              placeholder="Digite a senha temporária"
              required
              autoComplete="current-password"
            />

            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              label="Nova Senha"
              placeholder="Digite sua nova senha"
              required
              autoComplete="new-password"
            />

            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirmar Nova Senha"
              placeholder="Confirme sua nova senha"
              required
              autoComplete="new-password"
            />

            <p className="text-xs text-gray-500 dark:text-gray-400">
              A senha deve ter pelo menos 6 caracteres
            </p>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-300 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              Salvar Nova Senha
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
