import { createRequire } from 'module';
import type { generateReportData } from './report-generator.js';
import type { ReportAIAnalysis, ChannelDiagnosis } from './report-ai-analyst.js';

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PDFDoc = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PDFDocument: new (options?: Record<string, unknown>) => PDFDoc = require('pdfkit');

type ReportData = Awaited<ReturnType<typeof generateReportData>>;

// ── Layout constants ───────────────────────────────────────────────────────────

const MARGIN        = 48;
const PAGE_W        = 595.28; // A4
const PAGE_H        = 841.89; // A4
const CONTENT_W     = PAGE_W - MARGIN * 2;
const FOOTER_ZONE   = PAGE_H - 50;
const HEADER_H      = 60;

// ── Brand palette ──────────────────────────────────────────────────────────────

const C = {
    dark:          '#1E1E1E',
    accent:        '#1a1a2e',
    white:         '#FFFFFF',
    tableLine:     '#F0F0F0',
    zebraRow:      '#F8F8F8',
    textSecondary: '#6B7280',
    success:       '#16A34A',
    danger:        '#DC2626',
    warning:       '#D97706',
    severe:        '#EA580C',
    primary:       '#2563EB',
    border:        '#E5E7EB',
    bgLight:       '#F4F4F5',
    bgCover:       '#0F0F23',
};

const SEVERITY_COLOR: Record<ChannelDiagnosis['severidade'], string> = {
    critica: C.danger,
    alta:    C.severe,
    media:   C.warning,
    ok:      C.success,
};

const SEVERITY_LABEL: Record<ChannelDiagnosis['severidade'], string> = {
    critica: 'CRITICO',
    alta:    'GRAVE',
    media:   'MODERADO',
    ok:      'POSITIVO',
};

const PLATFORM_LABELS: Record<string, string> = {
    meta_ads: 'Meta Ads', meta: 'Meta Ads',
    google_ads: 'Google Ads', google: 'Google Ads',
    hotmart: 'Hotmart', stripe: 'Stripe', shopify: 'Shopify',
    organico: 'Organico', email: 'Email', direto: 'Direto',
    afiliado: 'Afiliado', desconhecido: 'Outros',
};

