/**
 * @file lib/anthropic.ts
 *
 * Cliente de IA centralizado — singleton lazy com suporte a múltiplos providers.
 *
 * Providers suportados (em ordem de prioridade):
 *   1. Groq       — GROQ_API_KEY   — gratuito, llama-3.3-70b-versatile
 *   2. Gemini     — GEMINI_API_KEY — gratuito, gemini-2.0-flash
 *   3. Anthropic  — ANTHROPIC_API_KEY — pago, claude-sonnet-4-6
 *
 * Todos os serviços que usam IA importam getAnthropicClient() daqui.
 * A interface retornada é compatível com o Anthropic SDK.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createAiAdapter, type AiClient } from './ai-adapter.js';

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

// Pode ser Anthropic nativo ou adaptador (Groq/Gemini)
let _client: Anthropic | AiClient | null = null;

export function getAnthropicClient(): Anthropic | AiClient {
    if (_client) return _client;

    // 1. Tenta providers gratuitos primeiro (Groq, Gemini)
    const adapter = createAiAdapter();
    if (adapter) {
        _client = adapter;
        return _client;
    }

    // 2. Fallback: Anthropic pago
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error(
            '[AI] Nenhum provider configurado. Adicione GROQ_API_KEY (grátis em console.groq.com) ou ANTHROPIC_API_KEY em server/.env.local'
        );
    }
    _client = new Anthropic({ apiKey });
    return _client;
}

// ── Validação no startup ──────────────────────────────────────────────────────

/**
 * Detecta qual provider está disponível e loga no boot.
 * Não faz request à API — apenas valida variáveis de ambiente.
 */
export function validateAnthropicConfig(): void {
    if (process.env.GROQ_API_KEY) {
        console.log('[AI] ✅ Provider: Groq — modelo padrão: llama-3.3-70b-versatile (gratuito)');
        return;
    }

    if (process.env.GEMINI_API_KEY) {
        console.log('[AI] ✅ Provider: Google Gemini — modelo padrão: gemini-2.0-flash (gratuito)');
        return;
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
        console.warn('[AI] ⚠️  Nenhum provider configurado. Adicione GROQ_API_KEY em server/.env.local');
        console.warn('[AI]    Chave gratuita: https://console.groq.com');
        return;
    }
    if (!anthropicKey.startsWith('sk-ant-')) {
        console.warn('[AI] ⚠️  ANTHROPIC_API_KEY parece inválida (deve começar com sk-ant-).');
        return;
    }
    console.log(`[AI] ✅ Provider: Anthropic — modelo padrão: ${ANTHROPIC_MODELS.SONNET}`);
}
