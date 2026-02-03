const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const codes = await prisma.loginCode.findMany();
    console.log('LoginCodes existem:', codes.length);
  } catch (e) {
    console.log('Erro ao acessar LoginCode:', e.message);
    console.log('\nVerificando schema...');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
