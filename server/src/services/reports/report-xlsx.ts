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
} from 'exceljs';

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Workbook: WorkbookClass } = require('exceljs') as { Workbook: new () => Workbook };

type ReportData = Awaited<ReturnType<typeof generateReportData>>;

// ── Brand colors ─────────────────────────────────────────────────────────────

const C = {
    accent:        '#1a1a2e',
    dark:          '#1E1E1E',
    white:         '#FFFFFF',
    success:       '#22C55E',
    danger:        '#EF4444',
    warning:       '#F59E0B',
    textSecondary: '#6B7280',
    zebraRow:      '#F7F6F3',
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

// ── Style helpers ─────────────────────────────────────────────────────────────

function accentFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } };
}

function darkFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1E1E' } };
}

function zebraFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F6F3' } };
}

function colorFill(hex: string): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex.replace('#', '') } };
}

function whiteFont(bold = true, size = 10): Partial<Font> {
    return { color: { argb: 'FFFFFFFF' }, bold, size };
}

function colorFont(hex: string, bold = false, size = 10): Partial<Font> {
    return { color: { argb: 'FF' + hex.replace('#', '') }, bold, size };
}

function thinBorder(): Partial<Borders> {
    const side: Partial<ExcelBorder> = { style: 'thin', color: { argb: 'FFE5E5E5' } };
    return { top: side, bottom: side, left: side, right: side };
}

function styleHeaderRow(row: Row, colCount: number): void {
    row.height = 26;
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill      = accentFill();
        cell.font      = whiteFont(true, 10);
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center', wrapText: false };
        cell.border    = thinBorder();
    }
}

function styleDataRow(row: Row, colCount: number, idx: number): void {
    row.height = 22;
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        if (idx % 2 === 1) cell.fill = zebraFill();
        cell.border    = thinBorder();
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
        if (!cell.font?.color) cell.font = { size: 10 };
    }
}

function writeSectionTitle(ws: Worksheet, rowNum: number, text: string, lastCol: number): void {
    ws.mergeCells(rowNum, 1, rowNum, lastCol);
    const cell = ws.getCell(rowNum, 1);
    cell.value     = text;
    cell.fill      = accentFill();
    cell.font      = whiteFont(true, 13);
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 34;
}

function writePeriodRow(ws: Worksheet, rowNum: number, text: string, lastCol: number): void {
    ws.mergeCells(rowNum, 1, rowNum, lastCol);
    const cell = ws.getCell(rowNum, 1);
    cell.value     = text;
    cell.font      = colorFont(C.textSecondary, false, 9);
    cell.alignment = { vertical: 'middle' };
    ws.getRow(rowNum).height = 18;
}

// ── Auto-fit columns ──────────────────────────────────────────────────────────

