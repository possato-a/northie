/**
 * @file lib/anthropic.ts
 *
 * Cliente Anthropic centralizado — singleton lazy com validação de configuração.
 * Todos os serviços que precisam de Claude devem importar daqui em vez de
 * instanciar `new Anthropic()` diretamente.
 */

import Anthropic from '@anthropic-ai/sdk';

// ── Modelos disponíveis ───────────────────────────────────────────────────────

export const ANTHROPIC_MODELS = {
    /** Análises profundas, diagnósticos completos, reasoning complexo */
    OPUS: 'claude-opus-4-6' as const,
    /** Queries padrão, geração de conteúdo, agentes de execução */
    SONNET: 'claude-sonnet-4-6' as const,
    /** Tarefas rápidas e baratas: análise de texto, classificação, extração */
    HAIKU: 'claude-haiku-4-5-20251001' as const,
} as const;

export type AnthropicModel = typeof ANTHROPIC_MODELS[keyof typeof ANTHROPIC_MODELS];

// ── Singleton lazy ────────────────────────────────────────────────────────────

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
    if (!_client) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error(
                '[Anthropic] ANTHROPIC_API_KEY não configurada. Acesse server/.env.local e adicione a chave.'
            );
        }
        _client = new Anthropic({ apiKey });
    }
    return _client;
}

// ── Validação no startup ──────────────────────────────────────────────────────

/**
 * Valida que a API key existe e o cliente consegue ser criado.
 * Chame no boot do servidor. Não faz request à API — apenas valida formato.
 */
export function validateAnthropicConfig(): void {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.warn(
            '[Anthropic] ANTHROPIC_API_KEY não configurada — recursos de IA estarão desabilitados.'
        );
        return;
    }
    if (!apiKey.startsWith('sk-ant-')) {
        console.warn(
            '[Anthropic] ANTHROPIC_API_KEY parece inválida (deve começar com sk-ant-).'
        );
        return;
    }
    console.log(`[Anthropic] API Key configurada — modelo padrão: ${ANTHROPIC_MODELS.SONNET}`);
}
