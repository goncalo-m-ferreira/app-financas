import { Prisma, type TransactionType } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { eventPublisher } from '../events/noop-event-publisher.js';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';
import { createNotification } from './notifications.service.js';
import { resolveMonthYearRange } from '../utils/date-range.js';

export type ListTransactionsFilters = {
  type?: TransactionType;
  categoryId?: string;
  from?: Date;
  to?: Date;
  toExclusive?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  take?: number;
  skip?: number;
};

export type CreateTransactionInput = {
  type: TransactionType;
  amount: number;
  description?: string;
  transactionDate: Date;
  categoryId?: string;
  walletId: string;
};

export type UpdateTransactionInput = {
  type?: TransactionType;
  amount?: number;
  description?: string | null;
  transactionDate?: Date;
  categoryId?: string | null;
  walletId?: string | null;
};

export type ImportTransactionsCsvInput = {
  walletId: string;
  csvBuffer: Buffer;
};

export type ImportTransactionsCsvResult = {
  importedCount: number;
  walletId: string;
  netAmount: string;
};

type ParsedCsvTransaction = {
  type: TransactionType;
  amount: number;
  netAmount: number;
  description: string | null;
  transactionDate: Date;
};

type CategoryHeuristicRule = {
  keywords: string[];
  categoryCandidates: string[];
};

type NormalizedCategory = {
  id: string;
  normalizedName: string;
};

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: {
    category: {
      select: {
        id: true;
        name: true;
        color: true;
        icon: true;
      };
    };
    wallet: {
      select: {
        id: true;
        name: true;
        color: true;
      };
    };
  };
}>;

type TransactionResponse = Omit<TransactionWithRelations, 'amount'> & {
  amount: string;
};

const MAX_IMPORT_ROWS = 5000;

const REQUIRED_IMPORT_COLUMNS = ['date', 'description', 'amount'] as const;

const CATEGORY_HEURISTIC_RULES: CategoryHeuristicRule[] = [
  {
    keywords: ['UBER', 'GLOVO', 'RESTAURANTE', 'RESTAURANT', 'IFOOD'],
    categoryCandidates: ['DINING', 'FOOD', 'RESTAURANTE', 'RESTAURANTES'],
  },
  {
    keywords: ['CONTINENTE', 'PINGO DOCE', 'PINGODOCE', 'SUPERMERCADO', 'LIDL', 'MERCADONA'],
    categoryCandidates: ['GROCERIES', 'GROCERY', 'SUPERMARKET', 'SUPERMERCADO'],
  },
  {
    keywords: ['SALARIO', 'SALARY', 'VENCIMENTO', 'PAYROLL'],
    categoryCandidates: ['SALARY', 'RENDIMENTO', 'INCOME'],
  },
];

function toTransactionResponse(transaction: TransactionWithRelations): TransactionResponse {
  return {
    ...transaction,
    amount: transaction.amount.toString(),
  };
}

