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

// ── Layout constant: todas as abas até coluna H ───────────────────────────────
const HC = 8; // última coluna = H

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

function darkBlueFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
}

function greenAccentFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22C55E' } };
}

function zebraFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F6F3' } };
}

function whiteFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
}

function subheaderFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F1EF' } };
}

function dividerFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEECEA' } };
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

function bottomBorder(): Partial<Borders> {
    return { bottom: { style: 'thin', color: { argb: 'FFE8E6E0' } } };
}

function headerBorder(): Partial<Borders> {
    // Dark sides + verde na base (destaque)
    const dark:  Partial<ExcelBorder> = { style: 'thin',   color: { argb: 'FF1E1E1E' } };
    const green: Partial<ExcelBorder> = { style: 'medium', color: { argb: 'FF22C55E' } };
    return { top: dark, bottom: green, left: dark, right: dark };
}

function totalsTopBorder(): Partial<Borders> {
    const green: Partial<ExcelBorder> = { style: 'medium', color: { argb: 'FF22C55E' } };
    const thin:  Partial<ExcelBorder> = { style: 'thin',   color: { argb: 'FFE5E5E5' } };
    return { top: green, bottom: thin, left: thin, right: thin };
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

// ── Color alert helpers ────────────────────────────────────────────────────────

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

function styleHeaderRow(row: Row, colCount: number): void {
    row.height = 38;
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill      = darkFill();
        cell.font      = whiteFont(true, 10);
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center', wrapText: false };
        cell.border    = headerBorder();
        if (typeof cell.value === 'string') cell.value = cell.value.toUpperCase();
    }
}

function styleDataRow(row: Row, colCount: number, idx: number): void {
    row.height = 30;
    const bg = idx % 2 === 0 ? zebraFill() : whiteFill();
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill      = bg;
        cell.border    = bottomBorder();
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
        if (!cell.font) cell.font = { name: 'Calibri', size: 10 };
    }
}

// ── Row writers ───────────────────────────────────────────────────────────────

function writeSectionTitle(ws: Worksheet, rowNum: number, text: string): void {
    ws.mergeCells(rowNum, 1, rowNum, HC);
    const cell = ws.getCell(rowNum, 1);
    cell.value     = `   ${text}`;
    cell.fill      = accentFill();
    cell.font      = whiteFont(true, 15);
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 56;
}

function writePeriodRow(ws: Worksheet, rowNum: number, text: string): void {
    ws.mergeCells(rowNum, 1, rowNum, HC);
    const cell = ws.getCell(rowNum, 1);
    cell.value     = `   ${text}`;
    cell.fill      = subheaderFill();
    cell.font      = { name: 'Calibri', color: { argb: 'FF6B7280' }, italic: true, size: 10 };
    cell.alignment = { vertical: 'middle' };
    ws.getRow(rowNum).height = 26;
}

function writeSectionDivider(ws: Worksheet, rowNum: number, label: string): void {
    ws.mergeCells(rowNum, 1, rowNum, HC);
    const cell = ws.getCell(rowNum, 1);
    cell.value     = `  ▸  ${label}`;
    cell.fill      = dividerFill();
    cell.font      = { name: 'Calibri', color: { argb: 'FF22C55E' }, bold: true, size: 9 };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 26;
}

function writeOrangeAccentRow(ws: Worksheet, rowNum: number): void {
    // Linha laranja fina (4px) após o cabeçalho de tabela
    for (let c = 1; c <= HC; c++) {
        ws.getCell(rowNum, c).fill = greenAccentFill();
    }
    ws.getRow(rowNum).height = 4;
}

function writeTotalsRow(
    ws: Worksheet,
    rowNum: number,
    colCount: number,
    cells: { col: number; value: string | number }[],
): void {
    const row = ws.getRow(rowNum);
    row.height = 34;
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill      = darkBlueFill();
        cell.font      = whiteFont(true, 10);
        cell.border    = totalsTopBorder();
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
    cell.font      = { name: 'Calibri', color: { argb: 'FF22C55E' }, bold: true, size: 12 };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 32;
}

// ── Outer border (caixa ao redor da tabela de dados) ─────────────────────────

function applyOuterBorder(
    ws: Worksheet,
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number,
): void {
    const side: Partial<ExcelBorder> = { style: 'thin', color: { argb: 'FFDEDBD5' } };
    for (let c = startCol; c <= endCol; c++) {
        const top = ws.getCell(startRow, c);
        const bot = ws.getCell(endRow, c);
        top.border = { ...(top.border ?? {}), top: side };
        bot.border = { ...(bot.border ?? {}), bottom: side };
    }
    for (let r = startRow; r <= endRow; r++) {
        const lft = ws.getCell(r, startCol);
        const rgt = ws.getCell(r, endCol);
        lft.border = { ...(lft.border ?? {}), left: side };
        rgt.border = { ...(rgt.border ?? {}), right: side };
    }
}

// ── Column width setter ───────────────────────────────────────────────────────

