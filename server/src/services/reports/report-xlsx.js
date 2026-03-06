import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Workbook: WorkbookClass } = require('exceljs');
// ── Brand colors ─────────────────────────────────────────────────────────────
const C = {
    accent: '#1a1a2e',
    dark: '#1E1E1E',
    white: '#FFFFFF',
    success: '#22C55E',
    danger: '#EF4444',
    warning: '#F59E0B',
    textSecondary: '#6B7280',
    zebraRow: '#F7F6F3',
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
// ── Style helpers ─────────────────────────────────────────────────────────────
function accentFill() {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } };
}
function darkFill() {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1E1E' } };
}
function zebraFill() {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F6F3' } };
}
function whiteFill() {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
}
// colorFill kept for potential future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function colorFill(hex) {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex.replace('#', '') } };
}
function whiteFont(bold = true, size = 10) {
    return { color: { argb: 'FFFFFFFF' }, bold, size };
}
function colorFont(hex, bold = false, size = 10) {
    return { color: { argb: 'FF' + hex.replace('#', '') }, bold, size };
}
function thinBorder() {
    const side = { style: 'thin', color: { argb: 'FFE5E5E5' } };
    return { top: side, bottom: side, left: side, right: side };
}
function sectionTopBorder() {
    const top = { style: 'thin', color: { argb: 'FFE3E2E0' } };
    const normal = { style: 'thin', color: { argb: 'FFE5E5E5' } };
    return { top, bottom: normal, left: normal, right: normal };
}
// ── CORREÇÃO 3: N/D helper ────────────────────────────────────────────────────
function isBlank(v) {
    return v == null || v === '—' || v === '';
}
function applyNd(cell) {
    cell.value = 'N/D';
    cell.font = { color: { argb: 'FF9B9A97' }, italic: true, size: 10 };
}
function setCellText(cell, value) {
    if (isBlank(value)) {
        applyNd(cell);
    }
    else {
        cell.value = value;
    }
}
// ── Row stylers ───────────────────────────────────────────────────────────────
// CORREÇÃO 4: aceita fill para permitir cabeçalho #1E1E1E nas abas Vendas/Canais
function styleHeaderRow(row, colCount, fill = accentFill()) {
    row.height = 26;
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill = fill;
        cell.font = whiteFont(true, 10);
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center', wrapText: false };
        cell.border = thinBorder();
    }
}
// CORREÇÃO 2: idx % 2 === 0 → zebra (#F7F6F3), ímpar → branco
function styleDataRow(row, colCount, idx) {
    row.height = 22;
    const bg = idx % 2 === 0 ? zebraFill() : whiteFill();
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill = bg;
        cell.border = thinBorder();
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
        if (!cell.font?.color)
            cell.font = { size: 10 };
    }
}
function writeSectionTitle(ws, rowNum, text, lastCol) {
    ws.mergeCells(rowNum, 1, rowNum, lastCol);
    const cell = ws.getCell(rowNum, 1);
    cell.value = text;
    cell.fill = accentFill();
    cell.font = whiteFont(true, 13);
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 34;
}
function writePeriodRow(ws, rowNum, text, lastCol) {
    ws.mergeCells(rowNum, 1, rowNum, lastCol);
    const cell = ws.getCell(rowNum, 1);
    cell.value = text;
    cell.font = colorFont(C.textSecondary, false, 9);
    cell.alignment = { vertical: 'middle' };
    ws.getRow(rowNum).height = 18;
}
// ── CORREÇÃO 1: Auto-fit com +6 de respiro ────────────────────────────────────
function autoFitColumns(ws) {
    ws.columns.forEach(col => {
        let maxLen = 10;
        col.eachCell?.({ includeEmpty: false }, cell => {
            const v = String(cell.value ?? '');
            if (v.length > maxLen)
                maxLen = v.length;
        });
        col.width = Math.min(maxLen + 6, 60);
    });
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
        properties: { tabColor: { argb: 'FF1a1a2e' } },
    });
    const resumoCols = 2;
    // Row 1 — Título
    writeSectionTitle(wsResumo, 1, 'RELATÓRIO DE PERFORMANCE — NORTHIE', resumoCols);
    // Row 2 — Período
    writePeriodRow(wsResumo, 2, generatedStr, resumoCols);
    // Row 3 — Cabeçalhos
    const rHeaderRow = wsResumo.getRow(3);
    rHeaderRow.getCell(1).value = 'Métrica';
    rHeaderRow.getCell(2).value = 'Valor';
    styleHeaderRow(rHeaderRow, resumoCols);
    const changeNote = data.summary.revenue_change_pct !== null
        ? ` (${data.summary.revenue_change_pct >= 0 ? '+' : ''}${fmtNum(data.summary.revenue_change_pct)}% vs anterior)`
        : '';
    // CORREÇÃO 5: sem linhas vazias — a separação de seção é feita via border-top
    // O índice true indica que a linha inicia uma nova seção (recebe border-top)
    const kpis = [
        ['Faturamento Total (Receita Líquida)', fmtBrl(data.summary.revenue_net) + changeNote, undefined],
        ['Receita Bruta', fmtBrl(data.summary.revenue_gross), undefined],
        ['Margem Bruta (%)', `${fmtNum(data.summary.gross_margin_pct)}%`, undefined],
        ['Transações', data.summary.transactions.toLocaleString('pt-BR'), undefined],
        ['Ticket Médio (AOV)', fmtBrl(data.summary.aov), undefined],
        ['LTV Médio', fmtBrl(data.summary.ltv_avg), undefined],
        ['CAC Médio', data.cac_overall > 0 ? fmtBrl(data.cac_overall) : '—', undefined],
        ['ROAS Consolidado', data.summary.roas > 0 ? `${fmtNum(data.summary.roas)}x` : '—', undefined],
        ['Margem de Contribuição (%)', `${fmtNum(data.margin_contribution_pct)}%`, data.margin_contribution_pct < 0 ? 'low' : undefined],
        ['Margem de Contribuição (R$)', fmtBrl(data.margin_contribution_brl), data.margin_contribution_brl < 0 ? 'low' : undefined],
        // Nova seção — border-top no lugar da linha vazia
        ['Investimento em Ads', fmtBrl(data.summary.ad_spend), undefined, true],
        ['Novos Clientes no Período', data.summary.new_customers.toLocaleString('pt-BR'), undefined],
        ['Base Total de Clientes', data.summary.total_customers.toLocaleString('pt-BR'), undefined],
        ['Impressões', data.summary.impressions.toLocaleString('pt-BR'), undefined],
        ['Cliques', data.summary.clicks.toLocaleString('pt-BR'), undefined],
        ['CTR', `${fmtNum(data.summary.ctr)}%`, undefined],
        ['Taxa de Reembolso', `${fmtNum(data.summary.refund_rate)}%`, data.summary.refund_rate > 5 ? 'high' : undefined],
        ['Valor Reembolsado', fmtBrl(data.summary.refund_amount), undefined],
    ];
    let r = 4;
    for (const [label, value, flag, sectionStart] of kpis) {
        const rowIndex = r - 4; // 0-based para zebra
        const row = wsResumo.getRow(r);
        const cellA = wsResumo.getCell(r, 1);
        const cellB = wsResumo.getCell(r, 2);
        cellA.value = label;
        cellA.font = { bold: !!label, size: 10 };
        // CORREÇÃO 2: zebra no Resumo
        const bg = rowIndex % 2 === 0 ? zebraFill() : whiteFill();
        cellA.fill = bg;
        cellB.fill = bg;
        // CORREÇÃO 5: border-top de separação de seção
        cellA.border = sectionStart ? sectionTopBorder() : thinBorder();
        cellB.border = sectionStart ? sectionTopBorder() : thinBorder();
        cellB.alignment = { vertical: 'middle', horizontal: 'right' };
        // CORREÇÃO 3: célula sem valor vira N/D
        if (isBlank(value)) {
            applyNd(cellB);
        }
        else if (flag === 'high') {
            cellB.value = value;
            cellB.font = colorFont(C.danger, true, 10);
        }
        else if (flag === 'low') {
            cellB.value = value;
            cellB.font = colorFont(C.danger, false, 10);
        }
        else {
            cellB.value = value;
            cellB.font = { size: 10 };
        }
        row.height = 22;
        r++;
    }
    autoFitColumns(wsResumo);
    // ══════════════════════════════════════════════════════════════════════════
    // ABA 2 — Vendas
    // ══════════════════════════════════════════════════════════════════════════
    const wsVendas = workbook.addWorksheet('Vendas', {
        properties: { tabColor: { argb: 'FF22C55E' } },
    });
    const vendaCols = 6;
    writeSectionTitle(wsVendas, 1, 'DETALHAMENTO DE VENDAS', vendaCols);
    writePeriodRow(wsVendas, 2, generatedStr, vendaCols);
    const vendaHeaders = [
        'ID da Transação',
        'Cliente',
        'Canal de Aquisição',
        'Valor Líquido (R$)',
        'Data da Venda',
        'Status',
    ];
    const vHeaderRow = wsVendas.getRow(3);
    vendaHeaders.forEach((h, i) => { vHeaderRow.getCell(i + 1).value = h; });
    // CORREÇÃO 4: cabeçalho #1E1E1E para Vendas
    styleHeaderRow(vHeaderRow, vendaCols, darkFill());
    // Ordena por data DESC
    const sortedTx = [...data.transactions_detail].sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
    });
    sortedTx.forEach((t, idx) => {
        const rv = idx + 4;
        const dr = wsVendas.getRow(rv);
        const statusLabel = STATUS_LABELS[t.status] ?? t.status;
        const statusColor = { approved: C.success, refunded: C.danger }[t.status];
        const channel = translateChannel(t.customer_channel ?? t.platform ?? '');
        styleDataRow(dr, vendaCols, idx);
        // ID da Transação
        dr.getCell(1).value = t.id.slice(0, 8);
        dr.getCell(1).font = colorFont(C.dark, false, 10);
        // Cliente
        setCellText(dr.getCell(2), t.customer_email ?? null);
        // Canal
        setCellText(dr.getCell(3), channel || null);
        // Valor
        dr.getCell(4).value = fmtBrl(t.amount_net);
        dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
        // Data
        if (t.created_at) {
            dr.getCell(5).value = fmtDate(t.created_at);
            dr.getCell(5).font = colorFont(C.dark, false, 10);
        }
        else {
            applyNd(dr.getCell(5));
        }
        // Status
        dr.getCell(6).value = statusLabel;
        dr.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
        if (statusColor) {
            dr.getCell(6).font = colorFont(statusColor, true, 10);
        }
    });
    wsVendas.autoFilter = {
        from: { row: 3, column: 1 },
        to: { row: 3 + sortedTx.length, column: vendaCols },
    };
    autoFitColumns(wsVendas);
    // ══════════════════════════════════════════════════════════════════════════
    // ABA 3 — Canais
    // ══════════════════════════════════════════════════════════════════════════
    const wsCanais = workbook.addWorksheet('Canais', {
        properties: { tabColor: { argb: 'FF1A7FE8' } },
    });
    // CORREÇÃO 4: 6 colunas conforme spec
    const canalColCount = 6;
    writeSectionTitle(wsCanais, 1, 'PERFORMANCE POR CANAL DE AQUISIÇÃO', canalColCount);
    writePeriodRow(wsCanais, 2, generatedStr, canalColCount);
    const canalHeaders = [
        'Canal',
        'Investimento (R$)',
        'Receita Atribuída (R$)',
        'ROAS',
        'LTV Médio (R$)',
        'Novos Clientes',
    ];
    const cHeaderRow = wsCanais.getRow(3);
    canalHeaders.forEach((h, i) => { cHeaderRow.getCell(i + 1).value = h; });
    // CORREÇÃO 4: cabeçalho #1E1E1E para Canais
    styleHeaderRow(cHeaderRow, canalColCount, darkFill());
    const channels = data.channel_economics.filter(c => c.channel !== 'desconhecido');
    if (channels.length === 0) {
        // CORREÇÃO 4: mensagem de estado vazio
        wsCanais.mergeCells(4, 1, 4, canalColCount);
        const emptyCell = wsCanais.getCell(4, 1);
        emptyCell.value = 'Sem dados de mídia paga no período';
        emptyCell.font = colorFont(C.textSecondary, false, 10);
        emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
        emptyCell.fill = whiteFill();
        wsCanais.getRow(4).height = 32;
    }
    else {
        channels.forEach((ch, idx) => {
            const rv = idx + 4;
            const dr = wsCanais.getRow(rv);
            const roas = ch.total_spend > 0 ? ch.total_ltv / ch.total_spend : 0;
            styleDataRow(dr, canalColCount, idx);
            dr.getCell(1).value = translateChannel(ch.channel);
            dr.getCell(2).value = fmtBrl(ch.total_spend);
            dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
            dr.getCell(3).value = fmtBrl(ch.total_ltv);
            dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
            // ROAS: N/D se não há investimento
            if (ch.total_spend > 0) {
                dr.getCell(4).value = `${fmtNum(roas)}x`;
                dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
            }
            else {
                applyNd(dr.getCell(4));
            }
            dr.getCell(5).value = fmtBrl(ch.avg_ltv);
            dr.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
            dr.getCell(6).value = ch.new_customers;
            dr.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
        });
        wsCanais.autoFilter = {
            from: { row: 3, column: 1 },
            to: { row: 3 + channels.length, column: canalColCount },
        };
    }
    autoFitColumns(wsCanais);
    // ── Buffer ────────────────────────────────────────────────────────────────
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
}
//# sourceMappingURL=report-xlsx.js.map