function toAmountNumber(amount: Prisma.Decimal | number): number {
  const value =
    amount instanceof Prisma.Decimal ? Number.parseFloat(amount.toString()) : Number(amount);

  if (!Number.isFinite(value)) {
    throw new AppError('Invalid transaction amount.', 400);
  }

  return Math.abs(value);
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function normalizeCategoryKey(value: string): string {
  return normalizeSearchText(value).replace(/[^A-Z0-9]/g, '');
}

function normalizeImportHeader(columnName: string): string {
  const normalizedHeader = normalizeCategoryKey(columnName);

  if (normalizedHeader === 'DATE') {
    return 'date';
  }

  if (normalizedHeader === 'DESCRIPTION') {
    return 'description';
  }

  if (normalizedHeader === 'AMOUNT') {
    return 'amount';
  }

  return normalizedHeader.toLowerCase();
}

function parseCsvRows(csvContent: string, delimiter: string): string[][] {
  try {
    return parse(csvContent, {
      bom: true,
      delimiter,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    }) as string[][];
  } catch {
    throw new AppError('CSV inválido ou mal formatado.', 400);
  }
}

function parseGenericCsvRows(csvContent: string): Array<Record<string, unknown>> {
  let parsedHeaderColumns: string[] = [];

  try {
    const parsedRows = parse(csvContent, {
      bom: true,
      columns: (header: string[]) => {
        parsedHeaderColumns = header.map((column) => normalizeImportHeader(column));
        return parsedHeaderColumns;
      },
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Array<Record<string, unknown>>;

    const missingColumns = REQUIRED_IMPORT_COLUMNS.filter(
      (column) => !parsedHeaderColumns.includes(column),
    );

    if (missingColumns.length > 0) {
      throw new AppError(
        `CSV inválido. Colunas obrigatórias em falta: ${missingColumns.join(', ')}.`,
        400,
      );
    }

    return parsedRows;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('CSV inválido ou mal formatado.', 400);
  }
}

function findSantanderHeaderRowIndex(rows: string[][]): number {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const firstCell = String(row[0] ?? '').trim();
    const thirdCell = String(row[2] ?? '').trim();
    const normalizedFirstCell = normalizeSearchText(firstCell);
    const normalizedThirdCell = normalizeSearchText(thirdCell);

    const matchesByFirstColumn =
      normalizedFirstCell.includes('DATA OPERA') || normalizedFirstCell.includes('DATAOPER');
    const matchesByStructure = row.length >= 5 && normalizedThirdCell.includes('DESCRI');

    if (matchesByFirstColumn || matchesByStructure) {
      return index;
    }
  }

  return -1;
}

function findHeaderColumnIndexOrThrow(
  headerRow: string[],
  candidates: string[],
  label: string,
): number {
  const normalizedHeaderRow = headerRow.map((column) => normalizeCategoryKey(String(column ?? '')));

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeCategoryKey(candidate);
    const exactMatchIndex = normalizedHeaderRow.findIndex(
      (header) => header === normalizedCandidate,
    );

    if (exactMatchIndex >= 0) {
      return exactMatchIndex;
    }

    const partialMatchIndex = normalizedHeaderRow.findIndex((header) =>
      header.includes(normalizedCandidate),
    );

    if (partialMatchIndex >= 0) {
      return partialMatchIndex;
    }
  }

  throw new AppError(`CSV inválido. Coluna obrigatória em falta: ${label}.`, 400);
}

function buildValidatedLocalDate(params: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  lineNumber: number;
}): Date {
  const parsedDate = new Date(
    params.year,
    params.month - 1,
    params.day,
    params.hour,
    params.minute,
    params.second,
  );

  if (
    parsedDate.getFullYear() !== params.year ||
    parsedDate.getMonth() !== params.month - 1 ||
    parsedDate.getDate() !== params.day ||
    parsedDate.getHours() !== params.hour ||
    parsedDate.getMinutes() !== params.minute ||
    parsedDate.getSeconds() !== params.second
  ) {
    throw new AppError(`Linha ${params.lineNumber}: Date inválido.`, 400);
  }

  return parsedDate;
}

function parseCsvDate(rawValue: string, lineNumber: number): Date {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    throw new AppError(`Linha ${lineNumber}: Date é obrigatório.`, 400);
  }

  const dayFirstMatch = trimmed.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );

  if (dayFirstMatch) {
    const day = Number.parseInt(dayFirstMatch[1], 10);
    const month = Number.parseInt(dayFirstMatch[2], 10);
    let year = Number.parseInt(dayFirstMatch[3], 10);
    const hasTime = dayFirstMatch[4] !== undefined;
    const hour = Number.parseInt(dayFirstMatch[4] ?? '12', 10);
    const minute = Number.parseInt(dayFirstMatch[5] ?? '0', 10);
    const second = Number.parseInt(dayFirstMatch[6] ?? '0', 10);

    if (year < 100) {
      year += 2000;
    }

    return buildValidatedLocalDate({
      year,
      month,
      day,
      hour: hasTime ? hour : 12,
      minute,
      second,
      lineNumber,
    });
  }

  const yearFirstMatch = trimmed.match(
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );

  if (yearFirstMatch) {
    const year = Number.parseInt(yearFirstMatch[1], 10);
    const month = Number.parseInt(yearFirstMatch[2], 10);
    const day = Number.parseInt(yearFirstMatch[3], 10);
    const hasTime = yearFirstMatch[4] !== undefined;
    const hour = Number.parseInt(yearFirstMatch[4] ?? '12', 10);
    const minute = Number.parseInt(yearFirstMatch[5] ?? '0', 10);
    const second = Number.parseInt(yearFirstMatch[6] ?? '0', 10);

    return buildValidatedLocalDate({
      year,
      month,
      day,
      hour: hasTime ? hour : 12,
      minute,
      second,
      lineNumber,
    });
  }

  const directDate = new Date(trimmed);

  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  throw new AppError(`Linha ${lineNumber}: Date inválido.`, 400);
}

