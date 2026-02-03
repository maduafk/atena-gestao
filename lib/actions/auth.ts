'use server'

import { prisma } from '@/lib/db'
import { createSession, deleteSession, getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { 
  checkRateLimit, 
  resetRateLimit,
  sanitizeEmail,
  validateEmail,
  validatePassword,
  secureLog 
} from '@/lib/security'
import { sendLoginCode, generateLoginCode } from '@/lib/email'

export interface LoginResult {
  success: boolean
  error?: string
  retryAfterSeconds?: number
  requiresCode?: boolean
  userId?: string
  mustChangePassword?: boolean
}

export interface VerifyCodeResult {
  success: boolean
  error?: string
  mustChangePassword?: boolean
}

export interface ChangePasswordResult {
  success: boolean
  error?: string
}

/**
 * Obtém o IP do cliente para rate limiting
 */
async function getClientIP(): Promise<string> {
  const headersList = await headers()
  const forwarded = headersList.get('x-forwarded-for')
  const realIp = headersList.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  if (realIp) {
    return realIp
  }
  return 'unknown'
}

/**
 * Primeira etapa do login: verifica email e senha
 */
export async function login(formData: FormData): Promise<LoginResult> {
  const rawEmail = formData.get('email') as string
  const password = formData.get('password') as string

  const email = sanitizeEmail(rawEmail)

  const emailValidation = validateEmail(email)
  if (!emailValidation.valid) {
    return { success: false, error: emailValidation.error }
  }

  const passwordValidation = validatePassword(password)
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.error }
  }

  const clientIP = await getClientIP()
  const rateLimitResult = checkRateLimit(clientIP, 'login')
  
  if (!rateLimitResult.allowed) {
    const retryAfterSeconds = Math.ceil((rateLimitResult.retryAfterMs || 0) / 1000)
    
    secureLog('warn', {
      action: 'login_rate_limited',
      details: { ip: clientIP, retryAfterSeconds }
    })
    
    return { 
      success: false, 
      error: `Muitas tentativas. Aguarde ${Math.ceil(retryAfterSeconds / 60)} minutos.`,
      retryAfterSeconds,
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      secureLog('warn', {
        action: 'login_failed_user_not_found',
        details: { ip: clientIP }
      })
      return { success: false, error: 'Credenciais inválidas' }
    }

    // Verificar se o usuário está ativo
    if (!user.isActive) {
      secureLog('warn', {
        action: 'login_failed_user_inactive',
        userId: user.id,
        details: { ip: clientIP }
      })
      return { success: false, error: 'Conta desativada. Entre em contato com o administrador.' }
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash)

    if (!passwordMatch) {
      secureLog('warn', {
        action: 'login_failed_wrong_password',
        userId: user.id,
        details: { ip: clientIP }
      })
      return { success: false, error: 'Credenciais inválidas' }
    }

    // 2FA TEMPORARIAMENTE DESABILITADO
    // TODO: Reativar quando configurar serviço de email para produção
    // Para reativar, descomente o bloco abaixo e comente o login direto
    
    /*
    // Gerar e enviar código de verificação
    const code = generateLoginCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutos

    // Invalidar códigos anteriores
    await prisma.loginCode.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true }
    })

    // Criar novo código
    await prisma.loginCode.create({
      data: {
        userId: user.id,
        code,
        expiresAt,
      }
    })

    // Enviar código por email
    const emailSent = await sendLoginCode({ email: user.email, code })
    
    // Em desenvolvimento, mostrar código no console
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n' + '='.repeat(50))
      console.log('🔐 CÓDIGO DE VERIFICAÇÃO (apenas em dev)')
      console.log(`📧 Email: ${user.email}`)
      console.log(`🔑 Código: ${code}`)
      console.log('='.repeat(50) + '\n')
    }
    
    if (!emailSent && process.env.NODE_ENV === 'production') {
      secureLog('error', {
        action: 'login_code_email_failed',
        userId: user.id,
        details: { ip: clientIP }
      })
      return { success: false, error: 'Erro ao enviar código. Tente novamente.' }
    }

    secureLog('info', {
      action: 'login_code_sent',
      userId: user.id,
      details: { ip: clientIP }
    })

    return { 
      success: true, 
      requiresCode: true,
      userId: user.id
    }
    */

    // LOGIN DIRETO (sem 2FA)
    resetRateLimit(clientIP, 'login')
    await createSession(user.id, user.email, user.isAdmin)

    secureLog('info', {
      action: 'login_success_direct',
      userId: user.id,
      details: { ip: clientIP }
    })

    return { 
      success: true, 
      requiresCode: false,
      mustChangePassword: user.mustChangePassword
    }
  } catch (error) {
    secureLog('error', {
      action: 'login_error',
      details: { ip: clientIP },
      error: error instanceof Error ? error : new Error('Unknown error')
    })
    return { success: false, error: 'Erro ao fazer login. Tente novamente.' }
  }
}

