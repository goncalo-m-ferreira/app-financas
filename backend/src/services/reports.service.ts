import { constants, createWriteStream } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { type Prisma, type Report, type ReportStatus } from '@prisma/client';
import { env } from '../config/env.js';
import { reportsPublicDir } from '../config/paths.js';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';
import { publishQueueMessage } from '../lib/rabbitmq.js';
import { createNotification } from './notifications.service.js';
import { resolveMonthYearRange } from '../utils/date-range.js';

export type CreateReportInput = {
  name?: string;
  month?: number;
  year?: number;
};

export type ListReportsInput = {
  status?: ReportStatus;
  month?: number;
  year?: number;
};

export type ReportQueueMessage = {
  reportId: string;
  userId: string;
  month: number;
  year: number;
};

export type ReportDownloadPayload = {
  filePath: string;
  downloadName: string;
};

type TransactionForReport = Prisma.TransactionGetPayload<{
  include: {
    category: {
      select: {
        name: true;
      };
    };
    wallet: {
      select: {
        name: true;
      };
    };
  };
}>;

async function ensureUserExists(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new AppError('Utilizador não encontrado.', 404);
  }
}

function buildDefaultReportName(month: number, year: number): string {
  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
  }).format(new Date(year, month - 1, 1));

  return `${monthLabel} ${year} Monthly Report`;
}

function buildSafeFailureMessage(error: unknown): string {
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      return 'Report generation failed due to a server error. Please try regenerate.';
    }

    const normalized = error.message.trim();
    return normalized.length > 0
      ? normalized.slice(0, 255)
      : 'Report generation failed. Please try regenerate.';
  }

  return 'Report generation failed. Please try regenerate.';
}

function resolveDownloadName(reportName: string, month: number, year: number): string {
  const trimmedName = reportName.trim();
  const baseName = trimmedName.length > 0 ? trimmedName : `report-${month}-${year}`;
  return baseName.toLowerCase().endsWith('.pdf') ? baseName : `${baseName}.pdf`;
}

function resolveReportFilePath(fileUrl: string): string {
  const trimmed = fileUrl.trim();

  if (trimmed.length === 0) {
    throw new AppError('Report file is unavailable.', 404);
  }

  const safeName = path.basename(trimmed);
  return path.resolve(reportsPublicDir, safeName);
}

function formatAmount(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value).concat(` ${currency}`);
}

function calculateSummary(transactions: TransactionForReport[]): {
  income: number;
  expense: number;
  net: number;
} {
  return transactions.reduce(
    (accumulator, transaction) => {
      const amount = Number.parseFloat(transaction.amount.toString());

      if (!Number.isFinite(amount)) {
        return accumulator;
      }

      if (transaction.type === 'INCOME') {
        accumulator.income += amount;
        accumulator.net += amount;
      } else {
        accumulator.expense += amount;
        accumulator.net -= amount;
      }

      return accumulator;
    },
    {
      income: 0,
      expense: 0,
      net: 0,
    },
  );
}

