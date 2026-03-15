/**
 * @file calendar.service.js
 * Integração com Google Calendar API.
 * Busca eventos, detecta reuniões com Google Meet e analisa com IA.
 */

import { supabase } from '../lib/supabase.js';
import Anthropic from '@anthropic-ai/sdk';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Busca eventos do Google Calendar no período especificado
 */
export async function getCalendarEvents(accessToken, calendarId = 'primary', timeMin, timeMax) {
    const params = new URLSearchParams({
        calendarId,
        timeMin: timeMin || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        timeMax: timeMax || new Date().toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
    });

    const response = await fetch(`${CALENDAR_API_BASE}/calendars/${calendarId}/events?${params}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.error?.message || 'Falha ao buscar eventos do Google Calendar');
    }

    const data = await response.json();
    return data.items || [];
}

/**
 * Analisa reunião com Claude AI para extrair objeções, resultado e ciclo
 */
export async function analyzeMeetingWithAI(title, attendees, duration, meetLink) {
    // Sem transcrição real, fazemos análise baseada nos metadados
    const attendeeList = attendees.map(a => a.email || a.name).join(', ');

    const prompt = `Você é um especialista em análise de reuniões de vendas B2B.

Analise esta reunião e forneça insights estruturados em JSON:

Título: ${title || 'Reunião sem título'}
Participantes: ${attendeeList || 'Não informado'}
Duração: ${duration || '?'} minutos
Link Google Meet: ${meetLink ? 'Sim' : 'Não'}

Retorne APENAS JSON válido, sem markdown, no formato:
{
  "summary": "Resumo conciso do que provavelmente foi discutido",
  "objections": ["possível objeção 1", "possível objeção 2"],
  "result": "positive|neutral|negative",
  "cycle_signal": "Análise do estágio no ciclo de vendas",
  "tags": ["tag1", "tag2"]
}

Baseie-se no título e contexto disponível. Seja conservador e realista.`;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 500,
            messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content[0]?.text || '{}';
        return JSON.parse(text);
    } catch (err) {
        console.error('[Calendar] Falha na análise IA:', err.message);
        return {
            summary: title || 'Reunião registrada',
            objections: [],
            result: 'neutral',
            cycle_signal: 'Dados insuficientes para análise',
            tags: [],
        };
    }
}

/**
 * Normaliza um evento do Google Calendar para o formato interno
 */
function normalizeEvent(event) {
    const start = event.start?.dateTime || event.start?.date;
    const end = event.end?.dateTime || event.end?.date;
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;
    const durationMin = startDate && endDate
        ? Math.round((endDate - startDate) / 60000)
        : null;

    const meetLink = event.hangoutLink
        || event.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri
        || null;

    const attendees = (event.attendees || []).map(a => ({
        email: a.email,
        name: a.displayName,
        organizer: a.organizer || false,
        responseStatus: a.responseStatus,
    }));

    return {
        google_event_id: event.id,
        title: event.summary || 'Reunião sem título',
        attendees,
        started_at: startDate?.toISOString(),
        ended_at: endDate?.toISOString(),
        duration_minutes: durationMin,
        meet_link: meetLink,
    };
}

/**
 * Sincroniza eventos do Google Calendar para o banco de dados
 */
export async function syncCalendarEvents(profileId, accessToken) {
    console.log(`[Calendar] Sincronizando para profile ${profileId}`);

    const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date().toISOString();

    let events;
    try {
        events = await getCalendarEvents(accessToken, 'primary', timeMin, timeMax);
    } catch (err) {
        console.error(`[Calendar] Erro ao buscar eventos:`, err.message);
        return { synced: 0, errors: 1 };
    }

    // Filtrar apenas eventos com participantes externos (reuniões de verdade)
    const meetings = events.filter(e =>
        e.attendees && e.attendees.length >= 2 && e.status !== 'cancelled'
    );

    let synced = 0;
    let errors = 0;

    for (const event of meetings) {
        try {
            const normalized = normalizeEvent(event);

            // Verificar se já existe
            const { data: existing } = await supabase
                .from('meetings')
                .select('id, ai_summary')
                .eq('profile_id', profileId)
                .eq('google_event_id', normalized.google_event_id)
                .single();

            if (existing && existing.ai_summary) {
                // Já analisado, skip
                continue;
            }

            // Analisar com IA
            const aiAnalysis = await analyzeMeetingWithAI(
                normalized.title,
                normalized.attendees,
                normalized.duration_minutes,
                normalized.meet_link,
            );

            const record = {
                profile_id: profileId,
                ...normalized,
                ai_summary: aiAnalysis.summary,
                ai_objections: aiAnalysis.objections,
                ai_result: aiAnalysis.result,
                ai_cycle_signal: aiAnalysis.cycle_signal,
                ai_tags: aiAnalysis.tags,
            };

            await supabase.from('meetings').upsert(record, {
                onConflict: 'profile_id,google_event_id',
            });

            // Tentar correlacionar com cliente pelo email dos participantes
            await correlateWithCustomer(profileId, record, normalized.attendees);

            synced++;
        } catch (err) {
            console.error(`[Calendar] Erro ao processar evento ${event.id}:`, err.message);
            errors++;
        }
    }

    console.log(`[Calendar] Sync concluído: ${synced} reuniões, ${errors} erros`);
    return { synced, errors };
}

/**
 * Tenta correlacionar reunião com um customer pelo email dos participantes
 */
async function correlateWithCustomer(profileId, meeting, attendees) {
    for (const attendee of attendees) {
        if (!attendee.email || attendee.organizer) continue;

        const { data: customer } = await supabase
            .from('customers')
            .select('id')
            .eq('profile_id', profileId)
            .ilike('email', attendee.email)
            .single();

        if (customer) {
            await supabase
                .from('meetings')
                .update({ linked_customer_id: customer.id })
                .eq('profile_id', profileId)
                .eq('google_event_id', meeting.google_event_id);
            break;
        }
    }
}

/**
 * Retorna reuniões do banco com paginação
 */
export async function getMeetings(profileId, limit = 20, offset = 0) {
    const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('profile_id', profileId)
        .not('started_at', 'is', null)
        .order('started_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return data || [];
}

/**
 * Retorna insights agregados das reuniões
 */
export async function getMeetingInsights(profileId) {
    const { data: meetings, error } = await supabase
        .from('meetings')
        .select('ai_objections, ai_result, ai_tags, duration_minutes, started_at')
        .eq('profile_id', profileId)
        .not('ai_summary', 'is', null);

    if (error || !meetings?.length) return [];

    // Agregar objeções mais comuns
    const objectionCounts = {};
    meetings.forEach(m => {
        (m.ai_objections || []).forEach(obj => {
            objectionCounts[obj] = (objectionCounts[obj] || 0) + 1;
        });
    });

    // Calcular taxa de conversão por resultado
    const results = meetings.reduce((acc, m) => {
        acc[m.ai_result || 'neutral'] = (acc[m.ai_result || 'neutral'] || 0) + 1;
        return acc;
    }, {});

    // Duração média
    const durations = meetings.filter(m => m.duration_minutes).map(m => m.duration_minutes);
    const avgDuration = durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

    const insights = [];

    // Insight de objeções
    const topObjections = Object.entries(objectionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([obj]) => obj);

    if (topObjections.length > 0) {
        insights.push({
            type: 'objections',
            title: 'Principais Objeções',
            body: `As objeções mais frequentes nas suas reuniões foram: ${topObjections.join(', ')}.`,
            action: 'Prepare respostas prontas para essas objeções antes das próximas reuniões.',
        });
    }

    // Insight de resultado
    const totalMeetings = meetings.length;
    const positiveMeetings = results['positive'] || 0;
    if (totalMeetings > 0) {
        insights.push({
            type: 'conversion',
            title: 'Taxa de Reuniões Positivas',
            body: `${positiveMeetings} de ${totalMeetings} reuniões (${Math.round(positiveMeetings / totalMeetings * 100)}%) tiveram resultado positivo.`,
            action: positiveMeetings / totalMeetings < 0.5
                ? 'Considere qualificar melhor os leads antes de agendar reuniões.'
                : 'Boa taxa de conversão — mantenha o processo atual.',
        });
    }

    // Insight de duração
    if (avgDuration) {
        insights.push({
            type: 'duration',
            title: 'Duração Média das Reuniões',
            body: `Suas reuniões duram em média ${avgDuration} minutos.`,
            action: avgDuration > 60
                ? 'Reuniões longas podem indicar baixa qualificação do lead. Considere um processo de discovery antes.'
                : 'Reuniões objetivas — bom sinal de qualificação prévia.',
        });
    }

    return insights;
}
