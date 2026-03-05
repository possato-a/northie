import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PDFDocument = require('pdfkit');
// ── Layout constants ──────────────────────────────────────────────────────────
const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_H = 64;
const FOOTER_ZONE = PAGE_HEIGHT - 52;
// ── Brand palette ─────────────────────────────────────────────────────────────
const C = {
    dark: '#1E1E1E',
    accent: '#1a1a2e', // Azul marinho — header e tabelas
    white: '#FFFFFF',
    tableLine: '#F4F4F4', // Linhas de tabela
    zebraRow: '#F9F9F9', // Linhas pares
    textSecondary: '#6B7280',
    success: '#22C55E',
    danger: '#EF4444',
    warning: '#F59E0B',
    primary: '#1A7FE8',
    border: '#E5E5E5',
};
// ── Severity maps (AI) ────────────────────────────────────────────────────────
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
// ── Channel / status translations ─────────────────────────────────────────────
const CHANNEL_LABELS = {
    meta_ads: 'Meta Ads',
    google_ads: 'Google Ads',
    organico: 'Orgânico',
    email: 'Email',
    direto: 'Direto',
    afiliado: 'Afiliado',
    desconhecido: 'Outros',
    hotmart: 'Hotmart',
    stripe: 'Stripe',
    shopify: 'Shopify',
};
function translateChannel(ch) {
    return CHANNEL_LABELS[ch] ?? ch;
}
const STATUS_DEF = {
    approved: { text: 'Aprovado', color: C.success },
    refunded: { text: 'Reembolsado', color: C.danger },
    pending: { text: 'Pendente', color: C.warning },
    cancelled: { text: 'Cancelado', color: C.textSecondary },
    chargeback: { text: 'Chargeback', color: C.danger },
};
// ── Helpers ───────────────────────────────────────────────────────────────────
function streamToBuffer(doc) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });
}
function fmtBrl(n) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}
function fmtNum(n, decimals = 2) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtDateShort(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function changeBadge(pct) {
    if (pct === null)
        return '';
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${fmtNum(pct)}%`;
}
// ── Drawing primitives ────────────────────────────────────────────────────────
function drawHRule(doc, y, color = C.tableLine) {
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
// ── Page header (all pages) ───────────────────────────────────────────────────
function drawPageHeader(doc, profileName, periodLabel) {
    // Navy accent bar
    doc.save()
        .rect(0, 0, PAGE_WIDTH, HEADER_H)
        .fillColor(C.accent)
        .fill()
        .restore();
    // NORTHIE left
    doc.font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(C.white)
        .text('NORTHIE', MARGIN, 16);
    // Period label left (below logo)
    doc.font('Helvetica')
        .fontSize(8)
        .fillColor('#A0A8C8')
        .text(periodLabel, MARGIN, 42);
    // Business name right
    if (profileName) {
        doc.font('Helvetica')
            .fontSize(10)
            .fillColor('#D8DCF0')
            .text(profileName, 0, 20, { width: PAGE_WIDTH - MARGIN, align: 'right' });
    }
}
// ── Page-break safety ─────────────────────────────────────────────────────────
function ensureSpace(doc, needed, profileName, periodLabel) {
    if (doc.y + needed > FOOTER_ZONE) {
        doc.addPage();
        drawPageHeader(doc, profileName, periodLabel);
        doc.y = HEADER_H + 18;
    }
}
function drawTable(doc, columns, rows, profileName, periodLabel) {
    const headerH = 22;
    const rowH = 20;
    const colWidths = columns.map(c => CONTENT_WIDTH * c.width);
    function drawHeader(yPos) {
        doc.save()
            .rect(MARGIN, yPos, CONTENT_WIDTH, headerH)
            .fillColor(C.accent)
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
    ensureSpace(doc, headerH + rowH + 4, profileName, periodLabel);
    const startY = doc.y;
    drawHeader(startY);
    let rowY = startY + headerH;
    rows.forEach((row, idx) => {
        if (rowY + rowH > FOOTER_ZONE) {
            doc.save()
                .rect(MARGIN, startY, CONTENT_WIDTH, rowY - startY)
                .strokeColor(C.tableLine)
                .lineWidth(0.5)
                .stroke()
                .restore();
            doc.addPage();
            drawPageHeader(doc, profileName, periodLabel);
            doc.y = HEADER_H + 18;
            drawHeader(doc.y);
            rowY = doc.y + headerH;
        }
        const bg = idx % 2 === 1 ? C.zebraRow : C.white;
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
        .strokeColor(C.tableLine)
        .lineWidth(0.5)
        .stroke()
        .restore();
    doc.y = rowY + 12;
}
// ── KPI Cards (5 per spec) ────────────────────────────────────────────────────
function drawKpiCards(doc, data) {
    const cols = 3;
    const cardGap = 8;
    const cardW = (CONTENT_WIDTH - cardGap * (cols - 1)) / cols;
    const cardH = 62;
    const startY = doc.y;
    const deltaRev = changeBadge(data.summary.revenue_change_pct);
    const kpis = [
        {
            label: 'Faturamento Total',
            value: fmtBrl(data.summary.revenue_net),
            sub: deltaRev || undefined,
            subPositive: (data.summary.revenue_change_pct ?? 0) >= 0,
        },
        {
            label: 'LTV Médio',
            value: fmtBrl(data.summary.ltv_avg),
        },
        {
            label: 'CAC Médio',
            value: data.cac_overall > 0 ? fmtBrl(data.cac_overall) : '—',
            sub: data.summary.new_customers > 0 ? `${data.summary.new_customers} novos clientes` : undefined,
            subPositive: true,
        },
        {
            label: 'ROAS Consolidado',
            value: data.summary.roas > 0 ? `${fmtNum(data.summary.roas)}x` : '—',
            sub: data.summary.ad_spend > 0 ? `Spend ${fmtBrl(data.summary.ad_spend)}` : undefined,
            subPositive: true,
        },
        {
            label: 'Margem de Contribuição',
            value: `${fmtNum(data.margin_contribution_pct)}%`,
            sub: fmtBrl(data.margin_contribution_brl),
            subPositive: data.margin_contribution_brl >= 0,
        },
    ];
    kpis.forEach((kpi, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = MARGIN + col * (cardW + cardGap);
        const y = startY + row * (cardH + cardGap);
        // Accent left bar
        doc.save().rect(x, y, 3, cardH).fillColor(C.accent).fill().restore();
        // Card border
        doc.save().rect(x, y, cardW, cardH).strokeColor(C.tableLine).lineWidth(0.5).stroke().restore();
        // Label
        doc.font('Helvetica')
            .fontSize(7)
            .fillColor(C.textSecondary)
            .text(kpi.label.toUpperCase(), x + 12, y + 9, { width: cardW - 20, characterSpacing: 0.3 });
        // Value (Courier = Geist Mono substitute)
        doc.font('Helvetica-Bold')
            .fontSize(13)
            .fillColor(C.dark)
            .text(kpi.value, x + 12, y + 22, { width: cardW - 20 });
        // Sub
        if (kpi.sub) {
            doc.font('Helvetica')
                .fontSize(7.5)
                .fillColor(kpi.subPositive ? C.success : C.danger)
                .text(kpi.sub, x + 12, y + 45, { width: cardW - 20 });
        }
    });
    const totalRows = Math.ceil(kpis.length / cols);
    doc.y = startY + totalRows * (cardH + cardGap) + 8;
}
// ── Channel Performance Table (spec columns) ──────────────────────────────────
function drawChannelPerformanceTable(doc, channels, profileName, periodLabel) {
    const filtered = channels.filter(c => c.channel !== 'desconhecido');
    if (filtered.length === 0)
        return;
    const columns = [
        { label: 'CANAL', width: 0.18, align: 'left' },
        { label: 'INVESTIMENTO', width: 0.17, align: 'right', font: 'Courier' },
        { label: 'RECEITA ATRIBUÍDA', width: 0.21, align: 'right', font: 'Courier' },
        { label: 'ROAS', width: 0.11, align: 'right', font: 'Courier' },
        { label: 'LTV MÉDIO', width: 0.17, align: 'right', font: 'Courier' },
        { label: 'MARGEM', width: 0.16, align: 'right', font: 'Courier' },
    ];
    const rows = filtered.map(ch => {
        const roas = ch.total_spend > 0 ? ch.total_ltv / ch.total_spend : 0;
        const margin = ch.total_ltv > 0 ? ((ch.total_ltv - ch.total_spend) / ch.total_ltv) * 100 : 0;
        return {
            cells: [
                { text: translateChannel(ch.channel) },
                { text: ch.total_spend > 0 ? fmtBrl(ch.total_spend) : '—' },
                { text: fmtBrl(ch.total_ltv) },
                { text: ch.total_spend > 0 ? `${fmtNum(roas)}x` : '—' },
                { text: fmtBrl(ch.avg_ltv) },
                { text: `${fmtNum(margin)}%`, color: margin >= 0 ? C.success : C.danger },
            ],
        };
    });
    drawTable(doc, columns, rows, profileName, periodLabel);
}
// ── Detalhamento de Vendas ────────────────────────────────────────────────────
function drawVendasTable(doc, transactions, profileName, periodLabel) {
    if (transactions.length === 0)
        return;
    const columns = [
        { label: 'ID DA TRANSAÇÃO', width: 0.16, align: 'left', font: 'Courier' },
        { label: 'CLIENTE', width: 0.22, align: 'left' },
        { label: 'CANAL DE AQUISIÇÃO', width: 0.18, align: 'left' },
        { label: 'VALOR LÍQUIDO', width: 0.18, align: 'right', font: 'Courier' },
        { label: 'DATA', width: 0.13, align: 'center', font: 'Courier' },
        { label: 'STATUS', width: 0.13, align: 'center' },
    ];
    const rows = transactions.slice(0, 60).map(t => {
        const st = STATUS_DEF[t.status] ?? { text: t.status, color: C.textSecondary };
        const channel = translateChannel(t.customer_channel ?? t.platform ?? '—');
        const dateStr = t.created_at ? fmtDateShort(t.created_at) : '—';
        const client = t.customer_email ?? '—';
        return {
            cells: [
                { text: t.id.slice(0, 8), font: 'Courier' },
                { text: client },
                { text: channel },
                { text: fmtBrl(t.amount_net), font: 'Courier' },
                { text: dateStr, font: 'Courier' },
                { text: st.text, color: st.color },
            ],
        };
    });
    drawTable(doc, columns, rows, profileName, periodLabel);
}
// ── AI: Diagnosis card ────────────────────────────────────────────────────────
function drawDiagnosisCard(doc, d, profileName, periodLabel) {
    const color = SEVERITY_COLOR[d.severidade];
    const cardH = 110;
    ensureSpace(doc, cardH + 10, profileName, periodLabel);
    const startY = doc.y;
    const innerX = MARGIN + 14;
    const innerW = CONTENT_WIDTH - 24;
    doc.save().rect(MARGIN, startY, CONTENT_WIDTH, cardH).strokeColor(C.border).lineWidth(0.5).stroke().restore();
    doc.save().rect(MARGIN, startY, 3, cardH).fillColor(color).fill().restore();
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.dark)
        .text(d.canal.toUpperCase(), innerX, startY + 10, { width: innerW - 80 });
    const bW = 56;
    const bH = 16;
    const bX = PAGE_WIDTH - MARGIN - bW - 8;
    const bY = startY + 8;
    doc.save().roundedRect(bX, bY, bW, bH, 8).fillColor(color).fill().restore();
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.white)
        .text(SEVERITY_LABEL[d.severidade], bX, bY + 4, { width: bW, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.textSecondary).text('SINTOMA', innerX, startY + 28);
    doc.font('Helvetica').fontSize(8.5).fillColor(C.dark)
        .text(d.sintoma, innerX, startY + 38, { width: innerW, lineGap: 1 });
    const halfW = (innerW - 12) / 2;
    const colY = startY + 56;
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.textSecondary).text('CAUSA RAIZ', innerX, colY);
    doc.font('Helvetica').fontSize(8).fillColor(C.dark)
        .text(d.causa_raiz, innerX, colY + 10, { width: halfW, lineGap: 1 });
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.textSecondary).text('CONSEQUÊNCIA', innerX + halfW + 12, colY);
    doc.font('Helvetica').fontSize(8).fillColor(C.dark)
        .text(d.consequencia, innerX + halfW + 12, colY + 10, { width: halfW, lineGap: 1 });
    const bottomY = startY + 88;
    const prazoLabel = { imediato: 'Imediato', esta_semana: 'Esta semana', este_mes: 'Este mês' }[d.prazo] ?? d.prazo;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(color)
        .text(`Impacto: ${fmtBrl(d.consequencia_financeira_brl)}`, innerX, bottomY);
    doc.font('Helvetica').fontSize(7.5).fillColor(C.textSecondary)
        .text(`${prazoLabel} · ${d.acao_recomendada}`, innerX + 140, bottomY, { width: innerW - 140, lineGap: 1 });
    doc.y = startY + cardH + 10;
}
// ── AI: Próximos Passos ───────────────────────────────────────────────────────
function drawProximosPassos(doc, steps) {
    const startY = doc.y;
    const textX = MARGIN + 12;
    const textW = CONTENT_WIDTH - 12;
    for (let i = 0; i < steps.length; i++) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.primary)
            .text(`${i + 1}.`, textX, doc.y, { continued: true })
            .font('Helvetica').fillColor(C.dark)
            .text(` ${steps[i]}`, { width: textW - 20, lineGap: 2 });
        doc.moveDown(0.3);
    }
    const endY = doc.y;
    doc.save().rect(MARGIN, startY, 3, endY - startY).fillColor(C.primary).fill().restore();
}
// ── Main export ───────────────────────────────────────────────────────────────
export async function generatePdf(data, ai) {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const bufferPromise = streamToBuffer(doc);
    const periodLabel = `${fmtDate(data.period.start)} — ${fmtDate(data.period.end)}`;
    const profileName = data.profile_name ?? null;
    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 1 — DADOS PRINCIPAIS
    // ═══════════════════════════════════════════════════════════════════════════
    drawPageHeader(doc, profileName, periodLabel);
    doc.y = HEADER_H + 18;
    // 1. Resumo Executivo — 5 KPI cards
    sectionLabel(doc, 'Resumo Executivo');
    drawKpiCards(doc, data);
    doc.moveDown(0.5);
    // 2. Performance de Canais
    const channelsData = data.channel_economics.filter(c => c.channel !== 'desconhecido');
    if (channelsData.length > 0) {
        ensureSpace(doc, 80, profileName, periodLabel);
        sectionLabel(doc, 'Performance de Canais');
        drawChannelPerformanceTable(doc, channelsData, profileName, periodLabel);
    }
    // 3. Detalhamento de Vendas
    if (data.transactions_detail.length > 0) {
        ensureSpace(doc, 80, profileName, periodLabel);
        sectionLabel(doc, 'Detalhamento de Vendas');
        drawVendasTable(doc, data.transactions_detail, profileName, periodLabel);
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 2+ — ANÁLISE DE IA (se disponível)
    // ═══════════════════════════════════════════════════════════════════════════
    if (ai && (ai.resumo_executivo || ai.diagnosticos.length > 0)) {
        doc.addPage();
        drawPageHeader(doc, profileName, periodLabel);
        doc.y = HEADER_H + 18;
        // Resumo executivo de IA
        if (ai.resumo_executivo) {
            sectionLabel(doc, 'Análise de IA');
            doc.font('Helvetica').fontSize(9.5).fillColor(C.dark)
                .text(ai.resumo_executivo, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: 3 });
            doc.moveDown(1);
        }
        // Diagnósticos por canal
        if (ai.diagnosticos.length > 0) {
            ensureSpace(doc, 80, profileName, periodLabel);
            sectionLabel(doc, 'Diagnósticos por Canal');
            const order = { critica: 0, alta: 1, media: 2, ok: 3 };
            const sorted = [...ai.diagnosticos].sort((a, b) => order[a.severidade] - order[b.severidade]);
            for (const d of sorted) {
                drawDiagnosisCard(doc, d, profileName, periodLabel);
            }
        }
        // Próximos passos
        if (ai.proximos_passos.length > 0) {
            ensureSpace(doc, 60, profileName, periodLabel);
            sectionLabel(doc, 'Próximos Passos');
            drawProximosPassos(doc, ai.proximos_passos);
        }
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // FOOTER — todas as páginas
    // ═══════════════════════════════════════════════════════════════════════════
    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const footerY = PAGE_HEIGHT - 38;
        drawHRule(doc, footerY - 8);
        const pageNum = i - range.start + 1;
        const totalPages = range.count;
        doc.font('Helvetica').fontSize(7).fillColor(C.textSecondary)
            .text(`Gerado por Northie em ${today}`, MARGIN, footerY);
        doc.font('Helvetica').fontSize(7).fillColor(C.textSecondary)
            .text(`Página ${pageNum} de ${totalPages}`, 0, footerY, { width: PAGE_WIDTH - MARGIN, align: 'right' });
    }
    doc.end();
    return bufferPromise;
}
//# sourceMappingURL=report-pdf.js.map