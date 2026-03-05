import { createHmac, timingSafeEqual } from 'crypto';
import { supabase } from '../lib/supabase.js';
const EVENT_TO_STATUS = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
    'email.delivery_delayed': 'delayed',
};
// ── Verificação de assinatura Resend/Svix ─────────────────────────────────────
function verifyResendSignature(req) {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret)
        return false;
    const svixId = req.headers['svix-id'];
    const svixTimestamp = req.headers['svix-timestamp'];
    const svixSignature = req.headers['svix-signature'];
    if (!svixId || !svixTimestamp || !svixSignature)
        return false;
    // Rejeita eventos com timestamp > 5 minutos no passado
    const ts = parseInt(svixTimestamp, 10);
    if (Math.abs(Date.now() / 1000 - ts) > 300)
        return false;
    // Extrai a chave base64 do formato "whsec_<base64>"
    const rawSecret = secret.startsWith('whsec_')
        ? Buffer.from(secret.slice(6), 'base64')
        : Buffer.from(secret, 'base64');
    const body = req.rawBody?.toString('utf8') ?? '';
    const toSign = `${svixId}.${svixTimestamp}.${body}`;
    const computed = createHmac('sha256', rawSecret).update(toSign).digest('base64');
    // svix-signature pode ter múltiplos valores: "v1,<sig1> v1,<sig2>"
    const signatures = svixSignature.split(' ').map(s => s.replace(/^v1,/, ''));
    return signatures.some(sig => {
        try {
            return timingSafeEqual(Buffer.from(computed), Buffer.from(sig));
        }
        catch {
            return false;
        }
    });
}
// ── Handler principal ─────────────────────────────────────────────────────────
export async function handleResendWebhook(req, res) {
    if (!verifyResendSignature(req)) {
        console.warn('[ResendWebhook] Assinatura inválida');
        return res.status(401).json({ error: 'Invalid signature' });
    }
    const event = req.body;
    const emailStatus = EVENT_TO_STATUS[event.type];
    if (!emailStatus) {
        // Evento não relevante — responde 200 para o Resend não retentar
        return res.status(200).json({ received: true });
    }
    const emailId = event.data?.email_id;
    if (!emailId)
        return res.status(200).json({ received: true });
    const { error } = await supabase
        .from('report_logs')
        .update({ email_status: emailStatus })
        .eq('resend_email_id', emailId);
    if (error) {
        console.error('[ResendWebhook] Erro ao atualizar log:', error.message);
        return res.status(500).json({ error: 'DB update failed' });
    }
    console.log(`[ResendWebhook] ${event.type} → email ${emailId} → status ${emailStatus}`);
    return res.status(200).json({ received: true });
}
//# sourceMappingURL=resend-webhook.controller.js.map