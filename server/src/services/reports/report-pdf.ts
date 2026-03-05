import { createRequire } from 'module';
import type { generateReportData } from './report-generator.js';
import type { ReportAIAnalysis } from './report-ai-analyst.js';

const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

// ── Constants ─────────────────────────────────────────────────────────────────

const MARGIN = 60;
const PAGE_WIDTH = 595.28; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const C = {
    dark: '#1E1E1E',
    white: '#FFFFFF',
    bg: '#FCF8F8',
    border: '#E5E5E5',
    textSecondary: '#6B7280',
    success: '#22C55E',
    danger: '#EF4444',
    primary: '#1A7FE8',
    accent: '#F59E0B',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function streamToBuffer(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });
}

function fmtBrl(n: number): string {
    return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(n: number, decimals = 2): string {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function changeBadge(pct: number | null): string {
    if (pct === null) return '';
    const sign = pct >= 0 ? '+' : '';
    return ` (${sign}${fmtNum(pct)}%)`;
}

// ── Section helpers ───────────────────────────────────────────────────────────

function drawHRule(doc: InstanceType<typeof PDFDocument>, y: number, color = C.border) {
    doc.save()
        .moveTo(MARGIN, y)
        .lineTo(PAGE_WIDTH - MARGIN, y)
        .strokeColor(color)
        .lineWidth(0.5)
        .stroke()
        .restore();
}

function sectionTitle(doc: InstanceType<typeof PDFDocument>, title: string): number {
    const y = doc.y + 20;
    doc.font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(C.textSecondary)
        .text(title.toUpperCase(), MARGIN, y, { characterSpacing: 0.8 });
    drawHRule(doc, doc.y + 6);
    doc.moveDown(0.8);
    return doc.y;
}

function bulletList(
    doc: InstanceType<typeof PDFDocument>,
    items: string[],
    color: string,
    barWidth = 3,
) {
    for (const item of items) {
        const y = doc.y;
        // Colored bar
        doc.save()
            .rect(MARGIN, y, barWidth, 14)
            .fillColor(color)
            .fill()
            .restore();
        doc.font('Helvetica')
            .fontSize(9.5)
            .fillColor(C.dark)
            .text(item, MARGIN + barWidth + 8, y, { width: CONTENT_WIDTH - barWidth - 8 });
        doc.moveDown(0.3);
    }
}

function kpiGrid(
    doc: InstanceType<typeof PDFDocument>,
    items: Array<{ label: string; value: string; delta?: string; deltaPositive?: boolean }>,
) {
    const cols = 3;
    const cellW = CONTENT_WIDTH / cols;
    const startY = doc.y;

    items.forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = MARGIN + col * cellW;
        const y = startY + row * 72;

        // Cell border
        doc.save()
            .rect(x, y, cellW - 8, 62)
            .strokeColor(C.border)
            .lineWidth(0.5)
            .stroke()
            .restore();

        // Label
        doc.font('Helvetica')
            .fontSize(7.5)
            .fillColor(C.textSecondary)
            .text(item.label.toUpperCase(), x + 10, y + 10, { width: cellW - 26, characterSpacing: 0.5 });

        // Value
        doc.font('Helvetica-Bold')
            .fontSize(15)
            .fillColor(C.dark)
            .text(item.value, x + 10, y + 24, { width: cellW - 26 });

        // Delta
        if (item.delta) {
            doc.font('Helvetica')
                .fontSize(8)
                .fillColor(item.deltaPositive ? C.success : C.danger)
                .text(item.delta, x + 10, y + 46, { width: cellW - 26 });
        }
    });

    const rows = Math.ceil(items.length / cols);
    doc.y = startY + rows * 72 + 10;
}

