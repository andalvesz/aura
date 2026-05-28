# Aura

Workspace premium com Next.js 16, TypeScript, Tailwind CSS, Supabase Auth e shadcn/ui.

## Stack

- Next.js 16 (App Router + `proxy.ts`)
- TypeScript
- Tailwind CSS v4
- Supabase (Auth + Database)
- shadcn/ui + Lucide Icons
- Framer Motion

## Estrutura

```
app/           # Rotas e páginas
components/    # UI (landing, auth, dashboard)
lib/           # Supabase SSR, auth helpers
utils/         # Utilitários (cn)
types/         # Tipos TypeScript
proxy.ts       # Proteção de rotas (Next.js 16)
supabase/      # SQL inicial
```

## 1. Onde colocar as variáveis de ambiente

| Ambiente | Arquivo / local |
|----------|-----------------|
| **Local** | `.env.local` na raiz do projeto (copie de `.env.example`) |
| **Vercel** | Project → Settings → Environment Variables |

Variáveis obrigatórias:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

> Use apenas a **anon key** no frontend. Nunca commite `.env.local`.

## 2. Como rodar localmente

```bash
# Instalar dependências
npm install

# Configurar envs
cp .env.example .env.local
# Edite .env.local com suas credenciais Supabase

# Desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## 3. Como conectar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Vá em **Project Settings → API** e copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. No **SQL Editor**, execute o conteúdo de `supabase/schema.sql`.
4. Em **Authentication → Providers**, mantenha **Email** habilitado.
5. Em **Authentication → URL Configuration**, adicione:
   - **Site URL**: `http://localhost:3000` (dev) ou sua URL Vercel (prod)
   - **Redirect URLs**: `http://localhost:3000/auth/callback` e `https://seu-dominio.vercel.app/auth/callback`
6. (Opcional) Desative **Confirm email** em Authentication → Providers → Email se quiser login imediato após cadastro em dev.

## 4. Como fazer deploy na Vercel

1. Faça push do repositório para GitHub.
2. Em [vercel.com](https://vercel.com), **Add New Project** e importe o repo.
3. Framework preset: **Next.js** (detectado automaticamente).
4. Adicione as envs `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em **Environment Variables**.
5. Deploy.
6. No Supabase, atualize **Site URL** e **Redirect URLs** com o domínio `.vercel.app` (ou domínio customizado).

```bash
# Alternativa via CLI
npx vercel
npx vercel --prod
```

## 5. Como evitar loop de autenticação

O Aura separa responsabilidades em duas camadas:

| Camada | Arquivo | Função |
|--------|---------|--------|
| **Proxy (otimista)** | `proxy.ts` + `lib/supabase/proxy.ts` | Atualiza sessão/cookies; redireciona usuário logado de `/login` e `/cadastro` para `/dashboard`; redireciona não logado de `/dashboard` para `/login` |
| **Servidor (autoritativo)** | `lib/auth.ts` + `app/dashboard/layout.tsx` | `getUser()` / `requireUser()` valida sessão antes de renderizar o dashboard |

Regras que evitam loops:

1. **Rotas de auth** (`/login`, `/cadastro`) e **protegidas** (`/dashboard`) são tratadas de forma exclusiva — a landing `/` permanece pública para todos.
2. Usuário **com sessão** em `/login` ou `/cadastro` → redirect **uma vez** para `/dashboard`.
3. Usuário **sem sessão** em `/dashboard` → redirect para `/login?redirect=/dashboard...`.
4. O proxy sempre chama `supabase.auth.getUser()` (não `getSession()`), que valida o token no servidor Supabase.
5. Cookies de sessão são renovados via `setAll` no proxy antes de qualquer redirect.

Se ainda houver loop, verifique:

- Site URL e Redirect URLs corretos no Supabase
- Mesmas envs na Vercel e no Supabase (projeto correto)
- Relógio do sistema sincronizado

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | ESLint |

## Licença

MIT
