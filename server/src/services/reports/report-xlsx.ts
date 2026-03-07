import { createRequire } from 'module';
import type { generateReportData } from './report-generator.js';
import type { ReportAIAnalysis } from './report-ai-analyst.js';
import type {
    Fill,
    Font,
    Border as ExcelBorder,
    Borders,
    Row,
    Worksheet,
    Workbook,
    Cell,
} from 'exceljs';

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Workbook: WorkbookClass } = require('exceljs') as { Workbook: new () => Workbook };

type ReportData = Awaited<ReturnType<typeof generateReportData>>;

// ── Brand colors ──────────────────────────────────────────────────────────────

const C = {
    accent:        '#1A1A2E',
    dark:          '#1E1E1E',
    white:         '#FFFFFF',
    success:       '#22C55E',
    danger:        '#EF4444',
    warning:       '#F59E0B',
    textSecondary: '#6B7280',
    zebraRow:      '#F7F6F3',
    blue:          '#3B82F6',
    purple:        '#8B5CF6',
    teal:          '#10B981',
    orange:        '#F97316',
} as const;

// ── Channel / status translations ─────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
    meta_ads:     'Meta Ads',
    google_ads:   'Google Ads',
    organico:     'Orgânico',
    email:        'Email',
    direto:       'Direto',
    afiliado:     'Afiliado',
    desconhecido: 'Outros',
    hotmart:      'Hotmart',
    stripe:       'Stripe',
    shopify:      'Shopify',
};

const STATUS_LABELS: Record<string, string> = {
    approved:   'Aprovado',
    refunded:   'Reembolsado',
    pending:    'Pendente',
    cancelled:  'Cancelado',
    chargeback: 'Chargeback',
};

function translateChannel(ch: string): string {
    return CHANNEL_LABELS[ch] ?? ch;
}

// ── Formatters (pt-BR) ────────────────────────────────────────────────────────

function fmtBrl(n: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function fmtNum(n: number, decimals = 2): string {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
}

function fmtDateLong(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric',
    });
}

function fmtDateIso(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

// ── Fill helpers ──────────────────────────────────────────────────────────────

function accentFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
}

function darkFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1E1E' } };
}

function zebraFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F6F3' } };
}

function whiteFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
}

function subheaderFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F7' } };
}

// ── Font helpers (all with Calibri) ───────────────────────────────────────────

function whiteFont(bold = true, size = 10): Partial<Font> {
    return { name: 'Calibri', color: { argb: 'FFFFFFFF' }, bold, size };
}

function colorFont(hex: string, bold = false, size = 10): Partial<Font> {
    return { name: 'Calibri', color: { argb: 'FF' + hex.replace('#', '') }, bold, size };
}

function darkFont(bold = false, size = 10): Partial<Font> {
    return { name: 'Calibri', color: { argb: 'FF1E1E1E' }, bold, size };
}

// ── Border helpers ────────────────────────────────────────────────────────────

function thinBorder(): Partial<Borders> {
    const side: Partial<ExcelBorder> = { style: 'thin', color: { argb: 'FFE5E5E5' } };
    return { top: side, bottom: side, left: side, right: side };
}

function sectionTopBorder(): Partial<Borders> {
    const top: Partial<ExcelBorder>    = { style: 'thin', color: { argb: 'FFE3E2E0' } };
    const normal: Partial<ExcelBorder> = { style: 'thin', color: { argb: 'FFE5E5E5' } };
    return { top, bottom: normal, left: normal, right: normal };
}

// ── Value helpers ─────────────────────────────────────────────────────────────

function isBlank(v: string | null | undefined): boolean {
    return v == null || v === '—' || v === '';
}

function applyNd(cell: Cell): void {
    cell.value = 'N/D';
    cell.font  = { name: 'Calibri', color: { argb: 'FF9B9A97' }, italic: true, size: 10 };
}

function setCellText(cell: Cell, value: string | null | undefined): void {
    if (isBlank(value)) {
        applyNd(cell);
    } else {
        cell.value = value!;
        if (!cell.font) cell.font = { name: 'Calibri', size: 10 };
    }
}

// ── Color alert helpers (text only, never background) ─────────────────────────

function roasColor(roas: number): string {
    if (roas <= 0) return C.textSecondary;
    if (roas < 1)  return C.danger;
    if (roas < 2)  return C.warning;
    return C.success;
}

function ltvCacColor(ratio: number | null): string {
    if (ratio === null || ratio <= 0) return C.textSecondary;
    if (ratio < 3) return C.danger;
    return C.success;
}

function cohortRetColor(pct: number | null): string {
    if (pct === null) return C.textSecondary;
    if (pct >= 70)   return C.success;
    if (pct >= 40)   return C.warning;
    return C.danger;
}

function churnColor(prob: number | null): string {
    if (prob === null) return C.textSecondary;
    if (prob > 60)    return C.danger;
    if (prob > 40)    return C.warning;
    return C.textSecondary;
}

// ── Row stylers ───────────────────────────────────────────────────────────────

function styleHeaderRow(row: Row, colCount: number, fill: Fill = darkFill()): void {
    row.height = 36;
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill      = fill;
        cell.font      = whiteFont(true, 10);
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center', wrapText: false };
        cell.border    = thinBorder();
        // Uppercase the text value if it's a string
        if (typeof cell.value === 'string') cell.value = cell.value.toUpperCase();
    }
}

