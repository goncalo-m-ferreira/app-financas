import { z } from 'zod';

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'defaultCurrency deve conter 3 letras (ex: EUR).');

export const registerBodySchema = z.object({
  name: z.string().trim().min(2, 'name deve ter pelo menos 2 caracteres.').max(120),
  email: z.string().trim().email('email inválido.').toLowerCase(),
  password: z.string().min(8, 'password deve ter pelo menos 8 caracteres.').max(128),
  defaultCurrency: currencySchema.optional().default('EUR'),
});

export const loginBodySchema = z.object({
  email: z.string().trim().email('email inválido.').toLowerCase(),
  password: z.string().min(1, 'password é obrigatório.'),
});

export const googleAuthBodySchema = z.object({
  credential: z.string().trim().min(1, 'credential é obrigatório.'),
});

export const verifyEmailRequestBodySchema = z.object({
  email: z.string().trim().email('email inválido.').toLowerCase(),
});

export const verifyEmailConfirmBodySchema = z.object({
  token: z.string().trim().min(1, 'token é obrigatório.'),
});
