'use server'

import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { sendWelcomeEmail } from '@/lib/email'
import { secureLog, sanitizeEmail, validateEmail } from '@/lib/security'

interface ActionResult {
  success: boolean
  error?: string
}

interface User {
  id: string
  email: string
  isAdmin: boolean
  isActive: boolean
  mustChangePassword: boolean
  createdAt: Date
}

/**
 * Verifica se o usuário atual é admin
 */
async function requireAdmin(): Promise<{ userId: string } | null> {
  const session = await getSession()
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true }
  })

  if (!user?.isAdmin) return null

  return { userId: session.userId }
}

/**
 * Lista todos os usuários (apenas admin)
 */
export async function getUsers(): Promise<User[]> {
  const admin = await requireAdmin()
  if (!admin) return []

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      isAdmin: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' }
  })

  return users
}

/**
 * Gera uma senha temporária aleatória
 */
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

/**
 * Cria um novo usuário (apenas admin)
 */
export async function createUser(email: string, isAdmin: boolean = false): Promise<ActionResult & { tempPassword?: string }> {
  const admin = await requireAdmin()
  if (!admin) {
    return { success: false, error: 'Acesso não autorizado' }
  }

  // Sanitizar e validar email
  const cleanEmail = sanitizeEmail(email)
  const emailValidation = validateEmail(cleanEmail)
  if (!emailValidation.valid) {
    return { success: false, error: emailValidation.error }
  }

  try {
    // Verificar se já existe
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail }
    })

    if (existing) {
      return { success: false, error: 'Este email já está cadastrado' }
    }

    // Gerar senha temporária
    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        isAdmin,
        isActive: true,
        mustChangePassword: true,
      }
    })

    // Enviar email de boas-vindas com a senha temporária
    await sendWelcomeEmail({ email: cleanEmail, tempPassword })

    secureLog('info', {
      action: 'user_created',
      userId: admin.userId,
      details: { newUserId: user.id, isAdmin }
    })

    revalidatePath('/admin/users')
    return { success: true, tempPassword }
  } catch (error) {
    secureLog('error', {
      action: 'create_user_error',
      userId: admin.userId,
      error: error instanceof Error ? error : new Error('Unknown error')
    })
    return { success: false, error: 'Erro ao criar usuário' }
  }
}

/**
 * Ativa ou desativa um usuário (apenas admin)
 */
export async function toggleUserActive(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin()
  if (!admin) {
    return { success: false, error: 'Acesso não autorizado' }
  }

  // Não permitir desativar a si mesmo
  if (userId === admin.userId) {
    return { success: false, error: 'Você não pode desativar sua própria conta' }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return { success: false, error: 'Usuário não encontrado' }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive }
    })

    secureLog('info', {
      action: user.isActive ? 'user_deactivated' : 'user_activated',
      userId: admin.userId,
      details: { targetUserId: userId }
    })

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Erro ao atualizar usuário' }
  }
}

/**
 * Altera o status de admin de um usuário (apenas admin)
 */
export async function toggleUserAdmin(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin()
  if (!admin) {
    return { success: false, error: 'Acesso não autorizado' }
  }

  // Não permitir remover o próprio admin
  if (userId === admin.userId) {
    return { success: false, error: 'Você não pode alterar seu próprio status de admin' }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return { success: false, error: 'Usuário não encontrado' }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isAdmin: !user.isAdmin }
    })

    secureLog('info', {
      action: user.isAdmin ? 'admin_removed' : 'admin_granted',
      userId: admin.userId,
      details: { targetUserId: userId }
    })

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Erro ao atualizar usuário' }
  }
}

/**
 * Reseta a senha de um usuário (apenas admin)
 */
export async function resetUserPassword(userId: string): Promise<ActionResult & { tempPassword?: string }> {
  const admin = await requireAdmin()
  if (!admin) {
    return { success: false, error: 'Acesso não autorizado' }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return { success: false, error: 'Usuário não encontrado' }
    }

    // Gerar nova senha temporária
    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    await prisma.user.update({
      where: { id: userId },
      data: { 
        passwordHash,
        mustChangePassword: true
      }
    })

    // Enviar email com nova senha
    await sendWelcomeEmail({ email: user.email, tempPassword })

    secureLog('info', {
      action: 'password_reset_by_admin',
      userId: admin.userId,
      details: { targetUserId: userId }
    })

    revalidatePath('/admin/users')
    return { success: true, tempPassword }
  } catch (error) {
    return { success: false, error: 'Erro ao resetar senha' }
  }
}

/**
 * Deleta um usuário (apenas admin)
 */
export async function deleteUser(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin()
  if (!admin) {
    return { success: false, error: 'Acesso não autorizado' }
  }

  // Não permitir deletar a si mesmo
  if (userId === admin.userId) {
    return { success: false, error: 'Você não pode deletar sua própria conta' }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return { success: false, error: 'Usuário não encontrado' }
    }

    await prisma.user.delete({
      where: { id: userId }
    })

    secureLog('info', {
      action: 'user_deleted',
      userId: admin.userId,
      details: { targetUserId: userId, deletedEmail: user.email }
    })

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Erro ao deletar usuário' }
  }
}

/**
 * Verifica se precisa trocar senha (usado pelo middleware)
 */
export async function checkMustChangePassword(): Promise<boolean> {
  const session = await getSession()
  if (!session) return false

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { mustChangePassword: true }
  })

  return user?.mustChangePassword || false
}