function styleDataRow(row: Row, colCount: number, idx: number): void {
    row.height = 28;
    const bg = idx % 2 === 0 ? zebraFill() : whiteFill();
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill      = bg;
        cell.border    = thinBorder();
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
        if (!cell.font) cell.font = { name: 'Calibri', size: 10 };
    }
}

function writeSectionTitle(ws: Worksheet, rowNum: number, text: string, lastCol: number): void {
    ws.mergeCells(rowNum, 1, rowNum, lastCol);
    const cell = ws.getCell(rowNum, 1);
    cell.value     = `  ${text}`;
    cell.fill      = accentFill();
    cell.font      = whiteFont(true, 15);
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 52;
}

function writePeriodRow(ws: Worksheet, rowNum: number, text: string, lastCol: number): void {
    ws.mergeCells(rowNum, 1, rowNum, lastCol);
    const cell = ws.getCell(rowNum, 1);
    cell.value     = `  ${text}`;
    cell.fill      = subheaderFill();
    cell.font      = colorFont(C.textSecondary, false, 10);
    cell.alignment = { vertical: 'middle' };
    ws.getRow(rowNum).height = 24;
}

function writeTotalsRow(
    ws: Worksheet,
    rowNum: number,
    colCount: number,
    cells: { col: number; value: string | number }[],
): void {
    const row = ws.getRow(rowNum);
    row.height = 32;
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill      = accentFill();
        cell.font      = whiteFont(true, 10);
        cell.border    = thinBorder();
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
    }
    for (const { col, value } of cells) {
        row.getCell(col).value = value;
    }
}

function writeChartTitle(ws: Worksheet, rowNum: number, colStart: number, colEnd: number, text: string): void {
    ws.mergeCells(rowNum, colStart, rowNum, colEnd);
    const cell = ws.getCell(rowNum, colStart);
    cell.value     = text;
    cell.font      = { name: 'Calibri', color: { argb: 'FFF97316' }, bold: true, size: 12 };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 32;
}

// ── Column width setter (replaces autoFitColumns) ─────────────────────────────

