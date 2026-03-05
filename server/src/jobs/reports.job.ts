import { Resend } from 'resend';
import { supabase } from '../lib/supabase.js';
import {
    generateReportData, formatAsCsv, computeNextSendAt,
    type ReportFrequency,
} from '../services/reports/report-generator.js';
import { generateReportNarrative } from '../services/reports/report-ai-analyst.js';
import { generatePdf } from '../services/reports/report-pdf.js';

// Normaliza frequência pt-BR → en
const FREQ_MAP: Record<string, ReportFrequency> = {
    semanal: 'weekly', mensal: 'monthly', trimestral: 'quarterly',
    weekly: 'weekly', monthly: 'monthly', quarterly: 'quarterly',
};

const FREQ_LABEL: Record<string, string> = {
    weekly: 'Semanal', monthly: 'Mensal', quarterly: 'Trimestral',
    semanal: 'Semanal', mensal: 'Mensal', trimestral: 'Trimestral',
};

let _resend: Resend | null = null;
function getResend(): Resend | null {
    if (!process.env.RESEND_API_KEY) return null;
    if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
    return _resend;
}

async function sendReportEmail(opts: {
    to: string;
    frequency: string;
    format: string;
    fileBuffer: Buffer | string;
    filename: string;
    mimeType: string;
}) {
    const resend = getResend();
    if (!resend) {
        console.warn('[Reports] RESEND_API_KEY não configurado — email pulado');
        return;
    }

    const freqLabel = FREQ_LABEL[opts.frequency] ?? opts.frequency;

    await resend.emails.send({
        from: 'Northie <onboarding@resend.dev>',
        to: opts.to,
        subject: `Relatório ${freqLabel} — Northie`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
                <div style="background: #1E1E1E; padding: 20px 24px; border-radius: 8px; margin-bottom: 24px;">
                    <h1 style="color: white; margin: 0; font-size: 20px; letter-spacing: -0.5px;">NORTHIE</h1>
                    <p style="color: #aaa; margin: 6px 0 0; font-size: 13px;">Relatório ${freqLabel} gerado automaticamente</p>
                </div>
                <p style="color: #1E1E1E; font-size: 15px; line-height: 1.6;">
                    Seu relatório ${freqLabel.toLowerCase()} está pronto. Ele inclui dados cruzados de todas as suas integrações, análise de canais e diagnóstico de IA.
                </p>
                <p style="color: #6B7280; font-size: 13px;">O arquivo está em anexo neste email.</p>
                <hr style="border: none; border-top: 1px solid #E5E5E5; margin: 24px 0;" />
                <p style="color: #6B7280; font-size: 12px; margin: 0;">
                    Northie · Infraestrutura financeira para founders digitais<br/>
                    Para parar de receber esses emails, ajuste suas configurações em Relatórios.
                </p>
            </div>
        `,
        attachments: [
            {
                filename: opts.filename,
                content: Buffer.isBuffer(opts.fileBuffer)
                    ? opts.fileBuffer.toString('base64')
                    : Buffer.from(opts.fileBuffer).toString('base64'),
            },
        ],
    });
}

async function processScheduledReports() {
    const now = new Date().toISOString();

    const { data: configs } = await supabase
        .from('report_configs')
        .select('*')
        .eq('enabled', true)
        .lte('next_send_at', now);

    if (!configs?.length) return;

    for (const config of configs) {
        const logId = crypto.randomUUID();
        const frequency = FREQ_MAP[config.frequency] ?? 'monthly';
        const format: string = config.format ?? 'pdf';
        const dateStr = new Date().toISOString().split('T')[0];

        try {
            const reportData = await generateReportData(config.profile_id, frequency);
            const aiAnalysis = await generateReportNarrative(reportData);

            // Gera arquivo
            let fileBuffer: Buffer | string;
            let filename: string;
            let mimeType: string;

            if (format === 'pdf') {
                fileBuffer = await generatePdf(reportData, aiAnalysis);
                filename = `northie-relatorio-${config.frequency}-${dateStr}.pdf`;
                mimeType = 'application/pdf';
            } else if (format === 'csv') {
                fileBuffer = formatAsCsv(reportData, aiAnalysis);
                filename = `northie-relatorio-${config.frequency}-${dateStr}.csv`;
                mimeType = 'text/csv';
            } else {
                fileBuffer = JSON.stringify({ ...reportData, ai_analysis: aiAnalysis }, null, 2);
                filename = `northie-relatorio-${config.frequency}-${dateStr}.json`;
                mimeType = 'application/json';
            }

            // Envia email se configurado
            if (config.email) {
                await sendReportEmail({
                    to: config.email,
                    frequency: config.frequency,
                    format,
                    fileBuffer,
                    filename,
                    mimeType,
                });
            }

            // Log de sucesso
            await supabase.from('report_logs').insert({
                id: logId,
                profile_id: config.profile_id,
                frequency: config.frequency,
                format,
                period_start: reportData.period.start,
                period_end: reportData.period.end,
                status: 'success',
            });

            // Agenda próximo envio
            await supabase
                .from('report_configs')
                .update({ next_send_at: computeNextSendAt(config.frequency), updated_at: now })
                .eq('id', config.id);

            console.log(`[Reports] Relatório ${format} enviado para ${config.profile_id}`);
        } catch (err) {
            console.error(`[Reports] Falha para profile ${config.profile_id}:`, err);

            await supabase.from('report_logs').insert({
                id: logId,
                profile_id: config.profile_id,
                frequency: config.frequency,
                format,
                status: 'error',
            });
        }
    }
}

export function startReportsJob() {
    processScheduledReports();
    setInterval(processScheduledReports, 4 * 60 * 60 * 1000); // a cada 4h
    console.log('[Reports] Scheduled reports job started');
}