function autoFitColumns(ws: Worksheet): void {
    ws.columns.forEach(col => {
        let maxLen = 10;
        col.eachCell?.({ includeEmpty: false }, cell => {
            const v = String(cell.value ?? '');
            if (v.length > maxLen) maxLen = v.length;
        });
        col.width = Math.min(maxLen + 4, 60);
    });
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

    const kpis: Array<[string, string, 'high' | 'low' | undefined]> = [
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
        ['', '', undefined],
        ['Investimento em Ads', fmtBrl(data.summary.ad_spend), undefined],
        ['Novos Clientes no Período', data.summary.new_customers.toLocaleString('pt-BR'), undefined],
        ['Base Total de Clientes', data.summary.total_customers.toLocaleString('pt-BR'), undefined],
        ['Impressões', data.summary.impressions.toLocaleString('pt-BR'), undefined],
        ['Cliques', data.summary.clicks.toLocaleString('pt-BR'), undefined],
        ['CTR', `${fmtNum(data.summary.ctr)}%`, undefined],
        ['Taxa de Reembolso', `${fmtNum(data.summary.refund_rate)}%`, data.summary.refund_rate > 5 ? 'high' : undefined],
        ['Valor Reembolsado', fmtBrl(data.summary.refund_amount), undefined],
    ];

    let r = 4;
    for (const [label, value, flag] of kpis) {
        const row    = wsResumo.getRow(r);
        const cellA  = wsResumo.getCell(r, 1);
        const cellB  = wsResumo.getCell(r, 2);
        cellA.value  = label;
        cellB.value  = value;
        cellA.font   = { bold: !!label, size: 10 };
        cellA.border = thinBorder();
        cellB.border = thinBorder();
        cellB.alignment = { vertical: 'middle', horizontal: 'right' };
        if (flag === 'high') cellB.font = colorFont(C.danger, true, 10);
        else if (flag === 'low') cellB.font = colorFont(C.danger, false, 10);
        else cellB.font = { size: 10 };
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
        'Nome do Cliente',
        'Canal de Aquisição',
        'Valor Líquido (R$)',
        'Data da Venda',
        'Status',
    ];
    const vHeaderRow = wsVendas.getRow(3);
    vendaHeaders.forEach((h, i) => { vHeaderRow.getCell(i + 1).value = h; });
    styleHeaderRow(vHeaderRow, vendaCols);

    data.transactions_detail.forEach((t, idx) => {
        const rv = idx + 4;
        const dr = wsVendas.getRow(rv);

        const statusLabel = STATUS_LABELS[t.status] ?? t.status;
        const statusColor = { approved: C.success, refunded: C.danger }[t.status];
        const channel     = translateChannel(t.customer_channel ?? t.platform ?? '—');

        dr.getCell(1).value = t.id.slice(0, 8);
        dr.getCell(2).value = t.customer_email ?? '—';
        dr.getCell(3).value = channel;
        dr.getCell(4).value = fmtBrl(t.amount_net);
        dr.getCell(5).value = t.created_at ? fmtDate(t.created_at) : '—';
        dr.getCell(6).value = statusLabel;

        styleDataRow(dr, vendaCols, idx);

        // Monospace para ID e Data
        dr.getCell(1).font = colorFont(C.dark, false, 10);
        dr.getCell(5).font = colorFont(C.dark, false, 10);

        // Valor monetário alinhado à direita
        dr.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

        // Status colorido
        if (statusColor) {
            dr.getCell(6).font = colorFont(statusColor, true, 10);
        }
        dr.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Linhas zebradas: #F7F6F3 nas linhas pares
    wsVendas.eachRow((row, rowNumber) => {
        if (rowNumber > 3) {
            const idx = rowNumber - 4;
            if (idx % 2 === 1) {
                for (let c = 1; c <= vendaCols; c++) {
                    const cell = row.getCell(c);
                    if (!cell.fill || (cell.fill as Fill).type === 'pattern' && (cell.fill as { fgColor?: { argb?: string } }).fgColor?.argb === 'FFFFFFFF') {
                        cell.fill = zebraFill();
                    }
                }
            }
        }
    });

    wsVendas.autoFilter = {
        from: { row: 3, column: 1 },
        to:   { row: 3 + data.transactions_detail.length, column: vendaCols },
    };

    autoFitColumns(wsVendas);

    // ══════════════════════════════════════════════════════════════════════════
    // ABA 3 — Canais
    // ══════════════════════════════════════════════════════════════════════════

    const wsCanais = workbook.addWorksheet('Canais', {
        properties: { tabColor: { argb: 'FF1A7FE8' } },
    });

    const canalColCount = 8;

    writeSectionTitle(wsCanais, 1, 'PERFORMANCE POR CANAL DE AQUISIÇÃO', canalColCount);
    writePeriodRow(wsCanais, 2, generatedStr, canalColCount);

    const canalHeaders = [
        'Canal',
        'Investimento (R$)',
        'Receita Atribuída (R$)',
        'ROAS',
        'LTV Médio (R$)',
        'Margem (%)',
        'Novos Clientes',
        'Status',
    ];
    const cHeaderRow = wsCanais.getRow(3);
    canalHeaders.forEach((h, i) => { cHeaderRow.getCell(i + 1).value = h; });
    styleHeaderRow(cHeaderRow, canalColCount);

    const channels = data.channel_economics.filter(c => c.channel !== 'desconhecido');
    channels.forEach((ch, idx) => {
        const rv = idx + 4;
        const dr = wsCanais.getRow(rv);

        const roas   = ch.total_spend > 0 ? ch.total_ltv / ch.total_spend : 0;
        const margin = ch.total_ltv > 0 ? ((ch.total_ltv - ch.total_spend) / ch.total_ltv) * 100 : 0;

        const statusLabel = ch.status === 'lucrativo' ? 'Lucrativo'
            : ch.status === 'prejuizo' ? 'Prejuízo' : 'Orgânico';
        const statusColor = ch.status === 'lucrativo' ? C.success
            : ch.status === 'prejuizo' ? C.danger : C.textSecondary;

        dr.getCell(1).value = translateChannel(ch.channel);
        dr.getCell(2).value = fmtBrl(ch.total_spend);
        dr.getCell(3).value = fmtBrl(ch.total_ltv);
        dr.getCell(4).value = ch.total_spend > 0 ? `${fmtNum(roas)}x` : '—';
        dr.getCell(5).value = fmtBrl(ch.avg_ltv);
        dr.getCell(6).value = `${fmtNum(margin)}%`;
        dr.getCell(7).value = ch.new_customers;
        dr.getCell(8).value = statusLabel;

        styleDataRow(dr, canalColCount, idx);

        // Margem colorida
        dr.getCell(6).font = colorFont(margin >= 0 ? C.success : C.danger, false, 10);

        // Status colorido e centralizado
        dr.getCell(8).font      = colorFont(statusColor, true, 10);
        dr.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

        // Novos clientes centralizado
        dr.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
    });

    wsCanais.autoFilter = {
        from: { row: 3, column: 1 },
        to:   { row: 3 + channels.length, column: canalColCount },
    };

    autoFitColumns(wsCanais);

    // ── Buffer ────────────────────────────────────────────────────────────────

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
}