async function generateReportPdf(params: {
  filePath: string;
  reportName: string;
  userName: string;
  userEmail: string;
  currency: string;
  month: number;
  year: number;
  transactions: TransactionForReport[];
}): Promise<void> {
  await mkdir(path.dirname(params.filePath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const document = new PDFDocument({
      margin: 50,
      size: 'A4',
      bufferPages: true,
    });

    const stream = createWriteStream(params.filePath);

    stream.on('finish', resolve);
    stream.on('error', reject);
    document.on('error', reject);

    document.pipe(stream);

    const pageMargin = 50;
    const leftX = pageMargin;
    const rightX = document.page.width - pageMargin;
    const contentWidth = rightX - leftX;
    let cursorY = 52;

    const monthLabel = new Intl.DateTimeFormat('en-US', {
      month: 'long',
    }).format(new Date(params.year, params.month - 1, 1));
    const generatedAtLabel = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const summary = calculateSummary(params.transactions);

    const pageRightLimit = document.page.width - pageMargin;
    const amountColumnWidth = 100;
    const amountColumnX = pageRightLimit - amountColumnWidth;
    const tableColumns = {
      date: { x: leftX, width: 95 },
      description: { x: leftX + 105, width: 210 },
      wallet: { x: leftX + 325, width: 110 },
      amount: { x: amountColumnX, width: amountColumnWidth },
    };

    function drawHorizontalLine(y: number, color: string): void {
      document.lineWidth(1).strokeColor(color).moveTo(leftX, y).lineTo(rightX, y).stroke();
    }

    function drawPageHeader(): void {
      document
        .font('Helvetica-Bold')
        .fontSize(24)
        .fillColor('#0f172a')
        .text('MONEYWISE', leftX, cursorY, {
          lineBreak: false,
        });

      document
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#1e293b')
        .text('Monthly Statement', rightX - 170, cursorY + 2, {
          width: 170,
          align: 'right',
        });

      document
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#64748b')
        .text(`Generated ${generatedAtLabel}`, rightX - 170, cursorY + 21, {
          width: 170,
          align: 'right',
        });

      cursorY += 46;
      drawHorizontalLine(cursorY, '#cbd5e1');
      cursorY += 14;
    }

    function drawClientInformation(): void {
      document
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#334155')
        .text('Client Information', leftX, cursorY);
      cursorY += 17;

      document
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#475569')
        .text(`Name: ${params.userName}`, leftX, cursorY);
      cursorY += 14;

      document
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#475569')
        .text(`Email: ${params.userEmail}`, leftX, cursorY);
      cursorY += 14;

      document
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#475569')
        .text(`Period: ${monthLabel} ${params.year}`, leftX, cursorY);
      cursorY += 18;

      drawHorizontalLine(cursorY, '#e2e8f0');
      cursorY += 14;
    }

    function drawSummarySection(): void {
      document
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#334155')
        .text('Summary Highlights', leftX, cursorY);
      cursorY += 16;

      const summaryColumnWidth = (contentWidth - 24) / 3;
      const expensesColumnX = leftX + summaryColumnWidth + 12;
      const netColumnX = expensesColumnX + summaryColumnWidth + 12;
      const labelY = cursorY;
      const valueY = cursorY + 12;

      document
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#64748b')
        .text('Total Income', leftX, labelY, { width: summaryColumnWidth });
      document
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor('#065f46')
        .text(formatAmount(summary.income, params.currency), leftX, valueY, {
          width: summaryColumnWidth,
        });

      document
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#64748b')
        .text('Total Expenses', expensesColumnX, labelY, { width: summaryColumnWidth });
      document
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor('#b91c1c')
        .text(formatAmount(summary.expense, params.currency), expensesColumnX, valueY, {
          width: summaryColumnWidth,
        });

      document
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#64748b')
        .text('Net Result', netColumnX, labelY, { width: summaryColumnWidth });
      document
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(summary.net >= 0 ? '#0f766e' : '#c2410c')
        .text(formatAmount(summary.net, params.currency), netColumnX, valueY, {
          width: summaryColumnWidth,
        });

      cursorY = valueY + 34;
      document
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#64748b')
        .text(`Transactions in statement: ${params.transactions.length}`, leftX, cursorY);
      cursorY += 12;
      drawHorizontalLine(cursorY, '#e2e8f0');
      cursorY += 14;
    }

    function drawTableHeader(): void {
      document
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#334155')
        .text('Date', tableColumns.date.x, cursorY, { width: tableColumns.date.width });
      document
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#334155')
        .text('Description', tableColumns.description.x, cursorY, {
          width: tableColumns.description.width,
        });
      document
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#334155')
        .text('Wallet', tableColumns.wallet.x, cursorY, { width: tableColumns.wallet.width });
      document
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#334155')
        .text('Amount', tableColumns.amount.x, cursorY, {
          width: tableColumns.amount.width,
          align: 'right',
        });

      cursorY += 16;
      drawHorizontalLine(cursorY, '#cbd5e1');
      cursorY += 8;
    }

    function ensureTableRowSpace(): void {
      const pageBottomLimit = document.page.height - 70;

      if (cursorY + 20 <= pageBottomLimit) {
        return;
      }

      document.addPage();
      cursorY = 52;
      drawPageHeader();
      drawTableHeader();
    }

    drawPageHeader();
    drawClientInformation();
    drawSummarySection();

    document
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#334155')
      .text('Transaction Details', leftX, cursorY);
    cursorY += 18;
    drawTableHeader();

    if (params.transactions.length === 0) {
      document
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#64748b')
        .text('No transactions found for this period.', leftX, cursorY);
      cursorY += 14;
      drawHorizontalLine(cursorY, '#e2e8f0');
    } else {
      for (const transaction of params.transactions) {
        ensureTableRowSpace();

        const dateLabel = new Intl.DateTimeFormat('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(transaction.transactionDate));

        const description =
          transaction.description?.trim() ||
          transaction.category?.name ||
          (transaction.type === 'EXPENSE' ? 'Expense' : 'Income');

        const walletLabel = transaction.wallet?.name ?? 'Unassigned wallet';
        const amount = Number.parseFloat(transaction.amount.toString());
        const amountLabel = `${transaction.type === 'EXPENSE' ? '-' : '+'}${formatAmount(
          Number.isFinite(amount) ? Math.abs(amount) : 0,
          params.currency,
        )}`;

        const amountColor = transaction.type === 'EXPENSE' ? '#b91c1c' : '#065f46';
        const rowStartY = cursorY;

        document
          .font('Helvetica')
          .fontSize(9.5)
          .fillColor('#334155')
          .text(dateLabel, tableColumns.date.x, rowStartY, {
            width: tableColumns.date.width,
          });

        document
          .font('Helvetica')
          .fontSize(9.5)
          .fillColor('#0f172a')
          .text(description, tableColumns.description.x, rowStartY, {
            width: tableColumns.description.width,
          });

        document
          .font('Helvetica')
          .fontSize(9.5)
          .fillColor('#334155')
          .text(walletLabel, tableColumns.wallet.x, rowStartY, {
            width: tableColumns.wallet.width,
          });

        document
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(amountColor)
          .text(amountLabel, tableColumns.amount.x, rowStartY, {
            width: tableColumns.amount.width,
            align: 'right',
          });

        cursorY += 15;
        drawHorizontalLine(cursorY, '#e2e8f0');
        cursorY += 5;
      }
    }

    const pageRange = document.bufferedPageRange();

    for (let pageIndex = 0; pageIndex < pageRange.count; pageIndex += 1) {
      document.switchToPage(pageIndex);

      const footerY = document.page.height - 32;
      drawHorizontalLine(footerY - 8, '#e2e8f0');

      document
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#94a3b8')
        .text(`Page ${pageIndex + 1} of ${pageRange.count}`, leftX, footerY, {
          width: contentWidth,
          align: 'center',
        });
    }

    document.end();
  });
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function listReportsByUser(
  userId: string,
  filters: ListReportsInput = {},
): Promise<Report[]> {
  await ensureUserExists(userId);

  const where: Prisma.ReportWhereInput = {
    userId,
  };

  if (filters.status !== undefined) {
    where.status = filters.status;
  }

  if (filters.month !== undefined) {
    where.month = filters.month;
  }

  if (filters.year !== undefined) {
    where.year = filters.year;
  }

  return prisma.report.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
  });
}

