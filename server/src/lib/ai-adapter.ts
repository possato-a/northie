/**
 * @file lib/ai-adapter.ts
 *
 * Adaptador que expõe a mesma interface do Anthropic SDK, mas pode ser
 * alimentado por Groq (gratuito) ou Google Gemini (gratuito) via
 * API compatível com OpenAI.
 *
 * Mapeamento de providers:
 *   GROQ_API_KEY   → Groq (llama-3.3-70b-versatile)
 *   GEMINI_API_KEY → Google AI Studio (gemini-2.0-flash)
 *
 * Prioridade: GROQ > GEMINI > ANTHROPIC
 */

import OpenAI from 'openai';
import type Anthropic from '@anthropic-ai/sdk';

// ── Tipos re-exportados para uso externo ──────────────────────────────────────

export type AiMessageParam = Anthropic.MessageParam;
export type AiTool = Anthropic.Tool;
export type AiContentBlock = Anthropic.ContentBlock;
export type AiToolUseBlock = Anthropic.ToolUseBlock;
export type AiToolResultBlockParam = Anthropic.ToolResultBlockParam;

// ── Interface mínima compatível com Anthropic SDK ─────────────────────────────

export interface AiMessagesCreateParams {
    model: string;
    max_tokens: number;
    system?: string;
    messages: Anthropic.MessageParam[];
    tools?: Anthropic.Tool[];
}

export interface AiMessagesCreateResponse {
    content: Anthropic.ContentBlock[];
    stop_reason: string | null;
}

export interface AiClient {
    messages: {
        create(params: AiMessagesCreateParams): Promise<AiMessagesCreateResponse>;
    };
}

// ── Configuração de providers ─────────────────────────────────────────────────

type Provider = 'groq' | 'gemini';

interface ProviderConfig {
    baseURL: string;
    apiKey: string;
    modelMap: Record<string, string>;
    defaultModel: string;
}

const PROVIDER_CONFIGS: Record<Provider, (apiKey: string) => ProviderConfig> = {
    groq: (apiKey) => ({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey,
        modelMap: {
            'claude-opus-4-6': 'llama-3.3-70b-versatile',
            'claude-sonnet-4-6': 'llama-3.3-70b-versatile',
            'claude-haiku-4-5-20251001': 'llama-3.1-8b-instant',
        },
        defaultModel: 'llama-3.3-70b-versatile',
    }),
    gemini: (apiKey) => ({
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        apiKey,
        modelMap: {
            'claude-opus-4-6': 'gemini-2.0-flash',
            'claude-sonnet-4-6': 'gemini-2.0-flash',
            'claude-haiku-4-5-20251001': 'gemini-1.5-flash',
        },
        defaultModel: 'gemini-2.0-flash',
    }),
};

// ── Conversão de mensagens Anthropic → OpenAI ─────────────────────────────────

type OpenAIMessage = OpenAI.ChatCompletionMessageParam;

function convertMessagesToOpenAI(
    system: string | undefined,
    messages: Anthropic.MessageParam[]
): OpenAIMessage[] {
    const result: OpenAIMessage[] = [];

    // System prompt vira primeira mensagem role=system
    if (system) {
        result.push({ role: 'system', content: system });
    }

    for (const msg of messages) {
        if (typeof msg.content === 'string') {
            // Mensagem simples de texto
            result.push({ role: msg.role, content: msg.content });
            continue;
        }

        if (!Array.isArray(msg.content)) continue;

        // Mensagens com content array (tool_use, tool_result, text)
        if (msg.role === 'assistant') {
            // Pode ter blocos de texto + tool_use
            const textBlocks = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
            const toolUseBlocks = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

            const textContent = textBlocks.map(b => b.text).join('\n').trim() || null;
            const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = toolUseBlocks.map(b => ({
                id: b.id,
                type: 'function' as const,
                function: {
                    name: b.name,
                    arguments: JSON.stringify(b.input),
                },
            }));

            const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
                role: 'assistant',
                content: textContent,
            };
            if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
            result.push(assistantMsg);

        } else if (msg.role === 'user') {
            // Pode ter tool_result blocks — cada um vira uma mensagem role=tool separada
            const toolResultBlocks = msg.content.filter(
                (b): b is Anthropic.ToolResultBlockParam => b.type === 'tool_result'
            );
            const textBlocks = msg.content.filter(
                (b): b is Anthropic.TextBlock => b.type === 'text'
            );

            if (toolResultBlocks.length > 0) {
                for (const tr of toolResultBlocks) {
                    const content = typeof tr.content === 'string'
                        ? tr.content
                        : Array.isArray(tr.content)
                            ? tr.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('\n')
                            : '';
                    result.push({
                        role: 'tool',
                        tool_call_id: tr.tool_use_id,
                        content,
                    });
                }
            }

            if (textBlocks.length > 0) {
                result.push({
                    role: 'user',
                    content: textBlocks.map(b => b.text).join('\n'),
                });
            }
        }
    }

    return result;
}

