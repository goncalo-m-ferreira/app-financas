import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedCategory = {
  name: string;
  color: string;
  icon: string;
};

const DEFAULT_EXPENSE_CATEGORIES: SeedCategory[] = [
  { name: 'Alimentacao', color: '#ef4444', icon: 'utensils' },
  { name: 'Transporte', color: '#f59e0b', icon: 'bus' },
  { name: 'Casa', color: '#3b82f6', icon: 'home' },
  { name: 'Saude', color: '#22c55e', icon: 'heart-pulse' },
  { name: 'Lazer', color: '#8b5cf6', icon: 'gamepad-2' },
  { name: 'Educacao', color: '#14b8a6', icon: 'book-open' },
];

async function seedDefaultCategories(userId: string): Promise<void> {
  for (const category of DEFAULT_EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: {
        userId_name: {
          userId,
          name: category.name,
        },
      },
      update: {
        color: category.color,
        icon: category.icon,
      },
      create: {
        userId,
        name: category.name,
        color: category.color,
        icon: category.icon,
      },
    });
  }
}

async function main(): Promise<void> {
  const seedUserEmail = process.env.SEED_USER_EMAIL ?? 'demo@app-financas.local';
  const seedUserName = process.env.SEED_USER_NAME ?? 'Utilizador Demo';
  const seedCurrency = process.env.SEED_DEFAULT_CURRENCY ?? 'EUR';
  const seedUserPasswordHash =
    process.env.SEED_USER_PASSWORD_HASH ?? 'trocar-por-hash-real-na-fase-3';

  if (seedUserPasswordHash === 'trocar-por-hash-real-na-fase-3') {
    console.warn(
      '[seed] Aviso: SEED_USER_PASSWORD_HASH nao definido. A conta demo usa um placeholder.',
    );
  }

  const user = await prisma.user.upsert({
    where: { email: seedUserEmail },
    update: {
      name: seedUserName,
      defaultCurrency: seedCurrency,
    },
    create: {
      email: seedUserEmail,
      name: seedUserName,
      passwordHash: seedUserPasswordHash,
      defaultCurrency: seedCurrency,
    },
    select: {
      id: true,
      email: true,
    },
  });

  await seedDefaultCategories(user.id);

  console.log(
    `[seed] Concluido. Utilizador "${user.email}" preparado com ${DEFAULT_EXPENSE_CATEGORIES.length} categorias.`,
  );
}

main()
  .catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(
        `[seed] PrismaClientKnownRequestError (${error.code}): ${error.message}`,
      );
    } else if (error instanceof Prisma.PrismaClientValidationError) {
      console.error(`[seed] PrismaClientValidationError: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`[seed] Erro inesperado: ${error.message}`);
    } else {
      console.error('[seed] Erro desconhecido ao executar seed.');
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error('[seed] Falha ao fechar a ligacao Prisma.', disconnectError);
    }
  });
