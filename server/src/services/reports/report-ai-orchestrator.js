import Anthropic from '@anthropic-ai/sdk';
import { runDataAnalystAgent } from './agents/data-analyst.agent.js';
import { runStrategistAgent } from './agents/strategist.agent.js';
// ── Singleton Anthropic client ────────────────────────────────────────────────
let _anthropic = null;
function getAnthropic() {
    if (!_anthropic)
        _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return _anthropic;
}
// ── Fallback ──────────────────────────────────────────────────────────────────
const FALLBACK = {
    situacao_geral: 'atencao',
    resumo_executivo: 'Análise de IA indisponível. Consulte os dados numéricos do relatório.',
    diagnosticos: [],
    proximos_passos: [],
};
// ── Pipeline ──────────────────────────────────────────────────────────────────
export async function runOrchestratorPipeline(data, profileId) {
    const generatedAt = new Date().toISOString();
    const model = 'claude-sonnet-4-6 (analista) + claude-opus-4-6 (estrategista)';
    const anthropic = getAnthropic();
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
    }
    catch (err) {
        console.error('[OrchestratorAI] Falha no pipeline:', err);
        return { ...FALLBACK, generated_at: generatedAt, model };
    }
}
//# sourceMappingURL=report-ai-orchestrator.js.map