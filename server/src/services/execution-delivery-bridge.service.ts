/**
 * @file services/execution-delivery-bridge.service.ts
 *
 * Bridge entre os status de entrega do WhatsApp (whatsapp_messages)
 * e os itens de execução do Growth Engine (growth_execution_items).
 *
 * O webhook da Meta notifica status de mensagem via wamid.
 * Este serviço propaga esses status para o execution item correspondente,
 * mantendo rastreabilidade do delivery no Growth Engine.
 */

import { supabase } from '../lib/supabase.js';

// Status normalizados que o bridge aceita
type WhatsAppDeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed';

// Mapeamento de status WhatsApp → status em growth_execution_items
const STATUS_MAP: Record<WhatsAppDeliveryStatus, string> = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'delivered', // read implica delivered
    failed: 'failed',
};

/**
 * Propaga o status de entrega de uma mensagem WhatsApp para o
 * growth_execution_item correspondente via growth_action_id.
 *
 * Opera silenciosamente — não lança exceções para não bloquear
 * o processamento do webhook principal.
 */
export async function syncDeliveryToExecutionItem(
    wamid: string,
    newStatus: WhatsAppDeliveryStatus
): Promise<void> {
    // 1. Busca a mensagem WhatsApp pelo wamid para obter growth_action_id
    const { data: waMsg, error: fetchError } = await supabase
        .from('whatsapp_messages')
        .select('id, growth_action_id, to_number, status')
        .eq('wamid', wamid)
        .maybeSingle();

    if (fetchError) {
        console.debug(
            `[DeliveryBridge] Erro ao buscar whatsapp_message wamid=${wamid}:`,
            fetchError.message
        );
        return;
    }

    if (!waMsg) {
        console.debug(`[DeliveryBridge] wamid=${wamid} não encontrado — ignorando.`);
        return;
    }

    const growthActionId = waMsg.growth_action_id as string | null;
    if (!growthActionId) {
        // Mensagem não vinculada a uma ação do Growth Engine (ex: alertas ao founder)
        console.debug(
            `[DeliveryBridge] wamid=${wamid} sem growth_action_id — sem execution item para atualizar.`
        );
        return;
    }

    const targetStatus = STATUS_MAP[newStatus];
    const toNumber = waMsg.to_number as string | null;

    // 2. Busca o execution item correspondente à recomendação e número do cliente
    //    Tenta primeiro por customer_phone (match exato) e depois pelo recommendation_id sozinho
    //    para cobrir casos onde o phone está armazenado com formatos ligeiramente diferentes.
    let itemId: string | null = null;

    if (toNumber) {
        const { data: itemByPhone } = await supabase
            .from('growth_execution_items')
            .select('id')
            .eq('recommendation_id', growthActionId)
            .eq('customer_phone', toNumber)
            .maybeSingle();

        if (itemByPhone) {
            itemId = itemByPhone.id as string;
        }
    }

    // Fallback: pega qualquer item pending/sent daquela recomendação se não achou pelo phone
    if (!itemId) {
        const { data: itemFallback } = await supabase
            .from('growth_execution_items')
            .select('id')
            .eq('recommendation_id', growthActionId)
            .in('status', ['sent', 'pending'])
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (itemFallback) {
            itemId = itemFallback.id as string;
        }
    }

    if (!itemId) {
        console.debug(
            `[DeliveryBridge] Nenhum execution item encontrado para recommendation_id=${growthActionId} (wamid=${wamid}).`
        );
        return;
    }

    // 3. Atualiza o status do execution item
    const { error: updateError } = await supabase
        .from('growth_execution_items')
        .update({
            status: targetStatus,
            updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

    if (updateError) {
        console.debug(
            `[DeliveryBridge] Falha ao atualizar execution item id=${itemId}:`,
            updateError.message
        );
        return;
    }

    console.debug(
        `[DeliveryBridge] execution item id=${itemId} atualizado para "${targetStatus}" via wamid=${wamid} (status WA original: "${newStatus}").`
    );
}
