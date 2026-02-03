'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { getUserSettings, updateUserSettings, UserSettingsData } from '@/lib/actions/settings'
import { getCurrentSession } from '@/lib/actions/auth'

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<UserSettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getUserSettings()
        setSettings(data)
      } catch (error) {
        console.error('Error loading settings:', error)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
    getCurrentSession().then(session => setIsAdmin(session?.isAdmin ?? false))
  }, [])

  const handleToggle = async (key: keyof UserSettingsData) => {
    if (!settings) return
    
    setSaving(true)
    const newValue = !settings[key]
    
    try {
      await updateUserSettings({ [key]: newValue })
      setSettings({ ...settings, [key]: newValue })
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar isAdmin={isAdmin} />
        <main className="max-w-3xl mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar isAdmin={isAdmin} />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configurações</h1>
        </div>

        <Card title="Funcionalidades" subtitle="Ative ou desative recursos do aplicativo">
          <div className="space-y-4">
            {/* Loans Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="font-medium text-gray-900 dark:text-white">Controle de Empréstimos</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Controle valores emprestados do seu cartão para outras pessoas. 
                  Uma aba "Empréstimos" aparecerá nos seus cartões e um resumo no dashboard.
                </p>
                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ Lembre-se: emprestar o cartão é arriscado. A fatura é sempre sua responsabilidade.
                </div>
              </div>
              <div className="ml-4">
                <button
                  onClick={() => handleToggle('enableLoans')}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings?.enableLoans 
                      ? 'bg-primary-600' 
                      : 'bg-gray-300 dark:bg-gray-600'
                  } ${saving ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings?.enableLoans ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Conta" subtitle="Informações da sua conta" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Sair da conta</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Encerrar sessão atual
                </p>
              </div>
              <Button 
                variant="secondary"
                onClick={() => {
                  document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
                  router.push('/login')
                }}
              >
                Sair
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  )
}
