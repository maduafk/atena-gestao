/**
 * Módulo de Segurança - Atena Gestão
 * 
 * Contém funções para:
 * - Rate limiting
 * - Sanitização de inputs
 * - Validação de dados
 * - Logs seguros
 */

// ============================================
// RATE LIMITING (em memória - para produção usar Redis)
// ============================================

interface RateLimitEntry {
  count: number
  firstAttempt: number
  blockedUntil?: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

interface RateLimitConfig {
  maxAttempts: number      // Máximo de tentativas
  windowMs: number         // Janela de tempo em ms
  blockDurationMs: number  // Duração do bloqueio em ms
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  login: {
    maxAttempts: 50,
    windowMs: 15 * 60 * 1000,      // 15 minutos
    blockDurationMs: 1 * 60 * 1000, // 1 minuto de bloqueio (era 30)
  },
  api: {
    maxAttempts: 100,
    windowMs: 60 * 1000,           // 1 minuto
    blockDurationMs: 1 * 60 * 1000,  // 1 minuto de bloqueio (era 5)
  },
}

export interface RateLimitResult {
  allowed: boolean
  remainingAttempts: number
  retryAfterMs?: number
}

export function checkRateLimit(identifier: string, type: 'login' | 'api' = 'api'): RateLimitResult {
  const config = RATE_LIMIT_CONFIGS[type]
  const now = Date.now()
  const key = `${type}:${identifier}`
  
  let entry = rateLimitStore.get(key)
  
  // Se está bloqueado, verificar se o bloqueio expirou
  if (entry?.blockedUntil) {
    if (now < entry.blockedUntil) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterMs: entry.blockedUntil - now,
      }
    }
    // Bloqueio expirou, resetar
    entry = undefined
    rateLimitStore.delete(key)
  }
  
  // Se não existe ou a janela expirou, criar nova entrada
  if (!entry || (now - entry.firstAttempt) > config.windowMs) {
    rateLimitStore.set(key, {
      count: 1,
      firstAttempt: now,
    })
    return {
      allowed: true,
      remainingAttempts: config.maxAttempts - 1,
    }
  }
  
  // Incrementar contador
  entry.count++
  
  // Se excedeu o limite, bloquear
  if (entry.count > config.maxAttempts) {
    entry.blockedUntil = now + config.blockDurationMs
    rateLimitStore.set(key, entry)
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterMs: config.blockDurationMs,
    }
  }
  
  rateLimitStore.set(key, entry)
  return {
    allowed: true,
    remainingAttempts: config.maxAttempts - entry.count,
  }
}

export function resetRateLimit(identifier: string, type: 'login' | 'api' = 'api'): void {
  const key = `${type}:${identifier}`
  rateLimitStore.delete(key)
}

// Limpar entradas antigas periodicamente (a cada 10 minutos)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    const keys = Array.from(rateLimitStore.keys())
    for (const key of keys) {
      const entry = rateLimitStore.get(key)
      if (entry) {
        const config = key.startsWith('login:') ? RATE_LIMIT_CONFIGS.login : RATE_LIMIT_CONFIGS.api
        if ((now - entry.firstAttempt) > config.windowMs * 2) {
          rateLimitStore.delete(key)
        }
      }
    }
  }, 10 * 60 * 1000)
}


// ============================================
// SANITIZAÇÃO DE INPUTS
// ============================================

/**
 * Remove caracteres potencialmente perigosos de strings
 */
export function sanitizeString(input: string | null | undefined): string {
  if (!input) return ''
  
  return input
    .trim()
    // Remove tags HTML
    .replace(/<[^>]*>/g, '')
    // Escapa caracteres especiais HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Sanitiza string preservando alguns caracteres para descrições
 */
export function sanitizeDescription(input: string | null | undefined): string {
  if (!input) return ''
  
  return input
    .trim()
    .slice(0, 500) // Limita tamanho
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/<[^>]*>/g, '') // Remove outras tags
}

/**
 * Sanitiza e valida email
 */
export function sanitizeEmail(input: string | null | undefined): string {
  if (!input) return ''
  
  return input
    .trim()
    .toLowerCase()
    .slice(0, 254) // RFC 5321
}

/**
 * Sanitiza valores monetários
 */
export function sanitizeMoneyValue(input: string | null | undefined): string {
  if (!input) return '0'
  
  // Remove tudo exceto números, ponto e vírgula
  const cleaned = input.replace(/[^\d.,]/g, '')
  // Substitui vírgula por ponto
  const normalized = cleaned.replace(',', '.')
  // Valida que é um número
  const num = parseFloat(normalized)
  
  if (isNaN(num) || num < 0) return '0'
  if (num > 999999999.99) return '999999999.99' // Limite máximo
  
  return num.toFixed(2)
}