const STATUS_DEF: Record<string, { text: string; color: string }> = {
    approved:   { text: 'Aprovado',    color: C.success },
    refunded:   { text: 'Reembolsado', color: C.danger  },
    pending:    { text: 'Pendente',    color: C.warning  },
    cancelled:  { text: 'Cancelado',   color: C.textSecondary },
    chargeback: { text: 'Chargeback',  color: C.danger  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function streamToBuffer(doc: PDFDoc): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end',  () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });
}

function fmtBrl(n: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function fmtNum(n: number, decimals = 1): string {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(n: number): string {
    return `${fmtNum(n)}%`;
}

function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtDateShort(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function changeBadge(pct: number | null): string {
    if (pct === null) return '';
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${fmtNum(pct)}%`;
}

function translateChannel(ch: string): string {
    return PLATFORM_LABELS[ch] ?? ch;
}

// ── Drawing primitives ─────────────────────────────────────────────────────────

function drawHRule(doc: PDFDoc, y: number, color = C.border, width = 0.5): void {
    doc.save()
        .moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y)
        .strokeColor(color).lineWidth(width).stroke()
        .restore();
}

function ensureSpace(doc: PDFDoc, needed: number, profileName: string | null, periodLabel: string): void {
    if (doc.y + needed > FOOTER_ZONE) {
        doc.addPage();
        drawPageHeader(doc, profileName, periodLabel);
        doc.y = HEADER_H + 16;
    }
}

function drawPageHeader(doc: PDFDoc, profileName: string | null, periodLabel: string): void {
    doc.save().rect(0, 0, PAGE_W, HEADER_H).fillColor(C.accent).fill().restore();

    doc.font('Helvetica-Bold').fontSize(17).fillColor(C.white).text('NORTHIE', MARGIN, 14);
    doc.font('Helvetica').fontSize(7.5).fillColor('#A0A8C8').text(periodLabel, MARGIN, 40);

    if (profileName) {
        doc.font('Helvetica').fontSize(9).fillColor('#D8DCF0')
            .text(profileName, 0, 20, { width: PAGE_W - MARGIN, align: 'right' });
    }
}

function drawSectionHeader(
    doc: PDFDoc,
    num: string,
    title: string,
    profileName: string | null,
    periodLabel: string,
    forceNewPage = true,
): void {
    if (forceNewPage) {
        doc.addPage();
        drawPageHeader(doc, profileName, periodLabel);
        doc.y = HEADER_H + 16;
    } else {
        ensureSpace(doc, 50, profileName, periodLabel);
    }

    const y = doc.y;
    doc.save().rect(MARGIN - 10, y, CONTENT_W + 20, 32).fillColor(C.bgLight).fill().restore();
    doc.save().rect(MARGIN - 10, y, 4, 32).fillColor(C.accent).fill().restore();

    doc.font('Helvetica').fontSize(7).fillColor(C.textSecondary)
        .text(num, MARGIN + 4, y + 5, { lineBreak: false, characterSpacing: 1 });

    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.dark)
        .text(`  ${title}`, { lineBreak: false });

    doc.y = y + 42;
}

function drawSubLabel(doc: PDFDoc, title: string): void {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.textSecondary)
        .text(title.toUpperCase(), MARGIN, doc.y, { characterSpacing: 1 });
    drawHRule(doc, doc.y + 4, C.tableLine);
    doc.y += 12;
}

// ── Generic table ──────────────────────────────────────────────────────────────

interface TableCol { label: string; width: number; align: 'left' | 'right' | 'center'; font?: string }
interface TableRow { cells: Array<{ text: string; color?: string; font?: string }> }

function drawTable(
    doc: PDFDoc,
    columns: TableCol[],
    rows: TableRow[],
    profileName: string | null,
    periodLabel: string,
): void {
    const hH = 22;
    const rH = 20;
    const colW = columns.map(c => CONTENT_W * c.width);

    const drawHeader = (yPos: number) => {
        doc.save().rect(MARGIN, yPos, CONTENT_W, hH).fillColor(C.accent).fill().restore();
        let hx = MARGIN + 8;
        doc.font('Helvetica-Bold').fontSize(7).fillColor(C.white);
        columns.forEach((col, i) => {
            const w = colW[i]!;
            doc.text(col.label, hx, yPos + 7, { width: w - 12, align: col.align, characterSpacing: 0.4 });
            hx += w;
        });
    };

    ensureSpace(doc, hH + rH + 4, profileName, periodLabel);
    const startY = doc.y;
    drawHeader(startY);
    let rowY = startY + hH;

    rows.forEach((row, idx) => {
        if (rowY + rH > FOOTER_ZONE) {
            doc.save().rect(MARGIN, startY, CONTENT_W, rowY - startY).strokeColor(C.tableLine).lineWidth(0.5).stroke().restore();
            doc.addPage();
            drawPageHeader(doc, profileName, periodLabel);
            doc.y = HEADER_H + 16;
            drawHeader(doc.y);
            rowY = doc.y + hH;
        }

        doc.save().rect(MARGIN, rowY, CONTENT_W, rH).fillColor(idx % 2 === 1 ? C.zebraRow : C.white).fill().restore();

        let cx = MARGIN + 8;
        columns.forEach((col, i) => {
            const w    = colW[i]!;
            const cell = row.cells[i]!;
            const font = cell.font ?? col.font ?? 'Helvetica';
            doc.font(font).fontSize(8.5).fillColor(cell.color ?? C.dark)
                .text(cell.text, cx, rowY + 6, { width: w - 12, align: col.align });
            cx += w;
        });

        rowY += rH;
    });

    doc.save().rect(MARGIN, startY, CONTENT_W, rowY - startY).strokeColor(C.tableLine).lineWidth(0.5).stroke().restore();
    doc.y = rowY + 10;
}

// ── KPI Cards ──────────────────────────────────────────────────────────────────

interface KpiCard {
    label: string;
    value: string;
    sub?: string | undefined;
    subColor?: string | undefined;
    benchmark?: string | undefined;
    accentColor?: string | undefined;
}

function drawKpiGrid(doc: PDFDoc, cards: KpiCard[], cols = 3): void {
    const gap  = 8;
    const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
    const cardH = 72;
    const startY = doc.y;

    cards.forEach((card, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x   = MARGIN + col * (cardW + gap);
        const y   = startY + row * (cardH + gap);
        const ac  = card.accentColor ?? C.accent;

        // Card
        doc.save().rect(x, y, cardW, cardH).strokeColor(C.border).lineWidth(0.5).stroke().restore();
        doc.save().rect(x, y, 3, cardH).fillColor(ac).fill().restore();

        // Label
        doc.font('Helvetica').fontSize(7).fillColor(C.textSecondary)
            .text(card.label.toUpperCase(), x + 10, y + 8, { width: cardW - 16, characterSpacing: 0.3 });

        // Value
        doc.font('Helvetica-Bold').fontSize(14).fillColor(C.dark)
            .text(card.value, x + 10, y + 22, { width: cardW - 16 });

        // Sub
        if (card.sub) {
            doc.font('Helvetica').fontSize(7.5).fillColor(card.subColor ?? C.textSecondary)
                .text(card.sub, x + 10, y + 48, { width: cardW - 16 });
        }

        // Benchmark
        if (card.benchmark) {
            doc.font('Helvetica').fontSize(6.5).fillColor(C.textSecondary)
                .text(card.benchmark, x + 10, card.sub ? y + 58 : y + 52, { width: cardW - 16 });
        }
    });

    const totalRows = Math.ceil(cards.length / cols);
    doc.y = startY + totalRows * (cardH + gap) + 8;
}

// ── Health score bar ───────────────────────────────────────────────────────────

function drawHealthScore(
    doc: PDFDoc,
    score: number,
    label: string,
    color: string,
    breakdown: Record<string, { score: number; weight: number; label: string }>,
): void {
    const barW = CONTENT_W * 0.58;
    const barH = 20;
    const barX = MARGIN;
    const barY = doc.y;

    // Background
    doc.save().rect(barX, barY, barW, barH).fillColor('#E5E7EB').fill().restore();
    // Fill
    doc.save().rect(barX, barY, barW * (score / 100), barH).fillColor(color).fill().restore();
    // Score text inside bar
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.white)
        .text(`${score}/100`, barX + 8, barY + 5, { lineBreak: false });

    // Label to the right
    doc.font('Helvetica-Bold').fontSize(11).fillColor(color)
        .text(label, barX + barW + 14, barY + 4, { lineBreak: false });

    doc.y = barY + barH + 14;

    // Breakdown row
    const bKeys = Object.entries(breakdown);
    const bColW = CONTENT_W / bKeys.length;
    bKeys.forEach(([, v], i) => {
        const bx = MARGIN + i * bColW;
        const by = doc.y;
        const bColor = v.score >= 75 ? C.success : v.score >= 50 ? C.warning : C.danger;
        doc.font('Helvetica').fontSize(7).fillColor(C.textSecondary)
            .text(['LTV/CAC', 'Reembolso', 'Crescimento', 'ROAS'][i] ?? '',
                bx, by, { width: bColW - 4 });
        doc.font('Helvetica-Bold').fontSize(8).fillColor(bColor)
            .text(`${v.score}  ${v.label} (${v.weight}%)`, bx, by + 10, { width: bColW - 4 });
    });

    doc.y += 34;
}

// ── Cover page ─────────────────────────────────────────────────────────────────

function drawCoverPage(doc: PDFDoc, data: ReportData, ai?: ReportAIAnalysis): void {
    const coverH = 310;
    const profileName = data.profile_name ?? 'Seu Negocio';
    const periodLabel = `${fmtDate(data.period.start)} — ${fmtDate(data.period.end)}`;
    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const businessModel = data.business_model_info?.label ?? 'Negocio Digital';

    // Dark cover background
    doc.save().rect(0, 0, PAGE_W, coverH).fillColor(C.bgCover).fill().restore();

    // Decorative accent bar
    doc.save().rect(0, coverH - 6, PAGE_W, 6).fillColor(C.accent).fill().restore();

    // NORTHIE logo
    doc.font('Helvetica-Bold').fontSize(28).fillColor(C.white).text('NORTHIE', MARGIN, 36);

    // Divider line
    doc.save().moveTo(MARGIN, 80).lineTo(PAGE_W - MARGIN, 80)
        .strokeColor('#2a2a4a').lineWidth(0.8).stroke().restore();

    // Report title
    doc.font('Helvetica').fontSize(9).fillColor('#A0A8C8').letterSpacing = 2;
    doc.font('Helvetica').fontSize(9).fillColor('#A0A8C8')
        .text('RELATORIO DE PERFORMANCE', MARGIN, 90, { characterSpacing: 2 });

    // Business name
    const nameY = 118;
    const nameSize = profileName.length > 25 ? 20 : 24;
    doc.font('Helvetica-Bold').fontSize(nameSize).fillColor(C.white)
        .text(profileName, MARGIN, nameY, { width: CONTENT_W });

    // Business model badge
    doc.y = nameY + (nameSize === 24 ? 34 : 28);
    const bmLabel = businessModel;
    const badgeW = doc.widthOfString(bmLabel, { fontSize: 8 }) + 20;
    doc.save().roundedRect(MARGIN, doc.y, badgeW, 18, 9).fillColor('#2a2a5e').fill().restore();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#A0C4FF')
        .text(bmLabel, MARGIN + 10, doc.y + 4, { lineBreak: false });

    // Period + date
    doc.y += 30;
    doc.font('Helvetica').fontSize(9).fillColor('#A0A8C8').text(`Periodo: ${periodLabel}`, MARGIN, doc.y);
    doc.font('Helvetica').fontSize(9).fillColor('#A0A8C8').text(`Gerado em: ${today}`, MARGIN, doc.y + 14);

    // Active integrations
    if (data.integrations_active && data.integrations_active.length > 0) {
        doc.y += 34;
        doc.font('Helvetica').fontSize(7.5).fillColor('#6B7CA8').text('INTEGRACOES ATIVAS:', MARGIN, doc.y);
        const intLabels = data.integrations_active.map(k => PLATFORM_LABELS[k] ?? k);
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#D8DCF0')
            .text(intLabels.join('   |   '), MARGIN, doc.y + 12, { width: CONTENT_W });
    }

    // Health score preview on cover
    const coverBottom = coverH + 16;

    if (data.health_score) {
        const hs = data.health_score;
        const hsX = MARGIN;
        const hsY = coverBottom;
        const barW = CONTENT_W * 0.5;

        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.textSecondary)
            .text('SAUDE DO NEGOCIO', hsX, hsY, { characterSpacing: 0.8 });
        doc.y = hsY + 14;
        doc.save().rect(hsX, doc.y, barW, 14).fillColor('#E5E7EB').fill().restore();
        doc.save().rect(hsX, doc.y, barW * (hs.score / 100), 14).fillColor(hs.color).fill().restore();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(hs.color)
            .text(`${hs.score}/100 — ${hs.label}`, hsX + barW + 12, doc.y + 2, { lineBreak: false });
        doc.y += 28;
    }

    // Key metrics preview (3 cards)
    doc.y = Math.max(doc.y, coverH + 60);
    const previewCards: KpiCard[] = [
        {
            label: 'Faturamento Liquido',
            value: fmtBrl(data.summary.revenue_net),
            sub: data.summary.revenue_change_pct !== null
                ? `${changeBadge(data.summary.revenue_change_pct)} vs periodo anterior`
                : undefined,
            subColor: (data.summary.revenue_change_pct ?? 0) >= 0 ? C.success : C.danger,
        },
        {
            label: 'ROAS Consolidado',
            value: data.summary.roas > 0 ? `${fmtNum(data.summary.roas)}x` : '--',
            sub: data.summary.ad_spend > 0 ? `Invest.: ${fmtBrl(data.summary.ad_spend)}` : undefined,
        },
        {
            label: ai ? 'Situacao Geral' : 'Novos Clientes',
            value: ai
                ? ({ saudavel: 'Saudavel', atencao: 'Atencao', critica: 'Critica' }[ai.situacao_geral] ?? '')
                : String(data.summary.new_customers),
            accentColor: ai
                ? ({ saudavel: C.success, atencao: C.warning, critica: C.danger }[ai.situacao_geral] ?? C.accent)
                : C.accent,
        },
    ];

    drawKpiGrid(doc, previewCards, 3);

    // Confidential footer on cover
    doc.font('Helvetica').fontSize(7.5).fillColor(C.textSecondary)
        .text('Este relatorio e confidencial e destinado exclusivamente ao proprietario do negocio.',
            MARGIN, PAGE_H - 55, { width: CONTENT_W, align: 'center' });
    doc.font('Helvetica').fontSize(7.5).fillColor(C.textSecondary)
        .text('Gerado pela Northie | northie.com.br',
            MARGIN, PAGE_H - 42, { width: CONTENT_W, align: 'center' });
}

// ── Secao 1 — Resumo Executivo ─────────────────────────────────────────────────

function drawSection1(
    doc: PDFDoc,
    data: ReportData,
    ai: ReportAIAnalysis | undefined,
    profileName: string | null,
    periodLabel: string,
): void {
    drawSectionHeader(doc, '01', 'RESUMO EXECUTIVO', profileName, periodLabel);

    // Health score
    if (data.health_score) {
        drawSubLabel(doc, 'Saude do Negocio');
        drawHealthScore(
            doc,
            data.health_score.score,
            data.health_score.label,
            data.health_score.color,
            data.health_score.breakdown,
        );
        doc.moveDown(0.4);
    }

    // AI executive summary or fallback
    const summary = ai?.resumo_executivo;
    if (summary) {
        drawSubLabel(doc, 'Analise de IA');
        doc.font('Helvetica').fontSize(9.5).fillColor(C.dark)
            .text(summary, MARGIN, doc.y, { width: CONTENT_W, lineGap: 3 });
        doc.moveDown(1);
    }

    // Top alerts (critica / alta) and positive points (ok) from AI
    const alerts    = ai?.diagnosticos.filter(d => d.severidade === 'critica' || d.severidade === 'alta').slice(0, 3) ?? [];
    const positives = ai?.diagnosticos.filter(d => d.severidade === 'ok').slice(0, 3) ?? [];

    const hasTwoCol = alerts.length > 0 || positives.length > 0;
    if (hasTwoCol) {
        ensureSpace(doc, 100, profileName, periodLabel);
        const colW = (CONTENT_W - 12) / 2;
        const startY = doc.y;

        // Alerts column
        if (alerts.length > 0) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor(C.danger)
                .text('ALERTAS CRITICOS', MARGIN, startY, { width: colW });
            let ay = startY + 16;
            alerts.forEach(d => {
                ensureSpace(doc, 30, profileName, periodLabel);
                const col = SEVERITY_COLOR[d.severidade];
                doc.save().rect(MARGIN, ay, 3, 24).fillColor(col).fill().restore();
                doc.font('Helvetica-Bold').fontSize(8).fillColor(C.dark)
                    .text(translateChannel(d.canal).toUpperCase(), MARGIN + 8, ay, { width: colW - 12 });
                doc.font('Helvetica').fontSize(7.5).fillColor(C.textSecondary)
                    .text(d.sintoma, MARGIN + 8, ay + 12, { width: colW - 12 });
                ay += 32;
            });
        }

        // Positive points column
        if (positives.length > 0) {
            const posX = MARGIN + colW + 12;
            doc.font('Helvetica-Bold').fontSize(8).fillColor(C.success)
                .text('PONTOS POSITIVOS', posX, startY, { width: colW });
            let py = startY + 16;
            positives.forEach(d => {
                doc.save().rect(posX, py, 3, 24).fillColor(C.success).fill().restore();
                doc.font('Helvetica-Bold').fontSize(8).fillColor(C.dark)
                    .text(translateChannel(d.canal).toUpperCase(), posX + 8, py, { width: colW - 12 });
                doc.font('Helvetica').fontSize(7.5).fillColor(C.textSecondary)
                    .text(d.sintoma, posX + 8, py + 12, { width: colW - 12 });
                py += 32;
            });
        }

        doc.y = Math.max(doc.y, startY + (Math.max(alerts.length, positives.length) * 32) + 24);
    }

    // Missing integrations banner
    const missing = data.missing_integrations ?? [];
    if (missing.length > 0) {
        ensureSpace(doc, 50, profileName, periodLabel);
        doc.moveDown(0.3);
        const bannerY = doc.y;
        const bannerH = 12 + missing.length * 14 + 8;
        doc.save().rect(MARGIN, bannerY, CONTENT_W, bannerH).fillColor('#EFF6FF').fill().restore();
        doc.save().rect(MARGIN, bannerY, 3, bannerH).fillColor(C.primary).fill().restore();
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.primary)
            .text('INTEGRACOES QUE MELHORARIAM ESTE RELATORIO:', MARGIN + 8, bannerY + 6);
        missing.forEach((m, i) => {
            doc.font('Helvetica').fontSize(7.5).fillColor(C.dark)
                .text(`+ ${m.platform}: ${m.benefit}`, MARGIN + 8, bannerY + 18 + i * 13);
        });
        doc.y = bannerY + bannerH + 8;
    }
}

// ── Secao 2 — Painel Financeiro Consolidado ────────────────────────────────────

function drawSection2(
    doc: PDFDoc,
    data: ReportData,
    profileName: string | null,
    periodLabel: string,
): void {
    drawSectionHeader(doc, '02', 'PAINEL FINANCEIRO CONSOLIDADO', profileName, periodLabel);

    const s = data.summary;
    const ltv_cac = data.ltv_cac_overall;
    const payback = data.payback_months;

    const cards: KpiCard[] = [
        {
            label: 'Faturamento Liquido',
            value: fmtBrl(s.revenue_net),
            sub: s.revenue_change_pct !== null ? `${changeBadge(s.revenue_change_pct)} vs periodo anterior` : undefined,
            subColor: (s.revenue_change_pct ?? 0) >= 0 ? C.success : C.danger,
            accentColor: C.accent,
        },
        {
            label: 'MRR Projetado',
            value: fmtBrl(data.mrr_projected ?? s.revenue_net * (30 / data.period.days)),
            sub: `ARR: ${fmtBrl(data.arr_projected ?? s.revenue_net * (365 / data.period.days))}`,
        },
        {
            label: 'Ticket Medio (AOV)',
            value: fmtBrl(s.aov),
            sub: `${s.transactions} transacoes`,
        },
        {
            label: 'LTV Medio',
            value: fmtBrl(s.ltv_avg),
            sub: ltv_cac !== null ? `LTV/CAC: ${fmtNum(ltv_cac)}x` : undefined,
            subColor: ltv_cac !== null ? (ltv_cac >= 3 ? C.success : ltv_cac >= 1.5 ? C.warning : C.danger) : undefined,
            benchmark: 'Otimo: >3x | Saudavel: >1.5x',
        },
        {
            label: 'CAC Medio',
            value: data.cac_overall > 0 ? fmtBrl(data.cac_overall) : '--',
            sub: payback !== null ? `Payback: ${fmtNum(payback)} meses` : `${s.new_customers} novos clientes`,
            benchmark: 'Bom: <12 meses payback',
        },
        {
            label: 'Margem de Contribuicao',
            value: fmtPct(data.margin_contribution_pct),
            sub: fmtBrl(data.margin_contribution_brl),
            subColor: data.margin_contribution_brl >= 0 ? C.success : C.danger,
        },
    ];

    drawKpiGrid(doc, cards, 3);
    doc.moveDown(0.5);

    // Revenue by source (multi-source flag)
    const cr = data.consolidated_revenue;
    if (cr && cr.is_multi_source && cr.by_source.length > 0) {
        ensureSpace(doc, 60, profileName, periodLabel);
        drawSubLabel(doc, 'Receita por Plataforma');
        if (cr.consolidation_note) {
            doc.font('Helvetica').fontSize(7.5).fillColor(C.primary)
                .text(cr.consolidation_note, MARGIN, doc.y, { width: CONTENT_W });
            doc.moveDown(0.5);
        }
        const cols = [
            { label: 'PLATAFORMA', width: 0.30, align: 'left'  as const },
            { label: 'RECEITA',    width: 0.30, align: 'right' as const, font: 'Courier' },
            { label: '% DO TOTAL', width: 0.20, align: 'right' as const, font: 'Courier' },
            { label: 'MODELO',     width: 0.20, align: 'left'  as const },
        ];
        const modelMap: Record<string, string> = { stripe: 'SaaS', hotmart: 'Infoproduto', shopify: 'E-commerce' };
        const rows = cr.by_source.map(s2 => ({
            cells: [
                { text: s2.label },
                { text: fmtBrl(s2.amount), font: 'Courier' },
                { text: fmtPct(s2.pct), font: 'Courier' },
                { text: modelMap[s2.platform] ?? '--' },
            ],
        }));
        drawTable(doc, cols, rows, profileName, periodLabel);
    }

    // Revenue trend
    if (data.revenue_trend.length >= 2) {
        ensureSpace(doc, 80, profileName, periodLabel);
        drawSubLabel(doc, 'Tendencia de Receita (ultimos 6 meses)');
        const trendCols = [
            { label: 'MES',       width: 0.18, align: 'left'  as const },
            { label: 'RECEITA',   width: 0.30, align: 'right' as const, font: 'Courier' },
            { label: 'VARIACAO',  width: 0.20, align: 'right' as const, font: 'Courier' },
            { label: 'TENDENCIA', width: 0.32, align: 'left'  as const },
        ];
        const trendRows = data.revenue_trend.map(t => {
            const pct = t.change_pct;
            const trend = pct === null ? '--'
                : pct > 10 ? 'Crescimento forte'
                : pct > 0  ? 'Crescimento estavel'
                : pct > -5 ? 'Leve queda'
                : 'Queda significativa';
            return {
                cells: [
                    { text: t.month },
                    { text: fmtBrl(t.revenue), font: 'Courier' },
                    { text: pct !== null ? changeBadge(pct) : '--', font: 'Courier',
                      color: pct === null ? C.textSecondary : pct >= 0 ? C.success : C.danger },
                    { text: trend, color: pct === null ? C.textSecondary : pct > 0 ? C.success : C.danger },
                ],
            };
        });
        drawTable(doc, trendCols, trendRows, profileName, periodLabel);
    }

    // Top products
    if (data.top_products.length > 0) {
        ensureSpace(doc, 80, profileName, periodLabel);
        drawSubLabel(doc, 'Top Produtos do Periodo');
        const prodCols = [
            { label: 'PRODUTO',       width: 0.40, align: 'left'  as const },
            { label: 'RECEITA',       width: 0.25, align: 'right' as const, font: 'Courier' },
            { label: 'TRANSACOES',    width: 0.18, align: 'right' as const, font: 'Courier' },
            { label: '% DO TOTAL',    width: 0.17, align: 'right' as const, font: 'Courier' },
        ];
        const prodRows = data.top_products.map(p => ({
            cells: [
                { text: p.product_name },
                { text: fmtBrl(p.revenue),     font: 'Courier' },
                { text: String(p.transactions), font: 'Courier' },
                { text: `${p.pct_of_total}%`,  font: 'Courier' },
            ],
        }));
        drawTable(doc, prodCols, prodRows, profileName, periodLabel);
    }
}

// ── Secao 3 — Analise de Aquisicao e Ads ──────────────────────────────────────

function drawSection3(
    doc: PDFDoc,
    data: ReportData,
    profileName: string | null,
    periodLabel: string,
): void {
    drawSectionHeader(doc, '03', 'ANALISE DE AQUISICAO E ADS', profileName, periodLabel);

    const s = data.summary;
    const hasAds = s.ad_spend > 0;

    if (!hasAds) {
        doc.font('Helvetica').fontSize(9.5).fillColor(C.textSecondary)
            .text('Nenhum dado de investimento em ads encontrado neste periodo. Conecte Meta Ads ou Google Ads para visualizar esta secao.',
                MARGIN, doc.y, { width: CONTENT_W });
        doc.moveDown(1);
        return;
    }

    // Total ads overview
    const adsCards: KpiCard[] = [
        { label: 'Investimento Total em Ads', value: fmtBrl(s.ad_spend), accentColor: C.accent },
        { label: 'ROAS Geral', value: `${fmtNum(s.roas)}x`,
          sub: s.roas >= 3 ? 'Saudavel' : s.roas >= 1 ? 'Abaixo do ideal' : 'Prejuizo',
          subColor: s.roas >= 3 ? C.success : s.roas >= 1 ? C.warning : C.danger,
          benchmark: 'Saudavel: >3x | Otimo: >5x' },
        { label: 'Impressoes Totais', value: s.impressions.toLocaleString('pt-BR'),
          sub: s.clicks > 0 ? `CTR: ${fmtPct(s.ctr)}` : undefined },
    ];
    drawKpiGrid(doc, adsCards, 3);
    doc.moveDown(0.3);

    // Per-platform spend
    const spendPlatforms = Object.entries(data.spend_by_platform ?? {}).filter(([, v]) => v > 0);
    if (spendPlatforms.length > 0) {
        ensureSpace(doc, 80, profileName, periodLabel);
        drawSubLabel(doc, 'Performance por Plataforma de Ads');
        const adCols = [
            { label: 'PLATAFORMA',        width: 0.22, align: 'left'  as const },
            { label: 'INVESTIMENTO',      width: 0.22, align: 'right' as const, font: 'Courier' },
            { label: 'RECEITA ATRIBUIDA', width: 0.24, align: 'right' as const, font: 'Courier' },
            { label: 'ROAS REAL',         width: 0.16, align: 'right' as const, font: 'Courier' },
            { label: 'STATUS',            width: 0.16, align: 'center' as const },
        ];
        const adRows = spendPlatforms.map(([platform, spend]) => {
            const revAttr = (data.revenue_by_platform ?? {})[platform] ?? 0;
            const roas = spend > 0 ? revAttr / spend : 0;
            const label = PLATFORM_LABELS[platform] ?? platform;
            return {
                cells: [
                    { text: label },
                    { text: fmtBrl(spend),  font: 'Courier' },
                    { text: revAttr > 0 ? fmtBrl(revAttr) : '--', font: 'Courier' },
                    { text: revAttr > 0 ? `${fmtNum(roas)}x` : '--', font: 'Courier',
                      color: roas >= 3 ? C.success : roas >= 1 ? C.warning : C.danger },
                    { text: roas >= 3 ? 'Saudavel' : roas >= 1 ? 'Atencao' : spend > 0 ? 'Critico' : '--',
                      color: roas >= 3 ? C.success : roas >= 1 ? C.warning : C.danger },
                ],
            };
        });
        drawTable(doc, adCols, adRows, profileName, periodLabel);
    }

    // Channel economics table (full)
    const channels = data.channel_economics.filter(c => c.channel !== 'desconhecido');
    if (channels.length > 0) {
        ensureSpace(doc, 80, profileName, periodLabel);
        drawSubLabel(doc, 'Economia por Canal de Aquisicao');
        const econCols = [
            { label: 'CANAL',           width: 0.18, align: 'left'  as const },
            { label: 'NOVOS CLI.',      width: 0.12, align: 'right' as const, font: 'Courier' },
            { label: 'LTV MEDIO',       width: 0.18, align: 'right' as const, font: 'Courier' },
            { label: 'CAC',             width: 0.16, align: 'right' as const, font: 'Courier' },
            { label: 'LTV/CAC',         width: 0.13, align: 'right' as const, font: 'Courier' },
            { label: 'VALOR CRIADO',    width: 0.23, align: 'right' as const, font: 'Courier' },
        ];
        const econRows = channels.map(ch => {
            const ratio = ch.ltv_cac_ratio;
            const rColor = ratio === null ? C.textSecondary : ratio >= 3 ? C.success : ratio >= 1 ? C.warning : C.danger;
            return {
                cells: [
                    { text: translateChannel(ch.channel) },
                    { text: String(ch.new_customers), font: 'Courier' },
                    { text: fmtBrl(ch.avg_ltv),  font: 'Courier' },
                    { text: ch.cac > 0 ? fmtBrl(ch.cac) : '--', font: 'Courier' },
                    { text: ratio !== null ? `${fmtNum(ratio)}x` : '--', font: 'Courier', color: rColor },
                    { text: fmtBrl(ch.value_created), font: 'Courier',
                      color: ch.value_created >= 0 ? C.success : C.danger },
                ],
            };
        });
        drawTable(doc, econCols, econRows, profileName, periodLabel);
    }
}

// ── Secao 4 — Retencao, Churn e Valor do Cliente ──────────────────────────────

function drawSection4(
    doc: PDFDoc,
    data: ReportData,
    profileName: string | null,
    periodLabel: string,
): void {
    drawSectionHeader(doc, '04', 'RETENCAO, CHURN E VALOR DO CLIENTE', profileName, periodLabel);

    const s = data.summary;
    const ltv_cac = data.ltv_cac_overall;
    const payback = data.payback_months;

    const retCards: KpiCard[] = [
        {
            label: 'LTV / CAC',
            value: ltv_cac !== null ? `${fmtNum(ltv_cac)}x` : '--',
            sub: ltv_cac !== null
                ? ltv_cac >= 5 ? 'Excelente' : ltv_cac >= 3 ? 'Saudavel' : ltv_cac >= 1.5 ? 'Atencao' : 'Critico'
                : 'Sem dados de CAC',
            subColor: ltv_cac !== null ? (ltv_cac >= 3 ? C.success : ltv_cac >= 1.5 ? C.warning : C.danger) : C.textSecondary,
            benchmark: 'Otimo: >5x | Minimo: 3x',
        },
        {
            label: 'Payback Period',
            value: payback !== null ? `${fmtNum(payback)} meses` : '--',
            sub: payback !== null
                ? payback <= 6 ? 'Excelente' : payback <= 12 ? 'Saudavel' : 'Acima do ideal'
                : 'Calcular com mais dados',
            subColor: payback !== null ? (payback <= 12 ? C.success : C.warning) : C.textSecondary,
            benchmark: 'Bom: <12 meses',
        },
        {
            label: 'Taxa de Reembolso',
            value: fmtPct(s.refund_rate),
            sub: fmtBrl(s.refund_amount) + ' reembolsado',
            subColor: s.refund_rate <= 5 ? C.success : s.refund_rate <= 10 ? C.warning : C.danger,
            benchmark: 'Saudavel: <5% | Critico: >15%',
            accentColor: s.refund_rate <= 5 ? C.success : s.refund_rate <= 10 ? C.warning : C.danger,
        },
        {
            label: 'Base Total de Clientes',
            value: s.total_customers.toLocaleString('pt-BR'),
            sub: `${s.new_customers} novos no periodo`,
        },
        {
            label: 'Clientes em Risco de Churn',
            value: String(data.at_risk_customers.length),
            sub: data.at_risk_customers.length > 0
                ? `LTV em risco: ${fmtBrl(data.at_risk_customers.reduce((a, c) => a + (c.ltv ?? 0), 0))}`
                : 'Nenhum identificado',
            subColor: data.at_risk_customers.length > 5 ? C.danger : data.at_risk_customers.length > 0 ? C.warning : C.success,
            accentColor: data.at_risk_customers.length > 5 ? C.danger : C.accent,
        },
        {
            label: 'Margem Bruta',
            value: fmtPct(s.gross_margin_pct),
            sub: `Receita bruta: ${fmtBrl(s.revenue_gross)}`,
        },
    ];

    drawKpiGrid(doc, retCards, 3);
    doc.moveDown(0.4);

    // At-risk customers
    if (data.at_risk_customers.length > 0) {
        ensureSpace(doc, 80, profileName, periodLabel);
        drawSubLabel(doc, `Clientes em Risco de Churn (${data.at_risk_customers.length} identificados)`);
        const riskCols = [
            { label: 'LTV',         width: 0.22, align: 'right' as const, font: 'Courier' },
            { label: 'CANAL',       width: 0.20, align: 'left'  as const },
            { label: 'PROB. CHURN', width: 0.18, align: 'right' as const, font: 'Courier' },
            { label: 'DIAS S/ COMPRA', width: 0.20, align: 'right' as const, font: 'Courier' },
            { label: 'RFM SCORE',   width: 0.20, align: 'center' as const },
        ];
        const riskRows = data.at_risk_customers.slice(0, 15).map(c => ({
            cells: [
                { text: fmtBrl(c.ltv ?? 0), font: 'Courier' },
                { text: translateChannel(c.channel ?? 'desconhecido') },
                { text: c.churn_probability !== null ? `${fmtNum(c.churn_probability)}%` : '--',
                  font: 'Courier',
                  color: (c.churn_probability ?? 0) > 80 ? C.danger : C.warning },
                { text: c.days_since_purchase !== null ? `${c.days_since_purchase} dias` : '--', font: 'Courier' },
                { text: c.rfm_score ?? '--' },
            ],
        }));
        drawTable(doc, riskCols, riskRows, profileName, periodLabel);
    }

    // RFM distribution
    const rfmFiltered = data.rfm_distribution.filter(s2 => s2.count > 0);
    if (rfmFiltered.length > 0) {
        ensureSpace(doc, 80, profileName, periodLabel);
        const rfmNote = data.rfm_source === 'estimated' ? ' (estimado — ative o job de RFM para dados precisos)' : '';
        drawSubLabel(doc, `Segmentacao RFM da Base${rfmNote}`);

        const rfmLabels: Record<string, string> = {
            champions: 'Compram muito, recentemente e gastam alto',
            loyalists:  'Compram com frequencia e gastam bem',
            em_risco:   'Compraram antes mas estao sumindo',
            perdidos:   'Sem compras recentes — possivelmente churnados',
            novos:      'Primeira compra recente',
            outros:     'Perfil misto',
        };

        const rfmCols = [
            { label: 'SEGMENTO',   width: 0.18, align: 'left'  as const },
            { label: 'CLIENTES',   width: 0.14, align: 'right' as const, font: 'Courier' },
            { label: 'LTV TOTAL',  width: 0.22, align: 'right' as const, font: 'Courier' },
            { label: 'DESCRICAO',  width: 0.46, align: 'left'  as const },
        ];
        const rfmRows = rfmFiltered.map(seg => {
            const segColor = seg.segment === 'champions' ? C.success
                : seg.segment === 'loyalists' ? C.primary
                : seg.segment === 'em_risco' || seg.segment === 'perdidos' ? C.danger
                : C.textSecondary;
            return {
                cells: [
                    { text: seg.segment.replace('_', ' ').toUpperCase(), color: segColor, font: 'Helvetica-Bold' },
                    { text: String(seg.count), font: 'Courier' },
                    { text: fmtBrl(seg.ltv),   font: 'Courier' },
                    { text: rfmLabels[seg.segment] ?? '' },
                ],
            };
        });
        drawTable(doc, rfmCols, rfmRows, profileName, periodLabel);
    }
}

// ── Secao 5 — Engajamento e Operacao ──────────────────────────────────────────

function drawSection5(
    doc: PDFDoc,
    data: ReportData,
    profileName: string | null,
    periodLabel: string,
): void {
    drawSectionHeader(doc, '05', 'ENGAJAMENTO E OPERACAO', profileName, periodLabel);

    doc.font('Helvetica').fontSize(9).fillColor(C.textSecondary)
        .text('Esta secao consolida proxies de engajamento disponiveis. Conecte as integracoes abaixo para dados completos.',
            MARGIN, doc.y, { width: CONTENT_W });
    doc.moveDown(0.8);

    // Locked integration cards
    const lockedPlatforms = [
        { name: 'WhatsApp Business',    icon: '[W]', unlock: 'Volume de conversas, tempo de resposta e custo de CS' },
        { name: 'Google Calendar/Meet', icon: '[C]', unlock: 'Reunioes realizadas, tempo investido em clientes, custo oculto de retencao' },
        { name: 'Email (Resend)',        icon: '[E]', unlock: 'Taxa de abertura, clique, bounce — correlacao com churn' },
    ];

    const cardW = (CONTENT_W - 16) / 3;
    const cardH = 72;
    const startY = doc.y;

    lockedPlatforms.forEach((p, i) => {
        const x = MARGIN + i * (cardW + 8);
        doc.save().rect(x, startY, cardW, cardH).strokeColor(C.border).lineWidth(0.8).dash(3, { space: 3 }).stroke().restore();
        doc.save().rect(x, startY, cardW, cardH).fillColor('#FAFAFA').fill().restore();

        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.textSecondary)
            .text(p.icon, x + 8, startY + 8, { lineBreak: false })
            .text(` ${p.name}`, { lineBreak: false });

        doc.font('Helvetica').fontSize(7.5).fillColor(C.textSecondary)
            .text('Conecte para desbloquear:', x + 8, startY + 28, { width: cardW - 16 });

        doc.font('Helvetica').fontSize(7).fillColor(C.textSecondary)
            .text(p.unlock, x + 8, startY + 40, { width: cardW - 16 });
    });

    doc.y = startY + cardH + 16;

    // What IS available: RFM as engagement proxy
    const rfmChampions = data.rfm_distribution.find(s2 => s2.segment === 'champions');
    const rfmAtRisk    = data.rfm_distribution.find(s2 => s2.segment === 'em_risco' || s2.segment === 'perdidos');

    if ((rfmChampions?.count ?? 0) > 0 || (rfmAtRisk?.count ?? 0) > 0) {
        ensureSpace(doc, 60, profileName, periodLabel);
        drawSubLabel(doc, 'Proxy de Engajamento — Segmentacao RFM');

        const engagementInsight = [
            rfmChampions && rfmChampions.count > 0
                ? `${rfmChampions.count} clientes campeoes (${fmtBrl(rfmChampions.ltv)} em LTV) — priorizem retencao deste grupo.`
                : null,
            data.at_risk_customers.length > 0
                ? `${data.at_risk_customers.length} clientes com sinais de desengajamento — acionar campanha de reativacao.`
                : null,
            data.summary.refund_rate > 7
                ? `Taxa de reembolso de ${fmtPct(data.summary.refund_rate)} pode indicar problema de engajamento pos-venda.`
                : null,
        ].filter(Boolean) as string[];

        if (engagementInsight.length > 0) {
            engagementInsight.forEach(insight => {
                doc.save().rect(MARGIN, doc.y, 3, 18).fillColor(C.primary).fill().restore();
                doc.font('Helvetica').fontSize(9).fillColor(C.dark)
                    .text(insight, MARGIN + 10, doc.y + 3, { width: CONTENT_W - 10 });
                doc.y += 24;
            });
        }
    }
}

// ── Secao 6 — Projecoes ────────────────────────────────────────────────────────

function drawSection6(
    doc: PDFDoc,
    data: ReportData,
    profileName: string | null,
    periodLabel: string,
): void {
    drawSectionHeader(doc, '06', 'PROJECOES — PROXIMOS 3 MESES', profileName, periodLabel);

    const proj = data.projections;
    if (!proj) {
        doc.font('Helvetica').fontSize(9).fillColor(C.textSecondary)
            .text('Dados insuficientes para gerar projecoes. Necessario pelo menos 2 meses de historico.',
                MARGIN, doc.y, { width: CONTENT_W });
        return;
    }

    // Trajectory note
    doc.font('Helvetica').fontSize(9.5).fillColor(C.dark)
        .text(proj.trajectory_note, MARGIN, doc.y, { width: CONTENT_W, lineGap: 2 });
    doc.moveDown(0.8);

    doc.font('Helvetica').fontSize(8).fillColor(C.textSecondary)
        .text(`Base mensal atual: ${fmtBrl(proj.base_monthly)} | Tendencia recente: ${proj.trend_rate_pct >= 0 ? '+' : ''}${fmtNum(proj.trend_rate_pct)}%/mes`,
            MARGIN, doc.y, { width: CONTENT_W });
    doc.moveDown(0.8);

    // 3 scenario cards side by side
    const scenarios = [proj.conservative, proj.moderate, proj.optimistic];
    const cardW = (CONTENT_W - 16) / 3;
    const cardH = 110;
    const startY = doc.y;

    scenarios.forEach((sc, i) => {
        const x = MARGIN + i * (cardW + 8);
        const color = sc.color;

        doc.save().rect(x, startY, cardW, cardH).strokeColor(color).lineWidth(0.8).stroke().restore();
        doc.save().rect(x, startY, cardW, 24).fillColor(color).fill().restore();

        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.white)
            .text(`${sc.label.toUpperCase()}  ${sc.rate_pct >= 0 ? '+' : ''}${fmtNum(sc.rate_pct)}%/mes`,
                x + 8, startY + 7, { width: cardW - 16 });

        const rows = [
            { label: 'Mes 1', value: fmtBrl(sc.month1) },
            { label: 'Mes 2', value: fmtBrl(sc.month2) },
            { label: 'Mes 3', value: fmtBrl(sc.month3) },
        ];
        rows.forEach((row, ri) => {
            const ry = startY + 32 + ri * 24;
            doc.font('Helvetica').fontSize(7.5).fillColor(C.textSecondary).text(row.label, x + 8, ry);
            doc.font('Helvetica-Bold').fontSize(9).fillColor(C.dark).text(row.value, x + 8, ry + 10, { width: cardW - 16 });
        });
    });

    doc.y = startY + cardH + 16;

    // Impact analysis
    ensureSpace(doc, 60, profileName, periodLabel);
    drawSubLabel(doc, 'Analise de Impacto');

    if (data.cac_overall > 0 && data.summary.ltv_avg > 0) {
        const paybackImpact = data.payback_months;
        doc.font('Helvetica').fontSize(8.5).fillColor(C.dark)
            .text(`Se o LTV/CAC sair de ${fmtNum(data.ltv_cac_overall ?? 0)}x para 3x: o negocio recuperaria o investimento em aquisicao em ${fmtNum((data.cac_overall / (data.summary.ltv_avg / 12)), 0)} meses.`,
                MARGIN, doc.y, { width: CONTENT_W });
        doc.y += 16;
        if (paybackImpact && paybackImpact > 12) {
            doc.font('Helvetica').fontSize(8.5).fillColor(C.warning)
                .text(`Atencao: payback atual de ${fmtNum(paybackImpact)} meses indica necessidade de aumentar LTV ou reduzir CAC.`,
                    MARGIN, doc.y, { width: CONTENT_W });
            doc.y += 16;
        }
    }

    if (data.summary.refund_rate > 3) {
        const currentRefundImpact = data.summary.refund_amount;
        doc.font('Helvetica').fontSize(8.5).fillColor(C.dark)
            .text(`Reduzir a taxa de reembolso de ${fmtPct(data.summary.refund_rate)} para 3% recuperaria aprox. ${fmtBrl(currentRefundImpact * 0.5)}/mes em receita.`,
                MARGIN, doc.y, { width: CONTENT_W });
        doc.y += 16;
    }
}

// ── Secao 7 — Bloco Fundraising ────────────────────────────────────────────────

function drawSection7(
    doc: PDFDoc,
    data: ReportData,
    profileName: string | null,
    periodLabel: string,
): void {
    drawSectionHeader(doc, '07', 'BLOCO FUNDRAISING — NORTHIE RAISE', profileName, periodLabel);

    doc.save().rect(MARGIN, doc.y, CONTENT_W, 28).fillColor('#EFF6FF').fill().restore();
    doc.save().rect(MARGIN, doc.y, 3, 28).fillColor(C.primary).fill().restore();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.primary)
        .text('Metricas formatadas para apresentacao a investidores. Para data room completo, acesse Northie Raise na plataforma.',
            MARGIN + 10, doc.y + 9, { width: CONTENT_W - 14 });
    doc.y += 38;

    const ltv_cac = data.ltv_cac_overall;
    const mrr     = data.mrr_projected ?? 0;
    const arr     = data.arr_projected ?? 0;
    const payback = data.payback_months;
    const growthMoM = data.revenue_trend.length >= 2
        ? data.revenue_trend[data.revenue_trend.length - 1]?.change_pct ?? null
        : null;

    const investorCols = [
        { label: 'METRICA',           width: 0.30, align: 'left'  as const, font: 'Helvetica-Bold' },
        { label: 'VALOR',             width: 0.28, align: 'right' as const, font: 'Courier' },
        { label: 'VARIACAO / NOTA',   width: 0.25, align: 'left'  as const },
        { label: 'BENCHMARK',         width: 0.17, align: 'left'  as const },
    ];

    const investorRows = [
        {
            label: 'ARR Projetado',
            value: fmtBrl(arr),
            note: mrr > 0 ? `MRR: ${fmtBrl(mrr)}` : '--',
            benchmark: '--',
        },
        {
            label: 'MRR Growth MoM',
            value: growthMoM !== null ? `${growthMoM >= 0 ? '+' : ''}${fmtNum(growthMoM)}%` : '--',
            note: growthMoM !== null ? (growthMoM >= 15 ? 'Excelente' : growthMoM >= 5 ? 'Saudavel' : 'Abaixo do ideal') : 'Dados insuf.',
            benchmark: '>10%/mes',
        },
        {
            label: 'LTV / CAC',
            value: ltv_cac !== null ? `${fmtNum(ltv_cac)}x` : '--',
            note: ltv_cac !== null ? (ltv_cac >= 5 ? 'Excelente' : ltv_cac >= 3 ? 'Saudavel' : 'Abaixo') : '--',
            benchmark: '>3x',
        },
        {
            label: 'Payback Period',
            value: payback !== null ? `${fmtNum(payback)} meses` : '--',
            note: payback !== null ? (payback <= 6 ? 'Excelente' : payback <= 12 ? 'Bom' : 'Longo') : '--',
            benchmark: '<12 meses',
        },
        {
            label: 'Ticket Medio (AOV)',
            value: fmtBrl(data.summary.aov),
            note: `${data.summary.transactions} transacoes`,
            benchmark: '--',
        },
        {
            label: 'CAC por Aquisicao',
            value: data.cac_overall > 0 ? fmtBrl(data.cac_overall) : '--',
            note: '--',
            benchmark: '<LTV/3',
        },
        {
            label: 'Taxa de Reembolso',
            value: fmtPct(data.summary.refund_rate),
            note: data.summary.refund_rate <= 3 ? 'Excelente' : data.summary.refund_rate <= 7 ? 'Aceitavel' : 'Alto',
            benchmark: '<5%',
        },
    ].map(r => ({
        cells: [
            { text: r.label, font: 'Helvetica-Bold' },
            { text: r.value, font: 'Courier' },
            { text: r.note,  color: C.textSecondary },
            { text: r.benchmark, color: C.textSecondary },
        ],
    }));

    drawTable(doc, investorCols, investorRows, profileName, periodLabel);
}

// ── Secao 8 — Diagnostico Completo ────────────────────────────────────────────

function drawDiagnosisCard(
    doc: PDFDoc,
    d: ChannelDiagnosis,
    profileName: string | null,
    periodLabel: string,
): void {
    const color = SEVERITY_COLOR[d.severidade];
    const innerX = MARGIN + 14;
    const innerW = CONTENT_W - 24;
    const halfW  = (innerW - 12) / 2;

    doc.font('Helvetica').fontSize(8.5);
    const altSintoma = doc.heightOfString(d.sintoma, { width: innerW });
    doc.font('Helvetica').fontSize(8);
    const altColunas = Math.max(
        doc.heightOfString(d.causa_raiz,   { width: halfW }),
        doc.heightOfString(d.consequencia, { width: halfW }),
    );
    const prazoLabel = { imediato: 'Imediato', esta_semana: 'Esta semana', este_mes: 'Este mes' }[d.prazo] ?? d.prazo;
    doc.font('Helvetica').fontSize(7.5);
    const altRec = doc.heightOfString(`${prazoLabel} | ${d.acao_recomendada}`, { width: innerW - 140 });

    const cardH = 20 + 18 + altSintoma + 18 + altColunas + Math.max(altRec, 12) + 24;
    ensureSpace(doc, cardH + 12, profileName, periodLabel);
    const sY = doc.y;

    doc.save().rect(MARGIN, sY, CONTENT_W, cardH).strokeColor(C.border).lineWidth(0.5).stroke().restore();
    doc.save().rect(MARGIN, sY, 3, cardH).fillColor(color).fill().restore();

    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.dark)
        .text(translateChannel(d.canal).toUpperCase(), innerX, sY + 10, { width: innerW - 80 });

    const bW = 70; const bH = 16;
    const bX = PAGE_W - MARGIN - bW - 8; const bY = sY + 8;
    doc.save().roundedRect(bX, bY, bW, bH, 8).fillColor(color).fill().restore();
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.white)
        .text(SEVERITY_LABEL[d.severidade], bX, bY + 4, { width: bW, align: 'center' });

    const sintY = sY + 28;
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.textSecondary).text('SINTOMA', innerX, sintY);
    doc.font('Helvetica').fontSize(8.5).fillColor(C.dark).text(d.sintoma, innerX, sintY + 10, { width: innerW, lineGap: 1 });

    const colLabelY = sintY + 10 + altSintoma + 8;
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.textSecondary).text('CAUSA RAIZ', innerX, colLabelY);
    doc.font('Helvetica').fontSize(8).fillColor(C.dark).text(d.causa_raiz, innerX, colLabelY + 10, { width: halfW, lineGap: 1 });
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.textSecondary).text('CONSEQUENCIA', innerX + halfW + 12, colLabelY);
    doc.font('Helvetica').fontSize(8).fillColor(C.dark).text(d.consequencia, innerX + halfW + 12, colLabelY + 10, { width: halfW, lineGap: 1 });

    const footerY = colLabelY + 10 + altColunas + 10;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(color)
        .text(`Impacto: ${fmtBrl(d.consequencia_financeira_brl)}`, innerX, footerY);
    doc.font('Helvetica').fontSize(7.5).fillColor(C.textSecondary)
        .text(`${prazoLabel}  |  ${d.acao_recomendada}`, innerX + 140, footerY, { width: innerW - 140, lineGap: 1 });

    doc.y = sY + cardH + 12;
}

function drawSection8(
    doc: PDFDoc,
    data: ReportData,
    ai: ReportAIAnalysis | undefined,
    profileName: string | null,
    periodLabel: string,
): void {
    drawSectionHeader(doc, '08', 'DIAGNOSTICO COMPLETO POR SEVERIDADE', profileName, periodLabel);

    if (!ai || ai.diagnosticos.length === 0) {
        doc.font('Helvetica').fontSize(9).fillColor(C.textSecondary)
            .text('Analise de IA nao disponivel neste relatorio. Gere o relatorio completo (PDF com IA) para visualizar o diagnostico.',
                MARGIN, doc.y, { width: CONTENT_W });
        return;
    }

    const order: ChannelDiagnosis['severidade'][] = ['critica', 'alta', 'media', 'ok'];
    const groupLabels: Record<ChannelDiagnosis['severidade'], string> = {
        critica: 'CRITICO — Acao nos proximos 7-15 dias',
        alta:    'GRAVE — Acao nos proximos 30-45 dias',
        media:   'MODERADO — Planejar para os proximos 60-90 dias',
        ok:      'PONTOS POSITIVOS — O que esta funcionando',
    };

    for (const sev of order) {
        const group = ai.diagnosticos.filter(d => d.severidade === sev);
        if (group.length === 0) continue;

        ensureSpace(doc, 50, profileName, periodLabel);
        const color = SEVERITY_COLOR[sev];
        const gY = doc.y;
        doc.save().rect(MARGIN, gY, CONTENT_W, 26).fillColor(color + '18').fill().restore();
        doc.save().rect(MARGIN, gY, 4, 26).fillColor(color).fill().restore();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(color)
            .text(groupLabels[sev], MARGIN + 12, gY + 8, { width: CONTENT_W - 20 });
        doc.y = gY + 34;

        for (const d of group) {
            drawDiagnosisCard(doc, d, profileName, periodLabel);
        }
    }

    // Data-driven "leve" items (non-AI)
    const leveItems: string[] = [];
    if (data.rfm_source === 'estimated') {
        leveItems.push('Job de RFM nao executado — ative o calculo noturno para segmentacao precisa da base.');
    }
    if ((data.missing_integrations ?? []).length > 0) {
        leveItems.push(`${data.missing_integrations!.length} integracoes faltantes reduzem a precisao deste relatorio.`);
    }
    if (data.revenue_trend.length < 3) {
        leveItems.push('Menos de 3 meses de historico — analise de tendencia sera mais precisa com mais dados.');
    }

    if (leveItems.length > 0) {
        ensureSpace(doc, 50, profileName, periodLabel);
        const leveY = doc.y;
        doc.save().rect(MARGIN, leveY, CONTENT_W, 26).fillColor(C.primary + '18').fill().restore();
        doc.save().rect(MARGIN, leveY, 4, 26).fillColor(C.primary).fill().restore();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.primary)
            .text('LEVE — Otimizacoes recomendadas', MARGIN + 12, leveY + 8);
        doc.y = leveY + 34;

        leveItems.forEach(item => {
            ensureSpace(doc, 28, profileName, periodLabel);
            doc.save().rect(MARGIN, doc.y, CONTENT_W, 24).strokeColor(C.border).lineWidth(0.5).stroke().restore();
            doc.save().rect(MARGIN, doc.y, 3, 24).fillColor(C.primary).fill().restore();
            doc.font('Helvetica').fontSize(8.5).fillColor(C.dark)
                .text(item, MARGIN + 10, doc.y + 6, { width: CONTENT_W - 16 });
            doc.y += 30;
        });
    }
}

// ── Secao 9 — Plano de Acao Priorizado ────────────────────────────────────────

function drawSection9(
    doc: PDFDoc,
    ai: ReportAIAnalysis | undefined,
    data: ReportData,
    profileName: string | null,
    periodLabel: string,
): void {
    drawSectionHeader(doc, '09', 'PLANO DE ACAO PRIORIZADO', profileName, periodLabel);

    const steps = ai?.proximos_passos ?? [];

    if (steps.length === 0) {
        doc.font('Helvetica').fontSize(9).fillColor(C.textSecondary)
            .text('Gere o relatorio com analise de IA para receber o plano de acao personalizado.',
                MARGIN, doc.y, { width: CONTENT_W });
        return;
    }

    // Build action table with impact categorization
    const cols = [
        { label: 'PRIOR.',  width: 0.08, align: 'center' as const, font: 'Helvetica-Bold' },
        { label: 'ACAO',    width: 0.54, align: 'left'   as const },
        { label: 'AREA',    width: 0.20, align: 'left'   as const },
        { label: 'PRAZO',   width: 0.18, align: 'center' as const },
    ];

    const areaMap = (step: string) => {
        if (/camp|ad|roas|meta|google|cpc|cpl/i.test(step)) return 'Growth / Ads';
        if (/churn|retencao|reativac|cliente/i.test(step)) return 'Retencao';
        if (/reembolso|produto|entrega/i.test(step)) return 'Produto';
        if (/receita|faturamento|escal/i.test(step)) return 'Financeiro';
        return 'Operacao';
    };

    const prazoMap = (step: string) => {
        if (/imediato|urgente|esta semana|hoje/i.test(step)) return 'Imediato';
        if (/este mes|30 dias/i.test(step)) return 'Este mes';
        return '30-60 dias';
    };

    const rows = steps.map((step, i) => ({
        cells: [
            { text: `#${i + 1}`, font: 'Helvetica-Bold', color: C.primary },
            { text: step },
            { text: areaMap(step), color: C.textSecondary },
            { text: prazoMap(step), color: C.textSecondary },
        ],
    }));

    drawTable(doc, cols, rows, profileName, periodLabel);

    // Impact note
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(7.5).fillColor(C.textSecondary)
        .text('Impactos estimados baseados nos dados do periodo. Execute em ordem de prioridade para maximizar resultado.',
            MARGIN, doc.y, { width: CONTENT_W });
}

