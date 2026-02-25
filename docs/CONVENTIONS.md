# Convenções Iniciais

## Estrutura
- `frontend/`: UI React + TypeScript + Tailwind.
- `backend/`: API Express + TypeScript.
- `prisma/`: modelo de dados e migrações (Fase 2).

## Naming
- `camelCase`: variáveis e funções.
- `PascalCase`: componentes React e tipos principais.
- `kebab-case`: nomes de ficheiros de rota/middleware (ex.: `health.routes.ts`).

## Qualidade
- ESLint para problemas de código e padrões TypeScript.
- Prettier para formatação consistente.
- Tratamento de erro obrigatório na API.
