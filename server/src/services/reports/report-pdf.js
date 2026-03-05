import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PDFDocument = require('pdfkit');
// ── Constants ────────────────────────────────────────────────────────────────
const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 495.28
const FOOTER_ZONE = PAGE_HEIGHT - MARGIN; // Reserve 50px at bottom for footer
const C = {
    dark: '#1E1E1E',
    white: '#FFFFFF',
    bg: '#FCF8F8',
    border: '#E5E5E5',
    textSecondary: '#6B7280',
    success: '#22C55E',
    danger: '#EF4444',
    warning: '#F59E0B',
    primary: '#1A7FE8',
};
const SEVERITY_COLOR = {
    critica: C.danger,
    alta: C.warning,
    media: C.warning,
    ok: C.success,
};
const SEVERITY_LABEL = {
    critica: 'CRITICA',
    alta: 'ALTA',
    media: 'MEDIA',
    ok: 'OK',
};
const SITUACAO_COLOR = {
    saudavel: C.success,
    atencao: C.warning,
    critica: C.danger,
};
const SITUACAO_LABEL = {
    saudavel: 'SAUDAVEL',
    atencao: 'ATENCAO',
    critica: 'CRITICA',
};
// ── Helpers ──────────────────────────────────────────────────────────────────
function streamToBuffer(doc) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });
}
function fmtBrl(n) {
    return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtNum(n, decimals = 2) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function changeBadge(pct) {
    if (pct === null)
        return '';
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${fmtNum(pct)}%`;
}
// ── Page-break safety ────────────────────────────────────────────────────────
function ensureSpace(doc, needed, ai, periodLabel, frequency) {
    if (doc.y + needed > FOOTER_ZONE) {
        doc.addPage();
        drawPageHeader(doc, ai, periodLabel, frequency);
        doc.y = 90;
    }
}
// ── Drawing primitives ───────────────────────────────────────────────────────
function drawHRule(doc, y, color = C.border) {
    doc.save()
        .moveTo(MARGIN, y)
        .lineTo(PAGE_WIDTH - MARGIN, y)
        .strokeColor(color)
        .lineWidth(0.5)
        .stroke()
        .restore();
}
function sectionLabel(doc, title) {
    doc.font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(C.textSecondary)
        .text(title.toUpperCase(), MARGIN, doc.y, { characterSpacing: 1.2 });
    drawHRule(doc, doc.y + 4);
    doc.y = doc.y + 10;
}
// ── Shared header (drawn on every page) ──────────────────────────────────────
function drawPageHeader(doc, ai, periodLabel, frequency) {
    // Dark bar
    doc.save()
        .rect(0, 0, PAGE_WIDTH, 70)
        .fillColor(C.dark)
        .fill()
        .restore();
    // NORTHIE title
    doc.font('Helvetica-Bold')
        .fontSize(20)
        .fillColor(C.white)
        .text('NORTHIE', MARGIN, 22);
    // Subtitle
    doc.font('Helvetica')
        .fontSize(8.5)
        .fillColor('#999999')
        .text(`Relatorio ${frequency} · ${periodLabel}`, MARGIN, 48);
    // Situacao geral badge (pill shape, top-right)
    const situacaoColor = SITUACAO_COLOR[ai.situacao_geral];
    const situacaoLabel = SITUACAO_LABEL[ai.situacao_geral];
    const badgeW = 72;
    const badgeH = 18;
    const badgeX = PAGE_WIDTH - MARGIN - badgeW;
    const badgeY = 26;
    const badgeR = 9;
    doc.save()
        .roundedRect(badgeX, badgeY, badgeW, badgeH, badgeR)
        .fillColor(situacaoColor)
        .fill()
        .restore();
    doc.font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(C.white)
        .text(situacaoLabel, badgeX, badgeY + 5, { width: badgeW, align: 'center' });
}
// ── KPI Grid (3 cols x 2 rows) ──────────────────────────────────────────────
function drawKpiGrid(doc, items) {
    const cols = 3;
    const cardGap = 8;
    const cardW = (CONTENT_WIDTH - cardGap * (cols - 1)) / cols;
    const cardH = 58;
    const startY = doc.y;
    items.forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = MARGIN + col * (cardW + cardGap);
        const y = startY + row * (cardH + cardGap);
        // Card border
        doc.save()
            .rect(x, y, cardW, cardH)
            .strokeColor(C.border)
            .lineWidth(0.5)
            .stroke()
            .restore();
        // Label
        doc.font('Helvetica')
            .fontSize(7)
            .fillColor(C.textSecondary)
            .text(item.label.toUpperCase(), x + 10, y + 8, { width: cardW - 20, characterSpacing: 0.5 });
        // Value
        doc.font('Helvetica-Bold')
            .fontSize(14)
            .fillColor(C.dark)
            .text(item.value, x + 10, y + 22, { width: cardW - 20 });
        // Delta
        if (item.delta) {
            doc.font('Helvetica')
                .fontSize(8)
                .fillColor(item.deltaPositive ? C.success : C.danger)
                .text(item.delta, x + 10, y + 42, { width: cardW - 20 });
        }
    });
    const rows = Math.ceil(items.length / cols);
    doc.y = startY + rows * (cardH + cardGap) + 4;
}
function drawTable(doc, columns, rows, ai, periodLabel, frequency) {
    const headerH = 22;
    const rowH = 20;
    const colWidths = columns.map(c => CONTENT_WIDTH * c.width);
    // Draw header
    function drawHeader(yPos) {
        doc.save()
            .rect(MARGIN, yPos, CONTENT_WIDTH, headerH)
            .fillColor(C.dark)
            .fill()
            .restore();
        let hx = MARGIN + 8;
        doc.font('Helvetica-Bold').fontSize(7).fillColor(C.white);
        columns.forEach((col, i) => {
            const w = colWidths[i];
            doc.text(col.label, hx, yPos + 7, { width: w - 12, align: col.align, characterSpacing: 0.4 });
            hx += w;
        });
    }
    // Check if at least header + 1 row fits
    ensureSpace(doc, headerH + rowH + 4, ai, periodLabel, frequency);
    const startY = doc.y;
    drawHeader(startY);
    let rowY = startY + headerH;
    rows.forEach((row, idx) => {
        // Page break check for each row
        if (rowY + rowH > FOOTER_ZONE) {
            // Draw outer border for what we have so far
            doc.save()
                .rect(MARGIN, startY, CONTENT_WIDTH, rowY - startY)
                .strokeColor(C.border)
                .lineWidth(0.5)
                .stroke()
                .restore();
            doc.addPage();
            drawPageHeader(doc, ai, periodLabel, frequency);
            doc.y = 90;
            drawHeader(90);
            rowY = 90 + headerH;
        }
        // Alternating row background
        const bg = idx % 2 === 1 ? '#F7F7F7' : C.white;
        doc.save()
            .rect(MARGIN, rowY, CONTENT_WIDTH, rowH)
            .fillColor(bg)
            .fill()
            .restore();
        let cx = MARGIN + 8;
        columns.forEach((col, i) => {
            const w = colWidths[i];
            const cell = row.cells[i];
            const font = cell.font ?? col.font ?? 'Helvetica';
            const color = cell.color ?? C.dark;
            doc.font(font)
                .fontSize(8.5)
                .fillColor(color)
                .text(cell.text, cx, rowY + 6, { width: w - 12, align: col.align });
            cx += w;
        });
        rowY += rowH;
    });
    // Outer border
    doc.save()
        .rect(MARGIN, startY, CONTENT_WIDTH, rowY - startY)
        .strokeColor(C.border)
        .lineWidth(0.5)
        .stroke()
        .restore();
    doc.y = rowY + 12;
}
// ── Channel economics table (6 cols for page 1, 7 cols for full) ─────────────
function drawChannelTable(doc, channels, full, ai, periodLabel, frequency) {
    const columns = full
        ? [
            { label: 'CANAL', width: 0.18, align: 'left' },
            { label: 'CLIENTES', width: 0.09, align: 'right', font: 'Courier' },
            { label: 'LTV MEDIO', width: 0.15, align: 'right', font: 'Courier' },
            { label: 'CAC', width: 0.13, align: 'right', font: 'Courier' },
            { label: 'LTV/CAC', width: 0.11, align: 'right', font: 'Courier' },
            { label: 'VALOR CRIADO', width: 0.18, align: 'right', font: 'Courier' },
            { label: 'STATUS', width: 0.16, align: 'right' },
        ]
        : [
            { label: 'CANAL', width: 0.20, align: 'left' },
            { label: 'CLIENTES', width: 0.12, align: 'right', font: 'Courier' },
            { label: 'LTV MEDIO', width: 0.18, align: 'right', font: 'Courier' },
            { label: 'CAC', width: 0.16, align: 'right', font: 'Courier' },
            { label: 'LTV/CAC', width: 0.14, align: 'right', font: 'Courier' },
            { label: 'STATUS', width: 0.20, align: 'right' },
        ];
    const rows = channels.map(ch => {
        const statusColor = ch.status === 'lucrativo' ? C.success : ch.status === 'prejuizo' ? C.danger : C.textSecondary;
        const statusLabel = ch.status === 'lucrativo' ? 'Lucrativo' : ch.status === 'prejuizo' ? 'Prejuizo' : 'Organico';
        const ltvcacStr = ch.ltv_cac_ratio !== null ? `${fmtNum(ch.ltv_cac_ratio)}x` : '--';
        const cacStr = ch.cac > 0 ? fmtBrl(ch.cac) : '--';
        const valorColor = ch.value_created >= 0 ? C.success : C.danger;
        const baseCells = [
            { text: ch.channel },
            { text: String(ch.new_customers) },
            { text: fmtBrl(ch.avg_ltv) },
            { text: cacStr },
            { text: ltvcacStr },
        ];
        if (full) {
            baseCells.push({ text: fmtBrl(ch.value_created), color: valorColor });
        }
        baseCells.push({ text: statusLabel, color: statusColor, font: 'Helvetica-Bold' });
        return { cells: baseCells };
    });
    drawTable(doc, columns, rows, ai, periodLabel, frequency);
}
// ── Diagnosis card ───────────────────────────────────────────────────────────
function drawDiagnosisCard(doc, d, ai, periodLabel, frequency) {
    const color = SEVERITY_COLOR[d.severidade];
    const cardH = 110;
    ensureSpace(doc, cardH + 10, ai, periodLabel, frequency);
    const startY = doc.y;
    const innerX = MARGIN + 14;
    const innerW = CONTENT_WIDTH - 24;
    // Card border
    doc.save()
        .rect(MARGIN, startY, CONTENT_WIDTH, cardH)
        .strokeColor(C.border)
        .lineWidth(0.5)
        .stroke()
        .restore();
    // Left accent bar
    doc.save()
        .rect(MARGIN, startY, 3, cardH)
        .fillColor(color)
        .fill()
        .restore();
    // Channel name + severity badge
    doc.font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(C.dark)
        .text(d.canal.toUpperCase(), innerX, startY + 10, { width: innerW - 80 });
    // Severity badge (pill)
    const badgeW = 56;
    const badgeH = 16;
    const badgeX = PAGE_WIDTH - MARGIN - badgeW - 8;
    const badgeY = startY + 8;
    doc.save()
        .roundedRect(badgeX, badgeY, badgeW, badgeH, 8)
        .fillColor(color)
        .fill()
        .restore();
    doc.font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(C.white)
        .text(SEVERITY_LABEL[d.severidade], badgeX, badgeY + 4, { width: badgeW, align: 'center' });
    // Symptom
    doc.font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(C.textSecondary)
        .text('SINTOMA', innerX, startY + 28);
    doc.font('Helvetica')
        .fontSize(8.5)
        .fillColor(C.dark)
        .text(d.sintoma, innerX, startY + 38, { width: innerW, lineGap: 1 });
    // Causa raiz + consequencia (2 columns)
    const halfW = (innerW - 12) / 2;
    const colY = startY + 56;
    doc.font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(C.textSecondary)
        .text('CAUSA RAIZ', innerX, colY);
    doc.font('Helvetica')
        .fontSize(8)
        .fillColor(C.dark)
        .text(d.causa_raiz, innerX, colY + 10, { width: halfW, lineGap: 1 });
    doc.font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(C.textSecondary)
        .text('CONSEQUENCIA', innerX + halfW + 12, colY);
    doc.font('Helvetica')
        .fontSize(8)
        .fillColor(C.dark)
        .text(d.consequencia, innerX + halfW + 12, colY + 10, { width: halfW, lineGap: 1 });
    // Financial impact + action + deadline
    const bottomY = startY + 88;
    const prazoLabel = { imediato: 'Imediato', esta_semana: 'Esta semana', este_mes: 'Este mes' }[d.prazo];
    doc.font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(color)
        .text(`Impacto: ${fmtBrl(d.consequencia_financeira_brl)}`, innerX, bottomY);
    doc.font('Helvetica')
        .fontSize(7.5)
        .fillColor(C.textSecondary)
        .text(`${prazoLabel} · ${d.acao_recomendada}`, innerX + 140, bottomY, { width: innerW - 140, lineGap: 1 });
    doc.y = startY + cardH + 10;
}
// ── Compact alert (page 1) ───────────────────────────────────────────────────
function drawCompactAlert(doc, d) {
    const color = SEVERITY_COLOR[d.severidade];
    const y = doc.y;
    const alertH = 30;
    // Left color bar
    doc.save()
        .rect(MARGIN, y, 3, alertH)
        .fillColor(color)
        .fill()
        .restore();
    // Channel + severity
    doc.font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(C.dark)
        .text(`${d.canal.toUpperCase()} -- ${SEVERITY_LABEL[d.severidade]}`, MARGIN + 12, y + 4, { width: CONTENT_WIDTH - 110 });
    // Action
    doc.font('Helvetica')
        .fontSize(8)
        .fillColor(C.textSecondary)
        .text(d.acao_recomendada, MARGIN + 12, y + 17, { width: CONTENT_WIDTH - 110 });
    // Financial impact right-aligned
    doc.font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(color)
        .text(fmtBrl(d.consequencia_financeira_brl), PAGE_WIDTH - MARGIN - 90, y + 10, { width: 86, align: 'right' });
    doc.y = y + alertH + 6;
}
// ── Proximos passos with blue left bar ───────────────────────────────────────
function drawProximosPassos(doc, steps) {
    const barX = MARGIN;
    const startY = doc.y;
    const textX = MARGIN + 12;
    const textW = CONTENT_WIDTH - 12;
    for (let i = 0; i < steps.length; i++) {
        const y = doc.y;
        doc.font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(C.primary)
            .text(`${i + 1}.`, textX, y, { continued: true })
            .font('Helvetica')
            .fillColor(C.dark)
            .text(` ${steps[i]}`, { width: textW - 20, lineGap: 2 });
        doc.moveDown(0.3);
    }
    const endY = doc.y;
    // Blue left bar spanning all items
    doc.save()
        .rect(barX, startY, 3, endY - startY)
        .fillColor(C.primary)
        .fill()
        .restore();
}
// ── Main export ──────────────────────────────────────────────────────────────
export async function generatePdf(data, ai) {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const bufferPromise = streamToBuffer(doc);
    const periodLabel = `${fmtDate(data.period.start)} -- ${fmtDate(data.period.end)}`;
    const freq = data.period.frequency;
    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 1 -- SUMARIO EXECUTIVO
    // ═══════════════════════════════════════════════════════════════════════════
    drawPageHeader(doc, ai, periodLabel, freq);
    doc.y = 90;
    // 1. Resumo Executivo
    if (ai.resumo_executivo) {
        sectionLabel(doc, 'Resumo Executivo');
        doc.font('Helvetica')
            .fontSize(9.5)
            .fillColor(C.dark)
            .text(ai.resumo_executivo, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: 3 });
        doc.moveDown(1);
    }
    // 2. KPI Grid
    ensureSpace(doc, 140, ai, periodLabel, freq);
    sectionLabel(doc, 'Indicadores do Periodo');
    const deltaRevenue = changeBadge(data.summary.revenue_change_pct);
    const revenuePositive = (data.summary.revenue_change_pct ?? 0) >= 0;
    const refundIsHigh = data.summary.refund_rate > 5;
    drawKpiGrid(doc, [
        {
            label: 'Receita Liquida',
            value: fmtBrl(data.summary.revenue_net),
            ...(deltaRevenue ? { delta: deltaRevenue, deltaPositive: revenuePositive } : {}),
        },
        {
            label: 'ROAS',
            value: `${fmtNum(data.summary.roas)}x`,
            ...(data.summary.ad_spend > 0 ? { delta: `Spend ${fmtBrl(data.summary.ad_spend)}`, deltaPositive: true } : {}),
        },
        { label: 'Novos Clientes', value: String(data.summary.new_customers) },
        { label: 'LTV Medio', value: fmtBrl(data.summary.ltv_avg) },
        { label: 'Margem Bruta', value: `${fmtNum(data.summary.gross_margin_pct)}%` },
        {
            label: 'Taxa de Reembolso',
            value: `${fmtNum(data.summary.refund_rate)}%`,
            ...(refundIsHigh ? { delta: `${fmtBrl(data.summary.refund_amount)} reembolsado`, deltaPositive: false } : {}),
        },
    ]);
    doc.moveDown(0.5);
    // 3. Economia por Canal (top 4, compact)
    const topChannels = data.channel_economics
        .filter(c => c.channel !== 'desconhecido')
        .slice(0, 4);
    if (topChannels.length > 0) {
        ensureSpace(doc, 120, ai, periodLabel, freq);
        sectionLabel(doc, 'Economia por Canal');
        drawChannelTable(doc, topChannels, false, ai, periodLabel, freq);
    }
    // 4. Alertas (top 2-3 critical/alta)
    const criticalDiags = [...ai.diagnosticos]
        .filter(d => d.severidade === 'critica' || d.severidade === 'alta')
        .slice(0, 3);
    if (criticalDiags.length > 0) {
        ensureSpace(doc, 50 + criticalDiags.length * 36, ai, periodLabel, freq);
        sectionLabel(doc, 'Alertas Criticos');
        for (const d of criticalDiags) {
            if (doc.y + 36 > FOOTER_ZONE)
                break;
            drawCompactAlert(doc, d);
        }
    }
    // 5. Proximos Passos (top 3)
    if (ai.proximos_passos.length > 0) {
        ensureSpace(doc, 60, ai, periodLabel, freq);
        sectionLabel(doc, 'Proximos Passos');
        drawProximosPassos(doc, ai.proximos_passos.slice(0, 3));
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 2+ -- DETALHADO
    // ═══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    drawPageHeader(doc, ai, periodLabel, freq);
    doc.y = 90;
    // 6. Diagnosticos Completos
    if (ai.diagnosticos.length > 0) {
        sectionLabel(doc, 'Diagnosticos por Canal');
        const order = { critica: 0, alta: 1, media: 2, ok: 3 };
        const sorted = [...ai.diagnosticos].sort((a, b) => order[a.severidade] - order[b.severidade]);
        for (const d of sorted) {
            drawDiagnosisCard(doc, d, ai, periodLabel, freq);
        }
    }
    // 7. Economia por Canal -- Completa
    const allChannels = data.channel_economics.filter(c => c.channel !== 'desconhecido');
    if (allChannels.length > 0) {
        ensureSpace(doc, 60 + allChannels.length * 20, ai, periodLabel, freq);
        sectionLabel(doc, 'Economia por Canal -- Visao Completa');
        drawChannelTable(doc, allChannels, true, ai, periodLabel, freq);
    }
    // 8. Tendencia de Receita
    if (data.revenue_trend.length >= 2) {
        const trendColumns = [
            { label: 'MES', width: 0.40, align: 'left' },
            { label: 'RECEITA', width: 0.35, align: 'right', font: 'Courier' },
            { label: 'VARIACAO', width: 0.25, align: 'right', font: 'Courier' },
        ];
        const trendRows = data.revenue_trend.map(t => {
            const changeText = t.change_pct !== null
                ? `${t.change_pct >= 0 ? '+' : ''}${fmtNum(t.change_pct)}%`
                : '--';
            const changeColor = t.change_pct === null
                ? C.textSecondary
                : t.change_pct >= 0 ? C.success : C.danger;
            return {
                cells: [
                    { text: t.month },
                    { text: fmtBrl(t.revenue) },
                    { text: changeText, color: changeColor },
                ],
            };
        });
        ensureSpace(doc, 40 + trendRows.length * 20, ai, periodLabel, freq);
        sectionLabel(doc, 'Tendencia de Receita');
        drawTable(doc, trendColumns, trendRows, ai, periodLabel, freq);
    }
    // 9. Top Produtos
    if (data.top_products.length > 0) {
        const prodColumns = [
            { label: 'PRODUTO', width: 0.50, align: 'left' },
            { label: 'RECEITA', width: 0.30, align: 'right', font: 'Courier' },
            { label: '% DO TOTAL', width: 0.20, align: 'right', font: 'Courier' },
        ];
        const prodRows = data.top_products.map(p => ({
            cells: [
                { text: p.product_name.length > 50 ? p.product_name.slice(0, 47) + '...' : p.product_name },
                { text: fmtBrl(p.revenue) },
                { text: `${p.pct_of_total}%` },
            ],
        }));
        ensureSpace(doc, 40 + prodRows.length * 20, ai, periodLabel, freq);
        sectionLabel(doc, 'Top Produtos por Receita');
        drawTable(doc, prodColumns, prodRows, ai, periodLabel, freq);
    }
    // 10. Qualidade da Base (RFM)
    if (data.rfm_distribution.length > 0 && data.rfm_distribution.some(s => s.count > 0)) {
        const rfmTitle = data.rfm_source === 'estimated'
            ? 'Qualidade da Base (RFM -- estimado)'
            : 'Qualidade da Base (RFM)';
        const rfmFiltered = data.rfm_distribution.filter(s => s.count > 0);
        const rfmColumns = [
            { label: 'SEGMENTO', width: 0.60, align: 'left' },
            { label: 'LTV TOTAL', width: 0.40, align: 'right', font: 'Courier' },
        ];
        const rfmRows = rfmFiltered.map(s => ({
            cells: [
                { text: `${s.segment} · ${s.count} clientes` },
                { text: fmtBrl(s.ltv) },
            ],
        }));
        ensureSpace(doc, 40 + rfmRows.length * 20 + 20, ai, periodLabel, freq);
        sectionLabel(doc, rfmTitle);
        drawTable(doc, rfmColumns, rfmRows, ai, periodLabel, freq);
        if (data.rfm_source === 'estimated') {
            doc.font('Helvetica')
                .fontSize(7.5)
                .fillColor(C.textSecondary)
                .text('* Segmentacao estimada a partir dos dados disponiveis. Ative o job de RFM para precisao.', MARGIN, doc.y, { width: CONTENT_WIDTH });
            doc.moveDown(0.5);
        }
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // FOOTER (all pages via bufferedPageRange)
    // ═══════════════════════════════════════════════════════════════════════════
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const footerY = PAGE_HEIGHT - 38;
        drawHRule(doc, footerY - 8);
        const pageNum = i - range.start + 1;
        const totalPages = range.count;
        doc.font('Helvetica')
            .fontSize(7)
            .fillColor(C.textSecondary)
            .text(`Gerado em ${fmtDate(ai.generated_at)} · Analise por ${ai.model} · Northie · Pag ${pageNum}/${totalPages}`, MARGIN, footerY, { width: CONTENT_WIDTH, align: 'center' });
    }
    doc.end();
    return bufferPromise;
}
//# sourceMappingURL=report-pdf.js.map