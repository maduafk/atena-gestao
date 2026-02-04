'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login, verifyLoginCode, resendLoginCode } from '@/lib/actions/auth'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

type Step = 'credentials' | 'code'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('credentials')
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState('')

  const handleCredentialsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const result = await login(formData)

      if (result.success) {
        if (result.requiresCode && result.userId) {
          // Login com verificação por email
          setUserId(result.userId)
          setStep('code')
          setSuccess('Código enviado para seu email!')
        } else {
          // Login direto (sem verificação por email)
          if (result.mustChangePassword) {
            router.push('/change-password')
          } else {
            router.push('/')
          }
          router.refresh()
        }
      } else {
        setError(result.error || 'Erro ao fazer login')
      }
    } catch {
      setError('Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  const handleCodeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!userId || code.length !== 6) return
    
    setError(null)
    setLoading(true)

    try {
      const result = await verifyLoginCode(userId, code)

      if (result.success) {
        if (result.mustChangePassword) {
          router.push('/change-password')
        } else {
          router.push('/')
        }
        router.refresh()
      } else {
        setError(result.error || 'Código inválido')
      }
    } catch {
      setError('Erro ao verificar código')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (!userId) return
    
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const result = await resendLoginCode(userId)
      
      if (result.success) {
        setSuccess('Novo código enviado!')
        setCode('')
      } else {
        setError(result.error || 'Erro ao reenviar código')
      }
    } catch {
      setError('Erro ao reenviar código')
    } finally {
      setLoading(false)
    }
  }

  const handleBackToCredentials = () => {
    setStep('credentials')
    setUserId(null)
    setCode('')
    setError(null)
    setSuccess(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <img 
              src="/logo.png" 
              alt="Atena Gestão" 
              className="w-20 h-20 mx-auto mb-4 rounded-2xl"
            />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Atena</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Gestão Financeira Pessoal</p>
          </div>

          {step === 'credentials' ? (
            /* Etapa 1: Email e Senha */
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <Input
                id="email"
                name="email"
                type="email"
                label="Email"
                placeholder="Digite seu email"
                required
                autoComplete="email"
              />

              <Input
                id="password"
                name="password"
                type="password"
                label="Senha"
                placeholder="Digite sua senha"
                required
                autoComplete="current-password"
              />

              {error && (
                <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-300 text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" loading={loading}>
                Continuar
              </Button>
            </form>
          ) : (
            /* Etapa 2: Código de Verificação */
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Digite o código de 6 dígitos enviado para seu email
                </p>
              </div>

              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Código de verificação
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="000000"
                  required
                  autoFocus
                />
              </div>

              {success && (
                <div className="bg-green-50 dark:bg-green-900/50 text-green-600 dark:text-green-300 text-sm p-3 rounded-lg">
                  {success}
                </div>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-300 text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                loading={loading}
                disabled={code.length !== 6}
              >
                Verificar
              </Button>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  ← Voltar
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                >
                  Reenviar código
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
