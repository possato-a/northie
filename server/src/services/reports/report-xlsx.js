import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Workbook: WorkbookClass } = require('exceljs');
// ── Brand colors ──────────────────────────────────────────────────────────────
const C = {
    accent: '#1A1A2E',
    dark: '#1E1E1E',
    white: '#FFFFFF',
    success: '#22C55E',
    danger: '#EF4444',
    warning: '#F59E0B',
    textSecondary: '#6B7280',
    zebraRow: '#F7F6F3',
    blue: '#3B82F6',
    purple: '#8B5CF6',
    teal: '#10B981',
    orange: '#F97316',
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
const STATUS_LABELS = {
    approved: 'Aprovado',
    refunded: 'Reembolsado',
    pending: 'Pendente',
    cancelled: 'Cancelado',
    chargeback: 'Chargeback',
};
function translateChannel(ch) {
    return CHANNEL_LABELS[ch] ?? ch;
}
// ── Formatters (pt-BR) ────────────────────────────────────────────────────────
function fmtBrl(n) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}
function fmtNum(n, decimals = 2) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
}
function fmtDateLong(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric',
    });
}
function fmtDateIso(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}
// ── Fill helpers ──────────────────────────────────────────────────────────────
function accentFill() {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
}
function darkFill() {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1E1E' } };
}
function darkBlueFill() {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
}
function zebraFill() {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F6F3' } };
}
function whiteFill() {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
}
function subheaderFill() {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F1EF' } };
}
function dividerFill() {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEECEA' } };
}
// ── Font helpers (all with Calibri) ───────────────────────────────────────────
function whiteFont(bold = true, size = 10) {
    return { name: 'Calibri', color: { argb: 'FFFFFFFF' }, bold, size };
}
function colorFont(hex, bold = false, size = 10) {
    return { name: 'Calibri', color: { argb: 'FF' + hex.replace('#', '') }, bold, size };
}
function darkFont(bold = false, size = 10) {
    return { name: 'Calibri', color: { argb: 'FF1E1E1E' }, bold, size };
}
// ── Border helpers ────────────────────────────────────────────────────────────
function thinBorder() {
    const side = { style: 'thin', color: { argb: 'FFE5E5E5' } };
    return { top: side, bottom: side, left: side, right: side };
}
function bottomBorder() {
    const bottom = { style: 'thin', color: { argb: 'FFE8E6E0' } };
    return { bottom };
}
// ── Value helpers ─────────────────────────────────────────────────────────────
function isBlank(v) {
    return v == null || v === '—' || v === '';
}
function applyNd(cell) {
    cell.value = 'N/D';
    cell.font = { name: 'Calibri', color: { argb: 'FF9B9A97' }, italic: true, size: 10 };
}
function setCellText(cell, value) {
    if (isBlank(value)) {
        applyNd(cell);
    }
    else {
        cell.value = value;
        if (!cell.font)
            cell.font = { name: 'Calibri', size: 10 };
    }
}
// ── Color alert helpers (text only, never background) ─────────────────────────
function roasColor(roas) {
    if (roas <= 0)
        return C.textSecondary;
    if (roas < 1)
        return C.danger;
    if (roas < 2)
        return C.warning;
    return C.success;
}
function ltvCacColor(ratio) {
    if (ratio === null || ratio <= 0)
        return C.textSecondary;
    if (ratio < 3)
        return C.danger;
    return C.success;
}
function cohortRetColor(pct) {
    if (pct === null)
        return C.textSecondary;
    if (pct >= 70)
        return C.success;
    if (pct >= 40)
        return C.warning;
    return C.danger;
}
function churnColor(prob) {
    if (prob === null)
        return C.textSecondary;
    if (prob > 60)
        return C.danger;
    if (prob > 40)
        return C.warning;
    return C.textSecondary;
}
// ── Row stylers ───────────────────────────────────────────────────────────────
function styleHeaderRow(row, colCount, fill = darkFill()) {
    row.height = 38;
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill = fill;
        cell.font = whiteFont(true, 10);
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center', wrapText: false };
        cell.border = thinBorder();
        if (typeof cell.value === 'string')
            cell.value = cell.value.toUpperCase();
    }
}
function styleDataRow(row, colCount, idx) {
    row.height = 30;
    const bg = idx % 2 === 0 ? zebraFill() : whiteFill();
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill = bg;
        cell.border = bottomBorder();
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
        if (!cell.font)
            cell.font = { name: 'Calibri', size: 10 };
    }
}
function writeSectionTitle(ws, rowNum, text, lastCol) {
    ws.mergeCells(rowNum, 1, rowNum, lastCol);
    const cell = ws.getCell(rowNum, 1);
    cell.value = `   ${text}`;
    cell.fill = accentFill();
    cell.font = whiteFont(true, 15);
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 56;
}
function writePeriodRow(ws, rowNum, text, lastCol) {
    ws.mergeCells(rowNum, 1, rowNum, lastCol);
    const cell = ws.getCell(rowNum, 1);
    cell.value = `   ${text}`;
    cell.fill = subheaderFill();
    cell.font = { name: 'Calibri', color: { argb: 'FF6B7280' }, italic: true, size: 10 };
    cell.alignment = { vertical: 'middle' };
    ws.getRow(rowNum).height = 26;
}
function writeSectionDivider(ws, rowNum, label, lastCol) {
    ws.mergeCells(rowNum, 1, rowNum, lastCol);
    const cell = ws.getCell(rowNum, 1);
    cell.value = `   ${label}`;
    cell.fill = dividerFill();
    cell.font = { name: 'Calibri', color: { argb: 'FFF97316' }, bold: true, size: 9 };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 26;
}
function writeTotalsRow(ws, rowNum, colCount, cells) {
    const row = ws.getRow(rowNum);
    row.height = 34;
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill = darkBlueFill();
        cell.font = whiteFont(true, 10);
        cell.border = thinBorder();
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
    }
    for (const { col, value } of cells) {
        row.getCell(col).value = value;
    }
}
function writeChartTitle(ws, rowNum, colStart, colEnd, text) {
    ws.mergeCells(rowNum, colStart, rowNum, colEnd);
    const cell = ws.getCell(rowNum, colStart);
    cell.value = text;
    cell.font = { name: 'Calibri', color: { argb: 'FFF97316' }, bold: true, size: 12 };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 32;
}
// ── Column width setter ───────────────────────────────────────────────────────
function setColWidths(ws, widths) {
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}
// ── Worksheet defaults (gridlines off + freeze) ───────────────────────────────
function setWsDefaults(ws, freezeRow) {
    ws.views = [{ state: 'frozen', ySplit: freezeRow, showGridLines: false }];
}
// ══════════════════════════════════════════════════════════════════════════════
// Main export
// ══════════════════════════════════════════════════════════════════════════════
export async function generateXlsx(data, _ai) {
    const workbook = new WorkbookClass();
    workbook.creator = 'Northie';
    workbook.created = new Date();
    const generatedStr = `Gerado em ${fmtDateLong(new Date().toISOString())} · Período: ${fmtDate(data.period.start)} a ${fmtDate(data.period.end)} (${data.period.days} dias)`;
    // ══════════════════════════════════════════════════════════════════════════
    // ABA 1 — Resumo
    // ══════════════════════════════════════════════════════════════════════════
    const wsResumo = workbook.addWorksheet('Resumo', {
        properties: { tabColor: { argb: 'FF1A1A2E' } },
    });
    const resumoCols = 2;
    writeSectionTitle(wsResumo, 1, 'RELATÓRIO DE PERFORMANCE — NORTHIE', resumoCols);
    writePeriodRow(wsResumo, 2, generatedStr, resumoCols);
    const rHeaderRow = wsResumo.getRow(3);
    rHeaderRow.getCell(1).value = 'MÉTRICA';
    rHeaderRow.getCell(2).value = 'VALOR';
    styleHeaderRow(rHeaderRow, resumoCols);
    setWsDefaults(wsResumo, 3);
    setColWidths(wsResumo, [52, 38]);
    const changeStr = data.summary.revenue_change_pct !== null
        ? `${data.summary.revenue_change_pct >= 0 ? '+' : ''}${fmtNum(data.summary.revenue_change_pct)}% vs período anterior`
        : 'sem comparativo';
    const changeColor = data.summary.revenue_change_pct !== null && data.summary.revenue_change_pct < 0
        ? C.danger : C.success;
    const hs = data.health_score;
    const resumoItems = [
        { kind: 'divider', label: 'FINANCEIRO' },
        { kind: 'kpi', label: 'Faturamento Total (Receita Líquida)', value: fmtBrl(data.summary.revenue_net) },
        { kind: 'kpi', label: 'Variação vs Período Anterior', value: changeStr, color: changeColor },
        { kind: 'kpi', label: 'Receita Bruta', value: fmtBrl(data.summary.revenue_gross) },
        { kind: 'kpi', label: 'Margem Bruta (%)', value: `${fmtNum(data.summary.gross_margin_pct)}%` },
        { kind: 'kpi', label: 'Transações', value: data.summary.transactions.toLocaleString('pt-BR') },
        { kind: 'kpi', label: 'Ticket Médio (AOV)', value: fmtBrl(data.summary.aov) },
        { kind: 'divider', label: 'CLIENTES & UNIT ECONOMICS' },
        { kind: 'kpi', label: 'LTV Médio (novos clientes)', value: fmtBrl(data.summary.ltv_avg) },
        { kind: 'kpi', label: 'CAC Médio', value: data.cac_overall > 0 ? fmtBrl(data.cac_overall) : '—' },
        { kind: 'kpi', label: 'LTV / CAC', value: data.ltv_cac_overall !== null ? `${fmtNum(data.ltv_cac_overall)}x` : '—',
            color: data.ltv_cac_overall !== null ? ltvCacColor(data.ltv_cac_overall) : undefined },
        { kind: 'kpi', label: 'ROAS Consolidado', value: data.summary.roas > 0 ? `${fmtNum(data.summary.roas)}x` : '—',
            color: data.summary.roas > 0 ? roasColor(data.summary.roas) : undefined },
        { kind: 'kpi', label: 'Margem de Contribuição (%)', value: `${fmtNum(data.margin_contribution_pct)}%`,
            color: data.margin_contribution_pct < 0 ? C.danger : undefined },
        { kind: 'kpi', label: 'Margem de Contribuição (R$)', value: fmtBrl(data.margin_contribution_brl),
            color: data.margin_contribution_brl < 0 ? C.danger : undefined },
        { kind: 'kpi', label: 'Investimento em Ads', value: fmtBrl(data.summary.ad_spend) },
        { kind: 'kpi', label: 'Novos Clientes no Período', value: data.summary.new_customers.toLocaleString('pt-BR') },
        { kind: 'kpi', label: 'Base Total de Clientes', value: data.summary.total_customers.toLocaleString('pt-BR') },
        { kind: 'divider', label: 'TRÁFEGO' },
        { kind: 'kpi', label: 'Impressões', value: data.summary.impressions.toLocaleString('pt-BR') },
        { kind: 'kpi', label: 'Cliques', value: data.summary.clicks.toLocaleString('pt-BR') },
        { kind: 'kpi', label: 'CTR', value: `${fmtNum(data.summary.ctr)}%` },
        { kind: 'divider', label: 'REEMBOLSOS' },
        { kind: 'kpi', label: 'Taxa de Reembolso', value: `${fmtNum(data.summary.refund_rate)}%`,
            color: data.summary.refund_rate > 5 ? C.danger : undefined },
        { kind: 'kpi', label: 'Valor Reembolsado', value: fmtBrl(data.summary.refund_amount) },
        { kind: 'divider', label: 'PROJEÇÕES & SAÚDE' },
        { kind: 'kpi', label: 'MRR Projetado', value: fmtBrl(data.mrr_projected) },
        { kind: 'kpi', label: 'ARR Projetado', value: fmtBrl(data.arr_projected) },
        { kind: 'kpi', label: 'Payback Period', value: data.payback_months !== null ? `${fmtNum(data.payback_months, 1)} meses` : '—' },
        { kind: 'kpi', label: 'Saúde do Negócio', value: `${hs.score}/100 — ${hs.label}` },
    ];
    let r = 4;
    let kpiIdx = 0;
    for (const item of resumoItems) {
        if (item.kind === 'divider') {
            writeSectionDivider(wsResumo, r, item.label, resumoCols);
        }
        else {
            const cellA = wsResumo.getCell(r, 1);
            const cellB = wsResumo.getCell(r, 2);
            const bg = kpiIdx % 2 === 0 ? zebraFill() : whiteFill();
            cellA.value = item.label;
            cellA.font = { name: 'Calibri', bold: true, size: 10 };
            cellA.fill = bg;
            cellA.border = bottomBorder();
            cellA.alignment = { vertical: 'middle' };
            cellB.fill = bg;
            cellB.border = bottomBorder();
            cellB.alignment = { vertical: 'middle', horizontal: 'right' };
            if (isBlank(item.value)) {
                applyNd(cellB);
            }
            else if (item.color) {
                cellB.value = item.value;
                cellB.font = colorFont(item.color, true, 10);
            }
            else {
                cellB.value = item.value;
                cellB.font = { name: 'Calibri', size: 10 };
            }
            wsResumo.getRow(r).height = 30;
            kpiIdx++;
        }
        r++;
    }
    // ══════════════════════════════════════════════════════════════════════════
    // ABA 2 — Vendas (7 cols)
    // ══════════════════════════════════════════════════════════════════════════
    const wsVendas = workbook.addWorksheet('Vendas', {
        properties: { tabColor: { argb: 'FF22C55E' } },
    });
    const vendaCols = 7;
    writeSectionTitle(wsVendas, 1, 'DETALHAMENTO DE VENDAS', vendaCols);
    writePeriodRow(wsVendas, 2, generatedStr, vendaCols);
    const vHeaderRow = wsVendas.getRow(3);
    ['ID', 'Cliente', 'Canal', 'Produto', 'Valor Líquido (R$)', 'Data', 'Status'].forEach((h, i) => {
        vHeaderRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(vHeaderRow, vendaCols, darkFill());
    setWsDefaults(wsVendas, 3);
    setColWidths(wsVendas, [20, 36, 20, 32, 22, 20, 20]);
    const sortedTx = [...data.transactions_detail].sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
    });
    let totalVendas = 0;
    sortedTx.forEach((t, idx) => {
        const rv = idx + 4;
        const dr = wsVendas.getRow(rv);
        const statusLabel = STATUS_LABELS[t.status] ?? t.status;
        const channel = translateChannel(t.customer_channel ?? t.platform ?? '');
        styleDataRow(dr, vendaCols, idx);
        dr.getCell(1).value = t.id.slice(0, 8);
        dr.getCell(1).font = { name: 'Calibri', color: { argb: 'FF9B9A97' }, size: 9 };
        setCellText(dr.getCell(2), t.customer_email ?? null);
        dr.getCell(2).font = darkFont(false, 10);
        setCellText(dr.getCell(3), channel || null);
        setCellText(dr.getCell(4), t.product_name || null);
        dr.getCell(5).value = fmtBrl(t.amount_net);
        dr.getCell(5).font = { name: 'Calibri', bold: t.status === 'approved', size: 10 };
        dr.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
        if (t.created_at) {
            dr.getCell(6).value = fmtDate(t.created_at);
            dr.getCell(6).font = darkFont(false, 10);
        }
        else {
            applyNd(dr.getCell(6));
        }
        const isApproved = t.status === 'approved';
        const isRefunded = t.status === 'refunded';
        dr.getCell(7).value = statusLabel;
        dr.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
        if (isApproved)
            dr.getCell(7).font = colorFont(C.success, true, 10);
        else if (isRefunded)
            dr.getCell(7).font = colorFont(C.danger, true, 10);
        else
            dr.getCell(7).font = darkFont(false, 10);
        if (t.status === 'approved')
            totalVendas += t.amount_net;
    });
    if (sortedTx.length > 0) {
        writeTotalsRow(wsVendas, sortedTx.length + 4, vendaCols, [
            { col: 1, value: `TOTAL (${sortedTx.filter(t => t.status === 'approved').length} aprovadas)` },
            { col: 5, value: fmtBrl(totalVendas) },
        ]);
    }
    wsVendas.autoFilter = {
        from: { row: 3, column: 1 },
        to: { row: 3 + sortedTx.length, column: vendaCols },
    };
    // ══════════════════════════════════════════════════════════════════════════
    // ABA 3 — Canais (8 cols)
    // ══════════════════════════════════════════════════════════════════════════
    const wsCanais = workbook.addWorksheet('Canais', {
        properties: { tabColor: { argb: 'FF1A7FE8' } },
    });
    const canalColCount = 8;
    writeSectionTitle(wsCanais, 1, 'PERFORMANCE POR CANAL DE AQUISIÇÃO', canalColCount);
    writePeriodRow(wsCanais, 2, generatedStr, canalColCount);
    const cHeaderRow = wsCanais.getRow(3);
    ['Canal', 'Investimento (R$)', 'Receita Atribuída (R$)', 'ROAS', 'CAC (R$)', 'LTV Médio (R$)', 'LTV/CAC', 'Novos Clientes'].forEach((h, i) => {
        cHeaderRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(cHeaderRow, canalColCount, darkFill());
    setWsDefaults(wsCanais, 3);
    setColWidths(wsCanais, [24, 26, 28, 20, 20, 22, 20, 22]);
    const channels = [...data.channel_economics].sort((a, b) => {
        const roasA = a.total_spend > 0 ? a.total_ltv / a.total_spend : -1;
        const roasB = b.total_spend > 0 ? b.total_ltv / b.total_spend : -1;
        return roasB - roasA;
    });
    if (channels.length === 0) {
        wsCanais.mergeCells(4, 1, 4, canalColCount);
        const emptyCell = wsCanais.getCell(4, 1);
        emptyCell.value = 'Sem dados de canais no período';
        emptyCell.font = colorFont(C.textSecondary, false, 10);
        emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
        emptyCell.fill = whiteFill();
        wsCanais.getRow(4).height = 32;
    }
    else {
        let totalSpendCh = 0, totalRevCh = 0, totalCustCh = 0;
        channels.forEach((ch, idx) => {
            const rv = idx + 4;
            const dr = wsCanais.getRow(rv);
            const roas = ch.total_spend > 0 ? ch.total_ltv / ch.total_spend : 0;
            styleDataRow(dr, canalColCount, idx);
            dr.getCell(1).value = translateChannel(ch.channel);
            dr.getCell(1).font = darkFont(true, 10);
            dr.getCell(2).value = fmtBrl(ch.total_spend);
            dr.getCell(2).font = darkFont(false, 10);
            dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
            dr.getCell(3).value = fmtBrl(ch.total_ltv);
            dr.getCell(3).font = darkFont(false, 10);
            dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
            if (ch.total_spend > 0) {
                dr.getCell(4).value = `${fmtNum(roas)}x`;
                dr.getCell(4).font = colorFont(roasColor(roas), roas < 1, 10);
                dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
            }
            else {
                dr.getCell(4).value = 'Orgânico';
                dr.getCell(4).font = colorFont(C.teal, false, 10);
                dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
            }
            if (ch.cac > 0) {
                dr.getCell(5).value = fmtBrl(ch.cac);
                dr.getCell(5).font = darkFont(false, 10);
                dr.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
            }
            else {
                applyNd(dr.getCell(5));
            }
            dr.getCell(6).value = fmtBrl(ch.avg_ltv);
            dr.getCell(6).font = darkFont(false, 10);
            dr.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
            if (ch.ltv_cac_ratio !== null) {
                const ratio = ch.ltv_cac_ratio;
                dr.getCell(7).value = `${fmtNum(ratio)}x`;
                dr.getCell(7).font = colorFont(ltvCacColor(ratio), ratio < 3, 10);
                dr.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
            }
            else {
                applyNd(dr.getCell(7));
            }
            dr.getCell(8).value = ch.new_customers;
            dr.getCell(8).font = darkFont(false, 10);
            dr.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
            totalSpendCh += ch.total_spend;
            totalRevCh += ch.total_ltv;
            totalCustCh += ch.new_customers;
        });
        const totR = channels.length + 4;
        const roasTotal = totalSpendCh > 0 ? totalRevCh / totalSpendCh : 0;
        writeTotalsRow(wsCanais, totR, canalColCount, [
            { col: 1, value: 'TOTAL' },
            { col: 2, value: fmtBrl(totalSpendCh) },
            { col: 3, value: fmtBrl(totalRevCh) },
            { col: 4, value: totalSpendCh > 0 ? `${fmtNum(roasTotal)}x` : '—' },
            { col: 8, value: totalCustCh },
        ]);
        wsCanais.autoFilter = {
            from: { row: 3, column: 1 },
            to: { row: 3 + channels.length, column: canalColCount },
        };
    }
    // ══════════════════════════════════════════════════════════════════════════
    // ABA 4 — Produtos (5 cols)
    // ══════════════════════════════════════════════════════════════════════════
    const wsProdutos = workbook.addWorksheet('Produtos', {
        properties: { tabColor: { argb: 'FFF59E0B' } },
    });
    const prodCols = 5;
    writeSectionTitle(wsProdutos, 1, 'TOP PRODUTOS POR RECEITA', prodCols);
    writePeriodRow(wsProdutos, 2, generatedStr, prodCols);
    const pHeaderRow = wsProdutos.getRow(3);
    ['Produto', 'Receita Total (R$)', 'Transações', 'Ticket Médio (R$)', '% do Total'].forEach((h, i) => {
        pHeaderRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(pHeaderRow, prodCols, darkFill());
    setWsDefaults(wsProdutos, 3);
    setColWidths(wsProdutos, [48, 26, 20, 24, 20]);
    if (data.top_products.length === 0) {
        wsProdutos.mergeCells(4, 1, 4, prodCols);
        const eCell = wsProdutos.getCell(4, 1);
        eCell.value = 'Sem dados de produtos no período (Hotmart/Shopify não conectados)';
        eCell.font = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill = whiteFill();
        wsProdutos.getRow(4).height = 32;
    }
    else {
        let totalRevProd = 0;
        data.top_products.forEach((p, idx) => {
            const rv = idx + 4;
            const dr = wsProdutos.getRow(rv);
            const ticketMedio = p.transactions > 0 ? p.revenue / p.transactions : 0;
            const refundAmt = data.refunds_by_product?.[p.product_name] ?? 0;
            styleDataRow(dr, prodCols, idx);
            dr.getCell(1).value = p.product_name;
            dr.getCell(1).font = { name: 'Calibri', bold: idx < 3, size: 10 };
            dr.getCell(2).value = fmtBrl(p.revenue);
            dr.getCell(2).font = refundAmt > 0 ? colorFont(C.warning, false, 10) : darkFont(false, 10);
            dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
            dr.getCell(3).value = p.transactions;
            dr.getCell(3).font = darkFont(false, 10);
            dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
            dr.getCell(4).value = fmtBrl(ticketMedio);
            dr.getCell(4).font = darkFont(false, 10);
            dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
            dr.getCell(5).value = `${p.pct_of_total}%`;
            dr.getCell(5).font = darkFont(false, 10);
            dr.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
            totalRevProd += p.revenue;
        });
        const totTx = data.top_products.reduce((s, p) => s + p.transactions, 0);
        writeTotalsRow(wsProdutos, data.top_products.length + 4, prodCols, [
            { col: 1, value: 'TOTAL' },
            { col: 2, value: fmtBrl(totalRevProd) },
            { col: 3, value: totTx },
            { col: 4, value: totTx > 0 ? fmtBrl(totalRevProd / totTx) : '—' },
        ]);
        wsProdutos.autoFilter = {
            from: { row: 3, column: 1 },
            to: { row: 3 + data.top_products.length, column: prodCols },
        };
    }
    // ══════════════════════════════════════════════════════════════════════════
    // ABA 5 — Clientes em Risco (7 cols)
    // ══════════════════════════════════════════════════════════════════════════
    const wsRisco = workbook.addWorksheet('Clientes em Risco', {
        properties: { tabColor: { argb: 'FFEF4444' } },
    });
    const riscoCols = 7;
    writeSectionTitle(wsRisco, 1, 'CLIENTES EM RISCO DE CHURN (PROB. > 60%)', riscoCols);
    writePeriodRow(wsRisco, 2, generatedStr, riscoCols);
    const rHeaderRow2 = wsRisco.getRow(3);
    ['#', 'LTV (R$)', 'Prob. Churn', 'Dias s/ Compra', 'Canal', 'RFM Score', 'Email'].forEach((h, i) => {
        rHeaderRow2.getCell(i + 1).value = h;
    });
    styleHeaderRow(rHeaderRow2, riscoCols, darkFill());
    setWsDefaults(wsRisco, 3);
    setColWidths(wsRisco, [20, 22, 24, 24, 20, 20, 40]);
    const atRisk = data.at_risk_customers;
    if (atRisk.length === 0) {
        wsRisco.mergeCells(4, 1, 4, riscoCols);
        const eCell = wsRisco.getCell(4, 1);
        eCell.value = 'Nenhum cliente com probabilidade de churn acima de 60%';
        eCell.font = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill = whiteFill();
        wsRisco.getRow(4).height = 32;
    }
    else {
        atRisk.forEach((c, idx) => {
            const rv = idx + 4;
            const dr = wsRisco.getRow(rv);
            styleDataRow(dr, riscoCols, idx);
            dr.getCell(1).value = idx + 1;
            dr.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
            dr.getCell(1).font = { name: 'Calibri', bold: true, size: 10 };
            dr.getCell(2).value = fmtBrl(c.ltv ?? 0);
            dr.getCell(2).font = darkFont(false, 10);
            dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
            const prob = c.churn_probability;
            const churnPct = prob !== null ? `${fmtNum(prob)}%` : 'N/D';
            const cColor = churnColor(prob);
            dr.getCell(3).value = churnPct;
            dr.getCell(3).font = colorFont(cColor, (prob ?? 0) > 60, 10);
            dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
            const days = c.days_since_purchase !== null ? `${c.days_since_purchase} dias` : 'N/D';
            dr.getCell(4).value = days;
            dr.getCell(4).font = c.days_since_purchase !== null && c.days_since_purchase > 90
                ? colorFont(C.danger, false, 10)
                : darkFont(false, 10);
            dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
            setCellText(dr.getCell(5), translateChannel(c.channel ?? 'desconhecido'));
            dr.getCell(5).font = darkFont(false, 10);
            if (c.rfm_score) {
                dr.getCell(6).value = c.rfm_score;
                dr.getCell(6).font = colorFont(C.textSecondary, false, 10);
                dr.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
            }
            else {
                applyNd(dr.getCell(6));
            }
            const email = c.email;
            setCellText(dr.getCell(7), email ?? null);
            if (!isBlank(email))
                dr.getCell(7).font = darkFont(false, 10);
        });
        wsRisco.autoFilter = {
            from: { row: 3, column: 1 },
            to: { row: 3 + atRisk.length, column: riscoCols },
        };
    }
    // ══════════════════════════════════════════════════════════════════════════
    // ABA 6 — Segmentação RFM (5 cols)
    // ══════════════════════════════════════════════════════════════════════════
    const wsRfm = workbook.addWorksheet('Segmentação RFM', {
        properties: { tabColor: { argb: 'FF8B5CF6' } },
    });
    const rfmCols = 5;
    const rfmTitle = data.rfm_source === 'estimated'
        ? 'SEGMENTAÇÃO RFM (ESTIMADO — JOB RFM PENDENTE)'
        : 'SEGMENTAÇÃO RFM';
    writeSectionTitle(wsRfm, 1, rfmTitle, rfmCols);
    writePeriodRow(wsRfm, 2, generatedStr, rfmCols);
    const rfmHeaderRow = wsRfm.getRow(3);
    ['Segmento', 'Clientes', '% da Base', 'LTV Total (R$)', 'LTV Médio (R$)'].forEach((h, i) => {
        rfmHeaderRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(rfmHeaderRow, rfmCols, darkFill());
    setWsDefaults(wsRfm, 3);
    setColWidths(wsRfm, [44, 20, 20, 26, 24]);
    const RFM_COLORS = {
        champions: C.success,
        loyalists: C.blue,
        em_risco: C.warning,
        perdidos: C.danger,
        novos: C.purple,
        outros: C.textSecondary,
    };
    const RFM_LABELS = {
        champions: 'Champions — melhores clientes',
        loyalists: 'Leais — compram com frequência',
        em_risco: 'Em Risco — reduzindo atividade',
        perdidos: 'Perdidos — inativos há muito tempo',
        novos: 'Novos — primeira compra recente',
        outros: 'Outros',
    };
    const totalRfmClientes = data.rfm_distribution.reduce((s, r) => s + r.count, 0);
    const totalRfmLtv = data.rfm_distribution.reduce((s, r) => s + r.ltv, 0);
    data.rfm_distribution.forEach((seg, idx) => {
        const rv = idx + 4;
        const dr = wsRfm.getRow(rv);
        const pct = totalRfmClientes > 0
            ? `${fmtNum((seg.count / totalRfmClientes) * 100, 1)}%`
            : '—';
        const avgLtv = seg.count > 0 ? seg.ltv / seg.count : 0;
        styleDataRow(dr, rfmCols, idx);
        const segColor = RFM_COLORS[seg.segment] ?? C.textSecondary;
        dr.getCell(1).value = RFM_LABELS[seg.segment] ?? seg.segment;
        dr.getCell(1).font = colorFont(segColor, true, 10);
        dr.getCell(2).value = seg.count;
        dr.getCell(2).font = darkFont(false, 10);
        dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
        dr.getCell(3).value = pct;
        dr.getCell(3).font = darkFont(false, 10);
        dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
        dr.getCell(4).value = fmtBrl(seg.ltv);
        dr.getCell(4).font = darkFont(false, 10);
        dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
        dr.getCell(5).value = seg.count > 0 ? fmtBrl(avgLtv) : '—';
        dr.getCell(5).font = darkFont(false, 10);
        dr.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
    });
    if (data.rfm_distribution.length > 0) {
        writeTotalsRow(wsRfm, data.rfm_distribution.length + 4, rfmCols, [
            { col: 1, value: 'TOTAL' },
            { col: 2, value: totalRfmClientes },
            { col: 3, value: '100%' },
            { col: 4, value: fmtBrl(totalRfmLtv) },
            { col: 5, value: totalRfmClientes > 0 ? fmtBrl(totalRfmLtv / totalRfmClientes) : '—' },
        ]);
    }
    // ══════════════════════════════════════════════════════════════════════════
    // ABA 7 — Projeções (4 cols)
    // ══════════════════════════════════════════════════════════════════════════
    const wsProj = workbook.addWorksheet('Projeções', {
        properties: { tabColor: { argb: 'FF10B981' } },
    });
    const projCols = 4;
    writeSectionTitle(wsProj, 1, 'PROJEÇÕES DE RECEITA — 3 CENÁRIOS', projCols);
    writePeriodRow(wsProj, 2, generatedStr, projCols);
    const projHeaderRow = wsProj.getRow(3);
    ['Métrica', 'Conservador', 'Moderado', 'Otimista'].forEach((h, i) => {
        projHeaderRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(projHeaderRow, projCols, darkFill());
    setWsDefaults(wsProj, 3);
    setColWidths(wsProj, [40, 28, 28, 28]);
    const { conservative: cons, moderate: mod, optimistic: opt } = data.projections;
    const projRows = [
        ['Mês 1 (Receita)', fmtBrl(cons.month1), fmtBrl(mod.month1), fmtBrl(opt.month1)],
        ['Mês 2 (Receita)', fmtBrl(cons.month2), fmtBrl(mod.month2), fmtBrl(opt.month2)],
        ['Mês 3 (Receita)', fmtBrl(cons.month3), fmtBrl(mod.month3), fmtBrl(opt.month3)],
        ['Taxa de Crescimento/mês', `${fmtNum(cons.rate_pct)}%`, `${fmtNum(mod.rate_pct)}%`, `${fmtNum(opt.rate_pct)}%`],
    ];
    projRows.forEach(([label, c, m, o], idx) => {
        const rv = idx + 4;
        const dr = wsProj.getRow(rv);
        styleDataRow(dr, projCols, idx);
        dr.getCell(1).value = label;
        dr.getCell(1).font = { name: 'Calibri', bold: true, size: 10 };
        dr.getCell(2).value = c;
        dr.getCell(2).font = colorFont('#2563EB', true, 10);
        dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
        dr.getCell(3).value = m;
        dr.getCell(3).font = colorFont('#F97316', true, 10);
        dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
        dr.getCell(4).value = o;
        dr.getCell(4).font = colorFont(C.teal, true, 10);
        dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    });
    // Separator blank row
    const sepRow = projRows.length + 4;
    wsProj.mergeCells(sepRow, 1, sepRow, projCols);
    wsProj.getRow(sepRow).height = 12;
    // General metrics section
    const generalMetrics = [
        ['MRR Projetado', fmtBrl(data.mrr_projected)],
        ['ARR Projetado', fmtBrl(data.arr_projected)],
        ['Payback Period', data.payback_months !== null ? `${fmtNum(data.payback_months, 1)} meses` : '—'],
        ['LTV / CAC Geral', data.ltv_cac_overall !== null ? `${fmtNum(data.ltv_cac_overall, 2)}x` : '—'],
        ['Margem de Contribuição', `${fmtNum(data.margin_contribution_pct)}% (${fmtBrl(data.margin_contribution_brl)})`],
    ];
    generalMetrics.forEach(([label, val], idx) => {
        const rv = sepRow + 1 + idx;
        const dr = wsProj.getRow(rv);
        const bg = idx % 2 === 0 ? zebraFill() : whiteFill();
        dr.height = 30;
        dr.getCell(1).value = label;
        dr.getCell(1).font = { name: 'Calibri', bold: true, size: 10 };
        dr.getCell(1).fill = bg;
        dr.getCell(1).border = bottomBorder();
        dr.getCell(1).alignment = { vertical: 'middle' };
        wsProj.mergeCells(rv, 2, rv, projCols);
        dr.getCell(2).value = val;
        dr.getCell(2).font = { name: 'Calibri', size: 10 };
        dr.getCell(2).fill = bg;
        dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
        dr.getCell(2).border = bottomBorder();
    });
    // ══════════════════════════════════════════════════════════════════════════
    // ABA 8 — Performance por Período (diária)
    // ══════════════════════════════════════════════════════════════════════════
    const wsPerf = workbook.addWorksheet('Performance por Período', {
        properties: { tabColor: { argb: 'FF0EA5E9' } },
    });
    const perfCols = 5;
    writeSectionTitle(wsPerf, 1, 'PERFORMANCE DIÁRIA DO PERÍODO', perfCols);
    writePeriodRow(wsPerf, 2, generatedStr, perfCols);
    const perfHeaderRow = wsPerf.getRow(3);
    ['Data', 'Receita (R$)', 'Transações', 'Ticket Médio (R$)', 'Variação Dia Anterior'].forEach((h, i) => {
        perfHeaderRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(perfHeaderRow, perfCols, darkFill());
    setWsDefaults(wsPerf, 3);
    setColWidths(wsPerf, [18, 26, 18, 26, 30]);
    const dailyRevenue = data.daily_revenue ?? [];
    if (dailyRevenue.length === 0) {
        wsPerf.mergeCells(4, 1, 4, perfCols);
        const eCell = wsPerf.getCell(4, 1);
        eCell.value = 'Sem transações no período selecionado';
        eCell.font = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill = whiteFill();
        wsPerf.getRow(4).height = 32;
    }
    else {
        let totalPerfRev = 0, totalPerfTx = 0;
        dailyRevenue.forEach((day, idx) => {
            const rv = idx + 4;
            const dr = wsPerf.getRow(rv);
            styleDataRow(dr, perfCols, idx);
            dr.getCell(1).value = fmtDateIso(day.date);
            dr.getCell(1).font = darkFont(false, 10);
            dr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
            dr.getCell(2).value = fmtBrl(day.revenue);
            dr.getCell(2).font = darkFont(false, 10);
            dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
            dr.getCell(3).value = day.transactions;
            dr.getCell(3).font = darkFont(false, 10);
            dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
            dr.getCell(4).value = fmtBrl(day.aov);
            dr.getCell(4).font = darkFont(false, 10);
            dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
            if (day.change_pct !== null) {
                const sign = day.change_pct >= 0 ? '+' : '';
                const color = day.change_pct >= 0 ? C.success : C.danger;
                dr.getCell(5).value = `${sign}${fmtNum(day.change_pct)}%`;
                dr.getCell(5).font = colorFont(color, day.change_pct < -20, 10);
                dr.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
            }
            else {
                dr.getCell(5).value = '—';
                dr.getCell(5).font = colorFont(C.textSecondary, false, 10);
                dr.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
            }
            totalPerfRev += day.revenue;
            totalPerfTx += day.transactions;
        });
        writeTotalsRow(wsPerf, dailyRevenue.length + 4, perfCols, [
            { col: 1, value: `TOTAL (${dailyRevenue.length} dias)` },
            { col: 2, value: fmtBrl(totalPerfRev) },
            { col: 3, value: totalPerfTx },
            { col: 4, value: totalPerfTx > 0 ? fmtBrl(totalPerfRev / totalPerfTx) : '—' },
        ]);
        wsPerf.autoFilter = {
            from: { row: 3, column: 1 },
            to: { row: 3 + dailyRevenue.length, column: perfCols },
        };
    }
    // ══════════════════════════════════════════════════════════════════════════
    // ABA 9 — Comparativo Mensal
    // ══════════════════════════════════════════════════════════════════════════
    const wsMensal = workbook.addWorksheet('Comparativo Mensal', {
        properties: { tabColor: { argb: 'FF6366F1' } },
    });
    const mensalCols = 4;
    writeSectionTitle(wsMensal, 1, 'COMPARATIVO MENSAL — TENDÊNCIA DE RECEITA (6 MESES)', mensalCols);
    writePeriodRow(wsMensal, 2, generatedStr, mensalCols);
    const mensalHeaderRow = wsMensal.getRow(3);
    ['Mês', 'Receita Líquida (R$)', 'Variação %', 'Tendência'].forEach((h, i) => {
        mensalHeaderRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(mensalHeaderRow, mensalCols, darkFill());
    setWsDefaults(wsMensal, 3);
    setColWidths(wsMensal, [20, 30, 22, 38]);
    if (data.revenue_trend.length === 0) {
        wsMensal.mergeCells(4, 1, 4, mensalCols);
        const eCell = wsMensal.getCell(4, 1);
        eCell.value = 'Dados históricos insuficientes (menos de 1 mês de transações)';
        eCell.font = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill = whiteFill();
        wsMensal.getRow(4).height = 32;
    }
    else {
        let peakRev = 0, peakMonth = '';
        data.revenue_trend.forEach((t, idx) => {
            const rv = idx + 4;
            const dr = wsMensal.getRow(rv);
            styleDataRow(dr, mensalCols, idx);
            dr.getCell(1).value = t.month;
            dr.getCell(1).font = { name: 'Calibri', bold: true, size: 10 };
            dr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
            dr.getCell(2).value = fmtBrl(t.revenue);
            dr.getCell(2).font = darkFont(false, 10);
            dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
            if (t.revenue > peakRev) {
                peakRev = t.revenue;
                peakMonth = t.month;
            }
            if (t.change_pct !== null) {
                const sign = t.change_pct >= 0 ? '+' : '';
                const color = t.change_pct >= 0 ? C.success : C.danger;
                dr.getCell(3).value = `${sign}${fmtNum(t.change_pct)}%`;
                dr.getCell(3).font = colorFont(color, Math.abs(t.change_pct) > 20, 10);
                dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
                const trend = t.change_pct >= 10 ? '▲▲ Forte crescimento'
                    : t.change_pct >= 0 ? '▲ Crescimento'
                        : t.change_pct >= -10 ? '▼ Queda leve'
                            : '▼▼ Queda acentuada';
                dr.getCell(4).value = trend;
                dr.getCell(4).font = colorFont(t.change_pct >= 0 ? C.success : C.danger, false, 10);
                dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };
            }
            else {
                dr.getCell(3).value = '— (primeiro mês)';
                dr.getCell(3).font = colorFont(C.textSecondary, false, 10);
                dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
                dr.getCell(4).value = '—';
                dr.getCell(4).font = colorFont(C.textSecondary, false, 10);
            }
        });
        if (peakMonth) {
            const noteR = data.revenue_trend.length + 4;
            wsMensal.mergeCells(noteR, 1, noteR, mensalCols);
            const noteCell = wsMensal.getCell(noteR, 1);
            noteCell.value = `Melhor mês no período: ${peakMonth} — ${fmtBrl(peakRev)}`;
            noteCell.font = colorFont(C.teal, true, 10);
            noteCell.fill = whiteFill();
            noteCell.border = bottomBorder();
            noteCell.alignment = { vertical: 'middle', horizontal: 'center' };
            wsMensal.getRow(noteR).height = 30;
        }
    }
    // ══════════════════════════════════════════════════════════════════════════
    // ABA 10 — Cohort de Retenção
    // ══════════════════════════════════════════════════════════════════════════
    const wsCohort = workbook.addWorksheet('Cohort de Retenção', {
        properties: { tabColor: { argb: 'FFEC4899' } },
    });
    const cohortCols = 8;
    writeSectionTitle(wsCohort, 1, 'COHORT DE RETENÇÃO (ESTIMADO — BASEADO EM LAST_PURCHASE)', cohortCols);
    writePeriodRow(wsCohort, 2, generatedStr, cohortCols);
    // Note row (linha 3 — extra antes do header)
    wsCohort.mergeCells(3, 1, 3, cohortCols);
    const methodNote = wsCohort.getCell(3, 1);
    methodNote.value = '   Retenção estimada: % de clientes do cohort que realizaram compra em cada mês subsequente (baseado em last_purchase_at)';
    methodNote.font = colorFont(C.textSecondary, false, 9);
    methodNote.fill = subheaderFill();
    methodNote.alignment = { vertical: 'middle' };
    wsCohort.getRow(3).height = 22;
    // Header row is row 4 (linha extra de nota em 3)
    const cohortHeaderRow = wsCohort.getRow(4);
    ['Cohort (Mês)', 'Clientes', 'M0 (Aquisição)', 'M1', 'M2', 'M3', 'M4', 'M5'].forEach((h, i) => {
        cohortHeaderRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(cohortHeaderRow, cohortCols, darkFill());
    setWsDefaults(wsCohort, 4);
    setColWidths(wsCohort, [22, 20, 22, 20, 20, 20, 20, 20]);
    const cohortRetention = data.cohort_retention ?? [];
    if (cohortRetention.length === 0) {
        wsCohort.mergeCells(5, 1, 5, cohortCols);
        const eCell = wsCohort.getCell(5, 1);
        eCell.value = 'Sem dados de cohort — clientes insuficientes ou histórico menor que 2 meses';
        eCell.font = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill = whiteFill();
        wsCohort.getRow(5).height = 32;
    }
    else {
        cohortRetention.forEach((row, idx) => {
            const rv = idx + 5;
            const dr = wsCohort.getRow(rv);
            styleDataRow(dr, cohortCols, idx);
            dr.getCell(1).value = row.cohort;
            dr.getCell(1).font = { name: 'Calibri', bold: true, size: 10 };
            dr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
            dr.getCell(2).value = row.total;
            dr.getCell(2).font = darkFont(false, 10);
            dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
            dr.getCell(3).value = '100%';
            dr.getCell(3).font = colorFont(C.success, true, 10);
            dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
            const mVals = [row.m1, row.m2, row.m3, row.m4, row.m5];
            mVals.forEach((pct, mi) => {
                const cell = dr.getCell(mi + 4);
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
                if (pct === null) {
                    cell.value = '—';
                    cell.font = colorFont(C.textSecondary, false, 9);
                }
                else {
                    cell.value = `${pct}%`;
                    cell.font = colorFont(cohortRetColor(pct), pct < 40, 10);
                }
            });
        });
        const legendR = cohortRetention.length + 5;
        wsCohort.mergeCells(legendR, 1, legendR, cohortCols);
        const legendCell = wsCohort.getCell(legendR, 1);
        legendCell.value = 'Legenda: Verde ≥ 70%  |  Amarelo 40–69%  |  Vermelho < 40%  |  — dado ainda não disponível (cohort recente)';
        legendCell.font = colorFont(C.textSecondary, false, 9);
        legendCell.fill = subheaderFill();
        legendCell.border = bottomBorder();
        legendCell.alignment = { vertical: 'middle', horizontal: 'left' };
        wsCohort.getRow(legendR).height = 22;
    }
    // ══════════════════════════════════════════════════════════════════════════
    // ABA 11 — Gráficos (dados estruturados + raw data em cols ocultas O/P)
    // ══════════════════════════════════════════════════════════════════════════
    const wsGraf = workbook.addWorksheet('Gráficos', {
        properties: { tabColor: { argb: 'FFF97316' } },
    });
    const grafCols = 6; // colunas visíveis de dados (A–F)
    const grafFullCols = 16; // largura total incluindo cols ocultas O/P (A–P)
    writeSectionTitle(wsGraf, 1, 'GRÁFICOS DE PERFORMANCE', grafFullCols);
    writePeriodRow(wsGraf, 2, generatedStr, grafFullCols);
    wsGraf.views = [{ showGridLines: false }];
    // Cols visíveis A–F
    setColWidths(wsGraf, [4, 22, 22, 20, 20, 20]);
    // Cols G–N (7–14): vazias mas com largura definida para evitar default 8.43
    for (let c = 7; c <= 14; c++) {
        wsGraf.getColumn(c).width = 20;
    }
    // Cols O (15) e P (16) — dados brutos ocultos para uso em gráficos nativos
    wsGraf.getColumn(15).width = 22;
    wsGraf.getColumn(16).width = 18;
    wsGraf.getColumn(15).hidden = true;
    wsGraf.getColumn(16).hidden = true;
    // ── RAW DATA — Receita por Mês (cols O/P a partir da linha 1) ─────────────
    const trendData = data.revenue_trend;
    wsGraf.getCell(1, 15).value = 'MÊS';
    wsGraf.getCell(1, 16).value = 'RECEITA';
    wsGraf.getCell(1, 15).font = whiteFont(true, 9);
    wsGraf.getCell(1, 16).font = whiteFont(true, 9);
    wsGraf.getCell(1, 15).fill = darkFill();
    wsGraf.getCell(1, 16).fill = darkFill();
    trendData.forEach((t, idx) => {
        wsGraf.getCell(idx + 2, 15).value = t.month;
        wsGraf.getCell(idx + 2, 16).value = t.revenue;
    });
    // ── RAW DATA — RFM (cols O/P a partir da linha 12) ───────────────────────
    const rfmRawStart = 12;
    wsGraf.getCell(rfmRawStart, 15).value = 'SEGMENTO';
    wsGraf.getCell(rfmRawStart, 16).value = 'CLIENTES';
    wsGraf.getCell(rfmRawStart, 15).font = whiteFont(true, 9);
    wsGraf.getCell(rfmRawStart, 16).font = whiteFont(true, 9);
    wsGraf.getCell(rfmRawStart, 15).fill = darkFill();
    wsGraf.getCell(rfmRawStart, 16).fill = darkFill();
    data.rfm_distribution.forEach((seg, idx) => {
        wsGraf.getCell(rfmRawStart + 1 + idx, 15).value = RFM_LABELS[seg.segment] ?? seg.segment;
        wsGraf.getCell(rfmRawStart + 1 + idx, 16).value = seg.count;
    });
    // ── RAW DATA — Projeções (cols O/P a partir da linha 22) ─────────────────
    const projRawStart = 22;
    wsGraf.getCell(projRawStart, 15).value = 'MÊS';
    wsGraf.getCell(projRawStart, 16).value = 'MODERADO';
    wsGraf.getCell(projRawStart, 15).font = whiteFont(true, 9);
    wsGraf.getCell(projRawStart, 16).font = whiteFont(true, 9);
    wsGraf.getCell(projRawStart, 15).fill = darkFill();
    wsGraf.getCell(projRawStart, 16).fill = darkFill();
    [
        ['Mês 1', mod.month1],
        ['Mês 2', mod.month2],
        ['Mês 3', mod.month3],
    ].forEach(([label, val], idx) => {
        wsGraf.getCell(projRawStart + 1 + idx, 15).value = label;
        wsGraf.getCell(projRawStart + 1 + idx, 16).value = val;
    });
    // ── GRÁFICO 1 — Receita por Mês ──────────────────────────────────────────
    writeChartTitle(wsGraf, 5, 2, 5, 'GRÁFICO 1 — Receita por Mês (R$)');
    const g1HRow = wsGraf.getRow(6);
    ['MÊS', 'RECEITA LÍQUIDA (R$)', 'VARIAÇÃO %', 'TENDÊNCIA'].forEach((h, i) => {
        const cell = g1HRow.getCell(i + 2);
        cell.value = h;
        cell.fill = darkFill();
        cell.font = whiteFont(true, 10);
        cell.border = thinBorder();
        cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
    });
    g1HRow.height = 38;
    if (trendData.length === 0) {
        wsGraf.mergeCells(7, 2, 7, 5);
        const noData = wsGraf.getCell(7, 2);
        noData.value = 'Dados insuficientes — menos de 1 mês de histórico';
        noData.font = colorFont(C.textSecondary, false, 10);
        noData.alignment = { vertical: 'middle', horizontal: 'center' };
        noData.fill = whiteFill();
        wsGraf.getRow(7).height = 30;
    }
    else {
        trendData.forEach((t, idx) => {
            const rv = idx + 7;
            const bg = idx % 2 === 0 ? zebraFill() : whiteFill();
            const dr = wsGraf.getRow(rv);
            dr.height = 30;
            const cells = [
                { col: 2, val: t.month, align: 'left', font: darkFont(true, 10) },
                { col: 3, val: fmtBrl(t.revenue), align: 'right', font: darkFont(false, 10) },
                { col: 4, val: t.change_pct !== null ? `${t.change_pct >= 0 ? '+' : ''}${fmtNum(t.change_pct)}%` : '—',
                    align: 'right',
                    font: t.change_pct !== null
                        ? colorFont(t.change_pct >= 0 ? C.success : C.danger, Math.abs(t.change_pct ?? 0) > 20, 10)
                        : colorFont(C.textSecondary, false, 10) },
                { col: 5, val: t.change_pct === null ? '—'
                        : t.change_pct >= 10 ? '▲▲ Forte crescimento'
                            : t.change_pct >= 0 ? '▲ Crescimento'
                                : t.change_pct >= -10 ? '▼ Queda leve'
                                    : '▼▼ Queda acentuada',
                    align: 'left',
                    font: t.change_pct !== null
                        ? colorFont(t.change_pct >= 0 ? C.success : C.danger, false, 10)
                        : colorFont(C.textSecondary, false, 10) },
            ];
            cells.forEach(({ col, val, align, font }) => {
                const cell = dr.getCell(col);
                cell.value = val;
                cell.fill = bg;
                cell.font = font;
                cell.border = bottomBorder();
                cell.alignment = { vertical: 'middle', horizontal: align };
            });
        });
    }
    // ── GRÁFICO 2 — Segmentação RFM ──────────────────────────────────────────
    writeChartTitle(wsGraf, 28, 2, 5, 'GRÁFICO 2 — Segmentação RFM — Clientes por Segmento');
    const g2HRow = wsGraf.getRow(29);
    ['SEGMENTO', 'CLIENTES', '% DA BASE', 'LTV MÉDIO (R$)'].forEach((h, i) => {
        const cell = g2HRow.getCell(i + 2);
        cell.value = h;
        cell.fill = darkFill();
        cell.font = whiteFont(true, 10);
        cell.border = thinBorder();
        cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
    });
    g2HRow.height = 38;
    const rfmDataForChart = data.rfm_distribution.filter(s => s.count > 0);
    rfmDataForChart.forEach((seg, idx) => {
        const rv = idx + 30;
        const bg = idx % 2 === 0 ? zebraFill() : whiteFill();
        const dr = wsGraf.getRow(rv);
        dr.height = 30;
        const segColor = RFM_COLORS[seg.segment] ?? C.textSecondary;
        const pct = totalRfmClientes > 0 ? `${fmtNum((seg.count / totalRfmClientes) * 100, 1)}%` : '—';
        const avgLtv = seg.count > 0 ? seg.ltv / seg.count : 0;
        const g2Cells = [
            { col: 2, val: RFM_LABELS[seg.segment] ?? seg.segment, align: 'left', font: colorFont(segColor, true, 10) },
            { col: 3, val: seg.count, align: 'right', font: darkFont(false, 10) },
            { col: 4, val: pct, align: 'right', font: darkFont(false, 10) },
            { col: 5, val: fmtBrl(avgLtv), align: 'right', font: darkFont(false, 10) },
        ];
        g2Cells.forEach(({ col, val, align, font }) => {
            const cell = dr.getCell(col);
            cell.value = val;
            cell.fill = bg;
            cell.font = font;
            cell.border = bottomBorder();
            cell.alignment = { vertical: 'middle', horizontal: align };
        });
    });
    // ── GRÁFICO 3 — Projeções 3 Cenários ─────────────────────────────────────
    writeChartTitle(wsGraf, 52, 2, 6, 'GRÁFICO 3 — Projeções de Receita — 3 Cenários');
    const g3HRow = wsGraf.getRow(53);
    ['MÉTRICA', 'CONSERVADOR', 'MODERADO', 'OTIMISTA'].forEach((h, i) => {
        const cell = g3HRow.getCell(i + 2);
        cell.value = h;
        cell.fill = darkFill();
        cell.font = whiteFont(true, 10);
        cell.border = thinBorder();
        cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
    });
    g3HRow.height = 38;
    const projDataForChart = [
        ['Mês 1', fmtBrl(cons.month1), fmtBrl(mod.month1), fmtBrl(opt.month1)],
        ['Mês 2', fmtBrl(cons.month2), fmtBrl(mod.month2), fmtBrl(opt.month2)],
        ['Mês 3', fmtBrl(cons.month3), fmtBrl(mod.month3), fmtBrl(opt.month3)],
        ['Taxa/mês', `${fmtNum(cons.rate_pct)}%`, `${fmtNum(mod.rate_pct)}%`, `${fmtNum(opt.rate_pct)}%`],
    ];
    projDataForChart.forEach(([label, c, m, o], idx) => {
        const rv = idx + 54;
        const bg = idx % 2 === 0 ? zebraFill() : whiteFill();
        const dr = wsGraf.getRow(rv);
        dr.height = 30;
        [
            { col: 2, val: label, font: darkFont(true, 10) },
            { col: 3, val: c, font: colorFont('#2563EB', true, 10) },
            { col: 4, val: m, font: colorFont('#F97316', true, 10) },
            { col: 5, val: o, font: colorFont(C.teal, true, 10) },
        ].forEach(({ col, val, font }) => {
            const cell = dr.getCell(col);
            cell.value = val;
            cell.fill = bg;
            cell.font = font;
            cell.border = bottomBorder();
            cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'right' };
        });
    });
    // Legenda dos cenários
    const legR = 58;
    wsGraf.mergeCells(legR, 2, legR, 5);
    const legCell = wsGraf.getCell(legR, 2);
    legCell.value = 'Conservador = azul  |  Moderado = laranja  |  Otimista = verde  |  Dados brutos nas colunas O/P (ocultas)';
    legCell.font = colorFont(C.textSecondary, false, 9);
    legCell.fill = subheaderFill();
    legCell.border = bottomBorder();
    legCell.alignment = { vertical: 'middle', horizontal: 'center' };
    wsGraf.getRow(legR).height = 22;
    // ── Buffer ────────────────────────────────────────────────────────────────
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
}
//# sourceMappingURL=report-xlsx.js.map