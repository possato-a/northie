import { Resend } from 'resend';
import type { ReportAIAnalysis } from './report-ai-analyst.js';
import type { generateReportData } from './report-generator.js';

// ── Resend client ─────────────────────────────────────────────────────────────

let _resend: Resend | null = null;
export function getResend(): Resend | null {
    if (!process.env.RESEND_API_KEY) return null;
    if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
    return _resend;
}

// ── Formatters internos ───────────────────────────────────────────────────────

const fmtBRL = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const fmtNum = (n: number, d = 2) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

const FREQ_LABEL: Record<string, string> = {
    weekly: 'Semanal', monthly: 'Mensal', quarterly: 'Trimestral',
    semanal: 'Semanal', mensal: 'Mensal', trimestral: 'Trimestral',
};

const SITUACAO_FALLBACK = { label: 'Atenção', color: '#b45309', bg: '#fffbeb' };
const SITUACAO: Record<string, { label: string; color: string; bg: string }> = {
    saudavel: { label: 'Saudável',  color: '#16a34a', bg: '#f0fdf4' },
    atencao:  SITUACAO_FALLBACK,
    critica:  { label: 'Crítica',   color: '#dc2626', bg: '#fef2f2' },
};

const SEVERIDADE_COLOR: Record<string, string> = {
    critica: '#dc2626', alta: '#ea580c', media: '#d97706', ok: '#16a34a',
};

// ── Template HTML do email ────────────────────────────────────────────────────

