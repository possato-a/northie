/**
 * @file jobs/chat-cleanup.job.ts
 * Limpa mensagens antigas do ai_chat_history para evitar crescimento
 * infinito da tabela. Roda diariamente e remove mensagens > 30 dias.
 */
import { supabase } from '../lib/supabase.js';
const RETENTION_DAYS = 30;
async function cleanupOldMessages() {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error, count } = await supabase
        .from('ai_chat_history')
        .delete({ count: 'exact' })
        .lt('created_at', cutoff);
    if (error) {
        console.error('[ChatCleanup] Error cleaning old messages:', error.message);
    }
    else if (count && count > 0) {
        console.log(`[ChatCleanup] Removed ${count} messages older than ${RETENTION_DAYS} days`);
    }
}
export function startChatCleanupJob() {
    console.log(`[ChatCleanup] Job registered — will clean messages older than ${RETENTION_DAYS} days every 24h.`);
    // Run once on startup (after a delay to not compete with other init tasks)
    setTimeout(cleanupOldMessages, 60 * 1000);
    // Then every 24 hours
    setInterval(cleanupOldMessages, 24 * 60 * 60 * 1000);
}
//# sourceMappingURL=chat-cleanup.job.js.map