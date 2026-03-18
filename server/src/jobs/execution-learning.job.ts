/**
 * @file jobs/execution-learning.job.ts
 *
 * Loop de aprendizado pós-execução do Growth Engine.
 * Detecta conversões de clientes que receberam mensagens de execução e
 * atualiza as estatísticas de conversão por recomendação.
 *
 * Frequência: a cada 24 horas.
 * Delay entre profiles: 1 segundo (evitar sobrecarga no banco).
 * Mutex: evita overlap se o ciclo anterior ainda estiver em execução.
 */

import { supabase } from '../lib/supabase.js';
import { ExecutionLearningService } from '../services/execution-learning.service.js';

// ── Mutex — impede execução simultânea ────────────────────────────────────────

let isRunning = false;

// ── Runner principal ──────────────────────────────────────────────────────────

async function runLearningForAllProfiles(): Promise<void> {
    console.log('[Learning] Iniciando ciclo de detecção de conversões...');

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id');

    if (error) {
        console.error('[Learning] Falha ao buscar profiles:', error.message);
        return;
    }

    for (const profile of profiles ?? []) {
        try {
            const result = await ExecutionLearningService.checkConversions(profile.id);

            if (result.checked > 0) {
                const revenueFormatted = result.revenue.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                });
                console.log(
                    `[Learning] profile ${profile.id}: ${result.checked} verificados, ${result.converted} convertidos, ${revenueFormatted}`
                );
            }

            await ExecutionLearningService.aggregateRecommendationStats(profile.id);
        } catch (err: unknown) {
            console.error(
                `[Learning] Erro para profile ${profile.id}:`,
                err instanceof Error ? err.message : String(err)
            );
        }

        // Delay entre profiles para não saturar o banco
        await new Promise(resolve => setTimeout(resolve, 1_000));
    }

    console.log('[Learning] Ciclo de aprendizado concluído.');
}

async function runLearningWithMutex(): Promise<void> {
    if (isRunning) {
        console.log('[Learning] Já em execução, pulando ciclo.');
        return;
    }
    isRunning = true;
    try {
        await runLearningForAllProfiles();
    } finally {
        isRunning = false;
    }
}

// ── Job starter ───────────────────────────────────────────────────────────────

export function startExecutionLearningJob(): void {
    console.log('[Learning] Job registrado — rodará a cada 24 horas.');
    setInterval(runLearningWithMutex, 24 * 60 * 60 * 1000);
}
