import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedCategory = {
  name: string;
  color: string;
  icon: string;
};

type SeedTransaction = {
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  description: string;
  categoryName?: string;
  transactionDate: Date;
};

const DEFAULT_EXPENSE_CATEGORIES: SeedCategory[] = [
  { name: 'BILLS', color: '#60a5fa', icon: 'receipt' },
  { name: 'CLOUD DRIVE', color: '#a78bfa', icon: 'cloud' },
  { name: 'SUBSCRIPTION', color: '#818cf8', icon: 'repeat' },
  { name: 'TRANSPORT', color: '#fb923c', icon: 'train' },
  { name: 'GROCERIES', color: '#34d399', icon: 'shopping-basket' },
  { name: 'SHOPPING', color: '#fbbf24', icon: 'shopping-bag' },
  { name: 'DINING', color: '#f87171', icon: 'utensils' },
  { name: 'HEALTH', color: '#22c55e', icon: 'heart-pulse' },
];

function daysAgoWithTime(daysAgo: number, hour: number, minute: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function buildDemoTransactions(): SeedTransaction[] {
  return [
    {
      type: 'EXPENSE',
      amount: '14.90',
      description: 'Spotify',
      categoryName: 'SUBSCRIPTION',
      transactionDate: daysAgoWithTime(2, 8, 26),
    },
    {
      type: 'EXPENSE',
      amount: '14.60',
      description: 'SBB',
      categoryName: 'TRANSPORT',
      transactionDate: daysAgoWithTime(2, 9, 14),
    },
    {
      type: 'INCOME',
      amount: '75.00',
      description: 'Freelance transfer',
      transactionDate: daysAgoWithTime(2, 16, 3),
    },
    {
      type: 'EXPENSE',
      amount: '3499.00',
      description: 'Apple',
      categoryName: 'SHOPPING',
      transactionDate: daysAgoWithTime(3, 10, 14),
    },
    {
      type: 'INCOME',
      amount: '150.00',
      description: 'Lukas Schneider',
      transactionDate: daysAgoWithTime(3, 10, 32),
    },
    {
      type: 'EXPENSE',
      amount: '65.00',
      description: 'Swisscom',
      categoryName: 'BILLS',
      transactionDate: daysAgoWithTime(3, 10, 52),
    },
    {
      type: 'EXPENSE',
      amount: '50.00',
      description: 'Heidi Kauer',
      categoryName: 'DINING',
      transactionDate: daysAgoWithTime(3, 16, 50),
    },
    {
      type: 'EXPENSE',
      amount: '9.99',
      description: 'Dropbox',
      categoryName: 'CLOUD DRIVE',
      transactionDate: daysAgoWithTime(4, 12, 49),
    },
    {
      type: 'EXPENSE',
      amount: '73.48',
      description: 'Migros',
      categoryName: 'GROCERIES',
      transactionDate: daysAgoWithTime(4, 13, 7),
    },
    {
      type: 'EXPENSE',
      amount: '20.00',
      description: 'Open AI',
      categoryName: 'CLOUD DRIVE',
      transactionDate: daysAgoWithTime(4, 15, 32),
    },
    {
      type: 'INCOME',
      amount: '3200.00',
      description: 'Salary',
      transactionDate: daysAgoWithTime(5, 9, 5),
    },
    {
      type: 'EXPENSE',
      amount: '129.00',
      description: 'Health Insurance',
      categoryName: 'BILLS',
      transactionDate: daysAgoWithTime(6, 11, 20),
    },
    {
      type: 'EXPENSE',
      amount: '42.30',
      description: 'Electricity',
      categoryName: 'BILLS',
      transactionDate: daysAgoWithTime(7, 17, 45),
    },
    {
      type: 'INCOME',
      amount: '220.00',
      description: 'Apple refund',
      transactionDate: daysAgoWithTime(8, 14, 20),
    },
    {
      type: 'EXPENSE',
      amount: '89.90',
      description: 'Gym Membership',
      categoryName: 'HEALTH',
      transactionDate: daysAgoWithTime(9, 7, 50),
    },
    {
      type: 'EXPENSE',
      amount: '19.99',
      description: 'iCloud+',
      categoryName: 'CLOUD DRIVE',
      transactionDate: daysAgoWithTime(1, 7, 40),
    },
    {
      type: 'EXPENSE',
      amount: '58.20',
      description: 'Coop',
      categoryName: 'GROCERIES',
      transactionDate: daysAgoWithTime(1, 18, 10),
    },
    {
      type: 'EXPENSE',
      amount: '35.00',
      description: 'Restaurant',
      categoryName: 'DINING',
      transactionDate: daysAgoWithTime(0, 20, 5),
    },
    {
      type: 'EXPENSE',
      amount: '12.99',
      description: 'Netflix',
      categoryName: 'SUBSCRIPTION',
      transactionDate: daysAgoWithTime(0, 21, 12),
    },
  ];
}

async function resetUserDemoData(userId: string): Promise<void> {
  await prisma.transaction.deleteMany({
    where: { userId },
  });

  await prisma.expenseCategory.deleteMany({
    where: { userId },
  });
}

async function seedDefaultCategories(userId: string): Promise<Map<string, string>> {
  const categoryByName = new Map<string, string>();

  for (const category of DEFAULT_EXPENSE_CATEGORIES) {
    const createdCategory = await prisma.expenseCategory.create({
      data: {
        userId,
        name: category.name,
        color: category.color,
        icon: category.icon,
      },
    });

    categoryByName.set(createdCategory.name, createdCategory.id);
  }

  return categoryByName;
}

async function seedDemoTransactions(
  userId: string,
  categoryByName: Map<string, string>,
): Promise<number> {
  const transactions = buildDemoTransactions();

  for (const transaction of transactions) {
    const categoryId = transaction.categoryName
      ? (categoryByName.get(transaction.categoryName) ?? null)
      : null;

    if (transaction.type === 'EXPENSE' && !categoryId) {
      throw new Error(
        `[seed] Categoria "${transaction.categoryName}" não encontrada para despesa "${transaction.description}".`,
      );
    }

    await prisma.transaction.create({
      data: {
        userId,
        type: transaction.type,
        amount: new Prisma.Decimal(transaction.amount),
        description: transaction.description,
        categoryId,
        transactionDate: transaction.transactionDate,
      },
    });
  }

  return transactions.length;
}

async function main(): Promise<void> {
  const seedUserEmail = process.env.SEED_USER_EMAIL ?? 'demo@app-financas.local';
  const seedUserName = process.env.SEED_USER_NAME ?? 'Utilizador Demo';
  const seedCurrency = process.env.SEED_DEFAULT_CURRENCY ?? 'CHF';
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

  await resetUserDemoData(user.id);
  const categoryByName = await seedDefaultCategories(user.id);
  const transactionsCount = await seedDemoTransactions(user.id, categoryByName);

  console.log(
    `[seed] Concluido. Utilizador "${user.email}" preparado com ${DEFAULT_EXPENSE_CATEGORIES.length} categorias e ${transactionsCount} transacoes.`,
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