function normalizeAmountString(rawAmount: string): string {
  let cleanAmount = String(rawAmount).trim();
  cleanAmount = cleanAmount.replace(/\s+/g, '').replace(/\u00A0/g, '');

  const hasComma = cleanAmount.includes(',');
  const hasDot = cleanAmount.includes('.');

  if (hasComma && (!hasDot || cleanAmount.lastIndexOf(',') > cleanAmount.lastIndexOf('.'))) {
    cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
  } else {
    cleanAmount = cleanAmount.replace(/,/g, '');
  }

  return cleanAmount;
}

function parseSignedAmount(rawValue: string, lineNumber: number, label: string): number {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    throw new AppError(`Linha ${lineNumber}: ${label} é obrigatório.`, 400);
  }

  let normalizedValue = trimmed.replace(/\s+/g, '').replace(/\u00A0/g, '');
  let signalFromParentheses = 1;

  if (normalizedValue.startsWith('(') && normalizedValue.endsWith(')')) {
    signalFromParentheses = -1;
    normalizedValue = normalizedValue.slice(1, -1);
  }

  normalizedValue = normalizedValue.replace(/[^\d,.\-+]/g, '');

  if (!normalizedValue) {
    throw new AppError(`Linha ${lineNumber}: ${label} inválido.`, 400);
  }

  normalizedValue = normalizeAmountString(normalizedValue);
  normalizedValue = normalizedValue.replace(/(?!^)[+-]/g, '');

  const parsedAmount = Number.parseFloat(normalizedValue);

  if (!Number.isFinite(parsedAmount) || parsedAmount === 0) {
    throw new AppError(`Linha ${lineNumber}: ${label} inválido.`, 400);
  }

  const signalFromValue =
    signalFromParentheses === -1 ? 1 : normalizedValue.startsWith('-') ? -1 : 1;
  const signedAmount = Math.abs(parsedAmount) * signalFromValue * signalFromParentheses;

  if (signedAmount === 0) {
    throw new AppError(`Linha ${lineNumber}: ${label} inválido.`, 400);
  }

  return signedAmount;
}

function parseCsvSignedAmount(rawValue: string, lineNumber: number): number {
  return parseSignedAmount(rawValue, lineNumber, 'Amount');
}

function parsePortugueseSignedAmount(rawValue: string, lineNumber: number): number {
  return parseSignedAmount(rawValue, lineNumber, 'Montante');
}

function parseSantanderTransactionsRows(rows: string[][], headerRowIndex: number): ParsedCsvTransaction[] {
  const headerRow = rows[headerRowIndex] ?? [];

  const dateIndex = findHeaderColumnIndexOrThrow(headerRow, ['Data Operação'], 'Data Operação');
  const descriptionIndex = findHeaderColumnIndexOrThrow(headerRow, ['Descrição'], 'Descrição');
  const amountIndex = findHeaderColumnIndexOrThrow(
    headerRow,
    ['Montante( EUR )', 'Montante EUR', 'Montante'],
    'Montante( EUR )',
  );

  const transactions: ParsedCsvTransaction[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const lineNumber = rowIndex + 1;
    const dateRaw = String(row[dateIndex] ?? '').trim();
    const descriptionRaw = String(row[descriptionIndex] ?? '').trim();
    const amountRaw = String(row[amountIndex] ?? '').trim();

    if (!dateRaw && !descriptionRaw && !amountRaw) {
      continue;
    }

    if (!dateRaw) {
      throw new AppError(`Linha ${lineNumber}: Data Operação é obrigatória.`, 400);
    }

    if (!descriptionRaw) {
      throw new AppError(`Linha ${lineNumber}: Descrição é obrigatória.`, 400);
    }

    if (descriptionRaw.length > 255) {
      throw new AppError(`Linha ${lineNumber}: Description não pode exceder 255 caracteres.`, 400);
    }

    const signedAmount = parsePortugueseSignedAmount(amountRaw, lineNumber);
    const transactionDate = parseCsvDate(dateRaw, lineNumber);
    const transactionType: TransactionType = signedAmount > 0 ? 'INCOME' : 'EXPENSE';

    transactions.push({
      type: transactionType,
      amount: Math.abs(signedAmount),
      netAmount: signedAmount,
      description: descriptionRaw,
      transactionDate,
    });
  }

  return transactions;
}

