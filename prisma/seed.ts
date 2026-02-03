import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Check if admin user already exists (idempotent)
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@atena.app' },
  })

  if (existingAdmin) {
    console.log('✅ Admin user already exists, skipping creation.')
    return
  }

  // Hash password (senha temporária: admin123)
  const passwordHash = await bcrypt.hash('admin123', 12)

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@atena.app',
      passwordHash,
      isAdmin: true,
      isActive: true,
      mustChangePassword: true, // Admin precisa trocar senha no primeiro acesso
    },
  })

  console.log(`✅ Created admin user with id: ${admin.id}`)
  console.log('📧 Email: admin@atena.app')
  console.log('🔑 Senha temporária: admin123')
  console.log('⚠️  Troque a senha no primeiro acesso!')
  console.log('🌱 Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