function twoColTable(
    doc: InstanceType<typeof PDFDocument>,
    rows: Array<[string, string]>,
    colALabel: string,
    colBLabel: string,
) {
    const colA = CONTENT_WIDTH * 0.6;
    const colB = CONTENT_WIDTH * 0.4;
    const startY = doc.y;

    // Header
    doc.save()
        .rect(MARGIN, startY, CONTENT_WIDTH, 20)
        .fillColor(C.dark)
        .fill()
        .restore();
    doc.font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(C.white)
        .text(colALabel, MARGIN + 8, startY + 6, { width: colA - 16 })
        .text(colBLabel, MARGIN + colA + 8, startY + 6, { width: colB - 16, align: 'right' });

    let rowY = startY + 20;
    rows.forEach(([a, b], idx) => {
        const bg = idx % 2 === 1 ? '#F9F9F9' : C.white;
        doc.save()
            .rect(MARGIN, rowY, CONTENT_WIDTH, 18)
            .fillColor(bg)
            .fill()
            .restore();

        doc.font('Helvetica')
            .fontSize(8.5)
            .fillColor(C.dark)
            .text(a, MARGIN + 8, rowY + 4, { width: colA - 16 });
        doc.font('Courier')
            .fontSize(8.5)
            .fillColor(C.dark)
            .text(b, MARGIN + colA + 8, rowY + 4, { width: colB - 16, align: 'right' });

        rowY += 18;
    });

    // Bottom border
    doc.save()
        .rect(MARGIN, startY, CONTENT_WIDTH, rowY - startY)
        .strokeColor(C.border)
        .lineWidth(0.5)
        .stroke()
        .restore();

    doc.y = rowY + 12;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generatePdf(
    data: Awaited<ReturnType<typeof generateReportData>>,
    ai: ReportAIAnalysis,
): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const bufferPromise = streamToBuffer(doc);

    // ── Header ────────────────────────────────────────────────────────────────
    doc.save()
        .rect(0, 0, PAGE_WIDTH, 80)
        .fillColor(C.dark)
        .fill()
        .restore();

    doc.font('Helvetica-Bold')
        .fontSize(22)
        .fillColor(C.white)
        .text('NORTHIE', MARGIN, 24);

    const periodLabel = `${fmtDate(data.period.start)} — ${fmtDate(data.period.end)}`;
    doc.font('Helvetica')
        .fontSize(9)
        .fillColor('#AAAAAA')
        .text(`Relatório ${data.period.frequency} · ${periodLabel}`, MARGIN, 52);

    doc.y = 100;

    // ── Análise Executiva ─────────────────────────────────────────────────────
    if (ai.executive_summary) {
        sectionTitle(doc, 'Análise Executiva');
        doc.font('Helvetica')
            .fontSize(10)
            .fillColor(C.dark)
            .text(ai.executive_summary, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: 3 });
        doc.moveDown(0.5);
    }

    // ── Destaques / Alertas / Recomendações ───────────────────────────────────
    const hasHighlights = ai.highlights.length > 0;
    const hasAlerts = ai.alerts.length > 0;
    const hasRecs = ai.recommendations.length > 0;

    if (hasHighlights || hasAlerts || hasRecs) {
        sectionTitle(doc, 'Destaques & Atenções');

        if (hasHighlights) {
            doc.font('Helvetica-Bold').fontSize(9).fillColor(C.success).text('Destaques', MARGIN, doc.y);
            doc.moveDown(0.3);
            bulletList(doc, ai.highlights, C.success);
            doc.moveDown(0.4);
        }

        if (hasAlerts) {
            doc.font('Helvetica-Bold').fontSize(9).fillColor(C.danger).text('Atenção', MARGIN, doc.y);
            doc.moveDown(0.3);
            bulletList(doc, ai.alerts, C.danger);
            doc.moveDown(0.4);
        }

        if (hasRecs) {
            doc.font('Helvetica-Bold').fontSize(9).fillColor(C.primary).text('Recomendações', MARGIN, doc.y);
            doc.moveDown(0.3);
            bulletList(doc, ai.recommendations, C.primary);
        }
    }

    // ── KPI Grid ─────────────────────────────────────────────────────────────
    sectionTitle(doc, 'Resumo do Período');

    const deltaRevenue = changeBadge(data.summary.revenue_change_pct);
    const revenuePositive = (data.summary.revenue_change_pct ?? 0) >= 0;
    kpiGrid(doc, [
        {
            label: 'Receita Líquida',
            value: fmtBrl(data.summary.revenue_net),
            ...(deltaRevenue ? { delta: deltaRevenue, deltaPositive: revenuePositive } : {}),
        },
        {
            label: 'Ticket Médio',
            value: fmtBrl(data.summary.aov),
        },
        {
            label: 'ROAS',
            value: `${fmtNum(data.summary.roas)}x`,
        },
        {
            label: 'LTV Médio',
            value: fmtBrl(data.summary.ltv_avg),
        },
        {
            label: 'Novos Clientes',
            value: String(data.summary.new_customers),
        },
        {
            label: 'Margem Bruta',
            value: `${fmtNum(data.summary.gross_margin_pct)}%`,
        },
    ]);

    // ── Channel Insights ──────────────────────────────────────────────────────
    if (ai.channel_insights) {
        sectionTitle(doc, 'Insights de Canais');
        doc.font('Helvetica')
            .fontSize(10)
            .fillColor(C.dark)
            .text(ai.channel_insights, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: 3 });
        doc.moveDown(0.5);
    }

    // ── Receita por Plataforma ────────────────────────────────────────────────
    const revRows = Object.entries(data.revenue_by_platform)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .map(([k, v]): [string, string] => [k, fmtBrl(v as number)]);

    if (revRows.length > 0) {
        sectionTitle(doc, 'Receita por Plataforma');
        twoColTable(doc, revRows, 'Plataforma', 'Receita Líquida');
    }

    // ── Investimento e CAC ────────────────────────────────────────────────────
    const spendRows = Object.entries(data.spend_by_platform)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .map(([k, v]): [string, string] => [k, fmtBrl(v as number)]);

    const cacRows = Object.entries(data.cac_by_channel)
        .sort(([, a], [, b]) => (a as number) - (b as number))
        .map(([k, v]): [string, string] => [k, fmtBrl(v as number)]);

    if (spendRows.length > 0) {
        sectionTitle(doc, 'Investimento em Ads');
        twoColTable(doc, spendRows, 'Plataforma', 'Gasto');
    }

    if (cacRows.length > 0) {
        sectionTitle(doc, 'CAC por Canal');
        twoColTable(doc, cacRows, 'Canal', 'Custo por Cliente');
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        const footerY = doc.page.height - 36;
        drawHRule(doc, footerY - 8);

        doc.font('Helvetica')
            .fontSize(7.5)
            .fillColor(C.textSecondary)
            .text(
                `Gerado em ${fmtDate(ai.generated_at)} · Análise por ${ai.model} · Northie`,
                MARGIN,
                footerY,
                { width: CONTENT_WIDTH, align: 'center' },
            );
    }

    doc.end();
    return bufferPromise;
}