function parseGenericTransactions(csvContent: string): ParsedCsvTransaction[] {
  const csvRows = parseGenericCsvRows(csvContent);

  return csvRows.map((row, index) => {
    const lineNumber = index + 2;
    const descriptionRaw = String(row.description ?? '').trim();

    if (!descriptionRaw) {
      throw new AppError(`Linha ${lineNumber}: Description é obrigatório.`, 400);
    }

    if (descriptionRaw.length > 255) {
      throw new AppError(`Linha ${lineNumber}: Description não pode exceder 255 caracteres.`, 400);
    }

    const signedAmount = parseCsvSignedAmount(String(row.amount ?? ''), lineNumber);
    const transactionDate = parseCsvDate(String(row.date ?? ''), lineNumber);
    const transactionType: TransactionType = signedAmount > 0 ? 'INCOME' : 'EXPENSE';

    return {
      type: transactionType,
      amount: Math.abs(signedAmount),
      netAmount: signedAmount,
      description: descriptionRaw,
      transactionDate,
    };
  });
}

function parseTransactionsFromCsvBuffer(csvBuffer: Buffer): ParsedCsvTransaction[] {
  const csvContent = csvBuffer.toString('utf8');

  if (!csvContent.trim()) {
    throw new AppError('O ficheiro CSV está vazio.', 400);
  }

  const rows = parseCsvRows(csvContent, ';');
  const santanderHeaderRowIndex = findSantanderHeaderRowIndex(rows);

  const parsedTransactions =
    santanderHeaderRowIndex >= 0
      ? parseSantanderTransactionsRows(rows, santanderHeaderRowIndex)
      : parseGenericTransactions(csvContent);

  if (parsedTransactions.length === 0) {
    throw new AppError('CSV sem linhas de transações para importar.', 400);
  }

  if (parsedTransactions.length > MAX_IMPORT_ROWS) {
    throw new AppError(`CSV excede o limite de ${MAX_IMPORT_ROWS} linhas.`, 400);
  }

  return parsedTransactions;
}

function buildNormalizedCategories(
  categories: Array<{
    id: string;
    name: string;
  }>,
): {
  normalizedCategories: NormalizedCategory[];
  categoryIdByName: Map<string, string>;
} {
  const normalizedCategories = categories.map((category) => ({
    id: category.id,
    normalizedName: normalizeCategoryKey(category.name),
  }));

  const categoryIdByName = new Map<string, string>();

  for (const category of categories) {
    const normalizedCategoryName = normalizeCategoryKey(category.name);

    if (!categoryIdByName.has(normalizedCategoryName)) {
      categoryIdByName.set(normalizedCategoryName, category.id);
    }
  }

  return {
    normalizedCategories,
    categoryIdByName,
  };
}

function resolveCategoryIdForImport(
  description: string | null,
  categoryIdByName: Map<string, string>,
  normalizedCategories: NormalizedCategory[],
): string | null {
  if (!description) {
    return null;
  }

  const normalizedDescription = normalizeSearchText(description);
  const compactDescription = normalizeCategoryKey(description);

  for (const rule of CATEGORY_HEURISTIC_RULES) {
    const hasRuleKeyword = rule.keywords.some((keyword) => {
      const normalizedKeyword = normalizeSearchText(keyword);
      const compactKeyword = normalizeCategoryKey(keyword);

      return (
        normalizedDescription.includes(normalizedKeyword) || compactDescription.includes(compactKeyword)
      );
    });

    if (!hasRuleKeyword) {
      continue;
    }

    for (const categoryCandidate of rule.categoryCandidates) {
      const categoryId = categoryIdByName.get(normalizeCategoryKey(categoryCandidate));

      if (categoryId) {
        return categoryId;
      }
    }
  }

  for (const category of normalizedCategories) {
    if (category.normalizedName && compactDescription.includes(category.normalizedName)) {
      return category.id;
    }
  }

  return null;
}