function setColWidths(ws: Worksheet, widths: number[]): void {
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

// ── Worksheet defaults (gridlines off + freeze) ───────────────────────────────

function setWsDefaults(ws: Worksheet, ySplit: number): void {
    ws.views = [{ state: 'frozen', ySplit, showGridLines: false }];
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

    // Estrutura padrão por aba:
    //   Row 1  — Título (A1:H1), height 56
    //   Row 2  — Subtítulo (A2:H2), height 26
    //   Row 3  — Cabeçalho de tabela, height 38, borda bottom laranja medium
    //   Row 4  — Linha laranja de destaque (4px)
    //   Row 5+ — Dados, height 30
    //   Último — Totais, height 34, borda top laranja medium

    // ══════════════════════════════════════════════════════════════════════════
    // ABA 1 — Resumo
    // ══════════════════════════════════════════════════════════════════════════

    const wsResumo = workbook.addWorksheet('Resumo', {
        properties: { tabColor: { argb: 'FF1A1A2E' } },
    });

    // Widths: A=44, B=38, C-H=14 cada
    setColWidths(wsResumo, [44, 38, 14, 14, 14, 14, 14, 14]);
    setWsDefaults(wsResumo, 4);

    writeSectionTitle(wsResumo, 1, 'RELATÓRIO DE PERFORMANCE — NORTHIE');
    writePeriodRow(wsResumo, 2, generatedStr);

    // Cabeçalho de tabela (row 3): A = MÉTRICA, B:H merged = VALOR
    {
        const hdr = wsResumo.getRow(3);
        hdr.height = 38;

        const cellA = hdr.getCell(1);
        cellA.value     = 'MÉTRICA';
        cellA.fill      = darkFill();
        cellA.font      = whiteFont(true, 10);
        cellA.alignment = { vertical: 'middle', horizontal: 'left' };
        cellA.border    = headerBorder();

        wsResumo.mergeCells(3, 2, 3, HC);
        const cellB = hdr.getCell(2);
        cellB.value     = 'VALOR';
        cellB.fill      = darkFill();
        cellB.font      = whiteFont(true, 10);
        cellB.alignment = { vertical: 'middle', horizontal: 'center' };
        cellB.border    = headerBorder();
    }

    // Linha laranja de destaque (row 4)
    writeOrangeAccentRow(wsResumo, 4);

    const changeStr = data.summary.revenue_change_pct !== null
        ? `${data.summary.revenue_change_pct >= 0 ? '+' : ''}${fmtNum(data.summary.revenue_change_pct)}% vs período anterior`
        : 'sem comparativo';
    const changeColor = data.summary.revenue_change_pct !== null && data.summary.revenue_change_pct < 0
        ? C.danger : C.success;

    const hs = data.health_score as { score: number; label: string };

    type KpiItem =
        | { kind: 'divider'; label: string }
        | { kind: 'kpi'; label: string; value: string; color?: string | undefined };

    const resumoItems: KpiItem[] = [
        { kind: 'divider', label: 'FINANCEIRO' },
        { kind: 'kpi', label: 'Faturamento Total (Receita Líquida)', value: fmtBrl(data.summary.revenue_net) },
        { kind: 'kpi', label: 'Variação vs Período Anterior',         value: changeStr, color: changeColor },
        { kind: 'kpi', label: 'Receita Bruta',                        value: fmtBrl(data.summary.revenue_gross) },
        { kind: 'kpi', label: 'Margem Bruta (%)',                     value: `${fmtNum(data.summary.gross_margin_pct)}%` },
        { kind: 'kpi', label: 'Transações',                           value: data.summary.transactions.toLocaleString('pt-BR') },
        { kind: 'kpi', label: 'Ticket Médio (AOV)',                   value: fmtBrl(data.summary.aov) },
        { kind: 'divider', label: 'CLIENTES & UNIT ECONOMICS' },
        { kind: 'kpi', label: 'LTV Médio (novos clientes)',           value: fmtBrl(data.summary.ltv_avg) },
        { kind: 'kpi', label: 'CAC Médio',                            value: data.cac_overall > 0 ? fmtBrl(data.cac_overall) : '—' },
        { kind: 'kpi', label: 'LTV / CAC',
            value: data.ltv_cac_overall !== null ? `${fmtNum(data.ltv_cac_overall)}x` : '—',
            color: data.ltv_cac_overall !== null ? ltvCacColor(data.ltv_cac_overall) : undefined },
        { kind: 'kpi', label: 'ROAS Consolidado',
            value: data.summary.roas > 0 ? `${fmtNum(data.summary.roas)}x` : '—',
            color: data.summary.roas > 0 ? roasColor(data.summary.roas) : undefined },
        { kind: 'kpi', label: 'Margem de Contribuição (%)',
            value: `${fmtNum(data.margin_contribution_pct)}%`,
            color: data.margin_contribution_pct < 0 ? C.danger : undefined },
        { kind: 'kpi', label: 'Margem de Contribuição (R$)',
            value: fmtBrl(data.margin_contribution_brl),
            color: data.margin_contribution_brl < 0 ? C.danger : undefined },
        { kind: 'kpi', label: 'Investimento em Ads',                  value: fmtBrl(data.summary.ad_spend) },
        { kind: 'kpi', label: 'Novos Clientes no Período',            value: data.summary.new_customers.toLocaleString('pt-BR') },
        { kind: 'kpi', label: 'Base Total de Clientes',               value: data.summary.total_customers.toLocaleString('pt-BR') },
        { kind: 'divider', label: 'TRÁFEGO' },
        { kind: 'kpi', label: 'Impressões',                           value: data.summary.impressions.toLocaleString('pt-BR') },
        { kind: 'kpi', label: 'Cliques',                              value: data.summary.clicks.toLocaleString('pt-BR') },
        { kind: 'kpi', label: 'CTR',                                  value: `${fmtNum(data.summary.ctr)}%` },
        { kind: 'divider', label: 'REEMBOLSOS' },
        { kind: 'kpi', label: 'Taxa de Reembolso',
            value: `${fmtNum(data.summary.refund_rate)}%`,
            color: data.summary.refund_rate > 5 ? C.danger : undefined },
        { kind: 'kpi', label: 'Valor Reembolsado',                    value: fmtBrl(data.summary.refund_amount) },
        { kind: 'divider', label: 'PROJEÇÕES & SAÚDE' },
        { kind: 'kpi', label: 'MRR Projetado',                        value: fmtBrl(data.mrr_projected) },
        { kind: 'kpi', label: 'ARR Projetado',                        value: fmtBrl(data.arr_projected) },
        { kind: 'kpi', label: 'Payback Period',
            value: data.payback_months !== null ? `${fmtNum(data.payback_months, 1)} meses` : '—' },
        { kind: 'kpi', label: 'Saúde do Negócio',                     value: `${hs.score}/100 — ${hs.label}` },
    ];

    let r = 5; // dados começam em row 5 (title=1, subtitle=2, header=3, orange=4)
    let kpiIdx = 0;
    for (const item of resumoItems) {
        if (item.kind === 'divider') {
            writeSectionDivider(wsResumo, r, item.label);
        } else {
            const bg = kpiIdx % 2 === 0 ? zebraFill() : whiteFill();
            wsResumo.getRow(r).height = 30;

            // Col A — label
            const cellA = wsResumo.getCell(r, 1);
            cellA.value     = item.label;
            cellA.font      = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF1E1E1E' } };
            cellA.fill      = bg;
            cellA.border    = bottomBorder();
            cellA.alignment = { vertical: 'middle', horizontal: 'left' };

            // Cols B:H merged — valor
            wsResumo.mergeCells(r, 2, r, HC);
            const cellB = wsResumo.getCell(r, 2);
            cellB.fill      = bg;
            cellB.border    = bottomBorder();
            cellB.alignment = { vertical: 'middle', horizontal: 'right' };

            if (isBlank(item.value)) {
                applyNd(cellB);
            } else if (item.color) {
                cellB.value = item.value;
                cellB.font  = colorFont(item.color, true, 10);
            } else {
                cellB.value = item.value;
                cellB.font  = { name: 'Calibri', size: 10 };
            }

            kpiIdx++;
        }
        r++;
    }

    // Borda externa: do cabeçalho até última linha de dados
    applyOuterBorder(wsResumo, 3, r - 1, 1, HC);

    // ══════════════════════════════════════════════════════════════════════════
    // ABA 2 — Vendas (7 dados + H vazia = 8 cols)
    // ══════════════════════════════════════════════════════════════════════════

    const wsVendas = workbook.addWorksheet('Vendas', {
        properties: { tabColor: { argb: 'FF22C55E' } },
    });

    const vendaCols = 7;
    setColWidths(wsVendas, [16, 36, 20, 32, 22, 16, 16, 16]);
    setWsDefaults(wsVendas, 4);

    writeSectionTitle(wsVendas, 1, 'DETALHAMENTO DE VENDAS');
    writePeriodRow(wsVendas, 2, generatedStr);

    const vHdr = wsVendas.getRow(3);
    ['ID', 'Cliente', 'Canal', 'Produto', 'Valor Líquido (R$)', 'Data', 'Status', ''].forEach((h, i) => {
        vHdr.getCell(i + 1).value = h;
    });
    styleHeaderRow(vHdr, HC);

    writeOrangeAccentRow(wsVendas, 4);

    const sortedTx = [...data.transactions_detail].sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
    });

    let totalVendas = 0;
    sortedTx.forEach((t, idx) => {
        const rv          = idx + 5;
        const dr          = wsVendas.getRow(rv);
        const statusLabel = STATUS_LABELS[t.status] ?? t.status;
        const channel     = translateChannel(t.customer_channel ?? t.platform ?? '');

        styleDataRow(dr, HC, idx);

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

        const isApproved = t.status === 'approved';
        const isRefunded = t.status === 'refunded';
        dr.getCell(7).value     = statusLabel;
        dr.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
        if (isApproved)      dr.getCell(7).font = colorFont(C.success, true, 10);
        else if (isRefunded) dr.getCell(7).font = colorFont(C.danger, true, 10);
        else                 dr.getCell(7).font = darkFont(false, 10);

        if (t.status === 'approved') totalVendas += t.amount_net;
    });

    const vTotals = sortedTx.length + 5;
    if (sortedTx.length > 0) {
        writeTotalsRow(wsVendas, vTotals, HC, [
            { col: 1, value: `TOTAL (${sortedTx.filter(t => t.status === 'approved').length} aprovadas)` },
            { col: 5, value: fmtBrl(totalVendas) },
        ]);
        applyOuterBorder(wsVendas, 3, vTotals, 1, HC);
    } else {
        applyOuterBorder(wsVendas, 3, 4, 1, HC);
    }

    wsVendas.autoFilter = {
        from: { row: 3, column: 1 },
        to:   { row: sortedTx.length + 4, column: vendaCols },
    };

    // ══════════════════════════════════════════════════════════════════════════
    // ABA 3 — Canais (8 cols)
    // ══════════════════════════════════════════════════════════════════════════

    const wsCanais = workbook.addWorksheet('Canais', {
        properties: { tabColor: { argb: 'FF1A7FE8' } },
    });

    setColWidths(wsCanais, [16, 22, 24, 14, 18, 20, 14, 20]);
    setWsDefaults(wsCanais, 4);

    writeSectionTitle(wsCanais, 1, 'PERFORMANCE POR CANAL DE AQUISIÇÃO');
    writePeriodRow(wsCanais, 2, generatedStr);

    const cHdr = wsCanais.getRow(3);
    ['Canal', 'Investimento (R$)', 'Receita Atribuída (R$)', 'ROAS', 'CAC (R$)', 'LTV Médio (R$)', 'LTV/CAC', 'Novos Clientes'].forEach((h, i) => {
        cHdr.getCell(i + 1).value = h;
    });
    styleHeaderRow(cHdr, HC);

    writeOrangeAccentRow(wsCanais, 4);

    const channels = [...data.channel_economics].sort((a, b) => {
        const roasA = a.total_spend > 0 ? a.total_ltv / a.total_spend : -1;
        const roasB = b.total_spend > 0 ? b.total_ltv / b.total_spend : -1;
        return roasB - roasA;
    });

    if (channels.length === 0) {
        wsCanais.mergeCells(5, 1, 5, HC);
        const eCell     = wsCanais.getCell(5, 1);
        eCell.value     = 'Sem dados de canais no período';
        eCell.font      = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill      = whiteFill();
        wsCanais.getRow(5).height = 32;
        applyOuterBorder(wsCanais, 3, 5, 1, HC);
    } else {
        let totalSpendCh = 0, totalRevCh = 0, totalCustCh = 0;

        channels.forEach((ch, idx) => {
            const rv   = idx + 5;
            const dr   = wsCanais.getRow(rv);
            const roas = ch.total_spend > 0 ? ch.total_ltv / ch.total_spend : 0;

            styleDataRow(dr, HC, idx);

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

        const cTotals   = channels.length + 5;
        const roasTotal = totalSpendCh > 0 ? totalRevCh / totalSpendCh : 0;
        writeTotalsRow(wsCanais, cTotals, HC, [
            { col: 1, value: 'TOTAL' },
            { col: 2, value: fmtBrl(totalSpendCh) },
            { col: 3, value: fmtBrl(totalRevCh) },
            { col: 4, value: totalSpendCh > 0 ? `${fmtNum(roasTotal)}x` : '—' },
            { col: 8, value: totalCustCh },
        ]);
        applyOuterBorder(wsCanais, 3, cTotals, 1, HC);

        wsCanais.autoFilter = {
            from: { row: 3, column: 1 },
            to:   { row: channels.length + 4, column: HC },
        };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ABA 4 — Produtos (5 dados + F-H vazias = 8 cols)
    // ══════════════════════════════════════════════════════════════════════════

    const wsProdutos = workbook.addWorksheet('Produtos', {
        properties: { tabColor: { argb: 'FFF59E0B' } },
    });

    const prodCols = 5;
    setColWidths(wsProdutos, [48, 26, 20, 24, 20, 14, 14, 14]);
    setWsDefaults(wsProdutos, 4);

    writeSectionTitle(wsProdutos, 1, 'TOP PRODUTOS POR RECEITA');
    writePeriodRow(wsProdutos, 2, generatedStr);

    const pHdr = wsProdutos.getRow(3);
    ['Produto', 'Receita Total (R$)', 'Transações', 'Ticket Médio (R$)', '% do Total', '', '', ''].forEach((h, i) => {
        pHdr.getCell(i + 1).value = h;
    });
    styleHeaderRow(pHdr, HC);

    writeOrangeAccentRow(wsProdutos, 4);

    if (data.top_products.length === 0) {
        wsProdutos.mergeCells(5, 1, 5, HC);
        const eCell     = wsProdutos.getCell(5, 1);
        eCell.value     = 'Sem dados de produtos no período (Hotmart/Shopify não conectados)';
        eCell.font      = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill      = whiteFill();
        wsProdutos.getRow(5).height = 32;
        applyOuterBorder(wsProdutos, 3, 5, 1, HC);
    } else {
        let totalRevProd = 0;

        data.top_products.forEach((p, idx) => {
            const rv          = idx + 5;
            const dr          = wsProdutos.getRow(rv);
            const ticketMedio = p.transactions > 0 ? p.revenue / p.transactions : 0;
            const refundAmt   = (data as unknown as { refunds_by_product?: Record<string, number> }).refunds_by_product?.[p.product_name] ?? 0;
            styleDataRow(dr, HC, idx);

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

        const totTx     = data.top_products.reduce((s, p) => s + p.transactions, 0);
        const pTotals   = data.top_products.length + 5;
        writeTotalsRow(wsProdutos, pTotals, HC, [
            { col: 1, value: 'TOTAL' },
            { col: 2, value: fmtBrl(totalRevProd) },
            { col: 3, value: totTx },
            { col: 4, value: totTx > 0 ? fmtBrl(totalRevProd / totTx) : '—' },
        ]);
        applyOuterBorder(wsProdutos, 3, pTotals, 1, HC);

        wsProdutos.autoFilter = {
            from: { row: 3, column: 1 },
            to:   { row: data.top_products.length + 4, column: prodCols },
        };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ABA 5 — Clientes em Risco (7 dados + H vazia = 8 cols)
    // ══════════════════════════════════════════════════════════════════════════

    const wsRisco = workbook.addWorksheet('Clientes em Risco', {
        properties: { tabColor: { argb: 'FFEF4444' } },
    });

    const riscoCols = 7;
    setColWidths(wsRisco, [8, 22, 22, 22, 18, 14, 28, 16]);
    setWsDefaults(wsRisco, 4);

    writeSectionTitle(wsRisco, 1, 'CLIENTES EM RISCO DE CHURN (PROB. > 60%)');
    writePeriodRow(wsRisco, 2, generatedStr);

    const rHdr = wsRisco.getRow(3);
    ['#', 'LTV (R$)', 'Prob. Churn', 'Dias s/ Compra', 'Canal', 'RFM Score', 'Email', ''].forEach((h, i) => {
        rHdr.getCell(i + 1).value = h;
    });
    styleHeaderRow(rHdr, HC);

    writeOrangeAccentRow(wsRisco, 4);

    const atRisk = data.at_risk_customers;

    if (atRisk.length === 0) {
        wsRisco.mergeCells(5, 1, 5, HC);
        const eCell     = wsRisco.getCell(5, 1);
        eCell.value     = 'Nenhum cliente com probabilidade de churn acima de 60%';
        eCell.font      = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill      = whiteFill();
        wsRisco.getRow(5).height = 32;
        applyOuterBorder(wsRisco, 3, 5, 1, HC);
    } else {
        atRisk.forEach((c, idx) => {
            const rv = idx + 5;
            const dr = wsRisco.getRow(rv);
            styleDataRow(dr, HC, idx);

            dr.getCell(1).value     = idx + 1;
            dr.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
            dr.getCell(1).font      = { name: 'Calibri', bold: true, size: 10 };

            dr.getCell(2).value     = fmtBrl(c.ltv ?? 0);
            dr.getCell(2).font      = darkFont(false, 10);
            dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };

            const prob     = c.churn_probability;
            const churnPct = prob !== null ? `${fmtNum(prob)}%` : 'N/D';
            dr.getCell(3).value     = churnPct;
            dr.getCell(3).font      = colorFont(churnColor(prob), (prob ?? 0) > 60, 10);
            dr.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

            const days = c.days_since_purchase !== null ? `${c.days_since_purchase} dias` : 'N/D';
            dr.getCell(4).value     = days;
            dr.getCell(4).font      = c.days_since_purchase !== null && c.days_since_purchase > 90
                ? colorFont(C.danger, false, 10) : darkFont(false, 10);
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

        applyOuterBorder(wsRisco, 3, atRisk.length + 4, 1, HC);

        wsRisco.autoFilter = {
            from: { row: 3, column: 1 },
            to:   { row: atRisk.length + 4, column: riscoCols },
        };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ABA 6 — Segmentação RFM (5 dados + F-H vazias = 8 cols)
    // ══════════════════════════════════════════════════════════════════════════

    const wsRfm = workbook.addWorksheet('Segmentação RFM', {
        properties: { tabColor: { argb: 'FF8B5CF6' } },
    });

    const rfmCols = 5;
    setColWidths(wsRfm, [44, 16, 16, 26, 24, 14, 14, 14]);
    setWsDefaults(wsRfm, 4);

    const rfmTitle = data.rfm_source === 'estimated'
        ? 'SEGMENTAÇÃO RFM (ESTIMADO — JOB RFM PENDENTE)'
        : 'SEGMENTAÇÃO RFM';
    writeSectionTitle(wsRfm, 1, rfmTitle);
    writePeriodRow(wsRfm, 2, generatedStr);

    const rfmHdr = wsRfm.getRow(3);
    ['Segmento', 'Clientes', '% da Base', 'LTV Total (R$)', 'LTV Médio (R$)', '', '', ''].forEach((h, i) => {
        rfmHdr.getCell(i + 1).value = h;
    });
    styleHeaderRow(rfmHdr, HC);

    writeOrangeAccentRow(wsRfm, 4);

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
        const rv     = idx + 5;
        const dr     = wsRfm.getRow(rv);
        const pct    = totalRfmClientes > 0
            ? `${fmtNum((seg.count / totalRfmClientes) * 100, 1)}%` : '—';
        const avgLtv = seg.count > 0 ? seg.ltv / seg.count : 0;

        styleDataRow(dr, HC, idx);

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
        const rfmTotals = data.rfm_distribution.length + 5;
        writeTotalsRow(wsRfm, rfmTotals, HC, [
            { col: 1, value: 'TOTAL' },
            { col: 2, value: totalRfmClientes },
            { col: 3, value: '100%' },
            { col: 4, value: fmtBrl(totalRfmLtv) },
            { col: 5, value: totalRfmClientes > 0 ? fmtBrl(totalRfmLtv / totalRfmClientes) : '—' },
        ]);
        applyOuterBorder(wsRfm, 3, rfmTotals, 1, HC);
    } else {
        applyOuterBorder(wsRfm, 3, 4, 1, HC);
    }

    if (data.rfm_distribution.length > 0) {
        wsRfm.autoFilter = {
            from: { row: 3, column: 1 },
            to:   { row: data.rfm_distribution.length + 4, column: rfmCols },
        };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ABA 7 — Projeções (4 dados + E-H vazias = 8 cols)
    // ══════════════════════════════════════════════════════════════════════════

    const wsProj = workbook.addWorksheet('Projeções', {
        properties: { tabColor: { argb: 'FF10B981' } },
    });

    const projCols = 4;
    setColWidths(wsProj, [40, 28, 28, 28, 14, 14, 14, 14]);
    setWsDefaults(wsProj, 4);

    writeSectionTitle(wsProj, 1, 'PROJEÇÕES DE RECEITA — 3 CENÁRIOS');
    writePeriodRow(wsProj, 2, generatedStr);

    const projHdr = wsProj.getRow(3);
    ['Métrica', 'Conservador', 'Moderado', 'Otimista', '', '', '', ''].forEach((h, i) => {
        projHdr.getCell(i + 1).value = h;
    });
    styleHeaderRow(projHdr, HC);

    writeOrangeAccentRow(wsProj, 4);

    const { conservative: cons, moderate: mod, optimistic: opt } = data.projections;

    const projRows: Array<[string, string, string, string]> = [
        ['Mês 1 (Receita)', fmtBrl(cons.month1), fmtBrl(mod.month1), fmtBrl(opt.month1)],
        ['Mês 2 (Receita)', fmtBrl(cons.month2), fmtBrl(mod.month2), fmtBrl(opt.month2)],
        ['Mês 3 (Receita)', fmtBrl(cons.month3), fmtBrl(mod.month3), fmtBrl(opt.month3)],
        ['Taxa de Crescimento/mês', `${fmtNum(cons.rate_pct)}%`, `${fmtNum(mod.rate_pct)}%`, `${fmtNum(opt.rate_pct)}%`],
    ];

    projRows.forEach(([label, c, m, o], idx) => {
        const rv = idx + 5;
        const dr = wsProj.getRow(rv);
        styleDataRow(dr, HC, idx);

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

    applyOuterBorder(wsProj, 3, projRows.length + 4, 1, HC);

    // Linha separadora + métricas gerais abaixo
    const sepRow = projRows.length + 6; // +5 (last proj data) +1 (blank)
    wsProj.getRow(sepRow - 1).height = 10;

    const generalMetrics: Array<[string, string]> = [
        ['MRR Projetado',          fmtBrl(data.mrr_projected)],
        ['ARR Projetado',          fmtBrl(data.arr_projected)],
        ['Payback Period',         data.payback_months !== null ? `${fmtNum(data.payback_months, 1)} meses` : '—'],
        ['LTV / CAC Geral',        data.ltv_cac_overall !== null ? `${fmtNum(data.ltv_cac_overall, 2)}x` : '—'],
        ['Margem de Contribuição', `${fmtNum(data.margin_contribution_pct)}% (${fmtBrl(data.margin_contribution_brl)})`],
    ];

    generalMetrics.forEach(([label, val], idx) => {
        const rv = sepRow + idx;
        const dr = wsProj.getRow(rv);
        const bg = idx % 2 === 0 ? zebraFill() : whiteFill();

        dr.height = 30;

        wsProj.mergeCells(rv, 1, rv, HC);
        const ca = wsProj.getCell(rv, 1);
        ca.value     = `${label}:   ${val}`;
        ca.font      = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF1E1E1E' } };
        ca.fill      = bg;
        ca.border    = bottomBorder();
        ca.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    applyOuterBorder(wsProj, sepRow, sepRow + generalMetrics.length - 1, 1, HC);

    // ══════════════════════════════════════════════════════════════════════════
    // ABA 8 — Performance por Período (5 dados + F-H vazias = 8 cols)
    // ══════════════════════════════════════════════════════════════════════════

    const wsPerf = workbook.addWorksheet('Performance por Período', {
        properties: { tabColor: { argb: 'FF0EA5E9' } },
    });

    const perfCols = 5;
    setColWidths(wsPerf, [18, 26, 18, 26, 30, 14, 14, 14]);
    setWsDefaults(wsPerf, 4);

    writeSectionTitle(wsPerf, 1, 'PERFORMANCE DIÁRIA DO PERÍODO');
    writePeriodRow(wsPerf, 2, generatedStr);

    const perfHdr = wsPerf.getRow(3);
    ['Data', 'Receita (R$)', 'Transações', 'Ticket Médio (R$)', 'Variação Dia Anterior', '', '', ''].forEach((h, i) => {
        perfHdr.getCell(i + 1).value = h;
    });
    styleHeaderRow(perfHdr, HC);

    writeOrangeAccentRow(wsPerf, 4);

    const dailyRevenue = (data as unknown as {
        daily_revenue?: { date: string; revenue: number; transactions: number; aov: number; change_pct: number | null }[];
    }).daily_revenue ?? [];

    if (dailyRevenue.length === 0) {
        wsPerf.mergeCells(5, 1, 5, HC);
        const eCell     = wsPerf.getCell(5, 1);
        eCell.value     = 'Sem transações no período selecionado';
        eCell.font      = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill      = whiteFill();
        wsPerf.getRow(5).height = 32;
        applyOuterBorder(wsPerf, 3, 5, 1, HC);
    } else {
        let totalPerfRev = 0, totalPerfTx = 0;

        dailyRevenue.forEach((day, idx) => {
            const rv = idx + 5;
            const dr = wsPerf.getRow(rv);
            styleDataRow(dr, HC, idx);

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

        const perfTotals = dailyRevenue.length + 5;
        writeTotalsRow(wsPerf, perfTotals, HC, [
            { col: 1, value: `TOTAL (${dailyRevenue.length} dias)` },
            { col: 2, value: fmtBrl(totalPerfRev) },
            { col: 3, value: totalPerfTx },
            { col: 4, value: totalPerfTx > 0 ? fmtBrl(totalPerfRev / totalPerfTx) : '—' },
        ]);
        applyOuterBorder(wsPerf, 3, perfTotals, 1, HC);

        wsPerf.autoFilter = {
            from: { row: 3, column: 1 },
            to:   { row: dailyRevenue.length + 4, column: perfCols },
        };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ABA 9 — Comparativo Mensal (4 dados + E-H vazias = 8 cols)
    // ══════════════════════════════════════════════════════════════════════════

    const wsMensal = workbook.addWorksheet('Comparativo Mensal', {
        properties: { tabColor: { argb: 'FF6366F1' } },
    });

    setColWidths(wsMensal, [16, 30, 22, 38, 14, 14, 14, 14]);
    setWsDefaults(wsMensal, 4);

    writeSectionTitle(wsMensal, 1, 'COMPARATIVO MENSAL — TENDÊNCIA DE RECEITA (6 MESES)');
    writePeriodRow(wsMensal, 2, generatedStr);

    const mensalHdr = wsMensal.getRow(3);
    ['Mês', 'Receita Líquida (R$)', 'Variação %', 'Tendência', '', '', '', ''].forEach((h, i) => {
        mensalHdr.getCell(i + 1).value = h;
    });
    styleHeaderRow(mensalHdr, HC);

    writeOrangeAccentRow(wsMensal, 4);

    if (data.revenue_trend.length === 0) {
        wsMensal.mergeCells(5, 1, 5, HC);
        const eCell     = wsMensal.getCell(5, 1);
        eCell.value     = 'Dados históricos insuficientes (menos de 1 mês de transações)';
        eCell.font      = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill      = whiteFill();
        wsMensal.getRow(5).height = 32;
        applyOuterBorder(wsMensal, 3, 5, 1, HC);
    } else {
        let peakRev = 0, peakMonth = '';

        data.revenue_trend.forEach((t, idx) => {
            const rv = idx + 5;
            const dr = wsMensal.getRow(rv);
            styleDataRow(dr, HC, idx);

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

        const mensalLast = data.revenue_trend.length + 4;

        if (peakMonth) {
            const noteR = data.revenue_trend.length + 5;
            wsMensal.mergeCells(noteR, 1, noteR, HC);
            const noteCell     = wsMensal.getCell(noteR, 1);
            noteCell.value     = `Melhor mês no período: ${peakMonth} — ${fmtBrl(peakRev)}`;
            noteCell.font      = colorFont(C.teal, true, 10);
            noteCell.fill      = whiteFill();
            noteCell.border    = bottomBorder();
            noteCell.alignment = { vertical: 'middle', horizontal: 'center' };
            wsMensal.getRow(noteR).height = 30;
            applyOuterBorder(wsMensal, 3, noteR, 1, HC);
        } else {
            applyOuterBorder(wsMensal, 3, mensalLast, 1, HC);
        }

        wssMensal: {
            wsMensal.autoFilter = {
                from: { row: 3, column: 1 },
                to:   { row: mensalLast, column: 4 },
            };
            break wssMensal;
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ABA 10 — Cohort de Retenção (8 cols)
    // ══════════════════════════════════════════════════════════════════════════

    const wsCohort = workbook.addWorksheet('Cohort de Retenção', {
        properties: { tabColor: { argb: 'FFEC4899' } },
    });

    setColWidths(wsCohort, [20, 14, 20, 16, 16, 16, 16, 16]);
    setWsDefaults(wsCohort, 5); // freeze após linha laranja (row 5)

    writeSectionTitle(wsCohort, 1, 'COHORT DE RETENÇÃO (ESTIMADO — BASEADO EM LAST_PURCHASE)');
    writePeriodRow(wsCohort, 2, generatedStr);

    // Nota metodológica (row 3 — A3:H3)
    wsCohort.mergeCells(3, 1, 3, HC);
    const methodNote     = wsCohort.getCell(3, 1);
    methodNote.value     = '   Retenção estimada: % de clientes do cohort que realizaram compra em cada mês subsequente (baseado em last_purchase_at)';
    methodNote.font      = colorFont(C.textSecondary, false, 9);
    methodNote.fill      = subheaderFill();
    methodNote.alignment = { vertical: 'middle' };
    wsCohort.getRow(3).height = 22;

    // Header (row 4)
    const cohortHdr = wsCohort.getRow(4);
    ['Cohort (Mês)', 'Clientes', 'M0 (Aquisição)', 'M1', 'M2', 'M3', 'M4', 'M5'].forEach((h, i) => {
        cohortHdr.getCell(i + 1).value = h;
    });
    styleHeaderRow(cohortHdr, HC);

    // Linha laranja de destaque (row 5)
    writeOrangeAccentRow(wsCohort, 5);

    const cohortRetention = (data as unknown as {
        cohort_retention?: { cohort: string; total: number; m0: number; m1: number | null; m2: number | null; m3: number | null; m4: number | null; m5: number | null }[];
    }).cohort_retention ?? [];

    if (cohortRetention.length === 0) {
        wsCohort.mergeCells(6, 1, 6, HC);
        const eCell     = wsCohort.getCell(6, 1);
        eCell.value     = 'Sem dados de cohort — clientes insuficientes ou histórico menor que 2 meses';
        eCell.font      = colorFont(C.textSecondary, false, 10);
        eCell.alignment = { vertical: 'middle', horizontal: 'center' };
        eCell.fill      = whiteFill();
        wsCohort.getRow(6).height = 32;
        applyOuterBorder(wsCohort, 4, 6, 1, HC);
    } else {
        cohortRetention.forEach((row, idx) => {
            const rv = idx + 6; // dados começam em row 6
            const dr = wsCohort.getRow(rv);
            styleDataRow(dr, HC, idx);

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

        const legendR = cohortRetention.length + 6;
        wsCohort.mergeCells(legendR, 1, legendR, HC);
        const legendCell     = wsCohort.getCell(legendR, 1);
        legendCell.value     = 'Legenda: Verde ≥ 70%  |  Amarelo 40–69%  |  Vermelho < 40%  |  — dado ainda não disponível (cohort recente)';
        legendCell.font      = colorFont(C.textSecondary, false, 9);
        legendCell.fill      = subheaderFill();
        legendCell.border    = bottomBorder();
        legendCell.alignment = { vertical: 'middle', horizontal: 'left' };
        wsCohort.getRow(legendR).height = 22;

        applyOuterBorder(wsCohort, 4, legendR, 1, HC);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ABA 11 — Gráficos
    // ══════════════════════════════════════════════════════════════════════════

    const wsGraf = workbook.addWorksheet('Gráficos', {
        properties: { tabColor: { argb: 'FF22C55E' } },
    });

    setColWidths(wsGraf, [4, 26, 24, 20, 20, 14, 14, 14]);
    wsGraf.views = [{ showGridLines: false }];

    writeSectionTitle(wsGraf, 1, 'GRÁFICOS DE PERFORMANCE');
    writePeriodRow(wsGraf, 2, generatedStr);

    // ── GRÁFICO 1 — Receita por Mês ──────────────────────────────────────────
    // Posição B6 conforme spec
    writeChartTitle(wsGraf, 5, 2, HC, 'GRÁFICO 1 — Receita por Mês (R$)');

    const g1HRow = wsGraf.getRow(6);
    ['MÊS', 'RECEITA LÍQUIDA (R$)', 'VARIAÇÃO %', 'TENDÊNCIA', '', ''].forEach((h, i) => {
        const cell     = g1HRow.getCell(i + 2);
        cell.value     = h;
        cell.fill      = darkFill();
        cell.font      = whiteFont(true, 10);
        cell.border    = headerBorder();
        cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
    });
    g1HRow.height = 38;

    const trendData = data.revenue_trend;
    if (trendData.length === 0) {
        wsGraf.mergeCells(7, 2, 7, HC);
        const noData     = wsGraf.getCell(7, 2);
        noData.value     = 'Dados insuficientes — menos de 1 mês de histórico';
        noData.font      = colorFont(C.textSecondary, false, 10);
        noData.alignment = { vertical: 'middle', horizontal: 'center' };
        noData.fill      = whiteFill();
        wsGraf.getRow(7).height = 30;
    } else {
        trendData.forEach((t, idx) => {
            const rv  = idx + 7;
            const bg  = idx % 2 === 0 ? zebraFill() : whiteFill();
            const dr  = wsGraf.getRow(rv);
            dr.height = 30;

            const cells = [
                { col: 2, val: t.month, align: 'left' as const, font: darkFont(true, 10) },
                { col: 3, val: fmtBrl(t.revenue), align: 'right' as const, font: darkFont(false, 10) },
                { col: 4, val: t.change_pct !== null
                    ? `${t.change_pct >= 0 ? '+' : ''}${fmtNum(t.change_pct)}%` : '—',
                    align: 'right' as const,
                    font: t.change_pct !== null
                        ? colorFont(t.change_pct >= 0 ? C.success : C.danger, Math.abs(t.change_pct ?? 0) > 20, 10)
                        : colorFont(C.textSecondary, false, 10) },
                { col: 5, val: t.change_pct === null ? '—'
                    : t.change_pct >= 10 ? '▲▲ Forte crescimento'
                    : t.change_pct >= 0  ? '▲ Crescimento'
                    : t.change_pct >= -10 ? '▼ Queda leve' : '▼▼ Queda acentuada',
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
                cell.border    = bottomBorder();
                cell.alignment = { vertical: 'middle', horizontal: align };
            });
        });
    }

    // ── GRÁFICO 2 — Segmentação RFM ──────────────────────────────────────────
    // Posição B29 conforme spec
    writeChartTitle(wsGraf, 28, 2, HC, 'GRÁFICO 2 — Segmentação RFM — Clientes por Segmento');

    const g2HRow = wsGraf.getRow(29);
    ['SEGMENTO', 'CLIENTES', '% DA BASE', 'LTV MÉDIO (R$)', '', ''].forEach((h, i) => {
        const cell     = g2HRow.getCell(i + 2);
        cell.value     = h;
        cell.fill      = darkFill();
        cell.font      = whiteFont(true, 10);
        cell.border    = headerBorder();
        cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
    });
    g2HRow.height = 38;

    const rfmDataForChart = data.rfm_distribution.filter(s => s.count > 0);
    rfmDataForChart.forEach((seg, idx) => {
        const rv     = idx + 30;
        const bg     = idx % 2 === 0 ? zebraFill() : whiteFill();
        const dr     = wsGraf.getRow(rv);
        dr.height    = 30;
        const segColor = RFM_COLORS[seg.segment] ?? C.textSecondary;
        const pct    = totalRfmClientes > 0 ? `${fmtNum((seg.count / totalRfmClientes) * 100, 1)}%` : '—';
        const avgLtv = seg.count > 0 ? seg.ltv / seg.count : 0;

        [
            { col: 2, val: RFM_LABELS[seg.segment] ?? seg.segment, align: 'left' as const, font: colorFont(segColor, true, 10) },
            { col: 3, val: seg.count,      align: 'right' as const, font: darkFont(false, 10) },
            { col: 4, val: pct,            align: 'right' as const, font: darkFont(false, 10) },
            { col: 5, val: fmtBrl(avgLtv), align: 'right' as const, font: darkFont(false, 10) },
        ].forEach(({ col, val, align, font }) => {
            const cell     = dr.getCell(col);
            cell.value     = val;
            cell.fill      = bg;
            cell.font      = font;
            cell.border    = bottomBorder();
            cell.alignment = { vertical: 'middle', horizontal: align };
        });
    });

    // ── GRÁFICO 3 — Projeções 3 Cenários ─────────────────────────────────────
    // Posição B53 conforme spec
    writeChartTitle(wsGraf, 52, 2, HC, 'GRÁFICO 3 — Projeções de Receita — 3 Cenários');

    const g3HRow = wsGraf.getRow(53);
    ['MÉTRICA', 'CONSERVADOR', 'MODERADO', 'OTIMISTA', '', ''].forEach((h, i) => {
        const cell     = g3HRow.getCell(i + 2);
        cell.value     = h;
        cell.fill      = darkFill();
        cell.font      = whiteFont(true, 10);
        cell.border    = headerBorder();
        cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
    });
    g3HRow.height = 38;

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
        dr.height = 30;

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
            cell.border    = bottomBorder();
            cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'right' };
        });
    });

    const legR = 58;
    wsGraf.mergeCells(legR, 2, legR, HC);
    const legCell     = wsGraf.getCell(legR, 2);
    legCell.value     = 'Conservador = azul  |  Moderado = laranja  |  Otimista = verde';
    legCell.font      = colorFont(C.textSecondary, false, 9);
    legCell.fill      = subheaderFill();
    legCell.border    = bottomBorder();
    legCell.alignment = { vertical: 'middle', horizontal: 'center' };
    wsGraf.getRow(legR).height = 22;

    // ── Buffer ────────────────────────────────────────────────────────────────

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
}
