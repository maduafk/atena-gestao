# Atena - Gestão Financeira Pessoal

Uma aplicação web para gerenciamento de finanças pessoais, incluindo controle de cartões de crédito, gastos em débito e receitas.

## Funcionalidades

- ✅ **Cartões de Crédito**: Cadastro de cartões com dia de fechamento e vencimento
- ✅ **Compras Parceladas**: Registro de compras com geração automática de parcelas
- ✅ **Pagamentos**: Registro de pagamentos com alocação automática nas parcelas
- ✅ **Gastos em Débito**: Controle de transações em débito
- ✅ **Receitas**: Registro de receitas mensais
- ✅ **Dashboard**: Visão geral das finanças do mês

## Stack Tecnológica

- **Next.js 14** - App Router
- **TypeScript**
- **TailwindCSS**
- **PostgreSQL** - Docker
- **Prisma ORM**
- **JWT Sessions** - Autenticação segura

## Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- npm ou yarn

## Instalação

### 1. Clone o repositório

```bash
git clone <repo-url>
cd atena-gestao
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` se necessário. Os valores padrão funcionam para desenvolvimento local.

### 4. Inicie o banco de dados

```bash
npm run db:up
```

Aguarde alguns segundos para o PostgreSQL iniciar completamente.

### 5. Execute as migrações

```bash
npm run db:migrate:dev
```

### 6. Execute o seed (cria usuário admin)

```bash
npm run db:seed
```

### 7. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

A aplicação estará disponível em [http://localhost:3000](http://localhost:3000)

## Credenciais de Acesso

- **Email**: `admin`
- **Senha**: `admin`

## Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Compila a aplicação para produção |
| `npm run start` | Inicia o servidor de produção |
| `npm run db:up` | Inicia o container PostgreSQL |
| `npm run db:down` | Para o container PostgreSQL |
| `npm run db:migrate` | Executa migrações (produção) |
| `npm run db:migrate:dev` | Executa migrações (desenvolvimento) |
| `npm run db:seed` | Popula o banco com dados iniciais |
| `npm run db:studio` | Abre o Prisma Studio |

## Setup Completo (Um Comando)

Para Windows PowerShell:
```powershell
npm run db:up; Start-Sleep -Seconds 5; npm run db:migrate:dev; npm run db:seed; npm run dev
```

Para Linux/Mac:
```bash
npm run db:up && sleep 5 && npm run db:migrate:dev && npm run db:seed && npm run dev
```

## Estrutura do Projeto

```
atena-gestao/
├── app/                    # Rotas Next.js App Router
│   ├── login/             # Página de login
│   ├── logout/            # Ação de logout
│   ├── cards/             # Páginas de cartões
│   │   └── [id]/          # Detalhe do cartão
│   ├── debit/             # Página de débito
│   ├── income/            # Página de receitas
│   └── page.tsx           # Dashboard
├── components/            # Componentes React
│   ├── ui/               # Componentes de UI
│   └── ...               # Componentes da aplicação
├── lib/                   # Bibliotecas e utilitários
│   ├── actions/          # Server Actions
│   ├── auth.ts           # Autenticação JWT
│   ├── db.ts             # Cliente Prisma
│   └── utils.ts          # Funções utilitárias
├── prisma/               # Schema e seeds
│   ├── schema.prisma     # Modelo do banco
│   └── seed.ts           # Seed inicial
└── docker-compose.yml    # Configuração Docker
```

## Lógica de Negócio

### Fechamento de Fatura

O sistema calcula automaticamente em qual fatura uma compra entra baseado no dia de fechamento do cartão:

- Se a compra é feita **antes ou no dia do fechamento**, entra na fatura do mês atual
- Se a compra é feita **após o dia do fechamento**, entra na fatura do próximo mês

### Parcelas

Ao registrar uma compra parcelada:
- O valor é dividido igualmente entre as parcelas
- Cents restantes são distribuídos nas primeiras parcelas
- Cada parcela é alocada no mês correspondente

### Pagamentos

Ao registrar um pagamento:
- O valor é alocado nas parcelas em aberto da fatura
- Alocação segue ordem: número da parcela, depois data de criação
- Parcelas totalmente pagas são marcadas como 'paid'

## Banco de Dados

### Conexão

```
postgresql://postgres:postgres@localhost:5432/atena-db
```

### Tabelas

- `users` - Usuários do sistema
- `cards` - Cartões de crédito
- `card_purchases` - Compras no cartão
- `card_installments` - Parcelas geradas
- `card_payments` - Pagamentos de fatura
- `card_payment_allocations` - Alocação de pagamentos
- `debit_transactions` - Transações em débito
- `income_transactions` - Receitas

## Desenvolvimento

### Prisma Studio

Para visualizar e editar dados diretamente:

```bash
npm run db:studio
```

### Resetar Banco de Dados

```bash
npm run db:down
npm run db:up
# Aguarde alguns segundos
npm run db:migrate:dev
npm run db:seed
```

## Troubleshooting

### Erro de conexão com o banco

Certifique-se de que o container está rodando:
```bash
docker ps
```

Se não estiver, execute:
```bash
npm run db:up
```

### Erro "P1001: Can't reach database server"

Aguarde alguns segundos após `db:up` para o PostgreSQL inicializar completamente.

### Erro de migração

Se houver problemas com migrações, você pode resetar o banco:
```bash
npm run db:down
npm run db:up
npx prisma migrate reset
```

## Licença

Projeto privado - Uso pessoal