function calculateWalletBalanceDelta(type: TransactionType, amount: Prisma.Decimal | number): number {
  const normalizedAmount = toAmountNumber(amount);
  return type === 'EXPENSE' ? -normalizedAmount : normalizedAmount;
}

function reverseWalletBalanceDelta(type: TransactionType, amount: Prisma.Decimal | number): number {
  return -calculateWalletBalanceDelta(type, amount);
}

async function ensureUserExists(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new AppError('Utilizador não encontrado.', 404);
  }
}

async function ensureCategoryBelongsToUser(userId: string, categoryId: string): Promise<void> {
  const category = await prisma.expenseCategory.findUnique({
    where: {
      userId_id: {
        userId,
        id: categoryId,
      },
    },
    select: { id: true },
  });

  if (!category) {
    throw new AppError('Categoria de despesa não encontrada para este utilizador.', 404);
  }
}

async function ensureWalletBelongsToUser(userId: string, walletId: string): Promise<void> {
  const wallet = await prisma.wallet.findUnique({
    where: {
      userId_id: {
        userId,
        id: walletId,
      },
    },
    select: { id: true },
  });

  if (!wallet) {
    throw new AppError('Wallet not found for this user.', 404);
  }
}

async function createBudgetAlertIfNeeded(params: {
  userId: string;
  categoryId: string | null;
  transactionDate: Date;
  transactionType: TransactionType;
}): Promise<void> {
  if (params.transactionType !== 'EXPENSE' || !params.categoryId) {
    return;
  }

  const budget = await prisma.budget.findUnique({
    where: {
      userId_categoryId: {
        userId: params.userId,
        categoryId: params.categoryId,
      },
    },
    include: {
      category: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!budget) {
    return;
  }

  const transactionMonth = params.transactionDate.getMonth() + 1;
  const transactionYear = params.transactionDate.getFullYear();
  const { start, endExclusive } = resolveMonthYearRange({
    month: transactionMonth,
    year: transactionYear,
  });

  const spentAggregate = await prisma.transaction.aggregate({
    where: {
      userId: params.userId,
      type: 'EXPENSE',
      categoryId: params.categoryId,
      transactionDate: {
        gte: start,
        lt: endExclusive,
      },
    },
    _sum: {
      amount: true,
    },
  });

  const spentAmount = Number.parseFloat(
    (spentAggregate._sum.amount ?? new Prisma.Decimal(0)).toString(),
  );
  const budgetAmount = Number.parseFloat(budget.amount.toString());

  if (!Number.isFinite(spentAmount) || !Number.isFinite(budgetAmount) || budgetAmount <= 0) {
    return;
  }

  const usageRatio = spentAmount / budgetAmount;

  if (usageRatio < 0.9) {
    return;
  }

  const existingAlert = await prisma.notification.findFirst({
    where: {
      userId: params.userId,
      type: 'BUDGET',
      title: 'Budget Alert',
      message: `You have used over 90% of your budget for ${budget.category.name}.`,
      createdAt: {
        gte: start,
        lt: endExclusive,
      },
    },
    select: { id: true },
  });

  if (existingAlert) {
    return;
  }

  await createNotification({
    userId: params.userId,
    title: 'Budget Alert',
    message: `You have used over 90% of your budget for ${budget.category.name}.`,
    type: 'BUDGET',
  });
}

async function getTransactionOrThrow(
  userId: string,
  transactionId: string,
): Promise<TransactionWithRelations> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          color: true,
          icon: true,
        },
      },
      wallet: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  });

  if (!transaction) {
    throw new AppError('Transação não encontrada.', 404);
  }

  return transaction;
}