export async function createReportAndEnqueue(
  userId: string,
  input: CreateReportInput,
): Promise<Report> {
  await ensureUserExists(userId);

  const { month, year } = resolveMonthYearRange({
    month: input.month,
    year: input.year,
  });

  const report = await prisma.report.create({
    data: {
      userId,
      name: input.name?.trim() || buildDefaultReportName(month, year),
      month,
      year,
      status: 'PENDING',
      fileUrl: null,
      errorMessage: null,
    },
  });

  try {
    await publishQueueMessage(env.reportsQueueName, {
      reportId: report.id,
      userId,
      month,
      year,
    } satisfies ReportQueueMessage);
  } catch (error) {
    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: 'FAILED',
        errorMessage: 'Failed to enqueue report generation.',
      },
    });

    console.error('[reports] failed to enqueue report generation', error);
    throw new AppError('Failed to enqueue report generation.', 503);
  }

  return report;
}

export async function regenerateFailedReport(userId: string, reportId: string): Promise<Report> {
  await ensureUserExists(userId);

  const sourceReport = await prisma.report.findFirst({
    where: {
      id: reportId,
      userId,
    },
  });

  if (!sourceReport) {
    throw new AppError('Report not found.', 404);
  }

  if (sourceReport.status !== 'FAILED') {
    throw new AppError('Only failed reports can be regenerated.', 409);
  }

  const pendingForPeriod = await prisma.report.findFirst({
    where: {
      userId,
      status: 'PENDING',
      month: sourceReport.month,
      year: sourceReport.year,
    },
    select: { id: true },
  });

  if (pendingForPeriod) {
    throw new AppError('A pending report already exists for this period.', 409);
  }

  return createReportAndEnqueue(userId, {
    name: sourceReport.name,
    month: sourceReport.month,
    year: sourceReport.year,
  });
}

