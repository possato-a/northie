---
description: Commit all staged changes and push to main automatically
model: claude-sonnet-4-6
---

Faça commit de todas as mudanças e push para a branch atual (ou main).

## Instruções

$ARGUMENTS

## Processo

1. **Verificar estado atual**
   ```bash
   git status
   git diff --stat HEAD
   ```

2. **Analisar as mudanças** para redigir uma mensagem de commit descritiva e precisa

3. **Staged e commit** — adicionar arquivos relevantes (excluir `node_modules/`, `.env`, arquivos de build gerados automaticamente)

4. **Mensagem de commit** no padrão Conventional Commits:
   - `feat(escopo): descrição` — nova feature
   - `fix(escopo): descrição` — correção de bug
   - `chore(escopo): descrição` — manutenção, configs, agents
   - `docs(escopo): descrição` — documentação
   - `refactor(escopo): descrição` — refactoring sem mudança de comportamento

5. **Push** para a branch atual

## Regras

- **Nunca commitar**: `node_modules/`, `.env`, `.env.local`, arquivos `.map` de source map gerados
- **Sempre incluir**: arquivos `.claude/agents/`, `.claude/commands/`, `server/src/`, `src/`, `supabase/migrations/`
- **`server/node_modules/.package-lock.json`**: não incluir no commit
- Mensagem em **português** para o título, inglês para detalhes técnicos quando necessário
- Seguir o estilo dos commits recentes do repositório

## Output

Execute o commit e push, confirmando o sucesso com o hash do commit e a branch de destino.