// ============================================
// VALIDAÇÃO DE DADOS
// ============================================

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Valida formato de email
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) {
    return { valid: false, error: 'Email é obrigatório' }
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Formato de email inválido' }
  }
  
  if (email.length > 254) {
    return { valid: false, error: 'Email muito longo' }
  }
  
  return { valid: true }
}

/**
 * Valida senha
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, error: 'Senha é obrigatória' }
  }
  
  if (password.length < 6) {
    return { valid: false, error: 'Senha deve ter pelo menos 6 caracteres' }
  }
  
  if (password.length > 128) {
    return { valid: false, error: 'Senha muito longa' }
  }
  
  return { valid: true }
}

/**
 * Valida UUID
 */
export function validateUUID(uuid: string): ValidationResult {
  if (!uuid) {
    return { valid: false, error: 'ID é obrigatório' }
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(uuid)) {
    return { valid: false, error: 'ID inválido' }
  }
  
  return { valid: true }
}

/**
 * Valida valor monetário
 */
export function validateMoneyValue(value: string, min = 0.01, max = 999999999.99): ValidationResult {
  const num = parseFloat(value)
  
  if (isNaN(num)) {
    return { valid: false, error: 'Valor inválido' }
  }
  
  if (num < min) {
    return { valid: false, error: `Valor mínimo é ${min}` }
  }
  
  if (num > max) {
    return { valid: false, error: `Valor máximo é ${max}` }
  }
  
  return { valid: true }
}

/**
 * Valida data
 */
export function validateDate(dateStr: string): ValidationResult {
  if (!dateStr) {
    return { valid: false, error: 'Data é obrigatória' }
  }
  
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Data inválida' }
  }
  
  // Não permitir datas muito no passado ou futuro
  const minDate = new Date('2000-01-01')
  const maxDate = new Date('2100-12-31')
  
  if (date < minDate || date > maxDate) {
    return { valid: false, error: 'Data fora do intervalo permitido' }
  }
  
  return { valid: true }
}


// ============================================
// LOGS SEGUROS
// ============================================

type LogLevel = 'info' | 'warn' | 'error'

interface SecureLogOptions {
  userId?: string
  action: string
  details?: Record<string, unknown>
  error?: Error
}

/**
 * Campos sensíveis que nunca devem ser logados
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'secret',
  'apiKey',
  'creditCard',
  'cvv',
  'ssn',
  'cpf',
]

/**
 * Remove campos sensíveis de um objeto para logging
 */
function removeSensitiveData(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      cleaned[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = removeSensitiveData(value as Record<string, unknown>)
    } else {
      cleaned[key] = value
    }
  }
  
  return cleaned
}

/**
 * Log seguro que nunca expõe dados sensíveis
 */
export function secureLog(level: LogLevel, options: SecureLogOptions): void {
  const timestamp = new Date().toISOString()
  const { userId, action, details, error } = options
  
  const logEntry = {
    timestamp,
    level,
    userId: userId ? userId.slice(0, 8) + '...' : undefined, // Trunca ID
    action,
    details: details ? removeSensitiveData(details) : undefined,
    error: error ? {
      message: error.message,
      name: error.name,
      // Não loga stack trace em produção
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    } : undefined,
  }
  
  const logMessage = JSON.stringify(logEntry)
  
  switch (level) {
    case 'info':
      console.info(logMessage)
      break
    case 'warn':
      console.warn(logMessage)
      break
    case 'error':
      console.error(logMessage)
      break
  }
}


// ============================================
// VERIFICAÇÃO DE AMBIENTE
// ============================================

/**
 * Verifica se as variáveis de ambiente de segurança estão configuradas
 */
export function checkSecurityConfig(): { secure: boolean; warnings: string[] } {
  const warnings: string[] = []
  
  // Verificar AUTH_SECRET
  const authSecret = process.env.AUTH_SECRET
  if (!authSecret || authSecret === 'default-secret-change-me' || authSecret.length < 32) {
    warnings.push('AUTH_SECRET não está configurado ou é muito fraco. Use uma string de pelo menos 32 caracteres.')
  }
  
  // Verificar DATABASE_URL
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    warnings.push('DATABASE_URL não está configurado.')
  } else if (dbUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
    warnings.push('DATABASE_URL aponta para localhost em produção.')
  }
  
  // Verificar HTTPS em produção
  if (process.env.NODE_ENV === 'production') {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (appUrl && !appUrl.startsWith('https://')) {
      warnings.push('NEXT_PUBLIC_APP_URL deve usar HTTPS em produção.')
    }
  }
  
  return {
    secure: warnings.length === 0,
    warnings,
  }
}
