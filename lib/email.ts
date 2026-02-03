// Email desabilitado - códigos aparecem apenas no console do servidor

/**
 * Gera um código de 6 dígitos para verificação de login
 */
export function generateLoginCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

interface SendLoginCodeParams {
  email: string
  code: string
}

interface SendWelcomeEmailParams {
  email: string
  tempPassword: string
}

export async function sendLoginCode({ email, code }: SendLoginCodeParams): Promise<boolean> {
  console.log('\n========================================')
  console.log(`📧 CÓDIGO DE LOGIN`)
  console.log(`👤 Email: ${email}`)
  console.log(`🔑 Código: ${code}`)
  console.log('========================================\n')

  return true
}

export async function sendWelcomeEmail({ email, tempPassword }: SendWelcomeEmailParams): Promise<boolean> {
  console.log('\n========================================')
  console.log(`📧 NOVA CONTA CRIADA`)
  console.log(`👤 Email: ${email}`)
  console.log(`🔑 Senha temporária: ${tempPassword}`)
  console.log('========================================\n')

  return true
}
