# Setup Manual — Stripe Connect + Hotmart

> Este guia cobre os passos que precisam ser feitos manualmente nos painéis da Stripe e Hotmart para que as integrações funcionem em produção.

---

## Stripe Connect

### O que já está configurado
- `STRIPE_SECRET_KEY` — chave secreta da conta Northie ✅

### O que ainda precisa ser feito

#### Passo 1 — Ativar o Stripe Connect

1. Acesse [dashboard.stripe.com/settings/connect](https://dashboard.stripe.com/settings/connect)
2. Em **"Get started with Connect"**, escolha o tipo **Standard** (founders conectam as próprias contas)
3. Preencha as informações do negócio (nome, URL, categoria)
4. Após salvar, a página vai exibir o **"Your platform's client ID"** — começa com `ca_`
5. Copie esse valor e adicione no Vercel e no `.env`:
   ```
   STRIPE_CLIENT_ID=ca_XXXXXXXXXXXXXXXXXXXXXXXX
   ```

#### Passo 2 — Registrar o webhook

1. Acesse [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Clique em **"Add endpoint"**
3. Configure:
   - **Endpoint URL:** `https://northie.vercel.app/api/webhooks/stripe`
   - **Listen to:** `Events on Connected accounts` ← obrigatório para Connect
   - **Events to send:** selecione os eventos abaixo

4. Eventos necessários:
   ```
   checkout.session.completed
   payment_intent.succeeded
   payment_intent.payment_failed
   charge.succeeded
   charge.refunded
   customer.subscription.created
   customer.subscription.updated
   customer.subscription.deleted
   invoice.paid
   invoice.payment_failed
   account.updated
   account.application.deauthorized
   ```

5. Clique em **"Add endpoint"**
6. Na página do webhook criado, clique em **"Reveal"** no campo **Signing secret**
7. Copie o valor (`whsec_...`) e adicione no Vercel e no `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXXXXXX
   ```

#### Passo 3 — Testar o webhook localmente (opcional)

```bash
# Instalar Stripe CLI
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# Disparar evento de teste
stripe trigger payment_intent.succeeded
```

---

### Como o founder conecta a Stripe

O fluxo é 100% automático — o founder não precisa mexer em nada além de clicar em "Conectar":

1. Founder clica em **"Conectar Stripe"** na App Store da Northie
2. É redirecionado para o painel OAuth da Stripe (`connect.stripe.com/oauth/authorize`)
3. Autoriza a Northie a acessar sua conta
4. É redirecionado de volta — token salvo automaticamente
5. Webhooks da conta do founder chegam automaticamente no endpoint da Northie (o evento inclui o `account` ID identificando quem é)

---

## Hotmart

### O que já está configurado
- `HOTMART_CLIENT_ID` ✅
- `HOTMART_CLIENT_SECRET` ✅

### O que ainda precisa ser feito

#### Passo 1 — Configurar o Webhook no painel Hotmart

> Cada founder precisa configurar a URL de webhook no painel deles. A Northie não consegue fazer isso automaticamente — é uma limitação da plataforma Hotmart.

**URL que o founder deve cadastrar:**
```
https://northie.vercel.app/api/webhooks/hotmart/{profileId}
```

Onde `{profileId}` é o UUID do founder na Northie (visível na URL após login ou na página de configurações).

**Passos para o founder:**
1. Acessar [app.hotmart.com](https://app.hotmart.com) > **Ferramentas** > **Webhooks**
2. Clicar em **"Adicionar webhook"**
3. Colar a URL com o profileId
4. Ativar os eventos:
   - Compra Completa (`PURCHASE_COMPLETE`)
   - Compra Aprovada (`PURCHASE_APPROVED`)
   - Compra Cancelada (`PURCHASE_CANCELED`)
   - Reembolso (`PURCHASE_REFUNDED`)
   - Cancelamento de Assinatura (`SUBSCRIPTION_CANCELLATION`)
5. Copiar o **Hottok** exibido na tela (token de segurança gerado pela Hotmart)
6. Enviar o Hottok para a equipe da Northie

#### Passo 2 — Cadastrar o Hottok no backend

Após receber o Hottok do founder, adicionar no Vercel:

```
HOTMART_WEBHOOK_TOKEN=<hottok-do-founder>
```

> **Atenção:** Atualmente o sistema usa um único `HOTMART_WEBHOOK_TOKEN` para todos os founders. Isso funciona na fase beta com poucos usuários. A versão escalável usa o profileId na URL para isolar por founder sem precisar de token compartilhado — está na roadmap.

#### Passo 3 — Testar o webhook

No painel da Hotmart, após cadastrar o webhook, há um botão **"Testar"** que envia um payload de exemplo para a URL cadastrada. O backend deve responder `200 OK`.

---

### Como o founder conecta a Hotmart

1. Founder clica em **"Conectar Hotmart"** na App Store da Northie
2. É redirecionado para o OAuth da Hotmart (`api-sec-vlc.hotmart.com/security/oauth/authorize`)
3. Autoriza a Northie
4. Token OAuth salvo automaticamente — permite sync histórico de vendas

> O webhook (passo 1 acima) é separado do OAuth. O OAuth permite que a Northie leia o histórico. O webhook entrega vendas em tempo real.

---

## Checklist de produção

### Stripe
- [ ] Stripe Connect ativado com tipo Standard
- [ ] `STRIPE_CLIENT_ID` (ca_...) adicionado no Vercel
- [ ] Webhook endpoint registrado com eventos de connected accounts
- [ ] `STRIPE_WEBHOOK_SECRET` (whsec_...) adicionado no Vercel
- [ ] Teste de webhook executado com sucesso

### Hotmart
- [ ] `HOTMART_CLIENT_ID` adicionado no Vercel ✅
- [ ] `HOTMART_CLIENT_SECRET` adicionado no Vercel ✅
- [ ] URL de webhook documentada e pronta para enviar ao founder
- [ ] `HOTMART_WEBHOOK_TOKEN` adicionado no Vercel (após receber do founder)

---

## Variáveis de ambiente — resumo para o Vercel

Acesse [vercel.com/dashboard](https://vercel.com) > seu projeto > **Settings** > **Environment Variables** e adicione:

| Variável | Onde obter |
|---|---|
| `STRIPE_SECRET_KEY` | Dashboard Stripe > API Keys ✅ |
| `STRIPE_CLIENT_ID` | Dashboard Stripe > Connect > Settings |
| `STRIPE_WEBHOOK_SECRET` | Dashboard Stripe > Webhooks > seu endpoint |
| `HOTMART_CLIENT_ID` | Developers Hotmart > seu app ✅ |
| `HOTMART_CLIENT_SECRET` | Developers Hotmart > seu app ✅ |
| `HOTMART_WEBHOOK_TOKEN` | Painel do founder em Ferramentas > Webhooks |
| `BACKEND_URL` | `https://northie.vercel.app` |
| `FRONTEND_URL` | `https://northie.vercel.app` |