function buildEmailHtml(opts: {
    frequency: string;
    data: Awaited<ReturnType<typeof generateReportData>>;
    ai: ReportAIAnalysis;
    format: string;
}): string {
    const { frequency, data, ai, format } = opts;
    const freqLabel = FREQ_LABEL[frequency] ?? frequency;
    const situacao = SITUACAO[ai.situacao_geral] ?? SITUACAO_FALLBACK;

    const fmtDate = (iso: string) =>
        new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    // KPIs
    const kpis = [
        { label: 'Receita Líquida', value: fmtBRL(data.summary.revenue_net) },
        { label: 'ROAS', value: `${fmtNum(data.summary.roas)}x` },
        { label: 'Novos Clientes', value: String(data.summary.new_customers) },
        { label: 'LTV Médio', value: fmtBRL(data.summary.ltv_avg) },
        { label: 'Ticket Médio', value: fmtBRL(data.summary.aov) },
        { label: 'Margem Bruta', value: `${fmtNum(data.summary.gross_margin_pct)}%` },
    ];

    const kpiRow = kpis.map(k => `
        <td style="width:33%;padding:16px;text-align:center;border-right:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">${k.label}</div>
            <div style="font-size:20px;font-weight:700;color:#111827;margin-top:6px;font-family:monospace;">${k.value}</div>
        </td>`).join('');

    // Canais
    const channelRows = data.channel_economics
        .filter(c => c.channel !== 'desconhecido')
        .slice(0, 5)
        .map(ch => {
            const statusColor = ch.status === 'lucrativo' ? '#16a34a' : ch.status === 'prejuizo' ? '#dc2626' : '#6b7280';
            const statusLabel = ch.status === 'lucrativo' ? 'Lucrativo' : ch.status === 'prejuizo' ? 'Prejuízo' : 'Orgânico';
            const ltvcac = ch.ltv_cac_ratio !== null ? fmtNum(ch.ltv_cac_ratio) + 'x' : '—';
            return `
            <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:10px 16px;font-size:13px;color:#374151;">${ch.channel}</td>
                <td style="padding:10px 16px;font-size:13px;color:#374151;text-align:center;">${ch.new_customers}</td>
                <td style="padding:10px 16px;font-size:13px;color:#374151;text-align:right;font-family:monospace;">${fmtBRL(ch.avg_ltv)}</td>
                <td style="padding:10px 16px;font-size:13px;color:#374151;text-align:right;font-family:monospace;">${ch.cac > 0 ? fmtBRL(ch.cac) : '—'}</td>
                <td style="padding:10px 16px;font-size:13px;text-align:right;font-family:monospace;">${ltvcac}</td>
                <td style="padding:10px 16px;text-align:right;">
                    <span style="background:${statusColor}18;color:${statusColor};font-size:11px;font-weight:600;padding:3px 8px;border-radius:4px;">${statusLabel}</span>
                </td>
            </tr>`;
        }).join('');

    // Diagnósticos
    const diagRows = ai.diagnosticos.slice(0, 4).map(d => {
        const color = SEVERIDADE_COLOR[d.severidade] ?? '#6b7280';
        const prazoLabel = { imediato: 'Imediato', esta_semana: 'Esta semana', este_mes: 'Este mês' }[d.prazo] ?? d.prazo;
        return `
        <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:12px 16px;">
                <div style="font-size:12px;font-weight:600;color:#111827;">${d.canal}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:3px;">${d.sintoma}</div>
            </td>
            <td style="padding:12px 16px;text-align:center;">
                <span style="background:${color}18;color:${color};font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;text-transform:uppercase;">${d.severidade}</span>
            </td>
            <td style="padding:12px 16px;font-size:12px;color:#374151;">${d.acao_recomendada}</td>
            <td style="padding:12px 16px;font-size:12px;font-weight:600;color:${color};font-family:monospace;text-align:right;">${fmtBRL(d.consequencia_financeira_brl)}</td>
            <td style="padding:12px 16px;font-size:11px;color:#6b7280;text-align:right;">${prazoLabel}</td>
        </tr>`;
    }).join('');

    // Próximos passos
    const nextSteps = ai.proximos_passos.slice(0, 4).map((p, i) =>
        `<li style="margin:8px 0;font-size:13px;color:#374151;"><span style="color:#1a7fe8;font-weight:700;">${i + 1}.</span> ${p}</li>`
    ).join('');

    // Variação de receita
    const changeHtml = data.summary.revenue_change_pct !== null
        ? `<span style="color:${data.summary.revenue_change_pct >= 0 ? '#16a34a' : '#dc2626'};font-weight:600;">
            ${data.summary.revenue_change_pct >= 0 ? '▲' : '▼'} ${Math.abs(data.summary.revenue_change_pct).toFixed(1)}% vs período anterior
           </span>`
        : '';

    const formatLabel = { pdf: 'PDF', xlsx: 'XLSX', csv: 'CSV', json: 'JSON' }[format] ?? format.toUpperCase();

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:680px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#111827;padding:28px 32px;display:flex;align-items:center;justify-content:space-between;">
        <div>
            <div style="color:white;font-size:22px;font-weight:800;letter-spacing:-0.5px;">NORTHIE</div>
            <div style="color:#9ca3af;font-size:13px;margin-top:4px;">Relatório ${freqLabel} · ${fmtDate(data.period.start)} – ${fmtDate(data.period.end)}</div>
        </div>
        <div style="background:${situacao.bg};border:1px solid ${situacao.color}33;border-radius:8px;padding:8px 14px;text-align:center;">
            <div style="font-size:10px;font-weight:700;color:${situacao.color};text-transform:uppercase;letter-spacing:0.08em;">Situação</div>
            <div style="font-size:14px;font-weight:700;color:${situacao.color};margin-top:2px;">${situacao.label}</div>
        </div>
    </div>

    <!-- Resumo executivo -->
    <div style="padding:24px 32px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${ai.resumo_executivo}</p>
        ${changeHtml ? `<div style="margin-top:10px;">${changeHtml}</div>` : ''}
    </div>

    <!-- KPIs -->
    <div style="padding:0 32px 24px;">
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;padding:20px 0 12px;">Métricas do Período</div>
        <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
            <tr>${kpis.slice(0,3).map(k => `
                <td style="padding:16px;text-align:center;border-right:1px solid #e5e7eb;">
                    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">${k.label}</div>
                    <div style="font-size:18px;font-weight:700;color:#111827;margin-top:6px;font-family:monospace;">${k.value}</div>
                </td>`).join('')}
            </tr>
            <tr style="border-top:1px solid #e5e7eb;">${kpis.slice(3).map(k => `
                <td style="padding:16px;text-align:center;border-right:1px solid #e5e7eb;">
                    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">${k.label}</div>
                    <div style="font-size:18px;font-weight:700;color:#111827;margin-top:6px;font-family:monospace;">${k.value}</div>
                </td>`).join('')}
            </tr>
        </table>
    </div>

    ${channelRows ? `
    <!-- Canais -->
    <div style="padding:0 32px 24px;">
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;padding-bottom:12px;">Economia por Canal</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <thead>
                <tr style="background:#f9fafb;">
                    <th style="padding:10px 16px;font-size:11px;color:#6b7280;text-align:left;font-weight:600;">Canal</th>
                    <th style="padding:10px 16px;font-size:11px;color:#6b7280;text-align:center;font-weight:600;">Clientes</th>
                    <th style="padding:10px 16px;font-size:11px;color:#6b7280;text-align:right;font-weight:600;">LTV Médio</th>
                    <th style="padding:10px 16px;font-size:11px;color:#6b7280;text-align:right;font-weight:600;">CAC</th>
                    <th style="padding:10px 16px;font-size:11px;color:#6b7280;text-align:right;font-weight:600;">LTV/CAC</th>
                    <th style="padding:10px 16px;font-size:11px;color:#6b7280;text-align:right;font-weight:600;">Status</th>
                </tr>
            </thead>
            <tbody>${channelRows}</tbody>
        </table>
    </div>` : ''}

    ${diagRows ? `
    <!-- Diagnósticos -->
    <div style="padding:0 32px 24px;">
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;padding-bottom:12px;">Diagnósticos de IA</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <thead>
                <tr style="background:#f9fafb;">
                    <th style="padding:10px 16px;font-size:11px;color:#6b7280;text-align:left;font-weight:600;">Problema</th>
                    <th style="padding:10px 16px;font-size:11px;color:#6b7280;text-align:center;font-weight:600;">Severidade</th>
                    <th style="padding:10px 16px;font-size:11px;color:#6b7280;text-align:left;font-weight:600;">Ação</th>
                    <th style="padding:10px 16px;font-size:11px;color:#6b7280;text-align:right;font-weight:600;">Impacto</th>
                    <th style="padding:10px 16px;font-size:11px;color:#6b7280;text-align:right;font-weight:600;">Prazo</th>
                </tr>
            </thead>
            <tbody>${diagRows}</tbody>
        </table>
    </div>` : ''}

    ${nextSteps ? `
    <!-- Próximos passos -->
    <div style="padding:0 32px 24px;">
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;padding-bottom:8px;">Próximos Passos</div>
        <ul style="margin:0;padding-left:0;list-style:none;">${nextSteps}</ul>
    </div>` : ''}

    <!-- Attachment note -->
    <div style="margin:0 32px 24px;padding:16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">
        <p style="margin:0;font-size:13px;color:#1e40af;">
            📎 O relatório completo em <strong>${formatLabel}</strong> está em anexo a este email.
        </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
            Northie · Infraestrutura financeira para founders digitais<br/>
            Gerado automaticamente em ${new Date().toLocaleDateString('pt-BR')} ·
            Para ajustar as configurações, acesse a aba Relatórios no dashboard.
        </p>
    </div>
</div>
</body>
</html>`;
}

// ── Função principal de envio ─────────────────────────────────────────────────

export async function sendReport(opts: {
    to: string;
    frequency: string;
    format: string;
    fileBuffer: Buffer | string;
    filename: string;
    data: Awaited<ReturnType<typeof generateReportData>>;
    ai: ReportAIAnalysis;
}): Promise<string | null> {
    const resend = getResend();
    if (!resend) {
        console.warn('[ReportEmail] RESEND_API_KEY não configurado');
        return null;
    }

    const freqLabel = FREQ_LABEL[opts.frequency] ?? opts.frequency;
    const html = buildEmailHtml({ frequency: opts.frequency, data: opts.data, ai: opts.ai, format: opts.format });

    const contentBase64 = Buffer.isBuffer(opts.fileBuffer)
        ? opts.fileBuffer.toString('base64')
        : Buffer.from(opts.fileBuffer, 'utf-8').toString('base64');

    const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'Northie <onboarding@resend.dev>',
        to: opts.to,
        subject: `Relatório ${freqLabel} — Northie · ${new Date().toLocaleDateString('pt-BR')}`,
        html,
        attachments: [{ filename: opts.filename, content: contentBase64 }],
    });

    if (error) {
        console.error('[ReportEmail] Erro ao enviar:', error);
        throw new Error(error.message);
    }

    console.log(`[ReportEmail] Enviado para ${opts.to} — id ${data?.id}`);
    return data?.id ?? null;
}
