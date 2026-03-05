import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PDFDocument = require('pdfkit');
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
    warning: '#F97316',
};
const SEVERITY_COLOR = {
    critica: C.danger,
    alta: C.warning,
    media: C.accent,
    ok: C.success,
};
const SEVERITY_LABEL = {
    critica: 'CRÍTICA',
    alta: 'ALTA',
    media: 'MÉDIA',
    ok: 'OK',
};
const SITUACAO_COLOR = {
    saudavel: C.success,
    atencao: C.accent,
    critica: C.danger,
};
const SITUACAO_LABEL = {
    saudavel: 'SAUDÁVEL',
    atencao: 'ATENÇÃO',
    critica: 'CRÍTICA',
};
// ── Helpers ───────────────────────────────────────────────────────────────────
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
    return ` (${sign}${fmtNum(pct)}%)`;
}
// ── Section helpers ───────────────────────────────────────────────────────────
function drawHRule(doc, y, color = C.border) {
    doc.save()
        .moveTo(MARGIN, y)
        .lineTo(PAGE_WIDTH - MARGIN, y)
        .strokeColor(color)
        .lineWidth(0.5)
        .stroke()
        .restore();
}
function sectionTitle(doc, title) {
    const y = doc.y + 20;
    doc.font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(C.textSecondary)
        .text(title.toUpperCase(), MARGIN, y, { characterSpacing: 0.8 });
    drawHRule(doc, doc.y + 6);
    doc.moveDown(0.8);
    return doc.y;
}
function bulletList(doc, items, color, barWidth = 3) {
    for (const item of items) {
        const y = doc.y;
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
function kpiGrid(doc, items) {
    const cols = 3;
    const cellW = CONTENT_WIDTH / cols;
    const startY = doc.y;
    items.forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = MARGIN + col * cellW;
        const y = startY + row * 72;
        doc.save()
            .rect(x, y, cellW - 8, 62)
            .strokeColor(C.border)
            .lineWidth(0.5)
            .stroke()
            .restore();
        doc.font('Helvetica')
            .fontSize(7.5)
            .fillColor(C.textSecondary)
            .text(item.label.toUpperCase(), x + 10, y + 10, { width: cellW - 26, characterSpacing: 0.5 });
        doc.font('Helvetica-Bold')
            .fontSize(15)
            .fillColor(C.dark)
            .text(item.value, x + 10, y + 24, { width: cellW - 26 });
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
function threeColTable(doc, rows, colALabel, colBLabel, colCLabel, colCColor) {
    const colA = CONTENT_WIDTH * 0.45;
    const colB = CONTENT_WIDTH * 0.30;
    const colC = CONTENT_WIDTH * 0.25;
    const startY = doc.y;
    doc.save()
        .rect(MARGIN, startY, CONTENT_WIDTH, 20)
        .fillColor(C.dark)
        .fill()
        .restore();
    doc.font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(C.white)
        .text(colALabel, MARGIN + 8, startY + 6, { width: colA - 16 })
        .text(colBLabel, MARGIN + colA + 8, startY + 6, { width: colB - 16, align: 'right' })
        .text(colCLabel, MARGIN + colA + colB + 8, startY + 6, { width: colC - 16, align: 'right' });
    let rowY = startY + 20;
    rows.forEach(([a, b, c], idx) => {
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
        const cColor = colCColor ? (colCColor(c) ?? C.dark) : C.dark;
        doc.font('Courier')
            .fontSize(8.5)
            .fillColor(cColor)
            .text(c, MARGIN + colA + colB + 8, rowY + 4, { width: colC - 16, align: 'right' });
        rowY += 18;
    });
    doc.save()
        .rect(MARGIN, startY, CONTENT_WIDTH, rowY - startY)
        .strokeColor(C.border)
        .lineWidth(0.5)
        .stroke()
        .restore();
    doc.y = rowY + 12;
}
function twoColTable(doc, rows, colALabel, colBLabel) {
    const colA = CONTENT_WIDTH * 0.6;
    const colB = CONTENT_WIDTH * 0.4;
    const startY = doc.y;
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
    doc.save()
        .rect(MARGIN, startY, CONTENT_WIDTH, rowY - startY)
        .strokeColor(C.border)
        .lineWidth(0.5)
        .stroke()
        .restore();
    doc.y = rowY + 12;
}
// ── Channel diagnosis card ────────────────────────────────────────────────────
function drawDiagnosisCard(doc, d) {
    const color = SEVERITY_COLOR[d.severidade];
    const startY = doc.y;
    const cardHeight = 120;
    // Left accent bar
    doc.save()
        .rect(MARGIN, startY, 4, cardHeight)
        .fillColor(color)
        .fill()
        .restore();
    // Card border
    doc.save()
        .rect(MARGIN, startY, CONTENT_WIDTH, cardHeight)
        .strokeColor(color)
        .lineWidth(0.5)
        .stroke()
        .restore();
    const innerX = MARGIN + 14;
    const innerW = CONTENT_WIDTH - 20;
    // Canal + severity badge
    doc.font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(C.dark)
        .text(d.canal.toUpperCase(), innerX, startY + 10, { width: innerW - 70, continued: false });
    doc.save()
        .rect(PAGE_WIDTH - MARGIN - 65, startY + 8, 60, 14)
        .fillColor(color)
        .fill()
        .restore();
    doc.font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(C.white)
        .text(SEVERITY_LABEL[d.severidade], PAGE_WIDTH - MARGIN - 63, startY + 11, { width: 56, align: 'center' });
    // Symptom
    doc.font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(C.textSecondary)
        .text('SINTOMA', innerX, startY + 28);
    doc.font('Helvetica')
        .fontSize(8.5)
        .fillColor(C.dark)
        .text(d.sintoma, innerX, startY + 38, { width: innerW });
    // Causa raiz + consequência em 2 colunas
    const halfW = (innerW - 10) / 2;
    doc.font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(C.textSecondary)
        .text('CAUSA RAIZ', innerX, startY + 60);
    doc.font('Helvetica')
        .fontSize(8)
        .fillColor(C.dark)
        .text(d.causa_raiz, innerX, startY + 70, { width: halfW });
    doc.font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(C.textSecondary)
        .text('CONSEQUÊNCIA', innerX + halfW + 10, startY + 60);
    doc.font('Helvetica')
        .fontSize(8)
        .fillColor(C.dark)
        .text(d.consequencia, innerX + halfW + 10, startY + 70, { width: halfW });
    // Financial impact + ação + prazo
    const impactY = startY + 96;
    doc.font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(color)
        .text(`Impacto: ${fmtBrl(d.consequencia_financeira_brl)}`, innerX, impactY);
    const prazoLabel = { imediato: 'Imediato', esta_semana: 'Esta semana', este_mes: 'Este mês' }[d.prazo];
    doc.font('Helvetica')
        .fontSize(8)
        .fillColor(C.textSecondary)
        .text(`Prazo: ${prazoLabel} · ${d.acao_recomendada}`, innerX + 100, impactY, { width: innerW - 100 });
    doc.y = startY + cardHeight + 10;
}
// ── Channel economics table (7 colunas) ──────────────────────────────────────
function channelEconTable(doc, channels) {
    const W = CONTENT_WIDTH;
    const cW = [W * 0.20, W * 0.08, W * 0.15, W * 0.14, W * 0.12, W * 0.16, W * 0.15]; // canal, cli, ltv, cac, ratio, criado, status
    const headers = ['CANAL', 'CLIENTES', 'LTV MÉDIO', 'CAC', 'LTV/CAC', 'VALOR CRIADO', 'STATUS'];
    const startY = doc.y;
    const headerH = 20;
    const rowH = 18;
    // Header bar
    doc.save().rect(MARGIN, startY, W, headerH).fillColor(C.dark).fill().restore();
    let hx = MARGIN + 6;
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.white);
    headers.forEach((h, i) => {
        const align = i === 0 ? 'left' : 'right';
        doc.text(h, hx, startY + 6, { width: cW[i] - 6, align, characterSpacing: 0.4 });
        hx += cW[i];
    });
    let rowY = startY + headerH;
    channels.forEach((ch, idx) => {
        const bg = idx % 2 === 1 ? '#F7F7F7' : C.white;
        doc.save().rect(MARGIN, rowY, W, rowH).fillColor(bg).fill().restore();
        const statusColor = ch.status === 'lucrativo' ? C.success : ch.status === 'prejuizo' ? C.danger : C.textSecondary;
        const statusLabel = ch.status === 'lucrativo' ? '✓ Lucrativo' : ch.status === 'prejuizo' ? '✗ Prejuízo' : '○ Orgânico';
        const ltvcacStr = ch.ltv_cac_ratio !== null ? `${fmtNum(ch.ltv_cac_ratio)}x` : '—';
        const cacStr = ch.cac > 0 ? fmtBrl(ch.cac) : '—';
        const valorColor = ch.value_created >= 0 ? C.success : C.danger;
        let cx = MARGIN + 6;
        doc.font('Helvetica').fontSize(8).fillColor(C.dark)
            .text(ch.channel, cx, rowY + 4, { width: cW[0] - 6 });
        cx += cW[0];
        doc.font('Courier').fontSize(8)
            .text(String(ch.new_customers), cx, rowY + 4, { width: cW[1] - 6, align: 'right' });
        cx += cW[1];
        doc.font('Courier').fontSize(8)
            .text(fmtBrl(ch.avg_ltv), cx, rowY + 4, { width: cW[2] - 6, align: 'right' });
        cx += cW[2];
        doc.font('Courier').fontSize(8)
            .text(cacStr, cx, rowY + 4, { width: cW[3] - 6, align: 'right' });
        cx += cW[3];
        doc.font('Courier').fontSize(8)
            .text(ltvcacStr, cx, rowY + 4, { width: cW[4] - 6, align: 'right' });
        cx += cW[4];
        doc.font('Courier').fontSize(8).fillColor(valorColor)
            .text(fmtBrl(ch.value_created), cx, rowY + 4, { width: cW[5] - 6, align: 'right' });
        cx += cW[5];
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(statusColor)
            .text(statusLabel, cx, rowY + 5, { width: cW[6] - 6, align: 'right' });
        rowY += rowH;
    });
    doc.save().rect(MARGIN, startY, W, rowY - startY).strokeColor(C.border).lineWidth(0.5).stroke().restore();
    doc.y = rowY + 12;
}
// ── Shared header drawer ──────────────────────────────────────────────────────
function drawPageHeader(doc, ai, periodLabel, frequency) {
    doc.save()
        .rect(0, 0, PAGE_WIDTH, 80)
        .fillColor(C.dark)
        .fill()
        .restore();
    doc.font('Helvetica-Bold')
        .fontSize(22)
        .fillColor(C.white)
        .text('NORTHIE', MARGIN, 24);
    doc.font('Helvetica')
        .fontSize(9)
        .fillColor('#AAAAAA')
        .text(`Relatório ${frequency} · ${periodLabel}`, MARGIN, 52);
    // Situação geral badge (top-right of header)
    const situacaoColor = SITUACAO_COLOR[ai.situacao_geral];
    const situacaoLabel = SITUACAO_LABEL[ai.situacao_geral];
    doc.save()
        .rect(PAGE_WIDTH - MARGIN - 80, 26, 76, 20)
        .fillColor(situacaoColor)
        .fill()
        .restore();
    doc.font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(C.white)
        .text(situacaoLabel, PAGE_WIDTH - MARGIN - 78, 31, { width: 72, align: 'center' });
}
// ── Main export ───────────────────────────────────────────────────────────────
export async function generatePdf(data, ai) {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const bufferPromise = streamToBuffer(doc);
    const periodLabel = `${fmtDate(data.period.start)} — ${fmtDate(data.period.end)}`;
    // ══════════════════════════════════════════════════════════════════════════
    // PÁGINA 1 — SUMÁRIO EXECUTIVO
    // ══════════════════════════════════════════════════════════════════════════
    drawPageHeader(doc, ai, periodLabel, data.period.frequency);
    doc.y = 100;
    // ── Análise Executiva ─────────────────────────────────────────────────────
    if (ai.resumo_executivo) {
        sectionTitle(doc, 'Análise Executiva');
        doc.font('Helvetica')
            .fontSize(10)
            .fillColor(C.dark)
            .text(ai.resumo_executivo, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: 3 });
        doc.moveDown(0.5);
    }
    // ── KPI Grid 3×2 ─────────────────────────────────────────────────────────
    sectionTitle(doc, 'Resumo do Período');
    const deltaRevenue = changeBadge(data.summary.revenue_change_pct);
    const revenuePositive = (data.summary.revenue_change_pct ?? 0) >= 0;
    const refundIsHigh = data.summary.refund_rate > 5;
    kpiGrid(doc, [
        {
            label: 'Receita Líquida',
            value: fmtBrl(data.summary.revenue_net),
            ...(deltaRevenue ? { delta: deltaRevenue, deltaPositive: revenuePositive } : {}),
        },
        {
            label: 'ROAS',
            value: `${fmtNum(data.summary.roas)}x`,
            ...(data.summary.ad_spend > 0 ? { delta: `Spend ${fmtBrl(data.summary.ad_spend)}`, deltaPositive: true } : {}),
        },
        { label: 'Novos Clientes', value: String(data.summary.new_customers) },
        { label: 'LTV Médio', value: fmtBrl(data.summary.ltv_avg) },
        { label: 'Margem Bruta', value: `${fmtNum(data.summary.gross_margin_pct)}%` },
        {
            label: 'Taxa de Reembolso',
            value: `${fmtNum(data.summary.refund_rate)}%`,
            ...(refundIsHigh ? { delta: `${fmtBrl(data.summary.refund_amount)} reembolsado`, deltaPositive: false } : {}),
        },
    ]);
    // ── Economia por Canal (página 1 — top 4) ────────────────────────────────
    const topChannels = data.channel_economics
        .filter(c => c.channel !== 'desconhecido')
        .slice(0, 4);
    if (topChannels.length > 0) {
        sectionTitle(doc, 'Economia por Canal');
        channelEconTable(doc, topChannels);
    }
    // ── Top 3 alertas ─────────────────────────────────────────────────────────
    const criticalDiags = [...ai.diagnosticos]
        .filter(d => d.severidade === 'critica' || d.severidade === 'alta')
        .slice(0, 3);
    if (criticalDiags.length > 0) {
        sectionTitle(doc, 'Alertas Críticos');
        for (const d of criticalDiags) {
            if (doc.y > 680)
                break; // Página 1 tem limite
            const color = SEVERITY_COLOR[d.severidade];
            const y = doc.y;
            doc.save()
                .rect(MARGIN, y, 4, 28)
                .fillColor(color)
                .fill()
                .restore();
            doc.font('Helvetica-Bold')
                .fontSize(8.5)
                .fillColor(C.dark)
                .text(`${d.canal.toUpperCase()} — ${SEVERITY_LABEL[d.severidade]}`, MARGIN + 12, y + 4, { width: CONTENT_WIDTH - 100 });
            doc.font('Helvetica')
                .fontSize(8)
                .fillColor(C.textSecondary)
                .text(d.acao_recomendada, MARGIN + 12, y + 16, { width: CONTENT_WIDTH - 100 });
            doc.font('Helvetica-Bold')
                .fontSize(8)
                .fillColor(color)
                .text(fmtBrl(d.consequencia_financeira_brl), PAGE_WIDTH - MARGIN - 80, y + 10, { width: 76, align: 'right' });
            doc.y = y + 38;
        }
    }
    // ── Próximos 3 passos ──────────────────────────────────────────────────────
    if (ai.proximos_passos.length > 0 && doc.y < 700) {
        sectionTitle(doc, 'Próximos Passos');
        bulletList(doc, ai.proximos_passos.slice(0, 3).map((p, i) => `${i + 1}. ${p}`), C.primary);
    }
    // ══════════════════════════════════════════════════════════════════════════
    // PÁGINA 2+ — RELATÓRIO DETALHADO
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    drawPageHeader(doc, ai, periodLabel, data.period.frequency);
    // Sub-label para a segunda página
    doc.save()
        .rect(0, 80, PAGE_WIDTH, 20)
        .fillColor('#F5F5F5')
        .fill()
        .restore();
    doc.font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(C.textSecondary)
        .text('RELATÓRIO DETALHADO — CFO VIEW', MARGIN, 87, { characterSpacing: 0.8 });
    doc.y = 118;
    // ── Diagnósticos completos por Canal ──────────────────────────────────────
    if (ai.diagnosticos.length > 0) {
        sectionTitle(doc, 'Diagnósticos por Canal');
        const order = { critica: 0, alta: 1, media: 2, ok: 3 };
        const sorted = [...ai.diagnosticos].sort((a, b) => order[a.severidade] - order[b.severidade]);
        for (const d of sorted) {
            if (doc.y > 680)
                doc.addPage();
            drawDiagnosisCard(doc, d);
        }
    }
    // ── Economia por Canal (página 2 — completo) ──────────────────────────────
    const allChannels = data.channel_economics.filter(c => c.channel !== 'desconhecido');
    if (allChannels.length > 0) {
        if (doc.y > 650)
            doc.addPage();
        sectionTitle(doc, 'Economia por Canal — Visão Completa (LTV × CAC)');
        channelEconTable(doc, allChannels);
    }
    // ── Tendência de Receita (nova seção) ─────────────────────────────────────
    if (data.revenue_trend.length >= 2) {
        if (doc.y > 650)
            doc.addPage();
        sectionTitle(doc, 'Tendência de Receita — Últimos 6 Meses');
        const trendRows = data.revenue_trend.map((t) => {
            const change = t.change_pct !== null
                ? `${t.change_pct >= 0 ? '+' : ''}${fmtNum(t.change_pct)}%`
                : '—';
            return [t.month, fmtBrl(t.revenue), change];
        });
        threeColTable(doc, trendRows, 'Mês', 'Receita Líquida', 'Variação', (val) => {
            if (val === '—')
                return C.textSecondary;
            return val.startsWith('+') ? C.success : C.danger;
        });
    }
    // ── Top Produtos (nova seção) ──────────────────────────────────────────────
    if (data.top_products.length > 0) {
        if (doc.y > 650)
            doc.addPage();
        sectionTitle(doc, 'Top Produtos por Receita');
        const productRows = data.top_products.map((p) => [
            p.product_name.length > 45 ? p.product_name.slice(0, 42) + '...' : p.product_name,
            fmtBrl(p.revenue),
            `${p.pct_of_total}%`,
        ]);
        threeColTable(doc, productRows, 'Produto', 'Receita', '% do Total');
    }
    // ── RFM Distribution ──────────────────────────────────────────────────────
    if (data.rfm_distribution.length > 0 && data.rfm_distribution.some(s => s.count > 0)) {
        if (doc.y > 650)
            doc.addPage();
        const rfmTitle = data.rfm_source === 'estimated'
            ? 'Qualidade da Base (RFM — estimado)'
            : 'Qualidade da Base (RFM)';
        sectionTitle(doc, rfmTitle);
        const rfmRows = data.rfm_distribution
            .filter(s => s.count > 0)
            .map((s) => [`${s.segment} · ${s.count} clientes`, fmtBrl(s.ltv)]);
        twoColTable(doc, rfmRows, 'Segmento', 'LTV Total');
        if (data.rfm_source === 'estimated') {
            doc.font('Helvetica')
                .fontSize(7.5)
                .fillColor(C.textSecondary)
                .text('* Segmentação estimada a partir dos dados disponíveis. Ative o job de RFM para precisão.', MARGIN, doc.y, { width: CONTENT_WIDTH });
            doc.moveDown(0.5);
        }
    }
    // ── Footer em todas as páginas ────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const footerY = doc.page.height - 36;
        drawHRule(doc, footerY - 8);
        const pageNum = i - range.start + 1;
        const totalPages = range.count;
        doc.font('Helvetica')
            .fontSize(7.5)
            .fillColor(C.textSecondary)
            .text(`Gerado em ${fmtDate(ai.generated_at)} · Análise por ${ai.model} · Northie · Pág. ${pageNum}/${totalPages}`, MARGIN, footerY, { width: CONTENT_WIDTH, align: 'center' });
    }
    doc.end();
    return bufferPromise;
}
//# sourceMappingURL=report-pdf.js.map