/**
 * Segunda etapa do login: verifica o código enviado por email
 */
export async function verifyLoginCode(userId: string, code: string): Promise<VerifyCodeResult> {
  const clientIP = await getClientIP()

  try {
    const loginCode = await prisma.loginCode.findFirst({
      where: {
        userId,
        code,
        used: false,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    })

    if (!loginCode) {
      secureLog('warn', {
        action: 'login_code_invalid',
        userId,
        details: { ip: clientIP }
      })
      return { success: false, error: 'Código inválido ou expirado' }
    }

    // Marcar código como usado
    await prisma.loginCode.update({
      where: { id: loginCode.id },
      data: { used: true }
    })

    // Resetar rate limit após sucesso
    resetRateLimit(clientIP, 'login')

    // Criar sessão
    await createSession(loginCode.user.id, loginCode.user.email, loginCode.user.isAdmin)

    secureLog('info', {
      action: 'login_success',
      userId: loginCode.user.id,
      details: { ip: clientIP }
    })

    return { 
      success: true, 
      mustChangePassword: loginCode.user.mustChangePassword 
    }
  } catch (error) {
    secureLog('error', {
      action: 'verify_code_error',
      userId,
      details: { ip: clientIP },
      error: error instanceof Error ? error : new Error('Unknown error')
    })
    return { success: false, error: 'Erro ao verificar código. Tente novamente.' }
  }
}

/**
 * Troca de senha (obrigatória no primeiro acesso)
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Sessão inválida' }
  }

  const clientIP = await getClientIP()

  // Validar nova senha
  if (newPassword.length < 6) {
    return { success: false, error: 'A nova senha deve ter pelo menos 6 caracteres' }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId }
    })

    if (!user) {
      return { success: false, error: 'Usuário não encontrado' }
    }

    // Verificar senha atual
    const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!passwordMatch) {
      secureLog('warn', {
        action: 'change_password_wrong_current',
        userId: user.id,
        details: { ip: clientIP }
      })
      return { success: false, error: 'Senha atual incorreta' }
    }

    // Não permitir usar a mesma senha
    if (currentPassword === newPassword) {
      return { success: false, error: 'A nova senha deve ser diferente da atual' }
    }

    // Atualizar senha
    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        passwordHash,
        mustChangePassword: false
      }
    })

    secureLog('info', {
      action: 'password_changed',
      userId: user.id,
      details: { ip: clientIP }
    })

    return { success: true }
  } catch (error) {
    secureLog('error', {
      action: 'change_password_error',
      userId: session.userId,
      details: { ip: clientIP },
      error: error instanceof Error ? error : new Error('Unknown error')
    })
    return { success: false, error: 'Erro ao trocar senha. Tente novamente.' }
  }
}

/**
 * Reenviar código de verificação
 */
export async function resendLoginCode(userId: string): Promise<LoginResult> {
  const clientIP = await getClientIP()
  
  // Rate limit para reenvio (3 tentativas por 5 minutos)
  const rateLimitResult = checkRateLimit(`${clientIP}-resend-${userId}`, 'login')
  
  if (!rateLimitResult.allowed) {
    return { 
      success: false, 
      error: 'Aguarde um momento antes de solicitar outro código.'
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user || !user.isActive) {
      return { success: false, error: 'Usuário não encontrado' }
    }

    // Gerar novo código
    const code = generateLoginCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    // Invalidar códigos anteriores
    await prisma.loginCode.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true }
    })

    // Criar novo código
    await prisma.loginCode.create({
      data: {
        userId: user.id,
        code,
        expiresAt,
      }
    })

    // Enviar código
    const emailSent = await sendLoginCode({ email: user.email, code })
    
    // Em desenvolvimento, mostrar código no console
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n' + '='.repeat(50))
      console.log('🔐 CÓDIGO REENVIADO (apenas em dev)')
      console.log(`📧 Email: ${user.email}`)
      console.log(`🔑 Código: ${code}`)
      console.log('='.repeat(50) + '\n')
    }
    
    if (!emailSent && process.env.NODE_ENV === 'production') {
      return { success: false, error: 'Erro ao enviar código. Tente novamente.' }
    }

    secureLog('info', {
      action: 'login_code_resent',
      userId: user.id,
      details: { ip: clientIP }
    })

    return { success: true, requiresCode: true, userId: user.id }
  } catch (error) {
    return { success: false, error: 'Erro ao reenviar código.' }
  }
}

export async function logout(): Promise<void> {
  await deleteSession()
  redirect('/login')
}

/**
 * Obtém informações da sessão atual para uso em componentes cliente
 */
export async function getCurrentSession(): Promise<{ isAdmin: boolean } | null> {
  const session = await getSession()
  if (!session) return null
  return { isAdmin: session.isAdmin }
}
