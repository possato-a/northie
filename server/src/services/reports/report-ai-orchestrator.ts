import Anthropic from '@anthropic-ai/sdk';
import type { generateReportData } from './report-generator.js';
import type { ReportAIAnalysis } from './report-ai-analyst.js';
import { runDataAnalystAgent } from './agents/data-analyst.agent.js';
import { runStrategistAgent } from './agents/strategist.agent.js';
import { getAnthropicClient } from '../../lib/anthropic.js';

type ReportData = Awaited<ReturnType<typeof generateReportData>>;

function getAnthropic(): Anthropic {
    return getAnthropicClient() as Anthropic;
}

// ── Fallback ──────────────────────────────────────────────────────────────────

const FALLBACK: Omit<ReportAIAnalysis, 'generated_at' | 'model'> = {
    situacao_geral:   'atencao',
    resumo_executivo: 'Análise de IA indisponível. Consulte os dados numéricos do relatório.',
    diagnosticos:     [],
    proximos_passos:  [],
};

// ── Pipeline ──────────────────────────────────────────────────────────────────

export async function runOrchestratorPipeline(
    data: ReportData,
    profileId: string,
): Promise<ReportAIAnalysis> {
    const generatedAt = new Date().toISOString();
    const model       = 'claude-sonnet-4-6 (analista) + claude-opus-4-6 (estrategista)';
    const anthropic   = getAnthropic();

    try {
        // ── Agent 1: coleta dados históricos com tool_use ──────────────────────
        console.log('[OrchestratorAI] Agent 1 — Analista de Dados iniciado...');
        const analystFindings = await runDataAnalystAgent(anthropic, data, profileId);
        console.log('[OrchestratorAI] Agent 1 concluído.');

        // ── Agent 2: diagnostica com extended thinking ─────────────────────────
        console.log('[OrchestratorAI] Agent 2 — Estrategista iniciado (extended thinking)...');
        const strategistResult = await runStrategistAgent(anthropic, data, analystFindings);
        console.log('[OrchestratorAI] Agent 2 concluído.');

        return { ...strategistResult, generated_at: generatedAt, model };

    } catch (err: unknown) {
        console.error('[OrchestratorAI] Falha no pipeline:', err);
        return { ...FALLBACK, generated_at: generatedAt, model };
    }
}
