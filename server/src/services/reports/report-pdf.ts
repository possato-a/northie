/**
 * report-pdf.ts
 * Gera PDF de relatório usando Puppeteer (HTML → PDF).
 * Identidade visual Northie: #F97316 (laranja), #0F0F23 (dark), Poppins + Geist Mono.
 */

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import type { generateReportData } from './report-generator.js';
import type { ReportAIAnalysis, ChannelDiagnosis } from './report-ai-analyst.js';

type ReportData = Awaited<ReturnType<typeof generateReportData>>;

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtBrl(n: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0);
}

function fmtNum(n: number, dec = 1): string {
    return (n ?? 0).toLocaleString('pt-BR', {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
    });
}

function fmtPct(n: number): string {
    return `${fmtNum(n)}%`;
}

function fmtDateLong(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric',
    });
}

function fmtDateShort(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
}

/** Escapa caracteres HTML para prevenir XSS no template. */
function esc(s: string | null | undefined): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

const PLATFORM_LABEL: Record<string, string> = {
    meta_ads: 'Meta Ads', meta: 'Meta Ads',
    google_ads: 'Google Ads', google: 'Google Ads',
    hotmart: 'Hotmart', stripe: 'Stripe', shopify: 'Shopify',
    organico: 'Orgânico', email: 'Email', direto: 'Direto',
    afiliado: 'Afiliado', desconhecido: 'Outros',
};

function plat(s: string): string { return PLATFORM_LABEL[s] ?? s; }

const STATUS_DEF: Record<string, { text: string; color: string }> = {
    approved:   { text: 'Aprovado',    color: '#10B981' },
    refunded:   { text: 'Reembolsado', color: '#EF4444' },
    pending:    { text: 'Pendente',    color: '#F59E0B' },
    cancelled:  { text: 'Cancelado',   color: '#6B7280' },
    chargeback: { text: 'Chargeback',  color: '#EF4444' },
};

const SEV_COLOR: Record<ChannelDiagnosis['severidade'], string> = {
    critica: '#EF4444', alta: '#F97316', media: '#F59E0B', ok: '#10B981',
};
const SEV_BG: Record<ChannelDiagnosis['severidade'], string> = {
    critica: '#FEF2F2', alta: '#FFF7ED', media: '#FFFBEB', ok: '#F0FDF4',
};
const SEV_LABEL: Record<ChannelDiagnosis['severidade'], string> = {
    critica: 'CRÍTICO', alta: 'GRAVE', media: 'MODERADO', ok: 'POSITIVO',
};
const PRAZO_LABEL: Record<ChannelDiagnosis['prazo'], string> = {
    imediato: 'Imediato', esta_semana: 'Esta semana', este_mes: 'Este mês',
};

const SIT_COLOR: Record<ReportAIAnalysis['situacao_geral'], string> = {
    saudavel: '#10B981', atencao: '#F59E0B', critica: '#EF4444',
};
const SIT_LABEL: Record<ReportAIAnalysis['situacao_geral'], string> = {
    saudavel: 'SAUDÁVEL', atencao: 'ATENÇÃO', critica: 'CRÍTICO',
};

const RFM_META: Record<string, { label: string; color: string; bg: string }> = {
    champions: { label: 'Champions', color: '#10B981', bg: '#F0FDF4' },
    loyalists: { label: 'Leais',     color: '#3B82F6', bg: '#EFF6FF' },
    em_risco:  { label: 'Em Risco',  color: '#F59E0B', bg: '#FFFBEB' },
    perdidos:  { label: 'Perdidos',  color: '#EF4444', bg: '#FEF2F2' },
    novos:     { label: 'Novos',     color: '#8B5CF6', bg: '#F5F3FF' },
    outros:    { label: 'Outros',    color: '#6B7280', bg: '#F9FAFB' },
};

// ── SVG helpers ───────────────────────────────────────────────────────────────

/** Anel SVG de pontuação (score ring). */
function scoreRingSvg(score: number, color: string, size = 96): string {
    const r   = size * 0.37;
    const c   = size / 2;
    const circ = 2 * Math.PI * r;
    const dash = Math.min(score / 100, 1) * circ;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#2A2A3E" stroke-width="${size * 0.065}"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${size * 0.065}"
    stroke-dasharray="${dash} ${circ}" stroke-dashoffset="${circ * 0.25}" stroke-linecap="round" transform="rotate(-0.01 ${c} ${c})"/>
  <text x="${c}" y="${c + 1}" text-anchor="middle" dominant-baseline="middle"
    font-family="Poppins,sans-serif" font-size="${size * 0.23}" font-weight="700" fill="${color}">${score}</text>
  <text x="${c}" y="${c + size * 0.23}" text-anchor="middle"
    font-family="Poppins,sans-serif" font-size="${size * 0.1}" fill="#6B7280">SCORE</text>
</svg>`;
}

/** Gráfico de barras SVG para tendência de receita. */
function trendBarChart(trend: ReportData['revenue_trend']): string {
    if (!trend || trend.length === 0) {
        return `<div style="text-align:center;color:#6B7280;font-size:11px;padding:20px">Sem dados de tendência</div>`;
    }
    const W = 500; const H = 90; const PAD = 24;
    const max = Math.max(...trend.map(d => d.revenue), 1);
    const barW = Math.floor((W - PAD * 2) / trend.length) - 3;
    const bars = trend.map((d, i) => {
        const bh  = Math.max(3, Math.round((d.revenue / max) * (H - 24)));
        const x   = PAD + i * (barW + 3);
        const y   = H - 18 - bh;
        const clr = d.change_pct !== null && d.change_pct < 0 ? '#EF4444' : '#F97316';
        return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="3" fill="${clr}" opacity="0.9"/>
<text x="${x + barW / 2}" y="${H - 2}" text-anchor="middle" font-size="9" fill="#6B7280" font-family="'Geist Mono',monospace">${esc(d.month)}</text>`;
    }).join('');
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible">${bars}</svg>`;
}

// ── CSS ────────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: 'Poppins', sans-serif;
    background: #FCF8F8;
    color: #1E1E1E;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

/* ── Page layout ── */
.page {
    width: 210mm;
    min-height: 297mm;
    page-break-after: always;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #fff;
}
.page:last-child { page-break-after: avoid; }

