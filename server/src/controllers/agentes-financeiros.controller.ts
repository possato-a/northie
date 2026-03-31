import type { Request, Response } from 'express';
import {
    obterConfigs,
    listarAlertas,
    logPorAgente,
    resolverAlerta,
    ignorarAlerta,
    configurarAgente,
    executarAgente,
} from '../services/agentes.service.js';
import type { FinancialAgentType } from '../types/index.js';

function getProfileId(req: Request): string | null {
    return (req.headers['x-profile-id'] as string) ?? null;
}

const VALID_TYPES: FinancialAgentType[] = ['receita', 'caixa', 'gastos', 'oportunidade'];

export async function getAgentes(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const [configs, alertas] = await Promise.all([
        obterConfigs(profileId),
        listarAlertas(profileId, 'aberto'),
    ]);

    // Contagem de alertas por agente
    const alertCounts: Record<string, number> = {};
    for (const a of alertas) {
        alertCounts[a.agent_type] = (alertCounts[a.agent_type] ?? 0) + 1;
    }

    const agentes = configs.map(c => ({
        ...c,
        alertas_abertos: alertCounts[c.agent_type] ?? 0,
    }));

    res.json(agentes);
}

export async function getAgenteLog(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const type = req.params.type as FinancialAgentType;
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Tipo de agente inválido' });

    const logs = await logPorAgente(profileId, type);
    res.json(logs);
}

export async function getAlertas(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const status = req.query.status as string | undefined;
    const alertas = await listarAlertas(profileId, status);
    res.json(alertas);
}

export async function postConfigurar(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const type = req.params.type as FinancialAgentType;
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Tipo de agente inválido' });

    const { thresholds, is_active } = req.body;
    const config = await configurarAgente(profileId, type, thresholds ?? {}, is_active);
    res.json(config);
}

export async function postResolver(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    try {
        const data = await resolverAlerta(profileId, req.params.id as string);
        res.json(data);
    } catch (err: unknown) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao resolver' });
    }
}

export async function postIgnorar(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    try {
        const data = await ignorarAlerta(profileId, req.params.id as string);
        res.json(data);
    } catch (err: unknown) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao ignorar' });
    }
}

export async function postExecutar(req: Request, res: Response) {
    const profileId = getProfileId(req);
    if (!profileId) return res.status(400).json({ error: 'Missing profile' });

    const type = req.params.type as FinancialAgentType;
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Tipo de agente inválido' });

    // Fire and forget
    executarAgente(profileId, type).catch(err => {
        console.error(`[agente-${type}] Erro na execução manual:`, err);
    });

    res.status(202).json({ message: `Agente ${type} executando...` });
}
