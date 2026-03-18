/**
 * @file services/meet-transcription.service.ts
 *
 * Analisa transcrições de reuniões via Claude e enriquece o contexto
 * de transações e clientes com insights estruturados.
 *
 * Responsabilidades:
 * - Analisar transcript de reunião com Claude Haiku (custo mínimo)
 * - Persistir ai_analysis em meetings
 * - Enriquecer customers.meeting_context com dados da análise
 * - Processar em lote reuniões pendentes de análise
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../lib/supabase.js';

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export interface MeetingAnalysis {
    meetingId: string;
    customerId?: string;
    objections: string[];
    sentimentScore: number;  // -1 (negativo) a +1 (positivo)
    buyingSignals: string[];
    decisionTimelineDays?: number;
    nextStepsSuggested: string[];
    summary: string;
    analyzedAt: string;
}

// ── Singleton Anthropic (lazy) ────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
    if (!_anthropic) {
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error('[MeetTranscription] ANTHROPIC_API_KEY não configurada.');
        }
        _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return _anthropic;
}

// ── Prompt de análise ─────────────────────────────────────────────────────────

function buildAnalysisPrompt(transcript: string): string {
    return `Você é um analista de reuniões de vendas. Analise a transcrição abaixo e retorne um JSON estruturado com os campos indicados. Responda APENAS com o JSON, sem markdown ou texto adicional.

TRANSCRIÇÃO:
${transcript.slice(0, 12000)}

JSON esperado (todos os campos são obrigatórios exceto decisionTimelineDays):
{
  "objections": ["string — objeção levantada pelo cliente"],
  "sentimentScore": 0.0,
  "buyingSignals": ["string — sinal positivo de interesse ou fechamento"],
  "decisionTimelineDays": null,
  "nextStepsSuggested": ["string — próximo passo concreto"],
  "summary": "string — resumo objetivo da reunião em 2-3 frases"
}

Regras:
- sentimentScore: número entre -1.0 (muito negativo) e +1.0 (muito positivo), escala contínua
- decisionTimelineDays: número inteiro de dias até decisão mencionado explicitamente, ou null se não mencionado
- objections: vazia se não houver objeções identificadas
- buyingSignals: vazia se não houver sinais positivos
- nextStepsSuggested: pelo menos um item se houver qualquer indicação de próximo passo
- Responda em português brasileiro
- NUNCA use markdown ou texto fora do JSON`;
}

// ── Classe principal ──────────────────────────────────────────────────────────

export class MeetTranscriptionService {
    /**
     * Analisa o transcript de uma reunião via Claude e retorna insights estruturados.
     * O transcript pode vir do parâmetro ou do campo meetings.transcript no banco.
     */
    static async analyzeMeeting(
        meetingId: string,
        profileId: string,
        transcriptText?: string
    ): Promise<MeetingAnalysis | null> {
        let transcript = transcriptText ?? null;
        let linkedCustomerId: string | null = null;

        // Se não recebeu transcript, busca no banco
        if (!transcript) {
            const { data: meeting, error } = await supabase
                .from('meetings')
                .select('transcript, notes, linked_customer_id')
                .eq('id', meetingId)
                .eq('profile_id', profileId)
                .single();

            if (error || !meeting) {
                console.warn(`[MeetTranscription] Reunião ${meetingId} não encontrada.`);
                return null;
            }

            // Usa transcript se disponível, senão notes como fallback
            const rawTranscript = (meeting.transcript as string | null) ?? null;
            const rawNotes = (meeting.notes as string | null) ?? null;
            transcript = rawTranscript ?? rawNotes ?? null;
            linkedCustomerId = (meeting.linked_customer_id as string | null) ?? null;
        }

        if (!transcript || transcript.trim().length < 50) {
            console.log(`[MeetTranscription] Reunião ${meetingId} sem texto suficiente para análise.`);
            return null;
        }

        try {
            const client = getAnthropic();
            const response = await client.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: buildAnalysisPrompt(transcript),
                    },
                ],
            });

            const textBlock = response.content.find(b => b.type === 'text');
            if (!textBlock || textBlock.type !== 'text') {
                console.error(`[MeetTranscription] Claude não retornou texto para reunião ${meetingId}.`);
                return null;
            }

            // Parse seguro do JSON
            let parsed: Record<string, unknown>;
            try {
                // Remove possível markdown residual antes de parsear
                const cleaned = textBlock.text
                    .replace(/^```(?:json)?\s*/i, '')
                    .replace(/\s*```$/i, '')
                    .trim();
                parsed = JSON.parse(cleaned) as Record<string, unknown>;
            } catch (parseErr) {
                console.error(
                    `[MeetTranscription] Falha ao parsear JSON da reunião ${meetingId}:`,
                    (parseErr as Error).message
                );
                return null;
            }

            const analysis: MeetingAnalysis = {
                meetingId,
                objections: Array.isArray(parsed.objections)
                    ? (parsed.objections as string[])
                    : [],
                sentimentScore: typeof parsed.sentimentScore === 'number'
                    ? Math.max(-1, Math.min(1, parsed.sentimentScore))
                    : 0,
                buyingSignals: Array.isArray(parsed.buyingSignals)
                    ? (parsed.buyingSignals as string[])
                    : [],
                nextStepsSuggested: Array.isArray(parsed.nextStepsSuggested)
                    ? (parsed.nextStepsSuggested as string[])
                    : [],
                summary: typeof parsed.summary === 'string'
                    ? parsed.summary
                    : 'Análise indisponível.',
                analyzedAt: new Date().toISOString(),
            };

            // Campos opcionais
            if (typeof parsed.decisionTimelineDays === 'number') {
                analysis.decisionTimelineDays = Math.round(parsed.decisionTimelineDays);
            }
            if (linkedCustomerId) {
                analysis.customerId = linkedCustomerId;
            }

            return analysis;
        } catch (err) {
            console.error(
                `[MeetTranscription] Erro ao chamar Claude para reunião ${meetingId}:`,
                (err as Error).message
            );
            return null;
        }
    }

    /**
     * Após análise, persiste os insights em meetings.ai_analysis (JSONB)
     * e, se linked_customer_id estiver vinculado, enriquece customers.meeting_context.
     */
    static async enrichTransactionContext(
        meetingId: string,
        profileId: string
    ): Promise<void> {
        // Verifica se já tem ai_analysis para evitar reprocessamento
        const { data: existing } = await supabase
            .from('meetings')
            .select('ai_analysis, linked_customer_id')
            .eq('id', meetingId)
            .eq('profile_id', profileId)
            .single();

        if (existing?.ai_analysis) {
            console.log(`[MeetTranscription] Reunião ${meetingId} já analisada — pulando.`);
            return;
        }

        const analysis = await MeetTranscriptionService.analyzeMeeting(meetingId, profileId);
        if (!analysis) {
            console.log(`[MeetTranscription] Sem análise para reunião ${meetingId}.`);
            return;
        }

        // Persiste em meetings.ai_analysis
        const { error: meetingUpdateError } = await supabase
            .from('meetings')
            .update({ ai_analysis: analysis })
            .eq('id', meetingId)
            .eq('profile_id', profileId);

        if (meetingUpdateError) {
            console.error(
                `[MeetTranscription] Falha ao salvar ai_analysis em meetings ${meetingId}:`,
                meetingUpdateError.message
            );
            return;
        }

        console.log(`[MeetTranscription] ai_analysis salvo para reunião ${meetingId}.`);

        // Enriquece customers.meeting_context se houver customer vinculado
        const customerId =
            analysis.customerId ??
            ((existing?.linked_customer_id as string | null) ?? null);

        if (!customerId) {
            return;
        }

        const meetingContext = {
            last_meeting_id: meetingId,
            last_meeting_analyzed_at: analysis.analyzedAt,
            sentiment_score: analysis.sentimentScore,
            objections: analysis.objections,
            buying_signals: analysis.buyingSignals,
            next_steps: analysis.nextStepsSuggested,
            summary: analysis.summary,
            ...(analysis.decisionTimelineDays !== undefined
                ? { decision_timeline_days: analysis.decisionTimelineDays }
                : {}),
        };

        const { error: customerUpdateError } = await supabase
            .from('customers')
            .update({ meeting_context: meetingContext })
            .eq('id', customerId)
            .eq('profile_id', profileId);

        if (customerUpdateError) {
            console.error(
                `[MeetTranscription] Falha ao enriquecer customer ${customerId}:`,
                customerUpdateError.message
            );
            return;
        }

        console.log(
            `[MeetTranscription] meeting_context atualizado no customer ${customerId}.`
        );
    }

    /**
     * Busca todas as reuniões com transcript mas sem ai_analysis e processa.
     * Chamado pelo job periódico. Processa até 10 por vez com delay de 500ms entre cada.
     * Retorna o número de reuniões processadas.
     */
    static async processUnanalyzed(profileId: string): Promise<number> {
        const { data: meetings, error } = await supabase
            .from('meetings')
            .select('id')
            .eq('profile_id', profileId)
            .not('transcript', 'is', null)
            .is('ai_analysis', null)
            .limit(10);

        if (error) {
            console.error(
                `[MeetTranscription] Erro ao buscar reuniões pendentes para profile ${profileId}:`,
                error.message
            );
            return 0;
        }

        if (!meetings || meetings.length === 0) {
            return 0;
        }

        let processed = 0;

        for (const meeting of meetings) {
            try {
                await MeetTranscriptionService.enrichTransactionContext(
                    meeting.id as string,
                    profileId
                );
                processed++;
            } catch (err) {
                console.error(
                    `[MeetTranscription] Erro ao processar reunião ${meeting.id as string}:`,
                    (err as Error).message
                );
            }

            // Delay entre chamadas para não saturar a API
            if (processed < meetings.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return processed;
    }
}
