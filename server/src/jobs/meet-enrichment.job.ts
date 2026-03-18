/**
 * @file jobs/meet-enrichment.job.ts
 *
 * Job periódico que analisa transcrições de reuniões pendentes via IA.
 * Roda a cada 6 horas para todos os profiles ativos.
 *
 * - Usa mutex para evitar execução simultânea
 * - Processa até 10 reuniões por profile por ciclo
 * - Chama MeetTranscriptionService.processUnanalyzed por profile
 */

import { supabase } from '../lib/supabase.js';
import { MeetTranscriptionService } from '../services/meet-transcription.service.js';

const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 horas

let isRunning = false;

async function runMeetEnrichmentForAllProfiles(): Promise<void> {
    console.log('[MeetEnrichment] Iniciando ciclo de análise de transcrições...');

    // Busca todos os profiles que tenham alguma reunião com transcript pendente
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id');

    if (error) {
        console.error('[MeetEnrichment] Falha ao buscar profiles:', error.message);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log('[MeetEnrichment] Nenhum profile encontrado.');
        return;
    }

    let totalProcessed = 0;

    for (const profile of profiles) {
        const profileId = profile.id as string;
        try {
            const count = await MeetTranscriptionService.processUnanalyzed(profileId);
            if (count > 0) {
                console.log(
                    `[MeetEnrichment] Profile ${profileId}: ${count} reunião(ões) analisada(s).`
                );
                totalProcessed += count;
            }
        } catch (err) {
            console.error(
                `[MeetEnrichment] Erro ao processar profile ${profileId}:`,
                (err as Error).message
            );
        }
    }

    console.log(
        `[MeetEnrichment] Ciclo concluído. Total processado: ${totalProcessed} reunião(ões).`
    );
}

async function runWithMutex(): Promise<void> {
    if (isRunning) {
        console.log('[MeetEnrichment] Já em execução — ciclo ignorado.');
        return;
    }
    isRunning = true;
    try {
        await runMeetEnrichmentForAllProfiles();
    } finally {
        isRunning = false;
    }
}

export function startMeetEnrichmentJob(): void {
    console.log('[MeetEnrichment] Job registrado — rodará a cada 6 horas.');
    setInterval(() => {
        runWithMutex().catch(err => {
            console.error('[MeetEnrichment] Erro não tratado no ciclo:', (err as Error).message);
        });
    }, INTERVAL_MS);
}
