const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@atena.app' }
  });
  
  if (user) {
    console.log('Usuário admin encontrado:');
    console.log('- ID:', user.id);
    console.log('- Email:', user.email);
    console.log('- isAdmin:', user.isAdmin);
    console.log('- isActive:', user.isActive);
    console.log('- mustChangePassword:', user.mustChangePassword);
    console.log('- passwordHash existe:', !!user.passwordHash);
    console.log('- passwordHash length:', user.passwordHash?.length);
  } else {
    console.log('Usuário admin NÃO encontrado no banco!');
    console.log('Execute: npx prisma db seed');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