// ── Secao 10 — Glossario ──────────────────────────────────────────────────────

function drawSection10(
    doc: PDFDoc,
    profileName: string | null,
    periodLabel: string,
): void {
    drawSectionHeader(doc, '10', 'GLOSSARIO', profileName, periodLabel);

    const glossary: Array<{ term: string; definition: string }> = [
        { term: 'LTV (Lifetime Value)',          definition: 'Receita total que um cliente gera ao longo de todo o relacionamento com o negocio. Calculado como soma das transacoes aprovadas por cliente.' },
        { term: 'CAC (Custo de Aquisicao)',       definition: 'Quanto o negocio gasta em media para adquirir um novo cliente. Calculado como investimento total em ads / novos clientes no periodo.' },
        { term: 'LTV/CAC Ratio',                  definition: 'Quantas vezes o valor gerado pelo cliente supera o custo de adquiri-lo. Acima de 3x e considerado saudavel.' },
        { term: 'ROAS (Return on Ad Spend)',       definition: 'Retorno sobre o investimento em publicidade. ROAS de 3x significa R$3 de receita para cada R$1 investido em ads.' },
        { term: 'MRR (Monthly Recurring Revenue)', definition: 'Receita recorrente mensal. Indica a previsibilidade do negocio. Extrapolado a partir da receita do periodo para negócios nao SaaS.' },
        { term: 'ARR (Annual Recurring Revenue)',  definition: 'MRR multiplicado por 12. Metrica-chave para valuation e fundraising.' },
        { term: 'Churn',                           definition: 'Taxa de cancelamento ou abandono de clientes. Alto churn significa que o negocio perde clientes mais rapido do que adquire.' },
        { term: 'Payback Period',                  definition: 'Tempo em meses para recuperar o investimento em aquisicao de um cliente. Calculado como CAC / receita mensal media por cliente.' },
        { term: 'NRR (Net Revenue Retention)',     definition: 'Percentual da receita retida de clientes existentes, incluindo expansoes (upsell) e cancelamentos. NRR > 100% significa crescimento sem novos clientes.' },
        { term: 'AOV (Average Order Value)',       definition: 'Ticket medio por transacao. Calculado como receita total / numero de transacoes.' },
        { term: 'RFM Score',                       definition: 'Segmentacao de clientes por Recencia (quando comprou), Frequencia (quantas vezes) e Monetario (quanto gastou). Identifica os melhores e os em risco.' },
        { term: 'CTR (Click-Through Rate)',        definition: 'Percentual de pessoas que clicam em um anuncio em relacao ao total que o viu. CTR alto indica relevancia do criativo.' },
        { term: 'CPL (Custo por Lead)',            definition: 'Investimento em ads dividido pelo numero de leads gerados. Indica a eficiencia em atrair potenciais clientes.' },
        { term: 'Margem de Contribuicao',          definition: 'Receita liquida menos o investimento em ads. Representa o valor que sobra para cobrir custos fixos e gerar lucro.' },
        { term: 'Health Score',                    definition: 'Score de 0 a 100 calculado pela Northie com base em LTV/CAC (30%), reembolso (25%), crescimento (25%) e ROAS (20%). 80+ = saudavel.' },
    ];

    // Two-column layout
    const colW = (CONTENT_W - 16) / 2;
    let col = 0;
    let leftY = doc.y;
    let rightY = doc.y;

    glossary.forEach(g => {
        const x = col === 0 ? MARGIN : MARGIN + colW + 16;
        const y = col === 0 ? leftY : rightY;

        const termH = doc.heightOfString(g.term, { fontSize: 8.5 });
        const defH  = doc.heightOfString(g.definition, { width: colW - 4, fontSize: 7.5 });
        const itemH = termH + defH + 14;

        if (y + itemH > FOOTER_ZONE) {
            if (col === 0) {
                doc.addPage();
                drawPageHeader(doc, profileName, periodLabel);
                leftY = HEADER_H + 16;
                rightY = leftY;
                doc.y = leftY;
            }
        }

        const curY = col === 0 ? leftY : rightY;
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.dark).text(g.term, x, curY, { width: colW });
        doc.font('Helvetica').fontSize(7.5).fillColor(C.textSecondary)
            .text(g.definition, x, curY + termH + 2, { width: colW, lineGap: 1 });

        if (col === 0) {
            leftY  = curY + itemH;
            col = 1;
        } else {
            rightY = curY + itemH;
            col = 0;
        }

        doc.y = Math.max(leftY, rightY);
    });
}