export async function getReportDownloadPayload(
  userId: string,
  reportId: string,
): Promise<ReportDownloadPayload> {
  await ensureUserExists(userId);

  const report = await prisma.report.findFirst({
    where: {
      id: reportId,
      userId,
    },
    select: {
      id: true,
      name: true,
      month: true,
      year: true,
      status: true,
      fileUrl: true,
    },
  });

  if (!report) {
    throw new AppError('Report not found.', 404);
  }

  if (report.status !== 'COMPLETED') {
    throw new AppError('Report is not ready for download.', 409);
  }

  if (!report.fileUrl) {
    throw new AppError('Report file is unavailable.', 404);
  }

  const filePath = resolveReportFilePath(report.fileUrl);

  try {
    await access(filePath, constants.R_OK);
  } catch {
    throw new AppError('Report file is no longer available. Please regenerate the report.', 404);
  }

  return {
    filePath,
    downloadName: resolveDownloadName(report.name, report.month, report.year),
  };
}

export async function processReportJob(job: ReportQueueMessage): Promise<void> {
  const report = await prisma.report.findFirst({
    where: {
      id: job.reportId,
      userId: job.userId,
    },
  });

  if (!report) {
    return;
  }

  try {
    await wait(3000);

    // Legacy rows are backfilled from created_at during migration and may be approximate.
    // Newly created reports persist canonical request month/year in the report row itself.
    const { month, year, start, endExclusive } = resolveMonthYearRange({
      month: report.month,
      year: report.year,
    });

    const [user, transactions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: job.userId },
        select: {
          name: true,
          email: true,
          defaultCurrency: true,
        },
      }),
      prisma.transaction.findMany({
        where: {
          userId: job.userId,
          transactionDate: {
            gte: start,
            lt: endExclusive,
          },
        },
        include: {
          category: {
            select: {
              name: true,
            },
          },
          wallet: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    if (!user) {
      throw new AppError('User for report generation was not found.', 404);
    }

    const fileName = `report-${report.id}-${Date.now()}.pdf`;
    const filePath = path.resolve(reportsPublicDir, fileName);

    await generateReportPdf({
      filePath,
      reportName: report.name,
      userName: user.name,
      userEmail: user.email,
      currency: user.defaultCurrency,
      month,
      year,
      transactions,
    });

    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: 'COMPLETED',
        fileUrl: `/reports/${fileName}`,
        errorMessage: null,
      },
    });

    await createNotification({
      userId: report.userId,
      title: 'Report Ready',
      message: 'Your monthly statement is ready to download in the Reports tab.',
      type: 'REPORT',
      targetPath: '/reports',
    });
  } catch (error) {
    const safeFailureMessage = buildSafeFailureMessage(error);

    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: 'FAILED',
        errorMessage: safeFailureMessage,
      },
    });

    try {
      await createNotification({
        userId: report.userId,
        title: 'Report Failed',
        message: 'We could not generate your monthly statement. Please try again in Reports.',
        type: 'REPORT',
        targetPath: '/reports',
      });
    } catch (notificationError) {
      console.error('[reports] failed to create report failure notification', notificationError);
    }

    throw error;
  }
}
