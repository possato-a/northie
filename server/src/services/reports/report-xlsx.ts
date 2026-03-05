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

// ── Types ────────────────────────────────────────────────────────────────────

type ReportData = Awaited<ReturnType<typeof generateReportData>>;

// ── Brand colors ─────────────────────────────────────────────────────────────

const C = {
    dark:          '#1E1E1E',
    white:         '#FFFFFF',
    bg:            '#FCF8F8',
    success:       '#22C55E',
    danger:        '#EF4444',
    warning:       '#F59E0B',
    primary:       '#1A7FE8',
    textSecondary: '#6B7280',
    border:        '#E5E5E5',
    altRow:        '#F5F5F5',
} as const;

// ── Severity / Situacao maps ─────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
    critica: C.danger,
    alta:    C.warning,
    media:   '#EAB308', // yellow-500
    ok:      C.success,
};

const SEVERITY_LABEL: Record<string, string> = {
    critica: 'CRITICA',
    alta:    'ALTA',
    media:   'MEDIA',
    ok:      'OK',
};

const SITUACAO_LABEL: Record<string, string> = {
    saudavel: 'SAUDAVEL',
    atencao:  'ATENCAO',
    critica:  'CRITICA',
};

const PRAZO_LABEL: Record<string, string> = {
    imediato:    'Imediato',
    esta_semana: 'Esta semana',
    este_mes:    'Este mes',
};

// ── Formatting helpers (pt-BR) ───────────────────────────────────────────────

function fmtBrl(n: number): string {
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return `R$ ${n < 0 ? '-' : ''}${formatted}`;
}

function fmtNum(n: number, decimals = 2): string {
    return n.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

function fmtPct(n: number): string {
    return `${fmtNum(n)}%`;
}

function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

function fmtInt(n: number): string {
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

// ── Style helpers ────────────────────────────────────────────────────────────

function darkHeaderFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1E1E' } };
}

function altRowFill(): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
}

function colorFill(hex: string): Fill {
    const argb = 'FF' + hex.replace('#', '');
    return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function whiteFont(bold = true): Partial<Font> {
    return { color: { argb: 'FFFFFFFF' }, bold, size: 10 };
}

function colorFont(hex: string, bold = false, size = 10): Partial<Font> {
    return { color: { argb: 'FF' + hex.replace('#', '') }, bold, size };
}

function thinBorder(): Partial<Borders> {
    const side: Partial<ExcelBorder> = { style: 'thin', color: { argb: 'FFE5E5E5' } };
    return { top: side, bottom: side, left: side, right: side };
}

/**
 * Apply dark header styling to a row (dark bg, white bold text).
 */
function styleHeaderRow(row: Row, colCount: number): void {
    row.height = 24;
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill = darkHeaderFill();
        cell.font = whiteFont(true);
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' };
        cell.border = thinBorder();
    }
}

/**
 * Apply alternating row style.
 */
function styleDataRow(row: Row, colCount: number, idx: number): void {
    row.height = 20;
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        if (idx % 2 === 1) {
            cell.fill = altRowFill();
        }
        cell.border = thinBorder();
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
        if (!cell.font || !cell.font.color) {
            cell.font = { size: 10 };
        }
    }
}

/**
 * Write a merged title row in dark bg with white text.
 */
function writeSectionHeader(
    ws: Worksheet,
    rowNum: number,
    text: string,
    lastCol: number,
    fontSize = 14,
): void {
    ws.mergeCells(rowNum, 1, rowNum, lastCol);
    const cell = ws.getCell(rowNum, 1);
    cell.value = text;
    cell.fill = darkHeaderFill();
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: fontSize };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    const row = ws.getRow(rowNum);
    row.height = fontSize === 14 ? 32 : 26;
}

// ══════════════════════════════════════════════════════════════════════════════
// Main export
// ══════════════════════════════════════════════════════════════════════════════

