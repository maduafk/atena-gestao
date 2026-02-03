const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@atena.app' }
  });
  
  if (!user) {
    console.log('Usuário não encontrado!');
    return;
  }

  console.log('Hash armazenado:', user.passwordHash);
  
  const senhaCorreta = await bcrypt.compare('admin123', user.passwordHash);
  console.log('Senha "admin123" está correta?', senhaCorreta);
  
  if (!senhaCorreta) {
    // Vamos resetar a senha
    console.log('\n🔄 Resetando a senha para "admin123"...');
    const novoHash = await bcrypt.hash('admin123', 12);
    
    await prisma.user.update({
      where: { email: 'admin@atena.app' },
      data: { passwordHash: novoHash }
    });
    
    console.log('✅ Senha resetada com sucesso!');
    console.log('📧 Email: admin@atena.app');
    console.log('🔑 Senha: admin123');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
