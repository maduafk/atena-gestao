import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

const protectedRoutes = ['/', '/cards', '/debit', '/income', '/settings', '/logout']
const adminRoutes = ['/admin']
const publicRoutes = ['/login']
const changePasswordRoute = '/change-password'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  const isProtectedRoute = protectedRoutes.some(route => 
    path === route || path.startsWith(route + '/')
  )
  const isAdminRoute = adminRoutes.some(route => 
    path === route || path.startsWith(route + '/')
  )
  const isPublicRoute = publicRoutes.includes(path)
  const isChangePasswordRoute = path === changePasswordRoute

  // Verificar e validar sessão
  const sessionCookie = request.cookies.get('atena-session')?.value
  let session = null
  
  if (sessionCookie) {
    try {
      session = await decrypt(sessionCookie)
      
      // Verificar se a sessão não expirou
      if (session && new Date(session.expiresAt) < new Date()) {
        session = null
      }
    } catch {
      // Token inválido ou corrompido
      session = null
    }
  }

  // Redirect to login if accessing protected route without session
  if ((isProtectedRoute || isAdminRoute || isChangePasswordRoute) && !session) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    // Limpar cookie inválido se existir
    if (sessionCookie) {
      response.cookies.delete('atena-session')
    }
    return response
  }

  // Redirect to home if accessing login with valid session
  if (isPublicRoute && session) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Verificar acesso admin
  if (isAdminRoute && session && !session.isAdmin) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Adicionar headers de segurança na resposta
  const response = NextResponse.next()
  
  // Prevenir clickjacking
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  
  // Prevenir MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