/* ── Cover (dark) ── */
.cover {
    background: #0F0F23;
    color: #fff;
}
.cover-inner {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 52px 52px 36px;
}
.cover-logo {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 7px;
    color: #F97316;
    text-transform: uppercase;
    margin-bottom: 60px;
}
.cover-eyebrow {
    font-size: 10px;
    letter-spacing: 3px;
    color: #6B7280;
    text-transform: uppercase;
    margin-bottom: 10px;
}
.cover-title {
    font-size: 40px;
    font-weight: 800;
    line-height: 1.1;
    color: #F3F4F6;
    margin-bottom: 6px;
}
.cover-subtitle {
    font-size: 15px;
    color: #9CA3AF;
    font-weight: 400;
    margin-bottom: 48px;
}
.cover-kpis {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 40px;
}
.cover-kpi {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 14px 16px;
}
.cover-kpi-label {
    font-size: 10px;
    letter-spacing: 2px;
    color: #6B7280;
    text-transform: uppercase;
    margin-bottom: 5px;
}
.cover-kpi-value {
    font-size: 18px;
    font-weight: 700;
    font-family: 'Geist Mono', monospace;
    color: #F3F4F6;
}
.cover-score-row {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 28px 52px;
    border-top: 1px solid rgba(255,255,255,0.07);
    border-bottom: 1px solid rgba(255,255,255,0.07);
}
.cover-score-info {}
.cover-score-info-title {
    font-size: 10px;
    letter-spacing: 2px;
    color: #6B7280;
    text-transform: uppercase;
    margin-bottom: 4px;
}
.cover-score-info-value {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 4px;
}
.cover-score-info-desc {
    font-size: 11px;
    color: #6B7280;
    line-height: 1.6;
    max-width: 340px;
}
.cover-footer {
    padding: 18px 52px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.cover-footer-brand { font-size: 11px; color: #4B5563; }
.cover-footer-gen   { font-size: 10px; color: #4B5563; font-family: 'Geist Mono', monospace; }

/* ── Page header / footer (content pages) ── */
.page-header {
    background: #0F0F23;
    padding: 16px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
}
.ph-brand { font-size: 11px; font-weight: 700; letter-spacing: 4px; color: #F97316; }
.ph-meta  { text-align: right; }
.ph-profile { font-size: 10px; color: #9CA3AF; }
.ph-period  { font-size: 9px;  color: #6B7280; font-family: 'Geist Mono', monospace; }

.page-body { flex: 1; padding: 28px 40px; overflow: hidden; }

.page-footer {
    background: #F9FAFB;
    border-top: 1px solid #E5E7EB;
    padding: 10px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
}
.pf-text { font-size: 9px; color: #9CA3AF; font-family: 'Geist Mono', monospace; }

/* ── Section header ── */
.sec-num   { font-size: 9px; font-weight: 700; letter-spacing: 3px; color: #F97316; text-transform: uppercase; margin-bottom: 3px; }
.sec-title { font-size: 20px; font-weight: 700; color: #1E1E1E; margin-bottom: 3px; }
.sec-sub   { font-size: 11px; color: #6B7280; margin-bottom: 22px; }
.divider   { height: 1px; background: #F3F4F6; margin: 20px 0; }

/* ── KPI grid ── */
.kpi-grid   { display: grid; gap: 10px; margin-bottom: 18px; }
.kpi-grid-4 { grid-template-columns: repeat(4, 1fr); }
.kpi-grid-3 { grid-template-columns: repeat(3, 1fr); }
.kpi-grid-2 { grid-template-columns: repeat(2, 1fr); }

.kpi-card {
    background: #F9FAFB;
    border: 1px solid #E5E7EB;
    border-radius: 9px;
    padding: 14px;
}
.kpi-card.accent { background: #FFF7ED; border-color: #FED7AA; }
.kpi-label   { font-size: 9px; letter-spacing: 1.5px; color: #6B7280; text-transform: uppercase; margin-bottom: 5px; }
.kpi-value   { font-size: 18px; font-weight: 700; font-family: 'Geist Mono', monospace; line-height: 1; margin-bottom: 3px; }
.kpi-value.lg{ font-size: 24px; }
.kpi-delta   { font-size: 10px; font-weight: 600; }
.kpi-ctx     { font-size: 10px; color: #9CA3AF; margin-top: 2px; }
.up   { color: #10B981; }
.down { color: #EF4444; }
.neu  { color: #9CA3AF; }

/* ── Tables ── */
.tbl { width: 100%; border-collapse: collapse; font-size: 10.5px; }
.tbl th {
    background: #1E1E1E;
    color: #fff;
    padding: 7px 10px;
    text-align: left;
    font-size: 9px;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-weight: 600;
}
.tbl th:first-child { border-radius: 5px 0 0 0; }
.tbl th:last-child  { border-radius: 0 5px 0 0; }
.tbl td {
    padding: 7px 10px;
    border-bottom: 1px solid #F3F4F6;
    color: #374151;
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
}
.tbl tr:nth-child(even) td { background: #FAFAFA; }
.tbl tr:last-child td      { border-bottom: none; }
.tbl .r  { text-align: right; }
.tbl .c  { text-align: center; }
.tbl .nf { font-family: 'Poppins', sans-serif; }

/* ── Status badge ── */
.badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    font-family: 'Poppins', sans-serif;
}
.status-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    margin-right: 5px;
    vertical-align: middle;
}

/* ── AI blocks ── */
.ai-box {
    background: #0F0F23;
    border-radius: 9px;
    padding: 20px;
    margin-bottom: 14px;
}
.ai-box-label { font-size: 9px; letter-spacing: 2px; color: #F97316; text-transform: uppercase; margin-bottom: 7px; }
.ai-box-text  { font-size: 12px; color: #E5E7EB; line-height: 1.75; font-family: 'Poppins', sans-serif; }

.ai-steps { list-style: none; }
.ai-steps li {
    font-size: 11px;
    color: #D1D5DB;
    padding: 6px 0 6px 20px;
    position: relative;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    line-height: 1.6;
}
.ai-steps li:last-child { border-bottom: none; }
.ai-steps li::before { content: '▶'; position: absolute; left: 0; color: #F97316; font-size: 7px; top: 9px; }

/* ── Diagnosis cards ── */
.diag-card { border-radius: 9px; padding: 14px; margin-bottom: 10px; }
.diag-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.diag-canal { font-size: 13px; font-weight: 700; }
.diag-tags  { display: flex; gap: 5px; }
.diag-body  { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 10.5px; margin-bottom: 8px; }
.diag-field label {
    font-size: 8px; letter-spacing: 1px; text-transform: uppercase;
    opacity: 0.55; display: block; margin-bottom: 2px;
}
.diag-footer {
    margin-top: 8px; padding-top: 8px;
    border-top: 1px solid rgba(0,0,0,0.07);
    display: flex; gap: 8px; align-items: flex-start;
}
.diag-acao { font-size: 10.5px; flex: 1; }
.diag-acao label { font-size: 8px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.55; display: block; margin-bottom: 2px; }
.diag-impact { text-align: right; min-width: 110px; }
.diag-impact label { font-size: 8px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.55; display: block; margin-bottom: 2px; }
.diag-impact-val { font-size: 12px; font-weight: 700; font-family: 'Geist Mono', monospace; }

/* ── RFM cards ── */
.rfm-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin-bottom: 18px; }
.rfm-card { border-radius: 9px; padding: 12px; text-align: center; }
.rfm-card-label { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 5px; }
.rfm-card-count { font-size: 26px; font-weight: 800; font-family: 'Geist Mono', monospace; line-height: 1; }
.rfm-card-ltv   { font-size: 10px; margin-top: 3px; opacity: 0.65; font-family: 'Geist Mono', monospace; }

/* ── Health breakdown ── */
.health-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.health-item  { display: flex; gap: 8px; align-items: center; background: #F9FAFB; border-radius: 7px; padding: 8px 12px; }
.health-label { font-size: 10px; color: #374151; min-width: 90px; }
.health-bar-wrap { flex: 1; height: 5px; background: #E5E7EB; border-radius: 3px; overflow: hidden; }
.health-bar   { height: 100%; border-radius: 3px; }
.health-score { font-size: 12px; font-weight: 700; min-width: 34px; text-align: right; font-family: 'Geist Mono', monospace; }

/* ── Projection cards ── */
.proj-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
.proj-card { border-radius: 9px; padding: 18px; border: 2px solid; }
.proj-card.cons { border-color: #BFDBFE; background: #EFF6FF; }
.proj-card.mod  { border-color: #FED7AA; background: #FFF7ED; }
.proj-card.opt  { border-color: #BBF7D0; background: #F0FDF4; }
.proj-label  { font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; }
.proj-card.cons .proj-label { color: #2563EB; }
.proj-card.mod  .proj-label { color: #F97316; }
.proj-card.opt  .proj-label { color: #10B981; }
.proj-main  { font-size: 19px; font-weight: 800; font-family: 'Geist Mono', monospace; margin-bottom: 10px; }
.proj-line  { display: flex; justify-content: space-between; font-size: 10px; padding: 3px 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
.proj-line:last-child { border: none; }
.proj-line-k { color: #6B7280; }
.proj-line-v { font-weight: 600; font-family: 'Geist Mono', monospace; }

/* ── Step list (plano de ação) ── */
.step-list { list-style: none; }
.step-item { display: flex; gap: 14px; padding: 12px 0; border-bottom: 1px solid #F3F4F6; align-items: flex-start; }
.step-item:last-child { border-bottom: none; }
.step-num  { width: 26px; height: 26px; border-radius: 50%; background: #F97316; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
.step-text { font-size: 11px; color: #374151; line-height: 1.65; }

/* ── Alert box ── */
.alert-box { background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 7px; padding: 12px 14px; font-size: 11px; color: #92400E; margin-top: 14px; }

/* ── Empty state ── */
.empty { text-align: center; padding: 32px; color: #9CA3AF; font-size: 12px; background: #F9FAFB; border-radius: 9px; }

/* ── Misc ── */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.mt8  { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.mt16 { margin-top: 16px; }
.mb8  { margin-bottom: 8px; }
.bold { font-weight: 700; }
.mono { font-family: 'Geist Mono', monospace; }
.small{ font-size: 10px; color: #9CA3AF; }

/* ── Extended design system ── */
.section-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 2px solid #F97316;
}
.section-num  { color: #F97316; font-size: 12px; font-weight: 700; letter-spacing: 2px; }
.section-name { color: #1E1E1E; font-size: 22px; font-weight: 700; }
.section-sub  { color: #6B7280; font-size: 13px; }

.kpi-card.positive { border-left: 3px solid #22C55E; }
.kpi-card.negative { border-left: 3px solid #EF4444; }
.kpi-card.neutral  { border-left: 3px solid #F97316; }

.benchmark { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: #6B7280; margin-top: 4px; }
.benchmark .bm-ok  { color: #22C55E; }
.benchmark .bm-bad { color: #EF4444; }

.badge-green  { background:#f0fdf4; color:#16a34a; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; }
.badge-red    { background:#fef2f2; color:#dc2626; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; }
.badge-yellow { background:#fffbeb; color:#d97706; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; }
.badge-orange { background:#fff7ed; color:#ea580c; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; }
.badge-blue   { background:#eff6ff; color:#2563eb; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; }

.alert-card { padding: 14px 18px; border-radius: 8px; border-left: 4px solid; margin-bottom: 10px; background: #FAFAFA; }
.alert-card.critical { border-color: #EF4444; background: #FEF2F2; }
.alert-card.warning  { border-color: #F59E0B; background: #FFFBEB; }
.alert-card.positive { border-color: #22C55E; background: #F0FDF4; }
.alert-card .alert-title { font-weight: 700; font-size: 13px; margin-bottom: 3px; color: #1E1E1E; }
.alert-card .alert-desc  { font-size: 11px; color: #6B7280; }

.empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px; text-align:center; color:#9CA3AF; background:#F9FAFB; border-radius:9px; }
.empty-state p { font-size: 12px; margin-top: 6px; }

.client-rank { display:flex; align-items:center; gap:12px; padding:12px 14px; background:#FAFAFA; border-radius:8px; border:1px solid #E5E7EB; margin-bottom:7px; }
.client-rank .rank-num { color:#F97316; font-weight:800; font-size:15px; width:24px; flex-shrink:0; }

.valuation-card { background:#F9FAFB; border:1px solid #E5E7EB; border-radius:10px; padding:20px; text-align:center; }
.valuation-card .val-number { font-size:26px; font-weight:800; color:#F97316; font-family:'Geist Mono',monospace; }
.valuation-card .val-label  { font-size:10px; color:#6B7280; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px; }
.valuation-card .val-range  { font-size:12px; color:#9CA3AF; margin-top:5px; font-family:'Geist Mono',monospace; }

.proj-scenario { flex:1; padding:20px; border-radius:10px; background:#F9FAFB; border:1px solid #E5E7EB; }
.proj-scenario.conservador { border-top: 3px solid #2563EB; }
.proj-scenario.moderado    { border-top: 3px solid #F97316; }
.proj-scenario.otimista    { border-top: 3px solid #22C55E; }

.cohort-cell-high  { color:#16a34a; font-weight:700; }
.cohort-cell-mid   { color:#d97706; }
.cohort-cell-low   { color:#dc2626; font-weight:700; }
.cohort-cell-empty { color:#9CA3AF; }

.progress-bar-wrap { flex:1; height:7px; background:#E5E7EB; border-radius:4px; overflow:hidden; }
.progress-bar      { height:100%; border-radius:4px; }
`;

// ── Partial builders ───────────────────────────────────────────────────────────

function pageHeader(section: string, profile: string, period: string): string {
    return `<div class="page-header">
  <div class="ph-brand">NORTHIE</div>
  <div class="ph-meta">
    <div class="ph-profile">${esc(profile)}</div>
    <div class="ph-period">${esc(section)} · ${esc(period)}</div>
  </div>
</div>`;
}

function pageFooter(num: number, genDate: string): string {
    return `<div class="page-footer">
  <span class="pf-text">Gerado em ${esc(genDate)} · Northie Analytics</span>
  <span class="pf-text">Página ${num}</span>
</div>`;
}

// ── PAGE BUILDERS ──────────────────────────────────────────────────────────────

/** Pág 1 — Capa */
function buildCover(data: ReportData, ai: ReportAIAnalysis, genDate: string): string {
    const s      = data.summary;
    const hs     = data.health_score;
    const hsClr  = hs.score >= 70 ? '#22C55E' : hs.score >= 40 ? '#F59E0B' : '#EF4444';
    const sitClr = SIT_COLOR[ai.situacao_geral];

    const periodStart = fmtDateLong(data.period.start);
    const periodEnd   = fmtDateLong(data.period.end);
    const profile     = data.profile_name ?? 'Relatório';
    const bizType     = data.business_type
        ? data.business_type.charAt(0).toUpperCase() + data.business_type.slice(1)
        : '';

    const delta    = s.revenue_change_pct;
    const deltaStr = delta !== null ? `${delta >= 0 ? '+' : ''}${fmtNum(delta)}%` : null;
    const deltaClr = delta !== null && delta >= 0 ? '#22C55E' : '#EF4444';

    const roasBadge = s.roas >= 3 ? `<span class="badge-green">Acima</span>` :
                      s.roas >= 1 ? `<span class="badge-yellow">Atenção</span>` :
                                    `<span class="badge-red">Abaixo</span>`;

    // LTV/CAC geral - calculado inline
    const ltvCacRatio = (data as any).ltv_cac_overall ?? null;
    const ltvCacBadge = ltvCacRatio !== null
        ? (ltvCacRatio >= 3 ? `<span class="badge-green">Acima 3x</span>` :
           ltvCacRatio >= 1 ? `<span class="badge-yellow">Atenção</span>` :
                              `<span class="badge-red">Crítico</span>`)
        : '';

    // CAC geral (média dos canais)
    const cacAvg = data.channel_economics.length > 0
        ? data.channel_economics.filter(c => c.cac > 0).reduce((sum, c, _, a) => sum + c.cac / a.length, 0)
        : 0;

    return `<div class="page cover">
  <div class="cover-inner" style="justify-content:space-between">
    <div>
      <div class="cover-logo">NORTHIE</div>
      <div style="font-size:10px;letter-spacing:3px;color:#4B5563;margin-top:-8px;margin-bottom:40px">INTELLIGENCE PLATFORM</div>
      <div class="cover-eyebrow">Relatório de Performance</div>
      <div class="cover-title">${esc(profile)}</div>
      <div class="cover-subtitle">${esc(bizType)}${bizType ? ' · ' : ''}${periodStart} — ${periodEnd}</div>
    </div>

    <div class="cover-kpis" style="grid-template-columns:repeat(3,1fr);gap:14px;margin:28px 0">
      <!-- Receita -->
      <div class="cover-kpi">
        <div class="cover-kpi-label">Receita Líquida</div>
        <div class="cover-kpi-value">${fmtBrl(s.revenue_net)}</div>
        ${deltaStr ? `<div style="font-size:10px;color:${deltaClr};margin-top:3px">${deltaStr} vs anterior</div>` : ''}
      </div>
      <!-- Novos clientes -->
      <div class="cover-kpi">
        <div class="cover-kpi-label">Novos Clientes</div>
        <div class="cover-kpi-value">${s.new_customers.toLocaleString('pt-BR')}</div>
        <div style="font-size:10px;color:#6B7280;margin-top:3px">${s.transactions} transações</div>
      </div>
      <!-- LTV Médio -->
      <div class="cover-kpi">
        <div class="cover-kpi-label">LTV Médio</div>
        <div class="cover-kpi-value">${fmtBrl(s.ltv_avg)}</div>
        <div style="font-size:10px;color:${s.ltv_avg >= 300 ? '#22C55E' : '#EF4444'};margin-top:3px">Benchmark: R$ 300 ${s.ltv_avg >= 300 ? '✓' : '✗'}</div>
      </div>
      <!-- CAC -->
      <div class="cover-kpi">
        <div class="cover-kpi-label">CAC Médio</div>
        <div class="cover-kpi-value">${cacAvg > 0 ? fmtBrl(cacAvg) : '—'}</div>
        <div style="font-size:10px;color:${cacAvg > 0 && cacAvg <= 50 ? '#22C55E' : cacAvg > 0 ? '#EF4444' : '#6B7280'};margin-top:3px">${cacAvg > 0 ? `Benchmark: R$ 50 ${cacAvg <= 50 ? '✓' : '✗'}` : 'Sem dados de ads'}</div>
      </div>
      <!-- ROAS -->
      <div class="cover-kpi">
        <div class="cover-kpi-label">ROAS</div>
        <div class="cover-kpi-value">${s.ad_spend > 0 ? fmtNum(s.roas, 2) + 'x' : '—'}</div>
        <div style="margin-top:4px">${s.ad_spend > 0 ? roasBadge : ''} <span style="font-size:10px;color:#6B7280">Benchmark: 2x</span></div>
      </div>
      <!-- LTV/CAC -->
      <div class="cover-kpi">
        <div class="cover-kpi-label">LTV / CAC</div>
        <div class="cover-kpi-value">${ltvCacRatio !== null ? fmtNum(ltvCacRatio, 2) + 'x' : '—'}</div>
        <div style="margin-top:4px">${ltvCacBadge} <span style="font-size:10px;color:#6B7280">Benchmark: 3x</span></div>
      </div>
    </div>

    <div class="cover-score-row">
      ${scoreRingSvg(hs.score, hsClr, 88)}
      <div class="cover-score-info">
        <div class="cover-score-info-title">Health Score</div>
        <div class="cover-score-info-value" style="color:${hsClr}">${esc(hs.label)} · ${hs.score}/100</div>
        <div class="cover-score-info-desc">Índice composto: LTV/CAC, crescimento, qualidade de canais e taxa de reembolso.</div>
      </div>
      <div style="margin-left:auto;text-align:right">
        <div style="font-size:10px;letter-spacing:2px;color:#6B7280;margin-bottom:4px">SITUAÇÃO GERAL</div>
        <span class="badge" style="background:${sitClr}22;color:${sitClr};font-size:12px;padding:5px 14px">${SIT_LABEL[ai.situacao_geral]}</span>
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <span class="cover-footer-brand">Northie Intelligence Platform</span>
    <span class="cover-footer-gen">Gerado em ${esc(genDate)}</span>
  </div>
</div>`;
}

/** Pág 2 — Resumo Executivo */
function buildResumo(data: ReportData, profile: string, period: string, genDate: string): string {
    const s   = data.summary;
    const hs  = data.health_score;
    const hsClr = hs.score >= 70 ? '#22C55E' : hs.score >= 40 ? '#F59E0B' : '#EF4444';

    const delta    = s.revenue_change_pct;
    const deltaHtml = delta !== null
        ? `<span class="kpi-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${fmtNum(delta)}% vs anterior</span>`
        : `<span class="kpi-delta neu">Sem período anterior</span>`;

    // Parágrafo de resumo
    const cacAvg = data.channel_economics.length > 0
        ? data.channel_economics.filter(c => c.cac > 0).reduce((sum, c, _, a) => sum + c.cac / a.length, 0)
        : 0;
    const resumoParagrafo = `Em ${esc(fmtDateLong(data.period.start))}–${esc(fmtDateLong(data.period.end))}, o negócio registrou <strong>${fmtBrl(s.revenue_net)}</strong> em receita líquida${delta !== null ? `, ${delta >= 0 ? 'crescimento de' : 'queda de'} <strong>${Math.abs(delta).toFixed(1)}%</strong> vs período anterior` : ''}. <strong>${s.new_customers}</strong> novos clientes adquiridos com LTV médio de <strong>${fmtBrl(s.ltv_avg)}</strong>${cacAvg > 0 ? ` e CAC de <strong>${fmtBrl(cacAvg)}</strong>` : ''}. Health Score atual: <strong style="color:${hsClr}">${hs.score}/100</strong>.`;

    // KPI cards
    const kpis = [
        { label: 'Receita Líquida', value: fmtBrl(s.revenue_net), delta: deltaHtml, cls: delta !== null && delta >= 0 ? 'positive' : delta !== null ? 'negative' : 'neutral' },
        { label: 'Ticket Médio', value: fmtBrl(s.aov), sub: `${s.transactions} transações`, cls: 'neutral' },
        { label: 'LTV Médio', value: fmtBrl(s.ltv_avg), sub: `Benchmark: R$ 300`, cls: s.ltv_avg >= 300 ? 'positive' : 'negative' },
        { label: 'Novos Clientes', value: s.new_customers.toLocaleString('pt-BR'), sub: `Base total: ${s.total_customers}`, cls: 'neutral' },
        { label: 'Investimento Ads', value: fmtBrl(s.ad_spend), sub: 'Período completo', cls: 'neutral' },
        { label: 'ROAS', value: s.ad_spend > 0 ? fmtNum(s.roas, 2) + 'x' : '—', sub: `Benchmark: 2x`, cls: s.roas >= 2 ? 'positive' : s.roas > 0 ? 'negative' : 'neutral' },
        { label: 'Taxa de Reembolso', value: fmtPct(s.refund_rate), sub: fmtBrl(s.refund_amount) + ' devolvido', cls: s.refund_rate > 5 ? 'negative' : 'positive' },
        { label: 'Margem Bruta', value: fmtPct(s.gross_margin_pct), sub: 'Líq / Bruto', cls: s.gross_margin_pct >= 60 ? 'positive' : 'negative' },
    ];

    const kpiHtml = kpis.map(k => `<div class="kpi-card ${k.cls}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      ${k.delta ? k.delta : (k.sub ? `<div class="kpi-ctx">${k.sub}</div>` : '')}
    </div>`).join('');

    // Health score breakdown bars
    const brkHtml = Object.entries(hs.breakdown).map(([key, v]) => {
        const bd  = v as { score: number; weight: number; label: string };
        const clr = bd.score >= 70 ? '#22C55E' : bd.score >= 40 ? '#F59E0B' : '#EF4444';
        const labels: Record<string, string> = { ltv_cac: 'LTV/CAC', refund: 'Reembolso', growth: 'Crescimento', roas: 'ROAS' };
        return `<div class="health-item">
          <div class="health-label">${labels[key] ?? key}</div>
          <div class="health-bar-wrap" style="flex:1;height:6px;background:#E5E7EB;border-radius:3px;overflow:hidden;"><div class="health-bar" style="width:${bd.score}%;background:${clr};height:100%;border-radius:3px"></div></div>
          <div class="health-score" style="color:${clr}">${bd.score}</div>
        </div>`;
    }).join('');

    // Trend chart wider
    const trend = data.revenue_trend ?? [];
    let trendSvgHtml = '';
    if (trend.length > 0) {
        const W = 620; const H = 100; const PAD = 8;
        const max = Math.max(...trend.map(d => d.revenue), 1);
        const barW = Math.floor((W - PAD * 2) / trend.length) - 4;
        const bars = trend.map((d, i) => {
            const bh  = Math.max(4, Math.round((d.revenue / max) * (H - 28)));
            const x   = PAD + i * (barW + 4);
            const y   = H - 20 - bh;
            const isLast = i === trend.length - 1;
            const clr = isLast ? '#F97316' : d.change_pct !== null && d.change_pct < 0 ? '#FCA5A5' : '#D1D5DB';
            const revLabel = d.revenue > 0 ? (d.revenue >= 1000 ? `R$${(d.revenue/1000).toFixed(0)}k` : `R$${d.revenue.toFixed(0)}`) : '';
            return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="3" fill="${clr}"/>
<text x="${x + barW/2}" y="${y - 3}" text-anchor="middle" font-size="8" fill="${isLast ? '#F97316' : '#9CA3AF'}" font-family="'Geist Mono',monospace">${revLabel}</text>
<text x="${x + barW/2}" y="${H - 2}" text-anchor="middle" font-size="9" fill="#6B7280" font-family="'Geist Mono',monospace">${esc(d.month)}</text>`;
        }).join('');
        trendSvgHtml = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible;width:100%">${bars}</svg>`;
    } else {
        trendSvgHtml = `<div class="empty">Sem dados de tendência</div>`;
    }

    return `<div class="page">
  ${pageHeader('Resumo Executivo', profile, period)}
  <div class="page-body">
    <div class="section-title">
      <span class="section-num">01</span>
      <span class="section-name">Resumo Executivo</span>
      <span class="section-sub">${esc(fmtDateLong(data.period.start))} — ${esc(fmtDateLong(data.period.end))}</span>
    </div>

    <div style="font-size:12px;color:#374151;line-height:1.75;margin-bottom:18px;background:#F9FAFB;border-radius:8px;padding:12px 16px">
      ${resumoParagrafo}
    </div>

    <div class="kpi-grid kpi-grid-4">${kpiHtml}</div>

    <div class="divider"></div>
    <div style="display:flex;gap:16px;align-items:flex-start">
      ${scoreRingSvg(hs.score, hsClr, 70)}
      <div style="flex:1">
        <div style="font-size:11px;font-weight:700;color:${hsClr};margin-bottom:8px">HEALTH SCORE: ${hs.score}/100 — ${esc(hs.label)}</div>
        <div class="health-grid">${brkHtml}</div>
      </div>
    </div>

    <div class="divider"></div>
    <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:#374151;margin-bottom:10px">TENDÊNCIA DE RECEITA — ÚLTIMOS 6 MESES</div>
    ${trendSvgHtml}
  </div>
  ${pageFooter(2, genDate)}
</div>`;
}

/** Pág 3 — Análise da IA */
function buildAnaliseIA(data: ReportData, ai: ReportAIAnalysis, profile: string, period: string, genDate: string): string {
    const sitClr = SIT_COLOR[ai.situacao_geral];
    const hs     = data.health_score;
    const hsClr  = hs.score >= 70 ? '#22C55E' : hs.score >= 40 ? '#F59E0B' : '#EF4444';

    // Status de integrações
    const INTEGRATIONS_ALL = ['meta_ads', 'google_ads', 'hotmart', 'stripe', 'shopify'];
    const active = new Set(data.integrations_active ?? []);
    const intStatusHtml = INTEGRATIONS_ALL.map(p =>
        `<span style="display:inline-flex;align-items:center;gap:5px;margin:3px 6px 3px 0;font-size:11px;color:${active.has(p) ? '#22C55E' : '#9CA3AF'}">
           ${active.has(p) ? '●' : '○'} ${esc(plat(p))}
         </span>`
    ).join('');

    // Top 3 métricas que precisam atenção
    const attentionItems: string[] = [];
    if (hs.breakdown && (hs.breakdown as any).ltv_cac?.score < 50) attentionItems.push(`LTV/CAC abaixo do benchmark (score: ${(hs.breakdown as any).ltv_cac?.score ?? '—'})`);
    if (hs.breakdown && (hs.breakdown as any).refund?.score < 50) attentionItems.push(`Taxa de reembolso elevada (score: ${(hs.breakdown as any).refund?.score ?? '—'})`);
    if (hs.breakdown && (hs.breakdown as any).roas?.score < 50) attentionItems.push(`ROAS abaixo do esperado (score: ${(hs.breakdown as any).roas?.score ?? '—'})`);
    if (hs.breakdown && (hs.breakdown as any).growth?.score < 50) attentionItems.push(`Crescimento de receita lento (score: ${(hs.breakdown as any).growth?.score ?? '—'})`);
    const top3 = attentionItems.slice(0, 3);

    const attentionHtml = top3.length > 0
        ? `<div style="margin-top:14px">
             <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:#374151;margin-bottom:8px">MÉTRICAS QUE PRECISAM DE ATENÇÃO</div>
             ${top3.map(a => `<div style="padding:8px 12px;background:#FFFBEB;border-left:3px solid #F59E0B;border-radius:4px;font-size:11px;color:#92400E;margin-bottom:6px">⚠ ${esc(a)}</div>`).join('')}
           </div>`
        : '';

    // Breakdown do health score
    const brkHtml = Object.entries(hs.breakdown).map(([key, v]) => {
        const bd  = v as { score: number; weight: number; label: string };
        const clr = bd.score >= 70 ? '#22C55E' : bd.score >= 40 ? '#F59E0B' : '#EF4444';
        const labels: Record<string, string> = { ltv_cac: 'LTV/CAC', refund: 'Reembolso', growth: 'Crescimento', roas: 'ROAS' };
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
          <div style="font-size:10px;color:#374151;min-width:90px">${labels[key] ?? key}</div>
          <div style="flex:1;height:5px;background:#E5E7EB;border-radius:3px;overflow:hidden"><div style="width:${bd.score}%;background:${clr};height:100%;border-radius:3px"></div></div>
          <div style="font-size:11px;font-weight:700;color:${clr};min-width:30px;text-align:right">${bd.score}</div>
        </div>`;
    }).join('');

    const mainContent = !ai.is_ai_fallback
        ? `<div class="ai-box">
             <div class="ai-box-label">Resumo Executivo da IA</div>
             <div class="ai-box-text">${esc(ai.resumo_executivo)}</div>
           </div>
           ${ai.proximos_passos?.length > 0 ? `
           <div style="margin-top:14px">
             <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:#F97316;margin-bottom:8px">PRÓXIMOS PASSOS RECOMENDADOS</div>
             <ul class="ai-steps" style="background:#0F0F23;border-radius:9px;padding:14px 14px 14px 34px">
               ${ai.proximos_passos.map(p => `<li>${esc(p)}</li>`).join('')}
             </ul>
           </div>` : ''}`
        : `<div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:20px;margin-bottom:14px">
             <div style="font-size:13px;font-weight:700;color:#92400E;margin-bottom:6px">⚠ Análise de IA não disponível</div>
             <div style="font-size:11px;color:#92400E;margin-bottom:12px">Conecte suas integrações para análises automáticas mais precisas.</div>
             <div style="font-size:11px;color:#374151;margin-bottom:8px"><strong>Status das integrações:</strong></div>
             <div>${intStatusHtml}</div>
             <div style="font-size:11px;color:#6B7280;margin-top:12px">Acesse Configurações → Integrações para conectar novas fontes de dados.</div>
           </div>`;

    const missingHtml = (data.missing_integrations ?? []).length > 0 && !ai.is_ai_fallback
        ? `<div class="alert-box">
             <strong>Integrações não conectadas:</strong>
             ${data.missing_integrations.map(m => esc(m.platform)).join(', ')} — conecte para análises mais precisas.
           </div>`
        : '';

    return `<div class="page">
  ${pageHeader('Análise de Inteligência', profile, period)}
  <div class="page-body">
    <div class="section-title">
      <span class="section-num">02</span>
      <span class="section-name">Análise de Inteligência</span>
      <span class="section-sub">Gerado por ${esc(ai.model)} · ${esc(fmtDateShort(ai.generated_at))}</span>
    </div>

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <span class="badge" style="background:${sitClr}22;color:${sitClr};font-size:10px;padding:4px 12px">${SIT_LABEL[ai.situacao_geral]}</span>
      <span style="font-size:11px;color:#6B7280">Situação geral identificada no período</span>
    </div>

    ${mainContent}
    ${attentionHtml}
    ${missingHtml}

    <div class="divider"></div>
    <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:#374151;margin-bottom:10px">HEALTH SCORE DETALHADO — ${hs.score}/100</div>
    ${brkHtml}
  </div>
  ${pageFooter(3, genDate)}
</div>`;
}

/** Pág 4 — Performance por Canal */
function buildCanais(data: ReportData, ai: ReportAIAnalysis, profile: string, period: string, genDate: string): string {
    const channels = data.channel_economics;

    function chanBadge(e: typeof channels[0]): string {
        if (e.status === 'lucrativo') return `<span class="badge-green">Lucrativo</span>`;
        if (e.status === 'organico')  return `<span class="badge-blue">Orgânico</span>`;
        return `<span class="badge-red">Prejuízo</span>`;
    }

    const chanRows = channels.map(e => {
        const ltvClr  = e.ltv_cac_ratio !== null ? (e.ltv_cac_ratio >= 3 ? '#22C55E' : e.ltv_cac_ratio >= 1 ? '#F59E0B' : '#EF4444') : '#9CA3AF';
        return `<tr>
      <td class="nf" style="font-weight:600">${esc(plat(e.channel))}</td>
      <td class="r">${e.new_customers}</td>
      <td class="r">${fmtBrl(e.avg_ltv)}</td>
      <td class="r">${e.cac > 0 ? fmtBrl(e.cac) : '—'}</td>
      <td class="r" style="color:${ltvClr};font-weight:600">${e.ltv_cac_ratio !== null ? fmtNum(e.ltv_cac_ratio, 2) + 'x' : '—'}</td>
      <td class="r">${fmtBrl(e.value_created)}</td>
      <td class="c">${chanBadge(e)}</td>
    </tr>`;
    });

    // Linha de totais
    if (channels.length > 0) {
        const totalClients  = channels.reduce((s, c) => s + c.new_customers, 0);
        const avgLtv        = channels.reduce((s, c) => s + c.avg_ltv, 0) / channels.length;
        const totalValue    = channels.reduce((s, c) => s + c.value_created, 0);
        chanRows.push(`<tr style="background:#F3F4F6;font-weight:700">
      <td class="nf">TOTAL / MÉDIA</td>
      <td class="r">${totalClients}</td>
      <td class="r">${fmtBrl(avgLtv)}</td>
      <td class="r">—</td>
      <td class="r">—</td>
      <td class="r">${fmtBrl(totalValue)}</td>
      <td></td>
    </tr>`);
    }

    const adRows = Object.entries(data.spend_by_platform).map(([p, spend]) => {
        const rev  = data.revenue_by_platform[p] ?? 0;
        const roas = spend > 0 ? rev / spend : 0;
        const roasClr = roas >= 2 ? '#22C55E' : roas >= 1 ? '#F59E0B' : '#EF4444';
        return `<tr>
      <td class="nf" style="font-weight:600">${esc(plat(p))}</td>
      <td class="r">${fmtBrl(spend)}</td>
      <td class="r">${fmtBrl(rev)}</td>
      <td class="r" style="color:${roasClr};font-weight:600">${roas > 0 ? fmtNum(roas, 2) + 'x' : '—'}</td>
    </tr>`;
    }).join('');

    const diagSummary = (ai.diagnosticos ?? []).slice(0, 2).map(d => {
        const clr = SEV_COLOR[d.severidade];
        return `<div class="alert-card ${d.severidade === 'ok' ? 'positive' : d.severidade === 'media' ? 'warning' : 'critical'}">
      <div class="alert-title" style="color:${clr}">${esc(plat(d.canal))} — ${SEV_LABEL[d.severidade]}</div>
      <div class="alert-desc">${esc(d.sintoma)} · <strong>Ação:</strong> ${esc(d.acao_recomendada)}</div>
      ${d.consequencia_financeira_brl > 0 ? `<div style="font-size:11px;font-weight:700;color:${clr};margin-top:4px;font-family:'Geist Mono',monospace">Impacto: ${fmtBrl(d.consequencia_financeira_brl)}</div>` : ''}
    </div>`;
    }).join('');

    return `<div class="page">
  ${pageHeader('Performance de Canais', profile, period)}
  <div class="page-body">
    <div class="section-title">
      <span class="section-num">03</span>
      <span class="section-name">Performance de Canais</span>
      <span class="section-sub">LTV, CAC e eficiência por canal de aquisição</span>
    </div>

    ${channels.length > 0
        ? `<table class="tbl">
             <thead><tr>
               <th>Canal</th><th class="r">Clientes</th><th class="r">LTV Médio</th>
               <th class="r">CAC</th><th class="r">LTV/CAC</th><th class="r">Valor Criado</th><th class="c">Status</th>
             </tr></thead>
             <tbody>${chanRows.join('')}</tbody>
           </table>`
        : `<div class="empty-state"><p>Nenhum canal de aquisição identificado no período</p></div>`}

    ${adRows ? `<div class="divider"></div>
    <div style="font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:8px;color:#374151">PERFORMANCE DE ADS POR PLATAFORMA</div>
    <table class="tbl">
      <thead><tr>
        <th>Plataforma</th><th class="r">Investimento</th><th class="r">Receita Atribuída</th><th class="r">ROAS</th>
      </tr></thead>
      <tbody>${adRows}</tbody>
    </table>` : `<div class="empty-state mt12"><p>Sem dados de anúncios pagos no período</p></div>`}

    ${diagSummary ? `<div class="divider"></div>
    <div style="font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:8px;color:#374151">DIAGNÓSTICOS CRÍTICOS</div>
    ${diagSummary}` : ''}
  </div>
  ${pageFooter(4, genDate)}
</div>`;
}

/** Pág 5 — Detalhe de Vendas */
function buildVendas(data: ReportData, profile: string, period: string, genDate: string): string {
    const txs = data.transactions_detail.slice(0, 30);
    const total = data.transactions_detail.length;

    // Banner de resumo
    const totalRev = data.transactions_detail.reduce((s, t) => s + (t.amount_net ?? 0), 0);
    const avgTicket = txs.length > 0 ? totalRev / total : 0;

    const rows = txs.map((t, i) => {
        const st = STATUS_DEF[t.status] ?? { text: t.status, color: '#6B7280' };
        return `<tr>
      <td style="color:#9CA3AF;font-size:9px">${String(i + 1).padStart(2, '0')}</td>
      <td>${esc(fmtDateShort(t.created_at))}</td>
      <td>${esc(plat(t.platform))}</td>
      <td style="font-size:9px;color:#9CA3AF">${esc(t.customer_email ?? '—')}</td>
      <td class="r" style="font-weight:600">${fmtBrl(t.amount_net)}</td>
      <td class="c"><span><span class="status-dot" style="background:${st.color}"></span>${esc(st.text)}</span></td>
    </tr>`;
    }).join('');

    const prodRows = data.top_products.slice(0, 8).map(p => `<tr>
      <td class="nf">${esc(p.product_name)}</td>
      <td class="r">${fmtBrl(p.revenue)}</td>
      <td class="r">${p.transactions}</td>
      <td class="r">${p.pct_of_total}%</td>
    </tr>`).join('');

    return `<div class="page">
  ${pageHeader('Detalhe de Vendas', profile, period)}
  <div class="page-body">
    <div class="section-title">
      <span class="section-num">04</span>
      <span class="section-name">Detalhe de Vendas</span>
      <span class="section-sub">${total} transações no período</span>
    </div>

    <!-- Banner resumo -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      <div class="kpi-card neutral">
        <div class="kpi-label">Total de Transações</div>
        <div class="kpi-value">${total.toLocaleString('pt-BR')}</div>
      </div>
      <div class="kpi-card positive">
        <div class="kpi-label">Receita Total</div>
        <div class="kpi-value">${fmtBrl(totalRev)}</div>
      </div>
      <div class="kpi-card neutral">
        <div class="kpi-label">Ticket Médio</div>
        <div class="kpi-value">${fmtBrl(avgTicket)}</div>
      </div>
    </div>

    ${rows
        ? `<table class="tbl">
             <thead><tr>
               <th>#</th><th>Data</th><th>Plataforma</th><th>Cliente</th>
               <th class="r">Valor Líq.</th><th class="c">Status</th>
             </tr></thead>
             <tbody>${rows}</tbody>
           </table>
           ${total > 30 ? `<div style="text-align:center;font-size:11px;color:#9CA3AF;margin-top:8px">Exibindo 30 de ${total} transações — demais disponíveis no Excel</div>` : ''}`
        : `<div class="empty-state"><p>Nenhuma transação registrada no período</p></div>`}

    ${prodRows
        ? `<div class="divider"></div>
           <div style="font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:8px;color:#374151">TOP PRODUTOS</div>
           <table class="tbl">
             <thead><tr>
               <th>Produto</th><th class="r">Receita</th><th class="r">Transações</th><th class="r">% Total</th>
             </tr></thead>
             <tbody>${prodRows}</tbody>
           </table>`
        : ''}
  </div>
  ${pageFooter(5, genDate)}
</div>`;
}

/** Pág 6 — Diagnósticos Completos */
function buildDiagnosticos(ai: ReportAIAnalysis, profile: string, period: string, genDate: string): string {
    const diagCards = (ai.diagnosticos ?? []).map(d => {
        const clr = SEV_COLOR[d.severidade];
        return `<div class="alert-card ${d.severidade === 'ok' ? 'positive' : d.severidade === 'media' ? 'warning' : 'critical'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:14px;font-weight:700;color:${clr}">${esc(plat(d.canal))}</div>
        <div style="display:flex;gap:6px">
          <span class="badge" style="background:${clr}22;color:${clr}">${SEV_LABEL[d.severidade]}</span>
          <span class="badge" style="background:#E5E7EB;color:#374151">${PRAZO_LABEL[d.prazo]}</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;margin-bottom:8px">
        <div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-bottom:2px">● Sintoma</div>
          <div style="color:#374151">${esc(d.sintoma)}</div>
        </div>
        <div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-bottom:2px">● Causa Raiz</div>
          <div style="color:#374151">${esc(d.causa_raiz)}</div>
        </div>
      </div>
      <div style="border-top:1px solid rgba(0,0,0,0.06);padding-top:8px;display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1;font-size:11px;color:#374151">
          <span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;display:block;margin-bottom:2px">▶ Ação Recomendada</span>
          ${esc(d.acao_recomendada)}
        </div>
        ${d.consequencia_financeira_brl > 0 ? `<div style="text-align:right;min-width:110px">
          <span style="font-size:9px;color:#9CA3AF;display:block;margin-bottom:2px">Impacto</span>
          <span style="font-size:13px;font-weight:700;color:${clr};font-family:'Geist Mono',monospace">${fmtBrl(d.consequencia_financeira_brl)}</span>
        </div>` : ''}
      </div>
    </div>`;
    }).join('');

    // Estado saudável
    const healthyState = `<div style="text-align:center;padding:32px;background:#F0FDF4;border-radius:9px;border:1px solid #BBF7D0">
      <div style="font-size:32px;margin-bottom:12px">✓</div>
      <div style="font-size:16px;font-weight:700;color:#16a34a;margin-bottom:6px">Todos os canais estão saudáveis</div>
      <div style="font-size:12px;color:#6B7280">Todos os canais monitorados estão dentro dos parâmetros normais para o período analisado.</div>
    </div>`;

    return `<div class="page">
  ${pageHeader('Diagnósticos', profile, period)}
  <div class="page-body">
    <div class="section-title">
      <span class="section-num">05</span>
      <span class="section-name">Diagnósticos por Canal</span>
      <span class="section-sub">Anomalias e oportunidades identificadas pela IA</span>
    </div>

    ${diagCards || healthyState}
  </div>
  ${pageFooter(6, genDate)}
</div>`;
}

/** Pág 7 — Base de Clientes & RFM */
function buildClientes(data: ReportData, profile: string, period: string, genDate: string): string {
    const totalCustomers = data.summary.total_customers || 1;

    const rfmCards = data.rfm_distribution.map(seg => {
        const m   = RFM_META[seg.segment] ?? { label: seg.segment, color: '#6B7280', bg: '#F9FAFB' };
        const pct = totalCustomers > 0 ? ((seg.count / totalCustomers) * 100).toFixed(1) : '0';
        const borderMap: Record<string, string> = {
            champions: '#22C55E', loyalists: '#3B82F6', em_risco: '#F59E0B',
            perdidos: '#EF4444', novos: '#8B5CF6', outros: '#6B7280',
        };
        const borderClr = borderMap[seg.segment] ?? '#6B7280';
        return `<div class="rfm-card" style="background:${m.bg};border:1px solid ${m.color}33;border-left:3px solid ${borderClr}">
      <div class="rfm-card-label" style="color:${m.color}">${esc(m.label)}</div>
      <div class="rfm-card-count" style="color:${m.color}">${seg.count}</div>
      <div class="rfm-card-ltv" style="color:${m.color}">${fmtBrl(seg.ltv)}</div>
      <div style="font-size:9px;color:#9CA3AF;margin-top:2px">${pct}% da base</div>
    </div>`;
    }).join('');

    const atRiskRows = data.at_risk_customers.slice(0, 15).map((c, i) => {
        const valorRisco = ((c.ltv ?? 0) * (c.churn_probability ?? 0) / 100);
        return `<tr>
      <td>${String(i + 1).padStart(2, '0')}</td>
      <td style="font-size:10px">${esc(c.email ?? '—')}</td>
      <td class="r">${fmtBrl(c.ltv ?? 0)}</td>
      <td class="r" style="color:${(c.churn_probability ?? 0) > 80 ? '#EF4444' : '#F59E0B'};font-weight:600">
        ${c.churn_probability !== null ? fmtPct(c.churn_probability) : '—'}
      </td>
      <td class="r" style="color:#EF4444;font-weight:600">${fmtBrl(valorRisco)}</td>
      <td class="r">${c.days_since_purchase !== null ? `${c.days_since_purchase}d` : '—'}</td>
      <td>${esc(plat(c.channel ?? 'desconhecido'))}</td>
    </tr>`;
    }).join('');

    return `<div class="page">
  ${pageHeader('Clientes & RFM', profile, period)}
  <div class="page-body">
    <div class="section-title">
      <span class="section-num">06</span>
      <span class="section-name">Base de Clientes & Segmentação RFM</span>
      <span class="section-sub">${data.rfm_source === 'estimated' ? 'Estimado (job RFM pendente)' : 'Dados calculados'}</span>
    </div>

    <div class="rfm-grid">
      ${rfmCards || '<div class="empty-state"><p>Segmentação RFM não calculada ainda</p></div>'}
    </div>

    ${atRiskRows
        ? `<div class="divider"></div>
           <div style="font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:8px;color:#374151">
             CLIENTES EM RISCO DE CHURN <span style="color:#EF4444">&gt; 60%</span>
           </div>
           <table class="tbl">
             <thead><tr>
               <th>#</th><th>Email</th><th class="r">LTV</th><th class="r">Churn</th>
               <th class="r">Valor em Risco</th><th class="r">Última Compra</th><th>Canal</th>
             </tr></thead>
             <tbody>${atRiskRows}</tbody>
           </table>`
        : `<div class="empty-state mt16"><p>Nenhum cliente com probabilidade de churn acima de 60%</p></div>`}
  </div>
  ${pageFooter(7, genDate)}
</div>`;
}

/** Pág 8 — Projeções */
function buildProjecoes(data: ReportData, profile: string, period: string, genDate: string): string {
    const { conservative: cons, moderate: mod, optimistic: opt } = data.projections;

    function projCard(cls: string, lbl: string, clr: string, p: typeof cons): string {
        return `<div class="proj-scenario ${cls}" style="flex:1">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:${clr};margin-bottom:12px">${lbl}</div>
      <div style="font-size:22px;font-weight:800;font-family:'Geist Mono',monospace;color:#1E1E1E;margin-bottom:12px">${fmtBrl(p.month1)}</div>
      <div style="font-size:10px;color:#6B7280;margin-bottom:6px">Mês 1 projetado</div>
      <div style="border-top:1px solid #E5E7EB;padding-top:10px">
        <div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0">
          <span style="color:#6B7280">Mês 2</span><span style="font-weight:600;font-family:'Geist Mono',monospace">${fmtBrl(p.month2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0">
          <span style="color:#6B7280">Mês 3</span><span style="font-weight:600;font-family:'Geist Mono',monospace">${fmtBrl(p.month3)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-top:1px solid #E5E7EB;margin-top:4px">
          <span style="color:#6B7280">Crescimento/mês</span><span style="font-weight:700;color:${clr}">${fmtPct(p.rate_pct)}</span>
        </div>
      </div>
    </div>`;
    }

    // Gráfico comparativo simples dos cenários no Mês 3
    const maxVal = Math.max(cons.month3, mod.month3, opt.month3, 1);
    function scenarioBar(val: number, clr: string, lbl: string): string {
        const w = Math.round((val / maxVal) * 100);
        return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
        <span style="color:#374151">${lbl}</span><span style="font-family:'Geist Mono',monospace;font-weight:600">${fmtBrl(val)}</span>
      </div>
      <div style="height:10px;background:#E5E7EB;border-radius:5px;overflow:hidden">
        <div style="width:${w}%;height:100%;background:${clr};border-radius:5px"></div>
      </div>
    </div>`;
    }

    const ltvCacOverall = (data as any).ltv_cac_overall ?? null;
    const paybackMonths = (data as any).payback_months ?? null;

    return `<div class="page">
  ${pageHeader('Projeções', profile, period)}
  <div class="page-body">
    <div class="section-title">
      <span class="section-num">07</span>
      <span class="section-name">Projeções & Valuation</span>
      <span class="section-sub">Cenários baseados no histórico dos últimos 6 meses</span>
    </div>

    <div style="display:flex;gap:14px;margin-bottom:18px">
      ${projCard('conservador', 'CONSERVADOR', '#2563EB', cons)}
      ${projCard('moderado',    'MODERADO',    '#F97316', mod)}
      ${projCard('otimista',    'OTIMISTA',    '#22C55E', opt)}
    </div>

    <div class="divider"></div>
    <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:#374151;margin-bottom:12px">COMPARATIVO — PROJEÇÃO MÊS 3</div>
    ${scenarioBar(cons.month3, '#2563EB', 'Conservador')}
    ${scenarioBar(mod.month3,  '#F97316', 'Moderado')}
    ${scenarioBar(opt.month3,  '#22C55E', 'Otimista')}

    <div class="divider"></div>
    <div class="kpi-grid kpi-grid-4">
      <div class="kpi-card neutral">
        <div class="kpi-label">MRR Projetado</div>
        <div class="kpi-value">${fmtBrl((data as any).mrr_projected ?? 0)}</div>
        <div class="kpi-ctx">Baseado no período</div>
      </div>
      <div class="kpi-card neutral">
        <div class="kpi-label">ARR Projetado</div>
        <div class="kpi-value">${fmtBrl((data as any).arr_projected ?? 0)}</div>
        <div class="kpi-ctx">MRR × 12</div>
      </div>
      <div class="kpi-card ${paybackMonths !== null && paybackMonths <= 12 ? 'positive' : 'negative'}">
        <div class="kpi-label">Payback Period</div>
        <div class="kpi-value">${paybackMonths !== null ? `${fmtNum(paybackMonths, 1)}m` : '—'}</div>
        <div class="kpi-ctx">CAC / receita por cliente</div>
      </div>
      <div class="kpi-card ${ltvCacOverall !== null && ltvCacOverall >= 3 ? 'positive' : 'negative'}">
        <div class="kpi-label">LTV / CAC Geral</div>
        <div class="kpi-value" style="color:${ltvCacOverall !== null && ltvCacOverall >= 3 ? '#22C55E' : '#EF4444'}">
          ${ltvCacOverall !== null ? fmtNum(ltvCacOverall, 2) + 'x' : '—'}
        </div>
        <div class="kpi-ctx">Benchmark: 3x</div>
      </div>
    </div>

    <div style="background:#F9FAFB;border-radius:8px;padding:10px 14px;font-size:10px;color:#6B7280;line-height:1.65;margin-top:10px">
      <strong style="color:#374151">Metodologia:</strong> Conservador = 70% da taxa atual. Moderado = taxa real. Otimista = 130%.
      Modelo: <strong>${esc(data.business_type ?? 'geral')}</strong>.
    </div>
  </div>
  ${pageFooter(8, genDate)}
</div>`;
}

/** Pág 9 — Plano de Ação */
function buildPlanoAcao(ai: ReportAIAnalysis, data: ReportData, profile: string, period: string, genDate: string): string {
    const steps = [
        ...(ai.proximos_passos ?? []),
        ...(ai.diagnosticos ?? []).map(d => d.acao_recomendada),
    ].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 12);

    // Ações padrão baseadas nos dados
    const defaultSteps: string[] = [];
    if (steps.length === 0) {
        const atRisk = data.at_risk_customers.filter(c => (c.churn_probability ?? 0) > 60);
        if (atRisk.length > 0) {
            const valorRisco = atRisk.reduce((s, c) => s + ((c.ltv ?? 0) * (c.churn_probability ?? 0) / 100), 0);
            defaultSteps.push(`Ativar campanha de retenção para ${atRisk.length} clientes com churn > 60% — valor em risco: ${fmtBrl(valorRisco)}`);
        }
        const bestChannel = [...data.channel_economics].sort((a, b) => (b.ltv_cac_ratio ?? 0) - (a.ltv_cac_ratio ?? 0))[0];
        if (bestChannel && data.summary.ad_spend > 0) {
            defaultSteps.push(`Escalar investimento em ${plat(bestChannel.channel)} — LTV/CAC atual: ${fmtNum(bestChannel.ltv_cac_ratio ?? 0, 2)}x`);
        }
        if ((data.missing_integrations ?? []).length > 0) {
            defaultSteps.push(`Conectar integrações faltantes para tracking completo: ${data.missing_integrations.map(m => plat(m.platform)).join(', ')}`);
        }
        if (defaultSteps.length === 0) {
            defaultSteps.push('Manter monitoramento mensal dos indicadores de growth');
        }
    }

    const finalSteps = steps.length > 0 ? steps : defaultSteps;
    const stepItems = finalSteps.map((s, i) => `<li class="step-item">
      <div class="step-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="step-text">${esc(s)}</div>
    </li>`).join('');

    const integrations = data.integrations_active;

    return `<div class="page">
  ${pageHeader('Plano de Ação', profile, period)}
  <div class="page-body">
    <div class="section-title">
      <span class="section-num">08</span>
      <span class="section-name">Plano de Ação</span>
      <span class="section-sub">Próximas etapas recomendadas para o período seguinte</span>
    </div>

    <ul class="step-list">${stepItems}</ul>

    <div class="divider"></div>
    <div style="display:flex;gap:14px">
      <div style="flex:1;background:#F9FAFB;border-radius:8px;padding:14px">
        <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:#6B7280;margin-bottom:8px">INTEGRAÇÕES ATIVAS</div>
        ${integrations.length > 0
            ? integrations.map(i => `<span class="badge-green" style="margin:2px;display:inline-block">${esc(plat(i))}</span>`).join(' ')
            : '<span style="font-size:11px;color:#9CA3AF">Nenhuma integração com dados no período</span>'}
      </div>
      <div style="background:#0F0F23;border-radius:8px;padding:14px;min-width:200px;display:flex;flex-direction:column;justify-content:space-between">
        <div style="font-size:12px;font-weight:700;color:#F97316;letter-spacing:2px">NORTHIE</div>
        <div>
          <div style="font-size:10px;color:#6B7280">Relatório gerado em</div>
          <div style="font-size:11px;color:#E5E7EB;font-family:'Geist Mono',monospace">${esc(genDate)}</div>
        </div>
      </div>
    </div>
  </div>
  ${pageFooter(9, genDate)}
</div>`;
}

/** Pág 10 — Cohort de Retenção */
function buildCohort(data: ReportData, profile: string, period: string, genDate: string): string {
    const cohortData: Array<{
        month: string;
        total: number;
        m0: number; m1: number | null; m2: number | null;
        m3: number | null; m4: number | null; m5: number | null;
    }> = (data as any).cohort ?? (data as any).retencao ?? [];

    function cellClr(pct: number | null): string {
        if (pct === null) return 'cohort-cell-empty';
        if (pct >= 70)    return 'cohort-cell-high';
        if (pct >= 40)    return 'cohort-cell-mid';
        return 'cohort-cell-low';
    }
    function fmtPctOrDash(pct: number | null): string {
        return pct !== null ? fmtPct(pct) : '—';
    }

    if (cohortData.length === 0) {
        return `<div class="page">
  ${pageHeader('Cohort de Retenção', profile, period)}
  <div class="page-body">
    <div class="section-title">
      <span class="section-num">09</span>
      <span class="section-name">Cohort de Retenção</span>
      <span class="section-sub">Retenção de clientes por mês de aquisição</span>
    </div>
    <div class="empty-state">
      <div style="font-size:36px;margin-bottom:12px">📊</div>
      <h3>Dados de cohort não disponíveis</h3>
      <p>São necessários pelo menos 2 meses de histórico de transações para calcular cohorts de retenção.</p>
    </div>
  </div>
  ${pageFooter(10, genDate)}
</div>`;
    }

    const rows = cohortData.map(c => `<tr>
      <td class="nf" style="font-weight:600">${esc(c.month)}</td>
      <td class="r">${c.total}</td>
      <td class="r cohort-cell-high">100%</td>
      <td class="r ${cellClr(c.m1)}">${fmtPctOrDash(c.m1)}</td>
      <td class="r ${cellClr(c.m2)}">${fmtPctOrDash(c.m2)}</td>
      <td class="r ${cellClr(c.m3)}">${fmtPctOrDash(c.m3)}</td>
      <td class="r ${cellClr(c.m4)}">${fmtPctOrDash(c.m4)}</td>
      <td class="r ${cellClr(c.m5)}">${fmtPctOrDash(c.m5)}</td>
    </tr>`).join('');

    // Insights automáticos
    const m1Values = cohortData.map(c => c.m1).filter((v): v is number => v !== null);
    const bestM1   = m1Values.length > 0 ? Math.max(...m1Values) : null;
    const bestCohort = bestM1 !== null ? cohortData.find(c => c.m1 === bestM1) : null;
    const worstM2Values = cohortData.map(c => ({ month: c.month, m2: c.m2 })).filter(c => c.m2 !== null);
    const worstCohort = worstM2Values.length > 0 ? worstM2Values.sort((a, b) => (a.m2! - b.m2!))[0] : null;

    return `<div class="page">
  ${pageHeader('Cohort de Retenção', profile, period)}
  <div class="page-body">
    <div class="section-title">
      <span class="section-num">09</span>
      <span class="section-name">Cohort de Retenção</span>
      <span class="section-sub">Percentual de clientes do cohort com nova compra em cada mês</span>
    </div>

    <table class="tbl" style="margin-bottom:14px">
      <thead><tr>
        <th>Cohort</th><th class="r">Clientes</th>
        <th class="r">M0</th><th class="r">M1</th><th class="r">M2</th>
        <th class="r">M3</th><th class="r">M4</th><th class="r">M5</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="display:flex;gap:16px;font-size:11px;margin-bottom:16px">
      <span><span style="color:#22C55E;font-weight:700">●</span> ≥ 70% Boa retenção</span>
      <span><span style="color:#F59E0B;font-weight:700">●</span> 40–69% Atenção</span>
      <span><span style="color:#EF4444;font-weight:700">●</span> &lt; 40% Crítica</span>
      <span><span style="color:#9CA3AF">●</span> Sem dados</span>
    </div>

    ${bestCohort || worstCohort ? `<div class="divider"></div>
    <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:#374151;margin-bottom:10px">INSIGHTS</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${bestCohort ? `<div class="alert-card positive">
        <div class="alert-title">Melhor cohort</div>
        <div class="alert-desc">${esc(bestCohort.month)} com ${fmtPct(bestCohort.m1!)} de retenção em M1</div>
      </div>` : ''}
      ${worstCohort ? `<div class="alert-card critical">
        <div class="alert-title">Cohort com maior risco</div>
        <div class="alert-desc">${esc(worstCohort.month)} — retenção de ${fmtPct(worstCohort.m2!)} em M2</div>
      </div>` : ''}
    </div>` : ''}
  </div>
  ${pageFooter(10, genDate)}
</div>`;
}

/** Pág 11 — Valuation & Benchmarks */
function buildValuation(data: ReportData, profile: string, period: string, genDate: string): string {
    const s   = data.summary;
    const hs  = data.health_score;

    const arr = (data as any).arr_projected ?? s.revenue_net * 12;
    const ltvTotal = data.channel_economics.reduce((sum, c) => sum + c.avg_ltv * c.new_customers, s.total_customers > 0 ? s.ltv_avg * s.total_customers * 0.5 : 0);

    const valMin = arr * 3;
    const valMax = arr * 8;
    const valLtv = ltvTotal * 0.5;

    const stage = hs.score >= 86 ? 'Série B+' : hs.score >= 66 ? 'Série A' : hs.score >= 41 ? 'Seed' : 'Pré-seed';
    const stageBadge = hs.score >= 86 ? `<span class="badge-green">${stage}</span>` :
                       hs.score >= 66 ? `<span class="badge-blue">${stage}</span>` :
                       hs.score >= 41 ? `<span class="badge-yellow">${stage}</span>` :
                                        `<span class="badge-red">${stage}</span>`;

    // Benchmarks
    const cacAvg = data.channel_economics.filter(c => c.cac > 0).reduce((sum, c, _, a) => sum + c.cac / a.length, 0);
    const ltvCac = (data as any).ltv_cac_overall ?? null;

    function bmRow(label: string, value: string, benchmark: string, ok: boolean): string {
        return `<tr>
      <td class="nf">${label}</td>
      <td class="r" style="font-family:'Geist Mono',monospace;font-weight:600">${value}</td>
      <td class="r" style="color:#6B7280;font-size:11px">${benchmark}</td>
      <td class="c">${ok ? `<span class="badge-green">✓ Acima</span>` : `<span class="badge-red">✗ Abaixo</span>`}</td>
    </tr>`;
    }

    // Radar metrics
    const growthScore = hs.score >= 70 ? 80 : hs.score >= 40 ? 50 : 25;
    const effScore    = ltvCac !== null ? Math.min(100, Math.round(ltvCac / 5 * 100)) : 0;
    const champPct    = data.rfm_distribution.length > 0
        ? Math.round((data.rfm_distribution.filter(seg => seg.segment === 'champions' || seg.segment === 'loyalists').reduce((sum, seg) => sum + seg.count, 0) / s.total_customers) * 100)
        : 0;
    const refundScore = Math.max(0, Math.round(100 - s.refund_rate * 10));

    function radarBar(label: string, score: number, current: string, bench: string): string {
        const clr = score >= 70 ? '#22C55E' : score >= 40 ? '#F59E0B' : '#EF4444';
        return `<div style="background:#F9FAFB;border-radius:8px;padding:12px 14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:11px;font-weight:600;color:#374151">${label}</span>
        <span style="font-size:11px;font-weight:700;color:${clr}">${score}/100</span>
      </div>
      <div style="height:6px;background:#E5E7EB;border-radius:3px;overflow:hidden;margin-bottom:5px">
        <div style="width:${score}%;height:100%;background:${clr};border-radius:3px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#9CA3AF">
        <span>Atual: ${current}</span><span>Bench: ${bench}</span>
      </div>
    </div>`;
    }

    return `<div class="page">
  ${pageHeader('Valuation & Benchmarks', profile, period)}
  <div class="page-body">
    <div class="section-title">
      <span class="section-num">10</span>
      <span class="section-name">Valuation & Benchmarks</span>
      <span class="section-sub">Estimativas baseadas em múltiplos de mercado para negócios digitais brasileiros</span>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px">
      <div class="valuation-card">
        <div class="val-label">Múltiplo de Receita (3x–8x ARR)</div>
        <div class="val-number">${fmtBrl(valMin)}</div>
        <div class="val-range">${fmtBrl(valMin)} — ${fmtBrl(valMax)}</div>
        <div style="font-size:10px;color:#9CA3AF;margin-top:6px">ARR projetado: ${fmtBrl(arr)}</div>
      </div>
      <div class="valuation-card">
        <div class="val-label">Valor da Base de Clientes</div>
        <div class="val-number">${fmtBrl(valLtv)}</div>
        <div class="val-range">LTV total × 0.5 (risco)</div>
        <div style="font-size:10px;color:#9CA3AF;margin-top:6px">${s.total_customers} clientes ativos</div>
      </div>
      <div class="valuation-card">
        <div class="val-label">Estágio de Maturidade</div>
        <div style="margin:10px 0">${stageBadge}</div>
        <div class="val-range">Health Score: ${hs.score}/100</div>
        <div style="font-size:10px;color:#9CA3AF;margin-top:6px">${hs.label}</div>
      </div>
    </div>

    <div class="divider"></div>
    <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:#374151;margin-bottom:10px">BENCHMARKS DO SETOR</div>
    <table class="tbl" style="margin-bottom:16px">
      <thead><tr><th>Métrica</th><th class="r">Seu Negócio</th><th class="r">Benchmark</th><th class="c">Status</th></tr></thead>
      <tbody>
        ${bmRow('LTV Médio', fmtBrl(s.ltv_avg), '> R$ 300', s.ltv_avg >= 300)}
        ${bmRow('CAC Médio', cacAvg > 0 ? fmtBrl(cacAvg) : '—', '< R$ 50', cacAvg > 0 && cacAvg <= 50)}
        ${bmRow('LTV / CAC', ltvCac !== null ? fmtNum(ltvCac, 2) + 'x' : '—', '> 3x', ltvCac !== null && ltvCac >= 3)}
        ${bmRow('ROAS', s.ad_spend > 0 ? fmtNum(s.roas, 2) + 'x' : '—', '> 2x', s.roas >= 2)}
        ${bmRow('Taxa de Reembolso', fmtPct(s.refund_rate), '< 5%', s.refund_rate < 5)}
        ${bmRow('Ticket Médio', fmtBrl(s.aov), '> R$ 150', s.aov >= 150)}
        ${bmRow('Margem Bruta', fmtPct(s.gross_margin_pct), '> 60%', s.gross_margin_pct >= 60)}
      </tbody>
    </table>

    <div class="divider"></div>
    <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:#374151;margin-bottom:10px">RADAR DE SAÚDE</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      ${radarBar('Crescimento de Receita', growthScore, fmtPct(s.revenue_change_pct ?? 0), '> 10%/mês')}
      ${radarBar('Eficiência de Aquisição', effScore, ltvCac !== null ? fmtNum(ltvCac, 2) + 'x' : '—', '> 3x LTV/CAC')}
      ${radarBar('Qualidade da Base', champPct, `${champPct}%`, '> 30% Champions+Leais')}
      ${radarBar('Saúde de Reembolso', refundScore, fmtPct(s.refund_rate), '< 5% reembolso')}
    </div>

    <div style="background:#0F0F23;border-radius:8px;padding:14px;font-size:11px;color:#9CA3AF;line-height:1.75">
      <strong style="color:#F97316">Nota para Investidores:</strong> Este relatório é gerado automaticamente pela Northie com base nos dados reais do negócio.
      Os valores de valuation são estimativas baseadas em múltiplos de mercado e <strong>não constituem avaliação formal</strong>.
      Para due diligence, utilize os dados auditados disponíveis na plataforma Northie Raise.
    </div>
  </div>
  ${pageFooter(11, genDate)}
</div>`;
}

/** Pág 12 — Top Clientes & Anomalias */
function buildTopClientes(data: ReportData, profile: string, period: string, genDate: string): string {
    const s = data.summary;

    // Top 10 clientes por LTV (usando at_risk_customers + channel_economics como proxy)
    // Usa data.at_risk_customers (que já tem LTV) e ordena decrescente
    const allClients = [...data.at_risk_customers]
        .sort((a, b) => (b.ltv ?? 0) - (a.ltv ?? 0))
        .slice(0, 10);

    const totalLtv = allClients.reduce((sum, c) => sum + (c.ltv ?? 0), 0);
    const maxLtv   = allClients.length > 0 ? (allClients[0]?.ltv ?? 1) : 1;
    const baseLtv  = s.ltv_avg * s.total_customers;
    const top10pct = baseLtv > 0 ? ((totalLtv / baseLtv) * 100).toFixed(1) : '—';

    const RFM_SEGMENT_COLOR: Record<string, string> = {
        champions: 'badge-green', loyalists: 'badge-blue', em_risco: 'badge-yellow',
        perdidos: 'badge-red', novos: 'badge-orange',
    };

    const clientRows = allClients.map((c, i) => {
        const barPct = maxLtv > 0 ? Math.round(((c.ltv ?? 0) / maxLtv) * 100) : 0;
        const rfmSeg = (c as any).rfm_segment ?? '';
        const badgeCls = RFM_SEGMENT_COLOR[rfmSeg] ?? 'badge-orange';
        const rfmLabel = RFM_META[rfmSeg]?.label ?? (rfmSeg || '—');
        return `<div class="client-rank">
      <div class="rank-num">${String(i + 1).padStart(2, '0')}</div>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:12px;color:#374151">${esc(c.email ?? `Cliente #${i + 1}`)}</span>
          <span style="font-size:13px;font-weight:700;font-family:'Geist Mono',monospace;color:#1E1E1E">${fmtBrl(c.ltv ?? 0)}</span>
        </div>
        <div style="height:5px;background:#E5E7EB;border-radius:3px;overflow:hidden;margin-bottom:4px">
          <div style="width:${barPct}%;height:100%;background:#F97316;border-radius:3px"></div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;font-size:10px;color:#9CA3AF">
          <span>${esc(plat(c.channel ?? 'desconhecido'))}</span>
          ${rfmLabel !== '—' ? `<span class="${badgeCls}">${esc(rfmLabel)}</span>` : ''}
          <span style="margin-left:auto">${baseLtv > 0 ? (((c.ltv ?? 0) / baseLtv) * 100).toFixed(2) + '% da base' : ''}</span>
        </div>
      </div>
    </div>`;
    }).join('');

    // Anomalias automáticas
    const anomalies: Array<{ cls: string; title: string; desc: string }> = [];

    // 1. Queda de receita > 50%
    if (s.revenue_change_pct !== null && s.revenue_change_pct < -50) {
        anomalies.push({ cls: 'critical', title: `Queda de receita de ${Math.abs(s.revenue_change_pct).toFixed(0)}%`, desc: `Receita caiu ${Math.abs(s.revenue_change_pct).toFixed(1)}% vs período anterior — de ${fmtBrl(s.revenue_net / (1 + s.revenue_change_pct / 100))} para ${fmtBrl(s.revenue_net)}` });
    }
    // 2. Crescimento > 100%
    if (s.revenue_change_pct !== null && s.revenue_change_pct > 100) {
        anomalies.push({ cls: 'positive', title: `Crescimento excepcional de ${s.revenue_change_pct.toFixed(0)}%`, desc: `Receita cresceu ${s.revenue_change_pct.toFixed(1)}% vs período anterior — de ${fmtBrl(s.revenue_net / (1 + s.revenue_change_pct / 100))} para ${fmtBrl(s.revenue_net)}` });
    }
    // 3. Clientes de alto LTV em risco
    const highRisk = data.at_risk_customers.filter(c => (c.ltv ?? 0) > 500 && (c.churn_probability ?? 0) > 60);
    if (highRisk.length > 0) {
        const valRisco = highRisk.reduce((s, c) => s + ((c.ltv ?? 0) * (c.churn_probability ?? 0) / 100), 0);
        anomalies.push({ cls: 'critical', title: `${highRisk.length} clientes premium em risco de churn`, desc: `Clientes com LTV > R$ 500 e churn > 60% — valor em risco: ${fmtBrl(valRisco)}` });
    }
    // 4. ROAS abaixo de 1
    if (s.ad_spend > 0 && s.roas < 1) {
        const bestChan = Object.entries(data.spend_by_platform)[0];
        anomalies.push({ cls: 'critical', title: `ROAS abaixo de 1x`, desc: `${bestChan ? esc(plat(bestChan[0])) + ' com' : ''} ROAS de ${fmtNum(s.roas, 2)}x — investindo mais do que retornando` });
    }
    // 5. Sem transações
    if (s.transactions === 0) {
        anomalies.push({ cls: 'warning', title: 'Nenhuma transação no período', desc: 'Verifique se as integrações estão conectadas e funcionando corretamente' });
    }
    // Default: tudo ok
    if (anomalies.length === 0) {
        anomalies.push({ cls: 'positive', title: 'Período dentro dos parâmetros normais', desc: 'Nenhuma anomalia crítica detectada. Continue monitorando os indicadores mensalmente.' });
    }

    const anomalyCards = anomalies.map(a => `<div class="alert-card ${a.cls}">
      <div class="alert-title">${a.title}</div>
      <div class="alert-desc">${a.desc}</div>
    </div>`).join('');

    return `<div class="page">
  ${pageHeader('Top Clientes & Anomalias', profile, period)}
  <div class="page-body">
    <div class="section-title">
      <span class="section-num">11</span>
      <span class="section-name">Top Clientes & Anomalias</span>
      <span class="section-sub">Maiores clientes por LTV e destaques do período</span>
    </div>

    <div class="two-col" style="gap:24px">
      <div>
        <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:#374151;margin-bottom:10px">TOP 10 CLIENTES POR LTV</div>
        ${allClients.length > 0
            ? `${clientRows}
               <div style="font-size:11px;color:#6B7280;margin-top:8px;text-align:right">Top 10 representam aprox. <strong>${top10pct}%</strong> do LTV total da base</div>`
            : `<div class="empty-state"><p>Nenhum dado de cliente disponível</p></div>`}
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:#374151;margin-bottom:10px">ANOMALIAS E DESTAQUES</div>
        ${anomalyCards}
      </div>
    </div>
  </div>
  ${pageFooter(12, genDate)}
</div>`;
}

// ── HTML assembler ────────────────────────────────────────────────────────────

function buildHTML(data: ReportData, ai: ReportAIAnalysis): string {
    const genDate  = new Date().toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
    const profile  = data.profile_name ?? 'Northie Report';
    const period   = `${fmtDateShort(data.period.start)} — ${fmtDateShort(data.period.end)}`;

    const pages = [
        buildCover(data, ai, genDate),
        buildResumo(data, profile, period, genDate),
        buildAnaliseIA(data, ai, profile, period, genDate),
        buildCanais(data, ai, profile, period, genDate),
        buildVendas(data, profile, period, genDate),
        buildDiagnosticos(ai, profile, period, genDate),
        buildClientes(data, profile, period, genDate),
        buildProjecoes(data, profile, period, genDate),
        buildPlanoAcao(ai, data, profile, period, genDate),
        buildCohort(data, profile, period, genDate),
        buildValuation(data, profile, period, genDate),
        buildTopClientes(data, profile, period, genDate),
    ].join('\n');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Northie Report — ${esc(profile)}</title>
<style>${CSS}</style>
</head>
<body>${pages}</body>
</html>`;
}

// ── AI fallback ───────────────────────────────────────────────────────────────

const FALLBACK_AI: ReportAIAnalysis = {
    situacao_geral:  'atencao',
    resumo_executivo: 'Análise de IA não disponível para este relatório.',
    diagnosticos:    [],
    proximos_passos: [],
    generated_at:    new Date().toISOString(),
    model:           'n/a',
    is_ai_fallback:  true,
};

// ── Main export ───────────────────────────────────────────────────────────────

export async function generatePdf(data: ReportData, ai?: ReportAIAnalysis): Promise<Buffer> {
    const analysis = ai ?? FALLBACK_AI;
    const html     = buildHTML(data, analysis);

    // Em produção (Vercel serverless) usa @sparticuz/chromium.
    // Em desenvolvimento local usa Chrome instalado na máquina.
    const isVercel = !!process.env.VERCEL;

    const executablePath = isVercel
        ? await chromium.executablePath()
        : process.platform === 'win32'
            ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            : '/usr/bin/google-chrome';

    const args = isVercel
        ? chromium.args
        : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'];

    const browser = await puppeteer.launch({
        args,
        executablePath,
        headless: true,
    });

    try {
        const page = await browser.newPage();
        // networkidle2 (vs networkidle0) tolera conexões abertas — mais robusto em serverless
        await page.setContent(html, { waitUntil: 'networkidle2', timeout: 60_000 });
        const pdf = await page.pdf({
            format:          'A4',
            printBackground: true,
            margin:          { top: 0, right: 0, bottom: 0, left: 0 },
        });
        return Buffer.from(pdf);
    } finally {
        await browser.close();
    }
}
