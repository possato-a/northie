/**
 * @file lib/webhook-queue.ts
 * Fila de processamento de webhooks com retry automático.
 *
 * Fluxo:
 *  1. Webhook chega → salvo em platforms_data_raw (processed: false)
 *  2. Enfileirado aqui com rawId + metadados
 *  3. Worker tenta normalizar com até MAX_RETRIES tentativas (backoff exponencial)
 *  4. Sucesso → processed: true | Falha final → error_message + processed: false permanece
 *
 * Em produção futura: substituir por BullMQ + Redis para persistência entre restarts.
 */

import { normalizeData } from '../services/normalization.service.js';
import { supabase } from './supabase.js';

interface QueueItem {
    rawId: string;
    platform: string;
    payload: any;
    profileId: string;
    attempts: number;
    nextRetry: number; // timestamp ms
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2_000; // 2s → 4s → 8s → 16s → 32s
const MAX_QUEUE_SIZE = 500; // previne OOM em flood de webhooks

class WebhookQueue {
    private queue: QueueItem[] = [];
    private running = false;

    enqueue(rawId: string, platform: string, payload: any, profileId: string): void {
        if (this.queue.length >= MAX_QUEUE_SIZE) {
            console.warn(`[Queue] ⚠ Queue full (${MAX_QUEUE_SIZE}), dropping oldest item`);
            this.queue.shift(); // remove o mais antigo
        }
        this.queue.push({ rawId, platform, payload, profileId, attempts: 0, nextRetry: Date.now() });
        if (!this.running) this.drain();
    }

    private async drain(): Promise<void> {
        this.running = true;

        while (this.queue.length > 0) {
            const now = Date.now();
            const item = this.queue.find(i => i.nextRetry <= now);

            if (!item) {
                // Nada pronto ainda — aguardar o próximo item
                if (this.queue.length === 0) break; // Fila esvaziou entre a checagem e aqui
                const next = Math.min(...this.queue.map(i => i.nextRetry));
                const waitMs = Math.max(50, next - now + 50); // Nunca negativo
                await sleep(waitMs);
                continue;
            }

            // Remove da fila temporariamente (splice O(n) mas evita recriar array)
            const idx = this.queue.indexOf(item);
            if (idx !== -1) this.queue.splice(idx, 1);

            try {
                await normalizeData(item.rawId, item.platform, item.payload, item.profileId);
                console.log(`[Queue] ✓ Processed ${item.platform} raw=${item.rawId}`);
            } catch (err: any) {
                item.attempts += 1;

                if (item.attempts >= MAX_RETRIES) {
                    console.error(
                        `[Queue] ✗ Max retries reached for ${item.platform} raw=${item.rawId}:`,
                        err.message
                    );
                    // Marcar como falha permanente no banco
                    await supabase
                        .from('platforms_data_raw')
                        .update({ error_message: err.message, failed_at: new Date().toISOString() })
                        .eq('id', item.rawId);
                } else {
                    const delay = BASE_DELAY_MS * Math.pow(2, item.attempts - 1);
                    item.nextRetry = Date.now() + delay;
                    this.queue.push(item); // reencfileira
                    console.warn(
                        `[Queue] ↻ Retry ${item.attempts}/${MAX_RETRIES} for ${item.platform} raw=${item.rawId} in ${delay}ms`
                    );
                }
            }
        }

        this.running = false;
    }

    /** Reprocessa itens com processed:false que ficaram presos (ex: restart do servidor) */
    async recoverPending(): Promise<void> {
        const { data: pending } = await supabase
            .from('platforms_data_raw')
            .select('id, platform, payload, profile_id')
            .eq('processed', false)
            .is('failed_at', null)
            .order('created_at', { ascending: true })
            .limit(20);

        if (!pending?.length) return;

        console.log(`[Queue] Recovering ${pending.length} unprocessed webhooks from DB...`);
        for (const row of pending) {
            this.enqueue(row.id, row.platform, row.payload, row.profile_id);
        }
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, Math.max(ms, 0)));
}

export const webhookQueue = new WebhookQueue();
