# Plano de Arquitetura e Implementação

## 1) Objetivo do Projeto
Construir uma plataforma de finanças pessoais para registo e análise de despesas/receitas, com foco em:
- simplicidade de uso;
- segurança dos dados do utilizador;
- base técnica modular para evolução futura (orçamentos, metas, relatórios avançados).

## 2) Arquitetura Proposta
### Stack
- Frontend: React + TypeScript + Tailwind CSS
- Backend: Node.js + Express
- Base de dados: SQLite + Prisma ORM

### Arquitetura em Camadas
- `UI (React)`: páginas, componentes acessíveis, gestão de estado de interface.
- `API (Express)`: rotas REST, validação de payload, autenticação/autorização.
- `Serviços`: regras de negócio (totais mensais, filtros por categoria/período, validações).
- `Persistência (Prisma)`: acesso à base de dados e mapeamento de entidades.

### Organização Inicial Sugerida
- `frontend/`: aplicação React (views, components, hooks, services/api).
- `backend/`: API Express (routes, controllers, services, repositories, middlewares).
- `prisma/`: `schema.prisma`, migrações e seed inicial.
- `docs/`: decisões de arquitetura e guias.

## 3) Estrutura da Base de Dados
### Tabela: `users` (Utilizadores)
- `id` (PK, UUID)
- `name` (texto, obrigatório)
- `email` (texto, obrigatório, único)
- `password_hash` (texto, obrigatório)
- `default_currency` (texto, ex: EUR, obrigatório, default `EUR`)
- `created_at`, `updated_at` (datetime)

### Tabela: `expense_categories` (Categorias de Despesas)
- `id` (PK, UUID)
- `user_id` (FK -> `users.id`, obrigatório)
- `name` (texto, obrigatório)
- `color` (texto, opcional)
- `icon` (texto, opcional)
- `created_at`, `updated_at` (datetime)

Regras:
- índice único composto: (`user_id`, `name`) para evitar categorias duplicadas por utilizador.

### Tabela: `transactions` (Transações)
- `id` (PK, UUID)
- `user_id` (FK -> `users.id`, obrigatório)
- `category_id` (FK -> `expense_categories.id`, obrigatório para despesas)
- `type` (enum: `income` | `expense`, obrigatório)
- `amount` (decimal, obrigatório, `> 0`)
- `description` (texto, opcional)
- `transaction_date` (date, obrigatório)
- `created_at`, `updated_at` (datetime)

Regras:
- índices: (`user_id`, `transaction_date`) e (`user_id`, `category_id`, `transaction_date`).
- integridade: uma transação só pode referenciar categorias do próprio utilizador.

## 4) Fases de Implementação (5 Fases)
### Fase 1: Setup do Projeto
Objetivo: criar base de trabalho consistente.
- inicializar frontend e backend;
- configurar TypeScript, ESLint/Prettier e variáveis de ambiente;
- definir estrutura de pastas e convenções de código.
Critério de saída: projeto arranca localmente (frontend + backend) sem erros.

### Fase 2: Base de Dados
Objetivo: modelar dados e preparar persistência.
- criar `schema.prisma` com `users`, `expense_categories`, `transactions`;
- gerar e aplicar migrações;
- adicionar seed com categorias padrão (ex: Alimentação, Transporte, Casa).
Critério de saída: CRUD básico via Prisma funcional e validado.

### Fase 3: Backend API
Objetivo: expor regras de negócio com segurança.
- autenticação (registo/login) com hash de password e tokens;
- endpoints de categorias e transações (CRUD + filtros por período/categoria);
- middleware global de erro e validação de input.
Critério de saída: API documentada e testada para fluxos principais.

### Fase 4: Frontend UI
Objetivo: entregar experiência utilizável e acessível.
- ecrãs: login/registo, dashboard, lista de transações, gestão de categorias;
- formulários com validação e feedback de erro;
- foco em acessibilidade (labels, teclado, contraste, estados de foco).
Critério de saída: utilizador consegue gerir finanças de ponta a ponta.

### Fase 5: Integração, Qualidade e Entrega
Objetivo: estabilizar e preparar evolução.
- integração frontend-backend completa;
- testes críticos (auth, criação/edição de transações, filtros);
- observabilidade básica (logs estruturados) e revisão de segurança.
Critério de saída: versão MVP pronta para uso local com documentação mínima.

## 5) Resultado Esperado do MVP
- registo/autenticação de utilizadores;
- criação de categorias de despesa por utilizador;
- registo e consulta de transações com filtros;
- visão resumida por período e categoria.
