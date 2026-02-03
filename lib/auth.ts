import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

// Verificar se AUTH_SECRET está configurado
const secretKey = process.env.AUTH_SECRET
if (!secretKey || secretKey === 'default-secret-change-me') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be set in production!')
  }
  console.warn('⚠️ AUTH_SECRET não configurado. Use uma chave segura em produção!')
}

const key = new TextEncoder().encode(secretKey || 'dev-only-secret-key-not-for-production')

const COOKIE_NAME = 'atena-session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface SessionPayload {
  userId: string
  email: string
  isAdmin: boolean
  expiresAt: Date
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload, expiresAt: payload.expiresAt.toISOString() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key)
}

export async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    })
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      isAdmin: payload.isAdmin as boolean || false,
      expiresAt: new Date(payload.expiresAt as string),
    }
  } catch {
    return null
  }
}

export async function createSession(userId: string, email: string, isAdmin: boolean = false): Promise<void> {
  const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE * 1000)
  const session = await encrypt({ userId, email, isAdmin, expiresAt })
  
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get(COOKIE_NAME)?.value
  if (!session) return null
  return await decrypt(session)
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function verifySession(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session) return null
  if (new Date(session.expiresAt) < new Date()) return null
  return session
}