export async function generateXlsx(
    data: ReportData,
    ai: ReportAIAnalysis,
): Promise<Buffer> {
    const workbook = new WorkbookClass();
    workbook.creator = 'Northie';
    workbook.created = new Date();

    // ══════════════════════════════════════════════════════════════════════════
    // Sheet 1: Resumo
    // ══════════════════════════════════════════════════════════════════════════

    const wsResumo = workbook.addWorksheet('Resumo', {
        properties: { tabColor: { argb: 'FF1A7FE8' } },
    });

    wsResumo.columns = [
        { width: 35 },
        { width: 25 },
    ];

    // Row 1 — Title
    writeSectionHeader(wsResumo, 1, 'NORTHIE — RELATORIO DE PERFORMANCE', 2, 14);

    // Row 2 — Period info
    const periodStr = `Gerado em ${fmtDate(new Date().toISOString())} · Periodo: ${fmtDate(data.period.start)} a ${fmtDate(data.period.end)} (${data.period.days} dias)`;
    wsResumo.mergeCells(2, 1, 2, 2);
    const periodCell = wsResumo.getCell(2, 1);
    periodCell.value = periodStr;
    periodCell.font = colorFont(C.textSecondary, false, 9);
    periodCell.alignment = { vertical: 'middle' };
    wsResumo.getRow(2).height = 20;

    // Row 3 — Empty
    wsResumo.getRow(3).height = 10;

    // Row 4+ — KPI table
    const changeNote = data.summary.revenue_change_pct !== null
        ? ` (${data.summary.revenue_change_pct >= 0 ? '+' : ''}${fmtNum(data.summary.revenue_change_pct)}% vs anterior)`
        : '';

    const refundFlag: string | undefined = data.summary.refund_rate > 5 ? 'high' : undefined;

    const kpis: Array<[string, string, string | undefined]> = [
        ['Receita Liquida', fmtBrl(data.summary.revenue_net) + changeNote, undefined],
        ['Receita Bruta', fmtBrl(data.summary.revenue_gross), undefined],
        ['Margem Bruta %', fmtPct(data.summary.gross_margin_pct), undefined],
        ['Transacoes', fmtInt(data.summary.transactions), undefined],
        ['Ticket Medio (AOV)', fmtBrl(data.summary.aov), undefined],
        ['Taxa de Reembolso', fmtPct(data.summary.refund_rate), refundFlag],
        ['Valor Reembolsado', fmtBrl(data.summary.refund_amount), undefined],
        ['', '', undefined], // separator
        ['Novos Clientes', fmtInt(data.summary.new_customers), undefined],
        ['LTV Medio', fmtBrl(data.summary.ltv_avg), undefined],
        ['Base Total de Clientes', fmtInt(data.summary.total_customers), undefined],
        ['Investimento em Ads', fmtBrl(data.summary.ad_spend), undefined],
        ['ROAS', `${fmtNum(data.summary.roas)}x`, undefined],
        ['Impressoes', fmtInt(data.summary.impressions), undefined],
        ['Cliques', fmtInt(data.summary.clicks), undefined],
        ['CTR', fmtPct(data.summary.ctr), undefined],
    ];

    let row = 4;
    for (const [label, value, flag] of kpis) {
        const r = wsResumo.getRow(row);
        r.height = 22;
        const cellA = wsResumo.getCell(row, 1);
        const cellB = wsResumo.getCell(row, 2);

        cellA.value = label;
        cellA.font = { bold: true, size: 10 };
        cellA.alignment = { vertical: 'middle' };
        cellA.border = thinBorder();

        cellB.value = value;
        cellB.alignment = { vertical: 'middle', horizontal: 'right' };
        cellB.border = thinBorder();

        if (flag === 'high') {
            cellB.font = colorFont(C.danger, true, 10);
        } else {
            cellB.font = { size: 10 };
        }

        row++;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Sheet 2: Canais
    // ══════════════════════════════════════════════════════════════════════════

    const wsCanais = workbook.addWorksheet('Canais', {
        properties: { tabColor: { argb: 'FF22C55E' } },
    });

    const canalCols = [
        { width: 18 }, // Canal
        { width: 16 }, // Novos Clientes
        { width: 16 }, // LTV Medio
        { width: 16 }, // CAC
        { width: 12 }, // LTV/CAC
        { width: 20 }, // Receita Total (LTV)
        { width: 16 }, // Spend
        { width: 18 }, // Valor Criado
        { width: 14 }, // Status
    ];
    wsCanais.columns = canalCols;
    const canalColCount = canalCols.length;

    // Row 1 — Title
    writeSectionHeader(wsCanais, 1, 'ECONOMIA POR CANAL', canalColCount, 12);

    // Row 2 — Headers
    const canalHeaders = [
        'Canal', 'Novos Clientes', 'LTV Medio', 'CAC', 'LTV/CAC',
        'Receita Total (LTV)', 'Spend', 'Valor Criado', 'Status',
    ];
    const headerRow = wsCanais.getRow(2);
    canalHeaders.forEach((h, i) => {
        headerRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(headerRow, canalColCount);

    // Data rows
    const channels = data.channel_economics.filter(c => c.channel !== 'desconhecido');
    channels.forEach((ch, idx) => {
        const r = idx + 3;
        const dataRow = wsCanais.getRow(r);

        dataRow.getCell(1).value = ch.channel;
        dataRow.getCell(2).value = ch.new_customers;
        dataRow.getCell(3).value = fmtBrl(ch.avg_ltv);
        dataRow.getCell(4).value = ch.cac > 0 ? fmtBrl(ch.cac) : '—';
        dataRow.getCell(5).value = ch.ltv_cac_ratio !== null ? `${fmtNum(ch.ltv_cac_ratio)}x` : '—';
        dataRow.getCell(6).value = fmtBrl(ch.total_ltv);
        dataRow.getCell(7).value = fmtBrl(ch.total_spend);
        dataRow.getCell(8).value = fmtBrl(ch.value_created);
        dataRow.getCell(9).value = ch.status === 'lucrativo' ? 'Lucrativo'
            : ch.status === 'prejuizo' ? 'Prejuizo'
            : 'Organico';

        styleDataRow(dataRow, canalColCount, idx);

        // Valor Criado color
        const vcCell = dataRow.getCell(8);
        vcCell.font = colorFont(ch.value_created >= 0 ? C.success : C.danger, false, 10);

        // Status color
        const stCell = dataRow.getCell(9);
        const stColor = ch.status === 'lucrativo' ? C.success
            : ch.status === 'prejuizo' ? C.danger
            : C.textSecondary;
        stCell.font = colorFont(stColor, true, 10);
        stCell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Auto-filter on headers
    wsCanais.autoFilter = {
        from: { row: 2, column: 1 },
        to: { row: 2 + channels.length, column: canalColCount },
    };

    // ══════════════════════════════════════════════════════════════════════════
    // Sheet 3: Tendencia (only if >= 2 entries)
    // ══════════════════════════════════════════════════════════════════════════

    if (data.revenue_trend.length >= 2) {
        const wsTrend = workbook.addWorksheet('Tendencia', {
            properties: { tabColor: { argb: 'FFF59E0B' } },
        });

        wsTrend.columns = [
            { width: 14 },
            { width: 22 },
            { width: 16 },
        ];
        const trendColCount = 3;

        writeSectionHeader(wsTrend, 1, 'TENDENCIA DE RECEITA', trendColCount, 12);

        const trendHeaders = ['Mes', 'Receita Liquida', 'Variacao'];
        const tRow = wsTrend.getRow(2);
        trendHeaders.forEach((h, i) => { tRow.getCell(i + 1).value = h; });
        styleHeaderRow(tRow, trendColCount);

        data.revenue_trend.forEach((t, idx) => {
            const r = idx + 3;
            const dr = wsTrend.getRow(r);
            dr.getCell(1).value = t.month;
            dr.getCell(2).value = fmtBrl(t.revenue);

            const changePct = t.change_pct;
            if (changePct !== null) {
                const sign = changePct >= 0 ? '+' : '';
                dr.getCell(3).value = `${sign}${fmtNum(changePct)}%`;
            } else {
                dr.getCell(3).value = '—';
            }

            styleDataRow(dr, trendColCount, idx);

            // Color-code variation
            if (changePct !== null) {
                const vCell = dr.getCell(3);
                vCell.font = colorFont(changePct >= 0 ? C.success : C.danger, false, 10);
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Sheet 4: Produtos (only if entries exist)
    // ══════════════════════════════════════════════════════════════════════════

    if (data.top_products.length > 0) {
        const wsProducts = workbook.addWorksheet('Produtos', {
            properties: { tabColor: { argb: 'FF1A7FE8' } },
        });

        wsProducts.columns = [
            { width: 40 },
            { width: 20 },
            { width: 14 },
            { width: 14 },
        ];
        const prodColCount = 4;

        writeSectionHeader(wsProducts, 1, 'TOP PRODUTOS', prodColCount, 12);

        const prodHeaders = ['Produto', 'Receita', 'Transacoes', '% do Total'];
        const pRow = wsProducts.getRow(2);
        prodHeaders.forEach((h, i) => { pRow.getCell(i + 1).value = h; });
        styleHeaderRow(pRow, prodColCount);

        data.top_products.forEach((p, idx) => {
            const r = idx + 3;
            const dr = wsProducts.getRow(r);
            dr.getCell(1).value = p.product_name;
            dr.getCell(2).value = fmtBrl(p.revenue);
            dr.getCell(3).value = p.transactions;
            dr.getCell(4).value = `${p.pct_of_total}%`;

            styleDataRow(dr, prodColCount, idx);
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Sheet 5: Clientes (only if at_risk_customers has entries)
    // ══════════════════════════════════════════════════════════════════════════

    if (data.at_risk_customers.length > 0) {
        const wsClientes = workbook.addWorksheet('Clientes', {
            properties: { tabColor: { argb: 'FFEF4444' } },
        });

        wsClientes.columns = [
            { width: 18 },
            { width: 18 },
            { width: 16 },
            { width: 18 },
            { width: 14 },
        ];
        const clientColCount = 5;

        writeSectionHeader(wsClientes, 1, 'CLIENTES EM RISCO', clientColCount, 12);

        const clientHeaders = ['LTV', 'Canal', 'Prob. Churn', 'Dias s/ Compra', 'RFM Score'];
        const cRow = wsClientes.getRow(2);
        clientHeaders.forEach((h, i) => { cRow.getCell(i + 1).value = h; });
        styleHeaderRow(cRow, clientColCount);

        data.at_risk_customers.forEach((c, idx) => {
            const r = idx + 3;
            const dr = wsClientes.getRow(r);

            dr.getCell(1).value = fmtBrl(c.ltv ?? 0);
            dr.getCell(2).value = c.channel ?? 'desconhecido';
            dr.getCell(3).value = c.churn_probability !== null && c.churn_probability !== undefined
                ? `${c.churn_probability}%`
                : '—';
            dr.getCell(4).value = c.days_since_purchase !== null && c.days_since_purchase !== undefined
                ? `${c.days_since_purchase} dias`
                : '—';
            dr.getCell(5).value = c.rfm_score ?? '—';

            styleDataRow(dr, clientColCount, idx);

            // Churn probability color
            const churnCell = dr.getCell(3);
            const prob = c.churn_probability ?? 0;
            if (prob > 80) {
                churnCell.font = colorFont(C.danger, true, 10);
            } else if (prob > 60) {
                churnCell.font = colorFont(C.warning, true, 10);
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Sheet 6: Diagnostico IA (only if diagnosticos has entries)
    // ══════════════════════════════════════════════════════════════════════════

    if (ai.diagnosticos.length > 0) {
        const wsIA = workbook.addWorksheet('Diagnostico IA', {
            properties: { tabColor: { argb: 'FF1E1E1E' } },
        });

        const iaColCount = 7;

        wsIA.columns = [
            { width: 18 }, // Canal
            { width: 14 }, // Severidade
            { width: 30 }, // Sintoma
            { width: 30 }, // Causa Raiz
            { width: 30 }, // Acao Recomendada
            { width: 18 }, // Impacto (R$)
            { width: 14 }, // Prazo
        ];

        // Row 1 — Title with situacao badge
        const situacaoText = SITUACAO_LABEL[ai.situacao_geral] ?? ai.situacao_geral.toUpperCase();
        writeSectionHeader(wsIA, 1, `DIAGNOSTICO IA — ${situacaoText}`, iaColCount, 12);

        // Row 2 — Resumo executivo
        wsIA.mergeCells(2, 1, 2, iaColCount);
        const resumoCell = wsIA.getCell(2, 1);
        resumoCell.value = ai.resumo_executivo;
        resumoCell.font = colorFont(C.textSecondary, false, 10);
        resumoCell.alignment = { vertical: 'middle', wrapText: true };
        wsIA.getRow(2).height = 36;

        // Row 3 — Empty
        wsIA.getRow(3).height = 6;

        // Row 4 — Diagnostics table headers
        const diagHeaders = [
            'Canal', 'Severidade', 'Sintoma', 'Causa Raiz',
            'Acao Recomendada', 'Impacto (R$)', 'Prazo',
        ];
        const diagHRow = wsIA.getRow(4);
        diagHeaders.forEach((h, i) => { diagHRow.getCell(i + 1).value = h; });
        styleHeaderRow(diagHRow, iaColCount);

        // Sort by severity: critica first
        const severityOrder: Record<string, number> = { critica: 0, alta: 1, media: 2, ok: 3 };
        const sortedDiags = [...ai.diagnosticos].sort(
            (a, b) => (severityOrder[a.severidade] ?? 9) - (severityOrder[b.severidade] ?? 9),
        );

        sortedDiags.forEach((d, idx) => {
            const r = idx + 5;
            const dr = wsIA.getRow(r);

            dr.getCell(1).value = d.canal;
            dr.getCell(2).value = SEVERITY_LABEL[d.severidade] ?? d.severidade;
            dr.getCell(3).value = d.sintoma;
            dr.getCell(4).value = d.causa_raiz;
            dr.getCell(5).value = d.acao_recomendada;
            dr.getCell(6).value = fmtBrl(d.consequencia_financeira_brl);
            dr.getCell(7).value = PRAZO_LABEL[d.prazo] ?? d.prazo;

            styleDataRow(dr, iaColCount, idx);

            // Wrap text on long columns
            [3, 4, 5].forEach(col => {
                dr.getCell(col).alignment = { vertical: 'middle', wrapText: true, horizontal: 'left' };
            });

            // Severity color
            const sevCell = dr.getCell(2);
            const sevColor = SEVERITY_COLOR[d.severidade] ?? C.textSecondary;
            sevCell.font = colorFont(sevColor, true, 10);
            sevCell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Proximos passos section
        if (ai.proximos_passos.length > 0) {
            const startRow = 5 + sortedDiags.length + 1; // +1 empty row

            wsIA.mergeCells(startRow, 1, startRow, iaColCount);
            const ppTitle = wsIA.getCell(startRow, 1);
            ppTitle.value = 'PROXIMOS PASSOS';
            ppTitle.font = { bold: true, size: 11, color: { argb: 'FF1E1E1E' } };
            ppTitle.alignment = { vertical: 'middle' };
            wsIA.getRow(startRow).height = 26;

            ai.proximos_passos.forEach((passo, idx) => {
                const r = startRow + 1 + idx;
                wsIA.mergeCells(r, 1, r, iaColCount);
                const cell = wsIA.getCell(r, 1);
                cell.value = `${idx + 1}. ${passo}`;
                cell.font = { size: 10 };
                cell.alignment = { vertical: 'middle', wrapText: true };
                wsIA.getRow(r).height = 22;
            });
        }
    }

    // ── Generate buffer ──────────────────────────────────────────────────────

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
}
