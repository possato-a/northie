import type { Request, Response } from 'express';
import {
    calcularPL,
    obterExtrato,
    gerarCSV,
    calcularPosicaoCaixa,
    calcularForecast,
    obterEntradasSaidas,
    listarFornecedores,
    detalheFornecedor,
    calcularROIFornecedor,
} from '../services/financeiro.service.js';
import { supabase } from '../lib/supabase.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getProfileId(req: Request): string | null {
    return (req.headers['x-profile-id'] as string) ?? null;
}

function getPeriodo(req: Request) {
    const now = new Date();
    const inicio = (req.query.inicio as string) ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const fim = (req.query.fim as string) ?? now.toISOString();
    return { inicio, fim };
}

// ── P&L ─────────────────────────────────────────────────────────────────────

export async function getPL(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const { inicio, fim } = getPeriodo(req);
    const pl = await calcularPL(profileId, inicio, fim);
    res.json(pl);
}

// ── Extrato ─────────────────────────────────────────────────────────────────

export async function getExtrato(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const { inicio, fim } = getPeriodo(req);
    const extrato = await obterExtrato(profileId, inicio, fim);
    res.json(extrato);
}

// ── Export CSV ──────────────────────────────────────────────────────────────

export async function exportCSV(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const { inicio, fim } = getPeriodo(req);
    const csv = await gerarCSV(profileId, inicio, fim);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=northie-pl-${inicio.slice(0, 10)}-${fim.slice(0, 10)}.csv`);
    res.send(csv);
}

// ── Gastos Fixos CRUD ───────────────────────────────────────────────────────

export async function listGastosFixos(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const { data, error } = await supabase
        .from('fixed_costs')
        .select('*')
        .eq('profile_id', profileId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
}

export async function createGastoFixo(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const { name, supplier_name, category, monthly_cost_brl, notes } = req.body;
    if (!name || !monthly_cost_brl) return res.status(400).json({ error: 'name e monthly_cost_brl obrigatórios' });

    const { data, error } = await supabase
        .from('fixed_costs')
        .insert({ profile_id: profileId, name, supplier_name, category, monthly_cost_brl, notes })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
}

export async function updateGastoFixo(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const { id } = req.params;
    const { name, supplier_name, category, monthly_cost_brl, notes } = req.body;

    const { data, error } = await supabase
        .from('fixed_costs')
        .update({ name, supplier_name, category, monthly_cost_brl, notes, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('profile_id', profileId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Gasto fixo não encontrado' });
    res.json(data);
}

export async function deleteGastoFixo(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const { id } = req.params;

    // Soft delete
    const { error } = await supabase
        .from('fixed_costs')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('profile_id', profileId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
}

// ── Caixa ───────────────────────────────────────────────────────────────────

export async function getCaixaPosicao(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const posicao = await calcularPosicaoCaixa(profileId);
    res.json(posicao);
}

export async function getCaixaForecast(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const forecast = await calcularForecast(profileId);
    res.json(forecast);
}

export async function getCaixaEntradasSaidas(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const data = await obterEntradasSaidas(profileId);
    res.json(data);
}

export async function getCaixaRunway(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const posicao = await calcularPosicaoCaixa(profileId);
    res.json({
        runway_meses: posicao.runway_meses,
        custos_fixos_mensais: posicao.custos_fixos_mensais,
        media_ads_spend: posicao.media_ads_spend,
    });
}

// ── Fornecedores ────────────────────────────────────────────────────────────

export async function getFornecedores(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const fornecedores = await listarFornecedores(profileId);
    res.json(fornecedores);
}

export async function getFornecedorDetalhe(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const data = await detalheFornecedor(profileId, req.params.id as string);
    if (!data) return res.status(404).json({ error: 'Fornecedor não encontrado' });
    res.json(data);
}

export async function getFornecedorROI(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const roi = await calcularROIFornecedor(profileId, req.params.id as string);
    res.json(roi);
}

export async function createFornecedor(req: Request, res: Response) {
    return createGastoFixo(req, res);
}

export async function updateFornecedor(req: Request, res: Response) {
    return updateGastoFixo(req, res);
}

export async function deleteFornecedor(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const id = req.params.id as string;
    if (id.startsWith('auto-')) return res.status(400).json({ error: 'Não é possível remover fornecedores detectados automaticamente' });
    return deleteGastoFixo(req, res);
}
