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
    // req.body é um Buffer (express.raw) — parsear via rawBody que já está em UTF-8
    const rawBody = req.rawBody;
    let event;
    try {
        event = JSON.parse(rawBody?.toString('utf8') ?? req.body.toString());
    }
    catch {
        console.warn('[ResendWebhook] Payload inválido — não é JSON');
        return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    const { type, data } = event;
    const emailId = data?.email_id;
    const recipientEmail = data?.to?.[0]; // Resend envia to como array
    if (!emailId)
        return res.status(200).json({ received: true });
    // ── 1. Atualiza report_logs para eventos que mapeiam em status ───────────
    const emailStatus = EVENT_TO_STATUS[type];
    if (emailStatus) {
        const { error } = await supabase
            .from('report_logs')
            .update({ email_status: emailStatus })
            .eq('resend_email_id', emailId);
        if (error) {
            console.error('[ResendWebhook] Erro ao atualizar report_logs:', error.message);
        }
    }
    // ── 2. Atualiza tabela customers com base no recipiente ───────────────────
    if (recipientEmail) {
        if (type === 'email.bounced') {
            // Marca bounce — evita reenvios e protege reputação do domínio
            const { error } = await supabase
                .from('customers')
                .update({ email_status: 'bounced' })
                .eq('email', recipientEmail);
            if (error)
                console.error('[ResendWebhook] Erro ao marcar bounce:', error.message);
            else
                console.log(`[ResendWebhook] email.bounced → customers email_status=bounced para ${recipientEmail}`);
        }
        else if (type === 'email.complained') {
            // Reclamo (spam) — marca como unsubscribed imediatamente
            const { error } = await supabase
                .from('customers')
                .update({ email_status: 'unsubscribed' })
                .eq('email', recipientEmail);
            if (error)
                console.error('[ResendWebhook] Erro ao marcar complained:', error.message);
            else
                console.log(`[ResendWebhook] email.complained → customers email_status=unsubscribed para ${recipientEmail}`);
        }
        else if (type === 'email.opened' || type === 'email.clicked') {
            // Engajamento positivo — atualiza last_engagement_at para cálculo de churn
            const { error } = await supabase
                .from('customers')
                .update({ last_engagement_at: new Date().toISOString() })
                .eq('email', recipientEmail);
            if (error)
                console.error('[ResendWebhook] Erro ao atualizar last_engagement_at:', error.message);
            else
                console.log(`[ResendWebhook] ${type} → customers last_engagement_at atualizado para ${recipientEmail}`);
        }
    }
    console.log(`[ResendWebhook] ${type} → email_id=${emailId} status=${emailStatus ?? 'não mapeado'}`);
    return res.status(200).json({ received: true });
}
//# sourceMappingURL=resend-webhook.controller.js.map