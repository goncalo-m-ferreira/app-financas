import { createHash, randomBytes } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';

const TOKEN_BYTES = 32;
const PROD_UNAVAILABLE_MESSAGE =
  'Serviço de verificação de email indisponível. Tente novamente mais tarde.';
const GENERIC_REQUEST_MESSAGE =
  'Se existir uma conta com esse email, enviámos instruções de confirmação.';

let cachedTransporter: Transporter | null | undefined;

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function createVerificationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(TOKEN_BYTES).toString('base64url');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

function buildVerificationLink(rawToken: string): string {
  const url = new URL(env.emailVerificationAppUrl);
  url.searchParams.set('token', rawToken);
  return url.toString();
}

function getTokenExpiresAt(now: Date): Date {
  return new Date(now.getTime() + env.emailVerificationTokenTtlMinutes * 60_000);
}

function hasEmailTransportConfig(): boolean {
  return Boolean(env.smtpHost && env.smtpFrom);
}

function resolveTransporter(): Transporter | null {
  if (cachedTransporter !== undefined) {
    return cachedTransporter;
  }

  if (!hasEmailTransportConfig()) {
    cachedTransporter = null;
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: env.smtpUser
      ? {
          user: env.smtpUser,
          pass: env.smtpPass ?? '',
        }
      : undefined,
  });

  return cachedTransporter;
}

export function assertEmailVerificationDeliveryConfigured(): void {
  if (hasEmailTransportConfig()) {
    return;
  }

  if (env.nodeEnv === 'production') {
    throw new AppError(PROD_UNAVAILABLE_MESSAGE, 503, {
      code: 'EMAIL_DELIVERY_UNAVAILABLE',
    });
  }
}

async function sendVerificationEmail(params: {
  email: string;
  name: string;
  verificationLink: string;
}): Promise<void> {
  const transporter = resolveTransporter();

  if (!transporter) {
    if (env.nodeEnv === 'production') {
      throw new AppError(PROD_UNAVAILABLE_MESSAGE, 503, {
        code: 'EMAIL_DELIVERY_UNAVAILABLE',
      });
    }

    return;
  }

  const subject = 'Confirma o teu email para ativar a conta';
  const expirationMinutes = env.emailVerificationTokenTtlMinutes;
  const text = [
    `Olá ${params.name},`,
    '',
    'Recebemos o teu registo. Para ativar a conta, confirma o teu email no link abaixo:',
    params.verificationLink,
    '',
    `Este link expira em ${expirationMinutes} minuto(s).`,
    'Se não criaste esta conta, ignora este email.',
  ].join('\n');
  const html = `
    <p>Olá ${params.name},</p>
    <p>Recebemos o teu registo. Para ativar a conta, confirma o teu email no link abaixo:</p>
    <p><a href="${params.verificationLink}">Confirmar email</a></p>
    <p>Este link expira em ${expirationMinutes} minuto(s).</p>
    <p>Se não criaste esta conta, ignora este email.</p>
  `;

  await transporter.sendMail({
    from: env.smtpFrom,
    to: params.email,
    subject,
    text,
    html,
  });
}

export async function issueEmailVerificationForUser(params: {
  userId: string;
  email: string;
  name: string;
}): Promise<void> {
  const now = new Date();
  const { rawToken, tokenHash } = createVerificationToken();
  const expiresAt = getTokenExpiresAt(now);

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.updateMany({
      where: {
        userId: params.userId,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    await tx.emailVerificationToken.create({
      data: {
        userId: params.userId,
        tokenHash,
        expiresAt,
      },
    });
  });

  const verificationLink = buildVerificationLink(rawToken);
  await sendVerificationEmail({
    email: params.email,
    name: params.name,
    verificationLink,
  });
}

export async function requestEmailVerificationByEmail(email: string): Promise<{ message: string }> {
  assertEmailVerificationDeliveryConfigured();

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerifiedAt: true,
    },
  });

  if (!user || user.emailVerifiedAt) {
    return { message: GENERIC_REQUEST_MESSAGE };
  }

  const cooldownStart = new Date(Date.now() - env.emailVerificationResendCooldownSeconds * 1_000);
  const recentToken = await prisma.emailVerificationToken.findFirst({
    where: {
      userId: user.id,
      createdAt: {
        gte: cooldownStart,
      },
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
    },
  });

  if (!recentToken) {
    await issueEmailVerificationForUser({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
  }

  return { message: GENERIC_REQUEST_MESSAGE };
}

export async function confirmEmailVerificationToken(token: string): Promise<{ message: string }> {
  const rawToken = token.trim();

  if (!rawToken) {
    throw new AppError('Token de confirmação é obrigatório.', 400, {
      code: 'TOKEN_REQUIRED',
    });
  }

  const now = new Date();
  const tokenHash = hashToken(rawToken);
  const verificationToken = await prisma.emailVerificationToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: {
        gt: now,
      },
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!verificationToken) {
    throw new AppError('Token de confirmação inválido ou expirado.', 400, {
      code: 'INVALID_OR_EXPIRED_TOKEN',
    });
  }

  await prisma.$transaction(async (tx) => {
    const consumed = await tx.emailVerificationToken.updateMany({
      where: {
        id: verificationToken.id,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    if (consumed.count !== 1) {
      throw new AppError('Token de confirmação inválido ou expirado.', 400, {
        code: 'INVALID_OR_EXPIRED_TOKEN',
      });
    }

    await tx.user.update({
      where: {
        id: verificationToken.userId,
      },
      data: {
        emailVerifiedAt: now,
      },
    });

    await tx.emailVerificationToken.updateMany({
      where: {
        userId: verificationToken.userId,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });
  });

  return {
    message: 'Email confirmado com sucesso.',
  };
}
