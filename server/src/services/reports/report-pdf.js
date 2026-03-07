/**
 * report-pdf.ts
 * Gera PDF de relatório usando Puppeteer (HTML → PDF).
 * Identidade visual Northie: #F97316 (laranja), #0F0F23 (dark), Poppins + Geist Mono.
 */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
// ── Formatters ────────────────────────────────────────────────────────────────
function fmtBrl(n) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0);
}
function fmtNum(n, dec = 1) {
    return (n ?? 0).toLocaleString('pt-BR', {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
    });
}
function fmtPct(n) {
    return `${fmtNum(n)}%`;
}
function fmtDateLong(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric',
    });
}
function fmtDateShort(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
}
/** Escapa caracteres HTML para prevenir XSS no template. */
function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// ── Lookup tables ─────────────────────────────────────────────────────────────
const PLATFORM_LABEL = {
    meta_ads: 'Meta Ads', meta: 'Meta Ads',
    google_ads: 'Google Ads', google: 'Google Ads',
    hotmart: 'Hotmart', stripe: 'Stripe', shopify: 'Shopify',
    organico: 'Orgânico', email: 'Email', direto: 'Direto',
    afiliado: 'Afiliado', desconhecido: 'Outros',
};
function plat(s) { return PLATFORM_LABEL[s] ?? s; }
const STATUS_DEF = {
    approved: { text: 'Aprovado', color: '#10B981' },
    refunded: { text: 'Reembolsado', color: '#EF4444' },
    pending: { text: 'Pendente', color: '#F59E0B' },
    cancelled: { text: 'Cancelado', color: '#6B7280' },
    chargeback: { text: 'Chargeback', color: '#EF4444' },
};
const SEV_COLOR = {
    critica: '#EF4444', alta: '#F97316', media: '#F59E0B', ok: '#10B981',
};
const SEV_BG = {
    critica: '#FEF2F2', alta: '#FFF7ED', media: '#FFFBEB', ok: '#F0FDF4',
};
const SEV_LABEL = {
    critica: 'CRÍTICO', alta: 'GRAVE', media: 'MODERADO', ok: 'POSITIVO',
};
const PRAZO_LABEL = {
    imediato: 'Imediato', esta_semana: 'Esta semana', este_mes: 'Este mês',
};
const SIT_COLOR = {
    saudavel: '#10B981', atencao: '#F59E0B', critica: '#EF4444',
};
const SIT_LABEL = {
    saudavel: 'SAUDÁVEL', atencao: 'ATENÇÃO', critica: 'CRÍTICO',
};
const RFM_META = {
    champions: { label: 'Champions', color: '#10B981', bg: '#F0FDF4' },
    loyalists: { label: 'Leais', color: '#3B82F6', bg: '#EFF6FF' },
    em_risco: { label: 'Em Risco', color: '#F59E0B', bg: '#FFFBEB' },
    perdidos: { label: 'Perdidos', color: '#EF4444', bg: '#FEF2F2' },
    novos: { label: 'Novos', color: '#8B5CF6', bg: '#F5F3FF' },
    outros: { label: 'Outros', color: '#6B7280', bg: '#F9FAFB' },
};
// ── SVG helpers ───────────────────────────────────────────────────────────────
/** Anel SVG de pontuação (score ring). */
function scoreRingSvg(score, color, size = 96) {
    const r = size * 0.37;
    const c = size / 2;
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
function trendBarChart(trend) {
    if (!trend || trend.length === 0) {
        return `<div style="text-align:center;color:#6B7280;font-size:11px;padding:20px">Sem dados de tendência</div>`;
    }
    const W = 500;
    const H = 90;
    const PAD = 24;
    const max = Math.max(...trend.map(d => d.revenue), 1);
    const barW = Math.floor((W - PAD * 2) / trend.length) - 3;
    const bars = trend.map((d, i) => {
        const bh = Math.max(3, Math.round((d.revenue / max) * (H - 24)));
        const x = PAD + i * (barW + 3);
        const y = H - 18 - bh;
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
`;
// ── Partial builders ───────────────────────────────────────────────────────────
function pageHeader(section, profile, period) {
    return `<div class="page-header">
  <div class="ph-brand">NORTHIE</div>
  <div class="ph-meta">
    <div class="ph-profile">${esc(profile)}</div>
    <div class="ph-period">${esc(section)} · ${esc(period)}</div>
  </div>
</div>`;
}
function pageFooter(num, genDate) {
    return `<div class="page-footer">
  <span class="pf-text">Gerado em ${esc(genDate)} · Northie Analytics</span>
  <span class="pf-text">Página ${num}</span>
</div>`;
}
// ── PAGE BUILDERS ──────────────────────────────────────────────────────────────
/** Pág 1 — Capa */
function buildCover(data, ai, genDate) {
    const s = data.summary;
    const hs = data.health_score;
    const hsClr = hs.score >= 70 ? '#10B981' : hs.score >= 40 ? '#F59E0B' : '#EF4444';
    const sitClr = SIT_COLOR[ai.situacao_geral];
    const periodStart = fmtDateLong(data.period.start);
    const periodEnd = fmtDateLong(data.period.end);
    const profile = data.profile_name ?? 'Relatório';
    const bizType = data.business_type
        ? data.business_type.charAt(0).toUpperCase() + data.business_type.slice(1)
        : '';
    const delta = s.revenue_change_pct;
    const deltaStr = delta !== null
        ? `${delta >= 0 ? '+' : ''}${fmtNum(delta)}% vs anterior`
        : '';
    return `<div class="page cover">
  <div class="cover-inner">
    <div class="cover-logo">NORTHIE</div>
    <div class="cover-eyebrow">Relatório de Performance</div>
    <div class="cover-title">${esc(profile)}</div>
    <div class="cover-subtitle">${esc(bizType)}${bizType ? ' · ' : ''}${periodStart} — ${periodEnd}</div>

    <div class="cover-kpis">
      <div class="cover-kpi">
        <div class="cover-kpi-label">Receita Líquida</div>
        <div class="cover-kpi-value">${fmtBrl(s.revenue_net)}</div>
        ${deltaStr ? `<div style="font-size:10px;color:#10B981;margin-top:3px">${esc(deltaStr)}</div>` : ''}
      </div>
      <div class="cover-kpi">
        <div class="cover-kpi-label">Novos Clientes</div>
        <div class="cover-kpi-value">${s.new_customers.toLocaleString('pt-BR')}</div>
        <div style="font-size:10px;color:#6B7280;margin-top:3px">${s.transactions} transações</div>
      </div>
      <div class="cover-kpi">
        <div class="cover-kpi-label">Situação Geral</div>
        <div class="cover-kpi-value" style="color:${sitClr}">${SIT_LABEL[ai.situacao_geral]}</div>
        <div style="font-size:10px;color:#6B7280;margin-top:3px">Análise IA</div>
      </div>
    </div>
  </div>

  <div class="cover-score-row">
    ${scoreRingSvg(hs.score, hsClr, 88)}
    <div class="cover-score-info">
      <div class="cover-score-info-title">Health Score</div>
      <div class="cover-score-info-value" style="color:${hsClr}">${esc(hs.label)} · ${hs.score}/100</div>
      <div class="cover-score-info-desc">Índice composto de saúde financeira — LTV/CAC, crescimento, qualidade de canais e taxa de reembolso.</div>
    </div>
  </div>

  <div class="cover-footer">
    <span class="cover-footer-brand">Northie Intelligence Platform</span>
    <span class="cover-footer-gen">Gerado em ${esc(genDate)}</span>
  </div>
</div>`;
}
/** Pág 2 — Resumo Executivo */
function buildResumo(data, profile, period, genDate) {
    const s = data.summary;
    const hs = data.health_score;
    const hsClr = hs.score >= 70 ? '#10B981' : hs.score >= 40 ? '#F59E0B' : '#EF4444';
    const delta = s.revenue_change_pct;
    const deltaHtml = delta !== null
        ? `<span class="kpi-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${fmtNum(delta)}% vs anterior</span>`
        : `<span class="kpi-delta neu">Sem período anterior</span>`;
    return `<div class="page">
  ${pageHeader('Resumo Executivo', profile, period)}
  <div class="page-body">
    <div class="sec-num">01</div>
    <div class="sec-title">Resumo Executivo</div>
    <div class="sec-sub">Indicadores consolidados do período ${esc(fmtDateLong(data.period.start))} — ${esc(fmtDateLong(data.period.end))}</div>

    <div class="kpi-grid kpi-grid-4">
      <div class="kpi-card accent">
        <div class="kpi-label">Receita Líquida</div>
        <div class="kpi-value lg">${fmtBrl(s.revenue_net)}</div>
        ${deltaHtml}
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Ticket Médio</div>
        <div class="kpi-value">${fmtBrl(s.aov)}</div>
        <div class="kpi-ctx">${s.transactions} transações</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">LTV Médio</div>
        <div class="kpi-value">${fmtBrl(s.ltv_avg)}</div>
        <div class="kpi-ctx">${s.new_customers} novos clientes</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Margem Bruta</div>
        <div class="kpi-value">${fmtPct(s.gross_margin_pct)}</div>
        <div class="kpi-ctx">Líq / Bruto</div>
      </div>
    </div>

    <div class="kpi-grid kpi-grid-4">
      <div class="kpi-card">
        <div class="kpi-label">Investimento Ads</div>
        <div class="kpi-value">${fmtBrl(s.ad_spend)}</div>
        <div class="kpi-ctx">Período completo</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">ROAS</div>
        <div class="kpi-value" style="color:${s.roas >= 3 ? '#10B981' : s.roas > 0 ? '#F59E0B' : '#9CA3AF'}">${s.ad_spend > 0 ? fmtNum(s.roas, 2) + 'x' : '—'}</div>
        <div class="kpi-ctx">${s.ad_spend > 0 ? (s.roas >= 3 ? 'Acima do benchmark' : 'Abaixo do benchmark') : 'Sem spend registrado'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Taxa de Reembolso</div>
        <div class="kpi-value" style="color:${s.refund_rate > 5 ? '#EF4444' : '#1E1E1E'}">${fmtPct(s.refund_rate)}</div>
        <div class="kpi-ctx">${fmtBrl(s.refund_amount)} devolvido</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Base de Clientes</div>
        <div class="kpi-value">${s.total_customers.toLocaleString('pt-BR')}</div>
        <div class="kpi-ctx">Total acumulado</div>
      </div>
    </div>

    <div class="divider"></div>

    <div style="display:flex;gap:16px;align-items:flex-start">
      ${scoreRingSvg(hs.score, hsClr, 76)}
      <div style="flex:1">
        <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${hsClr};margin-bottom:8px">HEALTH SCORE: ${hs.score}/100 — ${esc(hs.label)}</div>
        <div class="health-grid">
          ${Object.entries(hs.breakdown).map(([key, v]) => {
        const bd = v;
        const clr = bd.score >= 70 ? '#10B981' : bd.score >= 40 ? '#F59E0B' : '#EF4444';
        const labels = { ltv_cac: 'LTV/CAC', refund: 'Reembolso', growth: 'Crescimento', roas: 'ROAS' };
        return `<div class="health-item">
            <div class="health-label">${labels[key] ?? key}</div>
            <div class="health-bar-wrap"><div class="health-bar" style="width:${bd.score}%;background:${clr}"></div></div>
            <div class="health-score" style="color:${clr}">${bd.score}</div>
          </div>`;
    }).join('')}
        </div>
      </div>
    </div>

    <div class="divider"></div>
    <div style="font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:10px;color:#374151">TENDÊNCIA DE RECEITA</div>
    ${trendBarChart(data.revenue_trend)}
  </div>
  ${pageFooter(2, genDate)}
</div>`;
}
/** Pág 3 — Análise da IA */
function buildAnaliseIA(data, ai, profile, period, genDate) {
    const sitClr = SIT_COLOR[ai.situacao_geral];
    const missingHtml = (data.missing_integrations ?? []).length > 0
        ? `<div class="alert-box">
            <strong>Integrações não conectadas:</strong>
            ${data.missing_integrations.map(m => esc(m.platform)).join(', ')} —
            conecte para análises mais precisas.
           </div>`
        : '';
    return `<div class="page">
  ${pageHeader('Análise de Inteligência', profile, period)}
  <div class="page-body">
    <div class="sec-num">02</div>
    <div class="sec-title">Análise de Inteligência</div>
    <div class="sec-sub">Gerado por ${esc(ai.model)} · ${esc(fmtDateShort(ai.generated_at))}${ai.is_ai_fallback ? ' · Análise simplificada' : ''}</div>

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <span class="badge" style="background:${sitClr}22;color:${sitClr};font-size:10px;padding:4px 12px">${SIT_LABEL[ai.situacao_geral]}</span>
      <span style="font-size:11px;color:#6B7280">Situação geral identificada pela IA no período</span>
    </div>

    <div class="ai-box">
      <div class="ai-box-label">Resumo Executivo da IA</div>
      <div class="ai-box-text">${esc(ai.resumo_executivo)}</div>
    </div>

    ${ai.proximos_passos?.length > 0 ? `
    <div style="margin-top:14px">
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:#F97316;margin-bottom:8px">PRÓXIMOS PASSOS RECOMENDADOS</div>
      <ul class="ai-steps" style="background:#0F0F23;border-radius:9px;padding:14px 14px 14px 34px">
        ${ai.proximos_passos.map(p => `<li>${esc(p)}</li>`).join('')}
      </ul>
    </div>` : ''}

    ${missingHtml}
  </div>
  ${pageFooter(3, genDate)}
</div>`;
}
/** Pág 4 — Performance por Canal */
function buildCanais(data, ai, profile, period, genDate) {
    const channels = data.channel_economics;
    const chanRows = channels.length > 0
        ? channels.map(e => {
            const stColor = e.status === 'lucrativo' ? '#10B981' : e.status === 'organico' ? '#3B82F6' : '#EF4444';
            const stText = e.status === 'lucrativo' ? 'Lucrativo' : e.status === 'organico' ? 'Orgânico' : 'Prejuízo';
            return `<tr>
          <td class="nf" style="font-weight:600">${esc(plat(e.channel))}</td>
          <td class="r">${e.new_customers}</td>
          <td class="r">${fmtBrl(e.avg_ltv)}</td>
          <td class="r">${e.cac > 0 ? fmtBrl(e.cac) : '—'}</td>
          <td class="r">${e.ltv_cac_ratio !== null ? fmtNum(e.ltv_cac_ratio, 2) + 'x' : '—'}</td>
          <td class="r">${fmtBrl(e.value_created)}</td>
          <td class="c"><span class="badge" style="background:${stColor}22;color:${stColor}">${stText}</span></td>
        </tr>`;
        }).join('')
        : '';
    const adRows = Object.entries(data.spend_by_platform).map(([p, spend]) => {
        const rev = data.revenue_by_platform[p] ?? 0;
        const roas = spend > 0 ? rev / spend : 0;
        return `<tr>
          <td class="nf" style="font-weight:600">${esc(plat(p))}</td>
          <td class="r">${fmtBrl(spend)}</td>
          <td class="r">${fmtBrl(rev)}</td>
          <td class="r" style="color:${roas >= 3 ? '#10B981' : '#EF4444'};font-weight:600">${roas > 0 ? fmtNum(roas, 2) + 'x' : '—'}</td>
        </tr>`;
    }).join('');
    // Diagnósticos resumidos (primeiros 3)
    const diagSummary = (ai.diagnosticos ?? []).slice(0, 3).map(d => {
        const clr = SEV_COLOR[d.severidade];
        return `<div class="diag-card" style="background:${SEV_BG[d.severidade]};border:1.5px solid ${clr}33;margin-bottom:8px">
      <div class="diag-head">
        <div class="diag-canal" style="color:${clr}">${esc(plat(d.canal))}</div>
        <div class="diag-tags">
          <span class="badge" style="background:${clr}22;color:${clr}">${SEV_LABEL[d.severidade]}</span>
          <span class="badge" style="background:#1E1E1E18;color:#374151">${PRAZO_LABEL[d.prazo]}</span>
        </div>
      </div>
      <div style="font-size:10.5px;color:#374151;line-height:1.5"><strong>Sintoma:</strong> ${esc(d.sintoma)}</div>
      <div style="font-size:10.5px;color:#374151;line-height:1.5;margin-top:4px"><strong>Ação:</strong> ${esc(d.acao_recomendada)}</div>
      ${d.consequencia_financeira_brl > 0 ? `<div style="font-size:10px;font-weight:700;color:${clr};margin-top:4px;font-family:'Geist Mono',monospace">Impacto: ${fmtBrl(d.consequencia_financeira_brl)}</div>` : ''}
    </div>`;
    }).join('');
    return `<div class="page">
  ${pageHeader('Performance de Canais', profile, period)}
  <div class="page-body">
    <div class="sec-num">03</div>
    <div class="sec-title">Performance de Canais</div>
    <div class="sec-sub">LTV, CAC e eficiência por canal de aquisição</div>

    ${chanRows ? `<table class="tbl">
      <thead><tr>
        <th>Canal</th><th class="r">Clientes</th><th class="r">LTV Médio</th>
        <th class="r">CAC</th><th class="r">LTV/CAC</th><th class="r">Valor Criado</th><th class="c">Status</th>
      </tr></thead>
      <tbody>${chanRows}</tbody>
    </table>` : '<div class="empty">Nenhum canal de aquisição identificado no período</div>'}

    ${adRows ? `<div class="divider"></div>
    <div style="font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:8px;color:#374151">PERFORMANCE DE ADS</div>
    <table class="tbl">
      <thead><tr>
        <th>Plataforma</th><th class="r">Investimento</th><th class="r">Receita Atribuída</th><th class="r">ROAS</th>
      </tr></thead>
      <tbody>${adRows}</tbody>
    </table>` : ''}

    ${diagSummary ? `<div class="divider"></div>
    <div style="font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:8px;color:#374151">DIAGNÓSTICOS CRÍTICOS</div>
    ${diagSummary}` : ''}
  </div>
  ${pageFooter(4, genDate)}
</div>`;
}
/** Pág 5 — Detalhe de Vendas */
function buildVendas(data, profile, period, genDate) {
    const txs = data.transactions_detail.slice(0, 40);
    const rows = txs.map((t, i) => {
        const st = STATUS_DEF[t.status] ?? { text: t.status, color: '#6B7280' };
        return `<tr>
      <td style="color:#9CA3AF;font-size:9px">${String(i + 1).padStart(2, '0')}</td>
      <td>${esc(fmtDateShort(t.created_at))}</td>
      <td>${esc(plat(t.platform))}</td>
      <td style="font-size:9px;color:#9CA3AF">${esc(t.customer_email ?? '—')}</td>
      <td class="r" style="font-weight:600">${fmtBrl(t.amount_net)}</td>
      <td class="c">
        <span><span class="status-dot" style="background:${st.color}"></span>${esc(st.text)}</span>
      </td>
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
    <div class="sec-num">04</div>
    <div class="sec-title">Detalhe de Vendas</div>
    <div class="sec-sub">
      ${txs.length} transações exibidas
      ${data.transactions_detail.length > 40 ? ` (de ${data.transactions_detail.length} totais no período)` : ''}
    </div>

    ${rows ? `<table class="tbl">
      <thead><tr>
        <th>#</th><th>Data</th><th>Plataforma</th><th>Cliente</th>
        <th class="r">Valor Líq.</th><th class="c">Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>` : '<div class="empty">Nenhuma transação registrada no período</div>'}

    ${prodRows ? `<div class="divider"></div>
    <div style="font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:8px;color:#374151">TOP PRODUTOS</div>
    <table class="tbl">
      <thead><tr>
        <th>Produto</th><th class="r">Receita</th><th class="r">Transações</th><th class="r">% Total</th>
      </tr></thead>
      <tbody>${prodRows}</tbody>
    </table>` : ''}
  </div>
  ${pageFooter(5, genDate)}
</div>`;
}
/** Pág 6 — Diagnósticos Completos */
function buildDiagnosticos(ai, profile, period, genDate) {
    const diagCards = (ai.diagnosticos ?? []).map(d => {
        const clr = SEV_COLOR[d.severidade];
        return `<div class="diag-card" style="background:${SEV_BG[d.severidade]};border:1.5px solid ${clr}33">
      <div class="diag-head">
        <div class="diag-canal" style="color:${clr}">${esc(plat(d.canal))}</div>
        <div class="diag-tags">
          <span class="badge" style="background:${clr}22;color:${clr}">${SEV_LABEL[d.severidade]}</span>
          <span class="badge" style="background:#1E1E1E18;color:#374151">${PRAZO_LABEL[d.prazo]}</span>
        </div>
      </div>
      <div class="diag-body">
        <div class="diag-field"><label>Sintoma</label><p>${esc(d.sintoma)}</p></div>
        <div class="diag-field"><label>Causa Raiz</label><p>${esc(d.causa_raiz)}</p></div>
      </div>
      <div class="diag-footer">
        <div class="diag-acao">
          <label>Ação Recomendada</label>
          <p>${esc(d.acao_recomendada)}</p>
        </div>
        ${d.consequencia_financeira_brl > 0 ? `
        <div class="diag-impact">
          <label>Impacto Financeiro</label>
          <div class="diag-impact-val" style="color:${clr}">${fmtBrl(d.consequencia_financeira_brl)}</div>
        </div>` : ''}
      </div>
    </div>`;
    }).join('');
    return `<div class="page">
  ${pageHeader('Diagnósticos', profile, period)}
  <div class="page-body">
    <div class="sec-num">05</div>
    <div class="sec-title">Diagnósticos por Canal</div>
    <div class="sec-sub">Anomalias e oportunidades identificadas pela IA</div>

    ${diagCards || '<div class="empty">Nenhum diagnóstico gerado — todos os canais estão saudáveis ou sem dados suficientes</div>'}
  </div>
  ${pageFooter(6, genDate)}
</div>`;
}
/** Pág 7 — Base de Clientes & RFM */
function buildClientes(data, profile, period, genDate) {
    const rfmCards = data.rfm_distribution.map(seg => {
        const m = RFM_META[seg.segment] ?? { label: seg.segment, color: '#6B7280', bg: '#F9FAFB' };
        return `<div class="rfm-card" style="background:${m.bg};border:1px solid ${m.color}33">
      <div class="rfm-card-label" style="color:${m.color}">${esc(m.label)}</div>
      <div class="rfm-card-count" style="color:${m.color}">${seg.count}</div>
      <div class="rfm-card-ltv" style="color:${m.color}">${fmtBrl(seg.ltv)}</div>
    </div>`;
    }).join('');
    const atRiskRows = data.at_risk_customers.slice(0, 15).map((c, i) => `<tr>
      <td>${String(i + 1).padStart(2, '0')}</td>
      <td class="r">${fmtBrl(c.ltv ?? 0)}</td>
      <td class="r" style="color:${(c.churn_probability ?? 0) > 80 ? '#EF4444' : '#F59E0B'};font-weight:600">
        ${c.churn_probability !== null ? fmtPct(c.churn_probability) : '—'}
      </td>
      <td class="r">${c.days_since_purchase !== null ? `${c.days_since_purchase}d` : '—'}</td>
      <td>${esc(plat(c.channel ?? 'desconhecido'))}</td>
    </tr>`).join('');
    return `<div class="page">
  ${pageHeader('Clientes & RFM', profile, period)}
  <div class="page-body">
    <div class="sec-num">06</div>
    <div class="sec-title">Base de Clientes & Segmentação RFM</div>
    <div class="sec-sub">Distribuição por segmento e clientes em risco de churn${data.rfm_source === 'estimated' ? ' · Estimado (job RFM pendente)' : ''}</div>

    <div class="rfm-grid">
      ${rfmCards || '<div class="empty">Segmentação RFM não calculada</div>'}
    </div>

    ${atRiskRows ? `
    <div class="divider"></div>
    <div style="font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:8px;color:#374151">
      CLIENTES EM RISCO DE CHURN <span style="color:#EF4444">&gt; 60%</span>
    </div>
    <table class="tbl">
      <thead><tr>
        <th>#</th><th class="r">LTV</th><th class="r">Churn</th><th class="r">Última Compra</th><th>Canal</th>
      </tr></thead>
      <tbody>${atRiskRows}</tbody>
    </table>` : '<div class="empty mt16">Nenhum cliente com probabilidade de churn acima de 60%</div>'}
  </div>
  ${pageFooter(7, genDate)}
</div>`;
}
/** Pág 8 — Projeções */
function buildProjecoes(data, profile, period, genDate) {
    const { conservative: cons, moderate: mod, optimistic: opt } = data.projections;
    function projCard(cls, lbl, p) {
        return `<div class="proj-card ${cls}">
      <div class="proj-label">${lbl}</div>
      <div class="proj-main">${fmtBrl(p.month1)}</div>
      <div class="proj-line"><span class="proj-line-k">Mês 2</span><span class="proj-line-v">${fmtBrl(p.month2)}</span></div>
      <div class="proj-line"><span class="proj-line-k">Mês 3</span><span class="proj-line-v">${fmtBrl(p.month3)}</span></div>
      <div class="proj-line"><span class="proj-line-k">Crescimento/mês</span><span class="proj-line-v">${fmtPct(p.rate_pct)}</span></div>
    </div>`;
    }
    return `<div class="page">
  ${pageHeader('Projeções', profile, period)}
  <div class="page-body">
    <div class="sec-num">07</div>
    <div class="sec-title">Projeções & Valuation</div>
    <div class="sec-sub">Cenários baseados no histórico dos últimos 6 meses</div>

    <div class="proj-grid">
      ${projCard('cons', 'CONSERVADOR', cons)}
      ${projCard('mod', 'MODERADO', mod)}
      ${projCard('opt', 'OTIMISTA', opt)}
    </div>

    <div class="divider"></div>

    <div class="kpi-grid kpi-grid-4">
      <div class="kpi-card">
        <div class="kpi-label">MRR Projetado</div>
        <div class="kpi-value">${fmtBrl(data.mrr_projected)}</div>
        <div class="kpi-ctx">Baseado no período</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">ARR Projetado</div>
        <div class="kpi-value">${fmtBrl(data.arr_projected)}</div>
        <div class="kpi-ctx">MRR × 12</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Payback Period</div>
        <div class="kpi-value">${data.payback_months !== null ? `${fmtNum(data.payback_months, 1)}m` : '—'}</div>
        <div class="kpi-ctx">CAC / receita mensal por cliente</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">LTV / CAC Geral</div>
        <div class="kpi-value" style="color:${data.ltv_cac_overall !== null && data.ltv_cac_overall >= 3 ? '#10B981' : '#EF4444'}">
          ${data.ltv_cac_overall !== null ? fmtNum(data.ltv_cac_overall, 2) + 'x' : '—'}
        </div>
        <div class="kpi-ctx">Benchmark: 3x</div>
      </div>
    </div>

    <div class="divider"></div>
    <div style="background:#F9FAFB;border-radius:8px;padding:12px 14px;font-size:10.5px;color:#6B7280;line-height:1.65">
      <strong style="color:#374151">Metodologia:</strong> Projeções calculadas com base na taxa de crescimento observada nos últimos 6 meses.
      Conservador aplica 70% da taxa atual; moderado usa a taxa real; otimista projeta 130%.
      Modelo de negócio identificado: <strong>${esc(data.business_type ?? 'geral')}</strong>.
    </div>
  </div>
  ${pageFooter(8, genDate)}
</div>`;
}
/** Pág 9 — Plano de Ação */
function buildPlanoAcao(ai, data, profile, period, genDate) {
    // Consolida: próximos passos + ações dos diagnósticos (sem duplicatas)
    const steps = [
        ...(ai.proximos_passos ?? []),
        ...(ai.diagnosticos ?? []).map(d => d.acao_recomendada),
    ].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 12);
    const stepItems = steps.map((s, i) => `<li class="step-item">
      <div class="step-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="step-text">${esc(s)}</div>
    </li>`).join('');
    const integrations = data.integrations_active;
    return `<div class="page">
  ${pageHeader('Plano de Ação', profile, period)}
  <div class="page-body">
    <div class="sec-num">08</div>
    <div class="sec-title">Plano de Ação</div>
    <div class="sec-sub">Próximas etapas recomendadas para o período seguinte</div>

    ${stepItems
        ? `<ul class="step-list">${stepItems}</ul>`
        : '<div class="empty">Nenhuma ação recomendada gerada para este período</div>'}

    <div class="divider"></div>

    <div style="display:flex;gap:14px">
      <div style="flex:1;background:#F9FAFB;border-radius:8px;padding:14px">
        <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:#6B7280;margin-bottom:8px">INTEGRAÇÕES ATIVAS</div>
        ${integrations.length > 0
        ? integrations.map(i => `<span class="badge" style="background:#10B98122;color:#10B981;margin:2px">${esc(plat(i))}</span>`).join(' ')
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
// ── HTML assembler ────────────────────────────────────────────────────────────
function buildHTML(data, ai) {
    const genDate = new Date().toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
    const profile = data.profile_name ?? 'Northie Report';
    const period = `${fmtDateShort(data.period.start)} — ${fmtDateShort(data.period.end)}`;
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
const FALLBACK_AI = {
    situacao_geral: 'atencao',
    resumo_executivo: 'Análise de IA não disponível para este relatório.',
    diagnosticos: [],
    proximos_passos: [],
    generated_at: new Date().toISOString(),
    model: 'n/a',
    is_ai_fallback: true,
};
// ── Main export ───────────────────────────────────────────────────────────────
export async function generatePdf(data, ai) {
    const analysis = ai ?? FALLBACK_AI;
    const html = buildHTML(data, analysis);
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
            format: 'A4',
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
        });
        return Buffer.from(pdf);
    }
    finally {
        await browser.close();
    }
}
//# sourceMappingURL=report-pdf.js.map