function setColWidths(ws: Worksheet, widths: number[]): void {
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

// ── Worksheet defaults (gridlines off + freeze) ───────────────────────────────

function setWsDefaults(ws: Worksheet, freezeRow: number): void {
    ws.views = [{ state: 'frozen', ySplit: freezeRow, showGridLines: false }];
}

// ══════════════════════════════════════════════════════════════════════════════
// Main export
// ══════════════════════════════════════════════════════════════════════════════

export async function generateXlsx(
    data: ReportData,
    _ai?: ReportAIAnalysis,
): Promise<Buffer> {
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
    setColWidths(wsResumo, [44, 30]);

    const changeStr = data.summary.revenue_change_pct !== null
        ? `${data.summary.revenue_change_pct >= 0 ? '+' : ''}${fmtNum(data.summary.revenue_change_pct)}% vs período anterior`
        : 'sem comparativo';
    const changeColor = data.summary.revenue_change_pct !== null && data.summary.revenue_change_pct < 0
        ? C.danger : C.success;

    type KpiRow = [string, string, string | undefined, boolean?];
    const hs = data.health_score as { score: number; label: string };

    const kpis: KpiRow[] = [
        ['Faturamento Total (Receita Líquida)', fmtBrl(data.summary.revenue_net),             undefined],
        ['Variação vs Período Anterior',         changeStr,                                     changeColor],
        ['Receita Bruta',                        fmtBrl(data.summary.revenue_gross),            undefined],
        ['Margem Bruta (%)',                     `${fmtNum(data.summary.gross_margin_pct)}%`,   undefined],
        ['Transações',                           data.summary.transactions.toLocaleString('pt-BR'), undefined],
        ['Ticket Médio (AOV)',                   fmtBrl(data.summary.aov),                      undefined],
        ['LTV Médio (novos clientes)',           fmtBrl(data.summary.ltv_avg),                  undefined],
        ['CAC Médio',                            data.cac_overall > 0 ? fmtBrl(data.cac_overall) : '—', undefined],
        ['LTV / CAC',                            data.ltv_cac_overall !== null ? `${fmtNum(data.ltv_cac_overall)}x` : '—',
            data.ltv_cac_overall !== null ? ltvCacColor(data.ltv_cac_overall) : undefined],
        ['ROAS Consolidado',                     data.summary.roas > 0 ? `${fmtNum(data.summary.roas)}x` : '—',
            data.summary.roas > 0 ? roasColor(data.summary.roas) : undefined],
        ['Margem de Contribuição (%)',           `${fmtNum(data.margin_contribution_pct)}%`,
            data.margin_contribution_pct < 0 ? C.danger : undefined],
        ['Margem de Contribuição (R$)',          fmtBrl(data.margin_contribution_brl),
            data.margin_contribution_brl < 0 ? C.danger : undefined],
        ['Investimento em Ads',                  fmtBrl(data.summary.ad_spend),                 undefined, true],
        ['Novos Clientes no Período',            data.summary.new_customers.toLocaleString('pt-BR'), undefined],
        ['Base Total de Clientes',               data.summary.total_customers.toLocaleString('pt-BR'), undefined],
        ['Impressões',                           data.summary.impressions.toLocaleString('pt-BR'), undefined],
        ['Cliques',                              data.summary.clicks.toLocaleString('pt-BR'),   undefined],
        ['CTR',                                  `${fmtNum(data.summary.ctr)}%`,                undefined],
        ['Taxa de Reembolso',                    `${fmtNum(data.summary.refund_rate)}%`,
            data.summary.refund_rate > 5 ? C.danger : undefined],
        ['Valor Reembolsado',                    fmtBrl(data.summary.refund_amount),             undefined],
        ['MRR Projetado',                        fmtBrl(data.mrr_projected),                    undefined, true],
        ['ARR Projetado',                        fmtBrl(data.arr_projected),                    undefined],
        ['Payback Period',                       data.payback_months !== null ? `${fmtNum(data.payback_months, 1)} meses` : '—', undefined],
        ['Saúde do Negócio',                     `${hs.score}/100 — ${hs.label}`,               undefined, true],
    ];

    let r = 4;
    for (const [label, value, color, sectionStart] of kpis) {
        const rowIndex = r - 4;
        const cellA    = wsResumo.getCell(r, 1);
        const cellB    = wsResumo.getCell(r, 2);
        const bg       = rowIndex % 2 === 0 ? zebraFill() : whiteFill();

        cellA.value     = label;
        cellA.font      = { name: 'Calibri', bold: true, size: 10 };
        cellA.fill      = bg;
        cellA.border    = sectionStart ? sectionTopBorder() : thinBorder();
        cellA.alignment = { vertical: 'middle' };

        cellB.fill      = bg;
        cellB.border    = sectionStart ? sectionTopBorder() : thinBorder();
        cellB.alignment = { vertical: 'middle', horizontal: 'right' };

        if (isBlank(value)) {
            applyNd(cellB);
        } else if (color) {
            cellB.value = value;
            cellB.font  = colorFont(color, true, 10);
        } else {
            cellB.value = value;
            cellB.font  = { name: 'Calibri', size: 10 };
        }

        wsResumo.getRow(r).height = 28;
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
    setColWidths(wsVendas, [14, 30, 18, 28, 16, 14, 14]);

    const sortedTx = [...data.transactions_detail].sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
    });

    let totalVendas = 0;
    sortedTx.forEach((t, idx) => {
        const rv          = idx + 4;
        const dr          = wsVendas.getRow(rv);
        const statusLabel = STATUS_LABELS[t.status] ?? t.status;
        const channel     = translateChannel(t.customer_channel ?? t.platform ?? '');

        styleDataRow(dr, vendaCols, idx);

        dr.getCell(1).value     = t.id.slice(0, 8);
        dr.getCell(1).font      = { name: 'Calibri', color: { argb: 'FF9B9A97' }, size: 9 };

        setCellText(dr.getCell(2), t.customer_email ?? null);
        dr.getCell(2).font = darkFont(false, 10);

        setCellText(dr.getCell(3), channel || null);
        setCellText(dr.getCell(4), (t as unknown as { product_name?: string }).product_name || null);

        dr.getCell(5).value     = fmtBrl(t.amount_net);
        dr.getCell(5).font      = { name: 'Calibri', bold: t.status === 'approved', size: 10 };
        dr.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

        if (t.created_at) {
            dr.getCell(6).value = fmtDate(t.created_at);
            dr.getCell(6).font  = darkFont(false, 10);
        } else {
            applyNd(dr.getCell(6));
        }

        // Status with color
        const isApproved  = t.status === 'approved';
        const isRefunded  = t.status === 'refunded';
        dr.getCell(7).value     = statusLabel;
        dr.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
        if (isApproved)  dr.getCell(7).font = colorFont(C.success, true, 10);
        else if (isRefunded) dr.getCell(7).font = colorFont(C.danger, true, 10);
        else dr.getCell(7).font = darkFont(false, 10);

        if (t.status === 'approved') totalVendas += t.amount_net;
    });

    if (sortedTx.length > 0) {
        writeTotalsRow(wsVendas, sortedTx.length + 4, vendaCols, [
            { col: 1, value: `TOTAL (${sortedTx.filter(t => t.status === 'approved').length} aprovadas)` },
            { col: 5, value: fmtBrl(totalVendas) },
        ]);
    }

    wsVendas.autoFilter = {
        from: { row: 3, column: 1 },
        to:   { row: 3 + sortedTx.length, column: vendaCols },
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
    setColWidths(wsCanais, [20, 20, 22, 14, 16, 18, 14, 18]);

    const channels = [...data.channel_economics].sort((a, b) => {
        const roasA = a.total_spend > 0 ? a.total_ltv / a.total_spend : -1;
        const roasB = b.total_spend > 0 ? b.total_ltv / b.total_spend : -1;
        return roasB - roasA;
    });

    if (channels.length === 0) {
        wsCanais.mergeCells(4, 1, 4, canalColCount);
        const emptyCell     = wsCanais.getCell(4, 1);
        emptyCell.value     = 'Sem dados de canais no período';
        emptyCell.font      = colorFont(C.textSecondary, false, 10);
        emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
        emptyCell.fill      = whiteFill();
        wsCanais.getRow(4).height = 32;
    } else {
        let totalSpendCh = 0, totalRevCh = 0, totalCustCh = 0;

        channels.forEach((ch, idx) => {
            const rv   = idx + 4;
            const dr   = wsCanais.getRow(rv);
            const roas = ch.total_spend > 0 ? ch.total_ltv / ch.total_spend : 0;

            styleDataRow(dr, canalColCount, idx);

            dr.getCell(1).value = translateChannel(ch.channel);
            dr.getCell(1).font  = darkFont(true, 10);

            dr.getCell(2).value     = fmtBrl(ch.total_spend);
            dr.getCell(2).font      = darkFont(false, 10);
            dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };

            dr.getCell(3).value     = fmtBrl(ch.total_ltv);
            dr.getCell(3).font      = darkFont(false, 10);
            dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

            if (ch.total_spend > 0) {
                dr.getCell(4).value     = `${fmtNum(roas)}x`;
                dr.getCell(4).font      = colorFont(roasColor(roas), roas < 1, 10);
                dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
            } else {
                dr.getCell(4).value     = 'Orgânico';
                dr.getCell(4).font      = colorFont(C.teal, false, 10);
                dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
            }

            if (ch.cac > 0) {
                dr.getCell(5).value     = fmtBrl(ch.cac);
                dr.getCell(5).font      = darkFont(false, 10);
                dr.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
            } else {
                applyNd(dr.getCell(5));
            }

            dr.getCell(6).value     = fmtBrl(ch.avg_ltv);
            dr.getCell(6).font      = darkFont(false, 10);
            dr.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

            if (ch.ltv_cac_ratio !== null) {
                const ratio = ch.ltv_cac_ratio;
                dr.getCell(7).value     = `${fmtNum(ratio)}x`;
                dr.getCell(7).font      = colorFont(ltvCacColor(ratio), ratio < 3, 10);
                dr.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
            } else {
                applyNd(dr.getCell(7));
            }

            dr.getCell(8).value     = ch.new_customers;
            dr.getCell(8).font      = darkFont(false, 10);
            dr.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

            totalSpendCh += ch.total_spend;
            totalRevCh   += ch.total_ltv;
            totalCustCh  += ch.new_customers;
        });

        const totR      = channels.length + 4;
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
            to:   { row: 3 + channels.length, column: canalColCount },
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
    setColWidths(wsProdutos, [38, 20, 16, 18, 14]);

    if (data.top_products.length === 0) {
        wsProdutos.mergeCells(4, 1, 4, prodCols);
        const eCell     = wsProdutos.getCell(4, 1);
        eCell.value     = 'Sem dados de produtos no período (Hotmart/Shopify não conectados)';
        eCell.font      = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill      = whiteFill();
        wsProdutos.getRow(4).height = 32;
    } else {
        let totalRevProd = 0;

        data.top_products.forEach((p, idx) => {
            const rv          = idx + 4;
            const dr          = wsProdutos.getRow(rv);
            const ticketMedio = p.transactions > 0 ? p.revenue / p.transactions : 0;
            const refundAmt   = (data as unknown as { refunds_by_product?: Record<string, number> }).refunds_by_product?.[p.product_name] ?? 0;
            styleDataRow(dr, prodCols, idx);

            dr.getCell(1).value = p.product_name;
            dr.getCell(1).font  = { name: 'Calibri', bold: idx < 3, size: 10 };

            dr.getCell(2).value     = fmtBrl(p.revenue);
            dr.getCell(2).font      = refundAmt > 0 ? colorFont(C.warning, false, 10) : darkFont(false, 10);
            dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };

            dr.getCell(3).value     = p.transactions;
            dr.getCell(3).font      = darkFont(false, 10);
            dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

            dr.getCell(4).value     = fmtBrl(ticketMedio);
            dr.getCell(4).font      = darkFont(false, 10);
            dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

            dr.getCell(5).value     = `${p.pct_of_total}%`;
            dr.getCell(5).font      = darkFont(false, 10);
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
            to:   { row: 3 + data.top_products.length, column: prodCols },
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
    setColWidths(wsRisco, [8, 18, 20, 20, 18, 14, 34]);

    const atRisk = data.at_risk_customers;

    if (atRisk.length === 0) {
        wsRisco.mergeCells(4, 1, 4, riscoCols);
        const eCell     = wsRisco.getCell(4, 1);
        eCell.value     = 'Nenhum cliente com probabilidade de churn acima de 60%';
        eCell.font      = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill      = whiteFill();
        wsRisco.getRow(4).height = 32;
    } else {
        atRisk.forEach((c, idx) => {
            const rv = idx + 4;
            const dr = wsRisco.getRow(rv);
            styleDataRow(dr, riscoCols, idx);

            dr.getCell(1).value     = idx + 1;
            dr.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
            dr.getCell(1).font      = { name: 'Calibri', bold: true, size: 10 };

            dr.getCell(2).value     = fmtBrl(c.ltv ?? 0);
            dr.getCell(2).font      = darkFont(false, 10);
            dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };

            const prob      = c.churn_probability;
            const churnPct  = prob !== null ? `${fmtNum(prob)}%` : 'N/D';
            const cColor    = churnColor(prob);
            dr.getCell(3).value     = churnPct;
            dr.getCell(3).font      = colorFont(cColor, (prob ?? 0) > 60, 10);
            dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

            const days = c.days_since_purchase !== null ? `${c.days_since_purchase} dias` : 'N/D';
            dr.getCell(4).value     = days;
            dr.getCell(4).font      = c.days_since_purchase !== null && c.days_since_purchase > 90
                ? colorFont(C.danger, false, 10)
                : darkFont(false, 10);
            dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

            setCellText(dr.getCell(5), translateChannel(c.channel ?? 'desconhecido'));
            dr.getCell(5).font = darkFont(false, 10);

            if (c.rfm_score) {
                dr.getCell(6).value     = c.rfm_score;
                dr.getCell(6).font      = colorFont(C.textSecondary, false, 10);
                dr.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
            } else {
                applyNd(dr.getCell(6));
            }

            const email = (c as unknown as { email?: string | null }).email;
            setCellText(dr.getCell(7), email ?? null);
            if (!isBlank(email)) dr.getCell(7).font = darkFont(false, 10);
        });

        wsRisco.autoFilter = {
            from: { row: 3, column: 1 },
            to:   { row: 3 + atRisk.length, column: riscoCols },
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
    setColWidths(wsRfm, [36, 14, 14, 20, 20]);

    const RFM_COLORS: Record<string, string> = {
        champions: C.success,
        loyalists: C.blue,
        em_risco:  C.warning,
        perdidos:  C.danger,
        novos:     C.purple,
        outros:    C.textSecondary,
    };

    const RFM_LABELS: Record<string, string> = {
        champions: 'Champions — melhores clientes',
        loyalists: 'Leais — compram com frequência',
        em_risco:  'Em Risco — reduzindo atividade',
        perdidos:  'Perdidos — inativos há muito tempo',
        novos:     'Novos — primeira compra recente',
        outros:    'Outros',
    };

    const totalRfmClientes = data.rfm_distribution.reduce((s, r) => s + r.count, 0);
    const totalRfmLtv      = data.rfm_distribution.reduce((s, r) => s + r.ltv, 0);

    data.rfm_distribution.forEach((seg, idx) => {
        const rv     = idx + 4;
        const dr     = wsRfm.getRow(rv);
        const pct    = totalRfmClientes > 0
            ? `${fmtNum((seg.count / totalRfmClientes) * 100, 1)}%`
            : '—';
        const avgLtv = seg.count > 0 ? seg.ltv / seg.count : 0;

        styleDataRow(dr, rfmCols, idx);

        const segColor = RFM_COLORS[seg.segment] ?? C.textSecondary;
        dr.getCell(1).value = RFM_LABELS[seg.segment] ?? seg.segment;
        dr.getCell(1).font  = colorFont(segColor, true, 10);

        dr.getCell(2).value     = seg.count;
        dr.getCell(2).font      = darkFont(false, 10);
        dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };

        dr.getCell(3).value     = pct;
        dr.getCell(3).font      = darkFont(false, 10);
        dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

        dr.getCell(4).value     = fmtBrl(seg.ltv);
        dr.getCell(4).font      = darkFont(false, 10);
        dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

        dr.getCell(5).value     = seg.count > 0 ? fmtBrl(avgLtv) : '—';
        dr.getCell(5).font      = darkFont(false, 10);
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
    setColWidths(wsProj, [32, 22, 22, 22]);

    const { conservative: cons, moderate: mod, optimistic: opt } = data.projections;

    const projRows: Array<[string, string, string, string]> = [
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
        dr.getCell(1).font  = { name: 'Calibri', bold: true, size: 10 };

        dr.getCell(2).value     = c;
        dr.getCell(2).font      = colorFont('#2563EB', true, 10);
        dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };

        dr.getCell(3).value     = m;
        dr.getCell(3).font      = colorFont('#F97316', true, 10);
        dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

        dr.getCell(4).value     = o;
        dr.getCell(4).font      = colorFont(C.teal, true, 10);
        dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    });

    // Separator blank row
    const sepRow = projRows.length + 4;
    wsProj.mergeCells(sepRow, 1, sepRow, projCols);
    wsProj.getRow(sepRow).height = 12;

    // General metrics section
    const generalMetrics: Array<[string, string]> = [
        ['MRR Projetado',          fmtBrl(data.mrr_projected)],
        ['ARR Projetado',          fmtBrl(data.arr_projected)],
        ['Payback Period',         data.payback_months !== null ? `${fmtNum(data.payback_months, 1)} meses` : '—'],
        ['LTV / CAC Geral',        data.ltv_cac_overall !== null ? `${fmtNum(data.ltv_cac_overall, 2)}x` : '—'],
        ['Margem de Contribuição', `${fmtNum(data.margin_contribution_pct)}% (${fmtBrl(data.margin_contribution_brl)})`],
    ];

    generalMetrics.forEach(([label, val], idx) => {
        const rv = sepRow + 1 + idx;
        const dr = wsProj.getRow(rv);
        const bg = idx % 2 === 0 ? zebraFill() : whiteFill();

        dr.height = 28;
        dr.getCell(1).value     = label;
        dr.getCell(1).font      = { name: 'Calibri', bold: true, size: 10 };
        dr.getCell(1).fill      = bg;
        dr.getCell(1).border    = thinBorder();
        dr.getCell(1).alignment = { vertical: 'middle' };

        wsProj.mergeCells(rv, 2, rv, projCols);
        dr.getCell(2).value     = val;
        dr.getCell(2).font      = { name: 'Calibri', size: 10 };
        dr.getCell(2).fill      = bg;
        dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
        dr.getCell(2).border    = thinBorder();
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
    setColWidths(wsPerf, [16, 20, 16, 20, 24]);

    const dailyRevenue = (data as unknown as {
        daily_revenue?: { date: string; revenue: number; transactions: number; aov: number; change_pct: number | null }[];
    }).daily_revenue ?? [];

    if (dailyRevenue.length === 0) {
        wsPerf.mergeCells(4, 1, 4, perfCols);
        const eCell     = wsPerf.getCell(4, 1);
        eCell.value     = 'Sem transações no período selecionado';
        eCell.font      = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill      = whiteFill();
        wsPerf.getRow(4).height = 32;
    } else {
        let totalPerfRev = 0, totalPerfTx = 0;

        dailyRevenue.forEach((day, idx) => {
            const rv = idx + 4;
            const dr = wsPerf.getRow(rv);
            styleDataRow(dr, perfCols, idx);

            dr.getCell(1).value     = fmtDateIso(day.date);
            dr.getCell(1).font      = darkFont(false, 10);
            dr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

            dr.getCell(2).value     = fmtBrl(day.revenue);
            dr.getCell(2).font      = darkFont(false, 10);
            dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };

            dr.getCell(3).value     = day.transactions;
            dr.getCell(3).font      = darkFont(false, 10);
            dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

            dr.getCell(4).value     = fmtBrl(day.aov);
            dr.getCell(4).font      = darkFont(false, 10);
            dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

            if (day.change_pct !== null) {
                const sign  = day.change_pct >= 0 ? '+' : '';
                const color = day.change_pct >= 0 ? C.success : C.danger;
                dr.getCell(5).value     = `${sign}${fmtNum(day.change_pct)}%`;
                dr.getCell(5).font      = colorFont(color, day.change_pct < -20, 10);
                dr.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
            } else {
                dr.getCell(5).value     = '—';
                dr.getCell(5).font      = colorFont(C.textSecondary, false, 10);
                dr.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
            }

            totalPerfRev += day.revenue;
            totalPerfTx  += day.transactions;
        });

        writeTotalsRow(wsPerf, dailyRevenue.length + 4, perfCols, [
            { col: 1, value: `TOTAL (${dailyRevenue.length} dias)` },
            { col: 2, value: fmtBrl(totalPerfRev) },
            { col: 3, value: totalPerfTx },
            { col: 4, value: totalPerfTx > 0 ? fmtBrl(totalPerfRev / totalPerfTx) : '—' },
        ]);

        wsPerf.autoFilter = {
            from: { row: 3, column: 1 },
            to:   { row: 3 + dailyRevenue.length, column: perfCols },
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
    setColWidths(wsMensal, [14, 24, 18, 30]);

    if (data.revenue_trend.length === 0) {
        wsMensal.mergeCells(4, 1, 4, mensalCols);
        const eCell     = wsMensal.getCell(4, 1);
        eCell.value     = 'Dados históricos insuficientes (menos de 1 mês de transações)';
        eCell.font      = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill      = whiteFill();
        wsMensal.getRow(4).height = 32;
    } else {
        let peakRev = 0, peakMonth = '';

        data.revenue_trend.forEach((t, idx) => {
            const rv = idx + 4;
            const dr = wsMensal.getRow(rv);
            styleDataRow(dr, mensalCols, idx);

            dr.getCell(1).value     = t.month;
            dr.getCell(1).font      = { name: 'Calibri', bold: true, size: 10 };
            dr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

            dr.getCell(2).value     = fmtBrl(t.revenue);
            dr.getCell(2).font      = darkFont(false, 10);
            dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
            if (t.revenue > peakRev) { peakRev = t.revenue; peakMonth = t.month; }

            if (t.change_pct !== null) {
                const sign  = t.change_pct >= 0 ? '+' : '';
                const color = t.change_pct >= 0 ? C.success : C.danger;
                dr.getCell(3).value     = `${sign}${fmtNum(t.change_pct)}%`;
                dr.getCell(3).font      = colorFont(color, Math.abs(t.change_pct) > 20, 10);
                dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

                const trend = t.change_pct >= 10 ? '▲▲ Forte crescimento'
                    : t.change_pct >= 0    ? '▲ Crescimento'
                    : t.change_pct >= -10  ? '▼ Queda leve'
                    : '▼▼ Queda acentuada';
                dr.getCell(4).value     = trend;
                dr.getCell(4).font      = colorFont(t.change_pct >= 0 ? C.success : C.danger, false, 10);
                dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };
            } else {
                dr.getCell(3).value     = '— (primeiro mês)';
                dr.getCell(3).font      = colorFont(C.textSecondary, false, 10);
                dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
                dr.getCell(4).value     = '—';
                dr.getCell(4).font      = colorFont(C.textSecondary, false, 10);
            }
        });

        if (peakMonth) {
            const noteR = data.revenue_trend.length + 4;
            wsMensal.mergeCells(noteR, 1, noteR, mensalCols);
            const noteCell     = wsMensal.getCell(noteR, 1);
            noteCell.value     = `Melhor mês no período: ${peakMonth} — ${fmtBrl(peakRev)}`;
            noteCell.font      = colorFont(C.teal, true, 10);
            noteCell.fill      = whiteFill();
            noteCell.border    = thinBorder();
            noteCell.alignment = { vertical: 'middle', horizontal: 'center' };
            wsMensal.getRow(noteR).height = 28;
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
    const methodNote     = wsCohort.getCell(3, 1);
    methodNote.value     = '  Retenção estimada: % de clientes do cohort que realizaram compra em cada mês subsequente (baseado em last_purchase_at)';
    methodNote.font      = colorFont(C.textSecondary, false, 9);
    methodNote.fill      = subheaderFill();
    methodNote.alignment = { vertical: 'middle' };
    wsCohort.getRow(3).height = 20;

    // Header row is row 4 (linha extra de nota em 3)
    const cohortHeaderRow = wsCohort.getRow(4);
    ['Cohort (Mês)', 'Clientes', 'M0 (Aquisição)', 'M1', 'M2', 'M3', 'M4', 'M5'].forEach((h, i) => {
        cohortHeaderRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(cohortHeaderRow, cohortCols, darkFill());

    // Freeze at row 4 (freeze after row 4, dados a partir da 5)
    setWsDefaults(wsCohort, 4);
    setColWidths(wsCohort, [18, 12, 18, 12, 12, 12, 12, 12]);

    const cohortRetention = (data as unknown as {
        cohort_retention?: { cohort: string; total: number; m0: number; m1: number | null; m2: number | null; m3: number | null; m4: number | null; m5: number | null }[];
    }).cohort_retention ?? [];

    if (cohortRetention.length === 0) {
        wsCohort.mergeCells(5, 1, 5, cohortCols);
        const eCell     = wsCohort.getCell(5, 1);
        eCell.value     = 'Sem dados de cohort — clientes insuficientes ou histórico menor que 2 meses';
        eCell.font      = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill      = whiteFill();
        wsCohort.getRow(5).height = 32;
    } else {
        cohortRetention.forEach((row, idx) => {
            const rv = idx + 5;
            const dr = wsCohort.getRow(rv);
            styleDataRow(dr, cohortCols, idx);

            dr.getCell(1).value     = row.cohort;
            dr.getCell(1).font      = { name: 'Calibri', bold: true, size: 10 };
            dr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

            dr.getCell(2).value     = row.total;
            dr.getCell(2).font      = darkFont(false, 10);
            dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };

            dr.getCell(3).value     = '100%';
            dr.getCell(3).font      = colorFont(C.success, true, 10);
            dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

            const mVals: Array<number | null> = [row.m1, row.m2, row.m3, row.m4, row.m5];
            mVals.forEach((pct, mi) => {
                const cell     = dr.getCell(mi + 4);
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
                if (pct === null) {
                    cell.value = '—';
                    cell.font  = colorFont(C.textSecondary, false, 9);
                } else {
                    cell.value = `${pct}%`;
                    cell.font  = colorFont(cohortRetColor(pct), pct < 40, 10);
                }
            });
        });

        const legendR = cohortRetention.length + 5;
        wsCohort.mergeCells(legendR, 1, legendR, cohortCols);
        const legendCell     = wsCohort.getCell(legendR, 1);
        legendCell.value     = 'Legenda: Verde ≥ 70%  |  Amarelo 40–69%  |  Vermelho < 40%  |  — dado ainda não disponível (cohort recente)';
        legendCell.font      = colorFont(C.textSecondary, false, 9);
        legendCell.fill      = subheaderFill();
        legendCell.border    = thinBorder();
        legendCell.alignment = { vertical: 'middle', horizontal: 'left' };
        wsCohort.getRow(legendR).height = 20;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ABA 11 — Gráficos (dados estruturados para visualização)
    // ══════════════════════════════════════════════════════════════════════════

    const wsGraf = workbook.addWorksheet('Gráficos', {
        properties: { tabColor: { argb: 'FFF97316' } },
    });

    const grafCols = 6;
    writeSectionTitle(wsGraf, 1, 'GRÁFICOS DE PERFORMANCE', grafCols);
    writePeriodRow(wsGraf, 2, generatedStr, grafCols);

    wsGraf.views = [{ showGridLines: false }];
    setColWidths(wsGraf, [4, 22, 22, 18, 18, 18]);

    // ── GRÁFICO 1 — Receita por Mês ──────────────────────────────────────────
    // Título em B5, dados a partir de B6
    writeChartTitle(wsGraf, 5, 2, 5, 'GRÁFICO 1 — Receita por Mês (R$)');

    const g1HRow = wsGraf.getRow(6);
    ['MÊS', 'RECEITA LÍQUIDA (R$)', 'VARIAÇÃO %', 'TENDÊNCIA'].forEach((h, i) => {
        const cell     = g1HRow.getCell(i + 2);
        cell.value     = h;
        cell.fill      = darkFill();
        cell.font      = whiteFont(true, 10);
        cell.border    = thinBorder();
        cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
    });
    g1HRow.height = 36;

    const trendData = data.revenue_trend;
    if (trendData.length === 0) {
        wsGraf.mergeCells(7, 2, 7, 5);
        const noData     = wsGraf.getCell(7, 2);
        noData.value     = 'Dados insuficientes — menos de 1 mês de histórico';
        noData.font      = colorFont(C.textSecondary, false, 10);
        noData.alignment = { vertical: 'middle', horizontal: 'center' };
        noData.fill      = whiteFill();
        wsGraf.getRow(7).height = 28;
    } else {
        trendData.forEach((t, idx) => {
            const rv  = idx + 7;
            const bg  = idx % 2 === 0 ? zebraFill() : whiteFill();
            const dr  = wsGraf.getRow(rv);
            dr.height = 28;

            const cells = [
                { col: 2, val: t.month, align: 'left' as const, font: darkFont(true, 10) },
                { col: 3, val: fmtBrl(t.revenue), align: 'right' as const, font: darkFont(false, 10) },
                { col: 4, val: t.change_pct !== null ? `${t.change_pct >= 0 ? '+' : ''}${fmtNum(t.change_pct)}%` : '—',
                    align: 'right' as const,
                    font: t.change_pct !== null
                        ? colorFont(t.change_pct >= 0 ? C.success : C.danger, Math.abs(t.change_pct ?? 0) > 20, 10)
                        : colorFont(C.textSecondary, false, 10) },
                { col: 5, val: t.change_pct === null ? '—'
                    : t.change_pct >= 10 ? '▲▲ Forte crescimento'
                    : t.change_pct >= 0  ? '▲ Crescimento'
                    : t.change_pct >= -10 ? '▼ Queda leve'
                    : '▼▼ Queda acentuada',
                    align: 'left' as const,
                    font: t.change_pct !== null
                        ? colorFont(t.change_pct >= 0 ? C.success : C.danger, false, 10)
                        : colorFont(C.textSecondary, false, 10) },
            ];

            cells.forEach(({ col, val, align, font }) => {
                const cell     = dr.getCell(col);
                cell.value     = val;
                cell.fill      = bg;
                cell.font      = font;
                cell.border    = thinBorder();
                cell.alignment = { vertical: 'middle', horizontal: align };
            });
        });
    }

    // ── GRÁFICO 2 — Segmentação RFM ──────────────────────────────────────────
    // Título em B28, dados a partir de B29
    writeChartTitle(wsGraf, 28, 2, 5, 'GRÁFICO 2 — Segmentação RFM — Clientes por Segmento');

    const g2HRow = wsGraf.getRow(29);
    ['SEGMENTO', 'CLIENTES', '% DA BASE', 'LTV MÉDIO (R$)'].forEach((h, i) => {
        const cell     = g2HRow.getCell(i + 2);
        cell.value     = h;
        cell.fill      = darkFill();
        cell.font      = whiteFont(true, 10);
        cell.border    = thinBorder();
        cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
    });
    g2HRow.height = 36;

    const rfmDataForChart = data.rfm_distribution.filter(s => s.count > 0);
    rfmDataForChart.forEach((seg, idx) => {
        const rv     = idx + 30;
        const bg     = idx % 2 === 0 ? zebraFill() : whiteFill();
        const dr     = wsGraf.getRow(rv);
        dr.height    = 28;
        const segColor = RFM_COLORS[seg.segment] ?? C.textSecondary;
        const pct    = totalRfmClientes > 0 ? `${fmtNum((seg.count / totalRfmClientes) * 100, 1)}%` : '—';
        const avgLtv = seg.count > 0 ? seg.ltv / seg.count : 0;

        const g2Cells = [
            { col: 2, val: RFM_LABELS[seg.segment] ?? seg.segment, align: 'left' as const, font: colorFont(segColor, true, 10) },
            { col: 3, val: seg.count,    align: 'right' as const, font: darkFont(false, 10) },
            { col: 4, val: pct,          align: 'right' as const, font: darkFont(false, 10) },
            { col: 5, val: fmtBrl(avgLtv), align: 'right' as const, font: darkFont(false, 10) },
        ];

        g2Cells.forEach(({ col, val, align, font }) => {
            const cell     = dr.getCell(col);
            cell.value     = val;
            cell.fill      = bg;
            cell.font      = font;
            cell.border    = thinBorder();
            cell.alignment = { vertical: 'middle', horizontal: align };
        });
    });

    // ── GRÁFICO 3 — Projeções 3 Cenários ─────────────────────────────────────
    // Título em B52, dados a partir de B53
    writeChartTitle(wsGraf, 52, 2, 6, 'GRÁFICO 3 — Projeções de Receita — 3 Cenários');

    const g3HRow = wsGraf.getRow(53);
    ['MÉTRICA', 'CONSERVADOR', 'MODERADO', 'OTIMISTA'].forEach((h, i) => {
        const cell     = g3HRow.getCell(i + 2);
        cell.value     = h;
        cell.fill      = darkFill();
        cell.font      = whiteFont(true, 10);
        cell.border    = thinBorder();
        cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
    });
    g3HRow.height = 36;

    const projDataForChart: Array<[string, string, string, string]> = [
        ['Mês 1', fmtBrl(cons.month1), fmtBrl(mod.month1), fmtBrl(opt.month1)],
        ['Mês 2', fmtBrl(cons.month2), fmtBrl(mod.month2), fmtBrl(opt.month2)],
        ['Mês 3', fmtBrl(cons.month3), fmtBrl(mod.month3), fmtBrl(opt.month3)],
        ['Taxa/mês', `${fmtNum(cons.rate_pct)}%`, `${fmtNum(mod.rate_pct)}%`, `${fmtNum(opt.rate_pct)}%`],
    ];

    projDataForChart.forEach(([label, c, m, o], idx) => {
        const rv  = idx + 54;
        const bg  = idx % 2 === 0 ? zebraFill() : whiteFill();
        const dr  = wsGraf.getRow(rv);
        dr.height = 28;

        [
            { col: 2, val: label, font: darkFont(true, 10) },
            { col: 3, val: c,     font: colorFont('#2563EB', true, 10) },
            { col: 4, val: m,     font: colorFont('#F97316', true, 10) },
            { col: 5, val: o,     font: colorFont(C.teal, true, 10) },
        ].forEach(({ col, val, font }) => {
            const cell     = dr.getCell(col);
            cell.value     = val;
            cell.fill      = bg;
            cell.font      = font;
            cell.border    = thinBorder();
            cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'right' };
        });
    });

    // Legenda dos cenários
    const legR = 58;
    wsGraf.mergeCells(legR, 2, legR, 5);
    const legCell     = wsGraf.getCell(legR, 2);
    legCell.value     = 'Conservador = azul  |  Moderado = laranja  |  Otimista = verde';
    legCell.font      = colorFont(C.textSecondary, false, 9);
    legCell.fill      = subheaderFill();
    legCell.border    = thinBorder();
    legCell.alignment = { vertical: 'middle', horizontal: 'center' };
    wsGraf.getRow(legR).height = 20;

    // ── Buffer ────────────────────────────────────────────────────────────────

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
}
