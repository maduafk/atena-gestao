const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('=== ESTADO DO BANCO DE DADOS ===\n');
  
  const users = await prisma.user.findMany();
  const cards = await prisma.card.count();
  const purchases = await prisma.cardPurchase.count();
  const incomes = await prisma.incomeTransaction.count();
  const debits = await prisma.debitTransaction.count();
  
  console.log('Usuários:', users.length);
  users.forEach(u => console.log(`  - ${u.email} (admin: ${u.isAdmin})`));
  
  console.log('\nCartões:', cards);
  console.log('Compras no cartão:', purchases);
  console.log('Rendas:', incomes);
  console.log('Débitos:', debits);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