// ── Detalhamento de vendas (Apendice) ─────────────────────────────────────────

function drawVendasTable(
    doc: PDFDoc,
    transactions: ReportData['transactions_detail'],
    profileName: string | null,
    periodLabel: string,
): void {
    if (transactions.length === 0) return;

    drawSectionHeader(doc, '--', 'DETALHAMENTO DE VENDAS (APENDICE)', profileName, periodLabel);

    const cols: TableCol[] = [
        { label: 'ID',           width: 0.12, align: 'left',   font: 'Courier' },
        { label: 'CLIENTE',      width: 0.25, align: 'left'  },
        { label: 'CANAL',        width: 0.18, align: 'left'  },
        { label: 'VALOR LIQ.',   width: 0.18, align: 'right', font: 'Courier' },
        { label: 'DATA',         width: 0.14, align: 'center', font: 'Courier' },
        { label: 'STATUS',       width: 0.13, align: 'center' },
    ];

    const rows: TableRow[] = transactions.slice(0, 60).map(t => {
        const st  = STATUS_DEF[t.status] ?? { text: t.status, color: C.textSecondary };
        return {
            cells: [
                { text: t.id.slice(0, 8), font: 'Courier' },
                { text: t.customer_email ?? '--' },
                { text: translateChannel(t.customer_channel ?? t.platform ?? '--') },
                { text: fmtBrl(t.amount_net), font: 'Courier' },
                { text: t.created_at ? fmtDateShort(t.created_at) : '--', font: 'Courier' },
                { text: st.text, color: st.color },
            ],
        };
    });

    drawTable(doc, cols, rows, profileName, periodLabel);
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function generatePdf(data: ReportData, ai?: ReportAIAnalysis): Promise<Buffer> {
    const doc           = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const bufferPromise = streamToBuffer(doc);

    const periodLabel  = `${fmtDate(data.period.start)} — ${fmtDate(data.period.end)}`;
    const profileName  = data.profile_name ?? null;

    // ── CAPA ──────────────────────────────────────────────────────────────────
    drawCoverPage(doc, data, ai);

    // ── SECAO 1 — Resumo Executivo ────────────────────────────────────────────
    drawSection1(doc, data, ai, profileName, periodLabel);

    // ── SECAO 2 — Painel Financeiro Consolidado ───────────────────────────────
    drawSection2(doc, data, profileName, periodLabel);

    // ── SECAO 3 — Aquisicao e Ads ─────────────────────────────────────────────
    drawSection3(doc, data, profileName, periodLabel);

    // ── SECAO 4 — Retencao, Churn e Valor do Cliente ─────────────────────────
    drawSection4(doc, data, profileName, periodLabel);

    // ── SECAO 5 — Engajamento e Operacao ─────────────────────────────────────
    drawSection5(doc, data, profileName, periodLabel);

    // ── SECAO 6 — Projecoes ───────────────────────────────────────────────────
    drawSection6(doc, data, profileName, periodLabel);

    // ── SECAO 7 — Fundraising ─────────────────────────────────────────────────
    drawSection7(doc, data, profileName, periodLabel);

    // ── SECAO 8 — Diagnostico (requer IA) ────────────────────────────────────
    if (ai && ai.diagnosticos.length > 0) {
        drawSection8(doc, data, ai, profileName, periodLabel);
    }

    // ── SECAO 9 — Plano de Acao ───────────────────────────────────────────────
    if (ai && ai.proximos_passos.length > 0) {
        drawSection9(doc, ai, data, profileName, periodLabel);
    }

    // ── SECAO 10 — Glossario ──────────────────────────────────────────────────
    drawSection10(doc, profileName, periodLabel);

    // ── APENDICE — Detalhamento de Vendas ─────────────────────────────────────
    if (data.transactions_detail.length > 0) {
        drawVendasTable(doc, data.transactions_detail, profileName, periodLabel);
    }

    // ── FOOTER — todas as paginas ─────────────────────────────────────────────
    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const range = doc.bufferedPageRange();

    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        // Sem footer na capa
        if (i === range.start) continue;

        const footerY = PAGE_H - 36;
        drawHRule(doc, footerY - 8, C.tableLine);
        const pageNum    = i - range.start + 1;
        const totalPages = range.count;

        doc.font('Helvetica').fontSize(7).fillColor(C.textSecondary)
            .text(`Gerado pela Northie em ${today} | northie.com.br | Confidencial`,
                MARGIN, footerY, { lineBreak: false, baseline: 'bottom' });

        doc.font('Helvetica').fontSize(7).fillColor(C.textSecondary)
            .text(`Pagina ${pageNum} de ${totalPages}`,
                0, footerY, { width: PAGE_W - MARGIN, align: 'right', lineBreak: false, baseline: 'bottom' });
    }

    doc.end();
    return bufferPromise;
}