// ── Conversão de tools Anthropic → OpenAI ────────────────────────────────────

function convertToolsToOpenAI(tools: Anthropic.Tool[]): OpenAI.ChatCompletionTool[] {
    return tools.map(t => ({
        type: 'function' as const,
        function: {
            name: t.name,
            description: t.description ?? '',
            parameters: t.input_schema as Record<string, unknown>,
        },
    }));
}

// ── Conversão de resposta OpenAI → Anthropic ─────────────────────────────────

function convertResponseToAnthropic(
    choice: OpenAI.ChatCompletion['choices'][0]
): AiMessagesCreateResponse {
    const message = choice.message;
    const content: Anthropic.ContentBlock[] = [];

    if (message.content) {
        content.push({ type: 'text', text: message.content } as Anthropic.TextBlock);
    }

    if (message.tool_calls && message.tool_calls.length > 0) {
        for (const tc of message.tool_calls) {
            if (tc.type !== 'function') continue;
            let input: Record<string, unknown> = {};
            try {
                input = JSON.parse(tc.function.arguments) as Record<string, unknown>;
            } catch {
                input = { raw: tc.function.arguments };
            }
            content.push({
                type: 'tool_use',
                id: tc.id,
                name: tc.function.name,
                input,
            } as Anthropic.ToolUseBlock);
        }
    }

    const stopReason = choice.finish_reason === 'tool_calls'
        ? 'tool_use'
        : choice.finish_reason === 'length'
            ? 'max_tokens'
            : 'end_turn';

    return { content, stop_reason: stopReason };
}

// ── Classe do adaptador ───────────────────────────────────────────────────────

class OpenAICompatAdapter implements AiClient {
    private readonly openai: OpenAI;
    private readonly config: ProviderConfig;
    private readonly providerName: string;

    constructor(providerName: string, config: ProviderConfig) {
        this.providerName = providerName;
        this.config = config;
        this.openai = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
        });
    }

    get messages() {
        return {
            create: async (params: AiMessagesCreateParams): Promise<AiMessagesCreateResponse> => {
                // Mapeia o modelo Claude para o equivalente no provider
                const mappedModel = this.config.modelMap[params.model] ?? this.config.defaultModel;

                const openaiMessages = convertMessagesToOpenAI(params.system, params.messages);
                const openaiTools = params.tools ? convertToolsToOpenAI(params.tools) : undefined;

                const requestParams: OpenAI.ChatCompletionCreateParamsNonStreaming = {
                    model: mappedModel,
                    max_tokens: params.max_tokens,
                    messages: openaiMessages,
                };

                if (openaiTools && openaiTools.length > 0) {
                    requestParams.tools = openaiTools;
                    requestParams.tool_choice = 'auto';
                }

                const response = await this.openai.chat.completions.create(requestParams);

                if (!response.choices || response.choices.length === 0) {
                    throw new Error(`[AI Adapter:${this.providerName}] Resposta sem choices.`);
                }

                return convertResponseToAnthropic(response.choices[0]!);
            },
        };
    }
}

// ── Factory ───────────────────────────────────────────────────────────────────

let _adapter: AiClient | null = null;

/**
 * Retorna o cliente AI adaptado baseado nas env vars disponíveis.
 * Prioridade: GROQ > GEMINI > (retorna null se nenhum)
 */
export function createAiAdapter(): AiClient | null {
    if (_adapter) return _adapter;

    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
        const config = PROVIDER_CONFIGS.groq(groqKey);
        _adapter = new OpenAICompatAdapter('Groq', config);
        console.log('[AI Adapter] ✅ Provider: Groq (llama-3.3-70b-versatile) — gratuito');
        return _adapter;
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
        const config = PROVIDER_CONFIGS.gemini(geminiKey);
        _adapter = new OpenAICompatAdapter('Gemini', config);
        console.log('[AI Adapter] ✅ Provider: Google Gemini (gemini-2.0-flash) — gratuito');
        return _adapter;
    }

    return null;
}

/**
 * Limpa o singleton (útil para testes).
 */
export function resetAiAdapter(): void {
    _adapter = null;
}