function buildTransactionsFilter(
  userId: string,
  filters: ListTransactionsFilters,
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.from || filters.to || filters.toExclusive) {
    where.transactionDate = {};

    if (filters.from) {
      where.transactionDate.gte = filters.from;
    }

    if (filters.toExclusive) {
      where.transactionDate.lt = filters.toExclusive;
    } else if (filters.to) {
      where.transactionDate.lte = filters.to;
    }
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.amount = {};

    if (filters.minAmount !== undefined) {
      where.amount.gte = filters.minAmount;
    }

    if (filters.maxAmount !== undefined) {
      where.amount.lte = filters.maxAmount;
    }
  }

  if (filters.search) {
    const normalizedSearch = filters.search.trim();
    const upperSearch = normalizedSearch.toUpperCase();
    const orConditions: Prisma.TransactionWhereInput[] = [
      {
        description: {
          contains: normalizedSearch,
        },
      },
      {
        category: {
          name: {
            contains: normalizedSearch,
          },
        },
      },
    ];

    if (upperSearch.includes('INC')) {
      orConditions.push({ type: 'INCOME' });
    }

    if (upperSearch.includes('EXP')) {
      orConditions.push({ type: 'EXPENSE' });
    }

    where.OR = orConditions;
  }

  return where;
}

export async function listTransactionsByUser(
  userId: string,
  filters: ListTransactionsFilters,
): Promise<TransactionResponse[]> {
  await ensureUserExists(userId);

  if (filters.categoryId) {
    await ensureCategoryBelongsToUser(userId, filters.categoryId);
  }

  const transactions = await prisma.transaction.findMany({
    where: buildTransactionsFilter(userId, filters),
    include: {
      category: {
        select: {
          id: true,
          name: true,
          color: true,
          icon: true,
        },
      },
      wallet: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
    orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
    take: filters.take,
    skip: filters.skip,
  });

  return transactions.map(toTransactionResponse);
}

export async function getTransactionById(
  userId: string,
  transactionId: string,
): Promise<TransactionResponse> {
  await ensureUserExists(userId);
  const transaction = await getTransactionOrThrow(userId, transactionId);
  return toTransactionResponse(transaction);
}

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput,
): Promise<TransactionResponse> {
  await ensureUserExists(userId);

  const categoryId = input.categoryId ?? null;

  if (input.type === 'EXPENSE' && !categoryId) {
    throw new AppError('categoryId é obrigatório para transações do tipo EXPENSE.', 400);
  }

  if (!input.walletId) {
    throw new AppError('walletId is required.', 400);
  }

  if (categoryId) {
    await ensureCategoryBelongsToUser(userId, categoryId);
  }

  await ensureWalletBelongsToUser(userId, input.walletId);

  const walletDelta = calculateWalletBalanceDelta(input.type, input.amount);

  const transaction = await prisma.$transaction(async (tx) => {
    const createdTransaction = await tx.transaction.create({
      data: {
        userId,
        type: input.type,
        amount: input.amount,
        description: input.description,
        transactionDate: input.transactionDate,
        categoryId,
        walletId: input.walletId,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
        wallet: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    await tx.wallet.update({
      where: {
        userId_id: {
          userId,
          id: input.walletId,
        },
      },
      data: {
        balance: {
          increment: walletDelta,
        },
      },
    });

    return createdTransaction;
  });

  await eventPublisher.publish({
    name: 'transaction.created',
    payload: {
      transactionId: transaction.id,
      userId: transaction.userId,
      type: transaction.type,
      amount: transaction.amount.toString(),
      categoryId: transaction.categoryId,
      walletId: transaction.walletId,
      transactionDate: transaction.transactionDate.toISOString(),
    },
  });

  await createBudgetAlertIfNeeded({
    userId,
    categoryId: transaction.categoryId,
    transactionDate: transaction.transactionDate,
    transactionType: transaction.type,
  });

  return toTransactionResponse(transaction);
}

export async function importTransactionsFromCsv(
  userId: string,
  input: ImportTransactionsCsvInput,
): Promise<ImportTransactionsCsvResult> {
  await ensureUserExists(userId);
  await ensureWalletBelongsToUser(userId, input.walletId);

  const parsedTransactions = parseTransactionsFromCsvBuffer(input.csvBuffer);

  const categories = await prisma.expenseCategory.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
    },
  });

  const { normalizedCategories, categoryIdByName } = buildNormalizedCategories(categories);

  const importedTransactions = parsedTransactions.map((transaction) => {
    const categoryId = resolveCategoryIdForImport(
      transaction.description,
      categoryIdByName,
      normalizedCategories,
    );

    return {
      ...transaction,
      categoryId,
    };
  });

  const netAmount = importedTransactions.reduce(
    (accumulator, transaction) => accumulator + transaction.netAmount,
    0,
  );

  await prisma.$transaction(async (tx) => {
    await tx.transaction.createMany({
      data: importedTransactions.map((transaction) => ({
        userId,
        walletId: input.walletId,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        transactionDate: transaction.transactionDate,
        categoryId: transaction.categoryId,
      })),
    });

    await tx.wallet.update({
      where: {
        userId_id: {
          userId,
          id: input.walletId,
        },
      },
      data: {
        balance: {
          increment: netAmount,
        },
      },
    });
  });

  return {
    importedCount: importedTransactions.length,
    walletId: input.walletId,
    netAmount: netAmount.toFixed(2),
  };
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: UpdateTransactionInput,
): Promise<TransactionResponse> {
  await ensureUserExists(userId);

  const currentTransaction = await getTransactionOrThrow(userId, transactionId);
  const nextType = input.type ?? currentTransaction.type;
  const nextAmount = input.amount ?? toAmountNumber(currentTransaction.amount);
  const nextWalletId =
    input.walletId !== undefined ? input.walletId : currentTransaction.walletId;

  let nextCategoryId =
    input.categoryId !== undefined ? input.categoryId : currentTransaction.categoryId;

  if (input.type === 'INCOME' && input.categoryId === undefined) {
    nextCategoryId = null;
  }

  if (nextType === 'EXPENSE' && !nextCategoryId) {
    throw new AppError('categoryId é obrigatório para transações do tipo EXPENSE.', 400);
  }

  if (!nextWalletId) {
    throw new AppError('walletId is required for all transactions.', 400);
  }

  if (nextCategoryId) {
    await ensureCategoryBelongsToUser(userId, nextCategoryId);
  }

  await ensureWalletBelongsToUser(userId, nextWalletId);

  const data: Prisma.TransactionUncheckedUpdateInput = {
    type: nextType,
    amount: nextAmount,
    categoryId: nextCategoryId,
    walletId: nextWalletId,
  };

  if (input.description !== undefined) {
    data.description = input.description;
  }

  if (input.transactionDate !== undefined) {
    data.transactionDate = input.transactionDate;
  }

  const updatedTransaction = await prisma.$transaction(async (tx) => {
    if (currentTransaction.walletId) {
      const reverseDelta = reverseWalletBalanceDelta(
        currentTransaction.type,
        currentTransaction.amount,
      );

      await tx.wallet.update({
        where: {
          userId_id: {
            userId,
            id: currentTransaction.walletId,
          },
        },
        data: {
          balance: {
            increment: reverseDelta,
          },
        },
      });
    }

    const transaction = await tx.transaction.update({
      where: { id: transactionId },
      data,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
        wallet: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    const applyDelta = calculateWalletBalanceDelta(transaction.type, transaction.amount);

    await tx.wallet.update({
      where: {
        userId_id: {
          userId,
          id: nextWalletId,
        },
      },
      data: {
        balance: {
          increment: applyDelta,
        },
      },
    });

    return transaction;
  });

  return toTransactionResponse(updatedTransaction);
}

export async function deleteTransaction(
  userId: string,
  transactionId: string,
): Promise<TransactionResponse> {
  await ensureUserExists(userId);
  await getTransactionOrThrow(userId, transactionId);

  const deletedTransaction = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.delete({
      where: { id: transactionId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
        wallet: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    if (transaction.walletId) {
      const reverseDelta = reverseWalletBalanceDelta(transaction.type, transaction.amount);

      await tx.wallet.update({
        where: {
          userId_id: {
            userId,
            id: transaction.walletId,
          },
        },
        data: {
          balance: {
            increment: reverseDelta,
          },
        },
      });
    }

    return transaction;
  });

  return toTransactionResponse(deletedTransaction);
}
