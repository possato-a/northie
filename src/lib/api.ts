import axios from 'axios';
import { supabase } from './supabase';
import { matchMockRoute } from './mock-data';

// ── DEMO MODE — set to true for screenshots, false for real data ──
const DEMO_MODE = true;

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
});

// ── Request cache — deduplicates identical GET requests within TTL ──────────
const cache = new Map<string, { data: unknown; ts: number; promise?: Promise<unknown> }>();
const CACHE_TTL = 30_000; // 30s

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cachedGet(url: string, config?: Parameters<typeof api.get>[1], ttl = CACHE_TTL): Promise<any> {
    if (DEMO_MODE) {
        const mock = matchMockRoute(url, config?.params);
        if (mock !== null) return Promise.resolve({ data: mock });
    }
    const key = url + (config?.params ? '?' + new URLSearchParams(config.params).toString() : '');
    const now = Date.now();
    const entry = cache.get(key);

    // Return cached data if fresh
    if (entry?.data && now - entry.ts < ttl) {
        return Promise.resolve({ data: entry.data });
    }

    // Deduplicate in-flight requests
    if (entry?.promise) {
        return entry.promise as Promise<any>;
    }

    const promise = api.get(url, config).then(res => {
        cache.set(key, { data: res.data, ts: Date.now() });
        return res;
    }).finally(() => {
        const e = cache.get(key);
        if (e) delete e.promise;
    });

    cache.set(key, { data: entry?.data, ts: entry?.ts ?? 0, promise });
    return promise;
}

export function invalidateCache(prefix?: string) {
    if (!prefix) { cache.clear(); return; }
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) cache.delete(key);
    }
}

// Injeta o JWT do Supabase em toda requisição autenticada.
// O backend verifica o token e extrai o userId de lá — x-profile-id do cliente é ignorado.
api.interceptors.request.use(async (config) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            config.headers['Authorization'] = `Bearer ${session.access_token}`;
        }
    } catch {
        // Falha silenciosa — o backend retornará 401 se o token estiver ausente
    }
    return config;
});

// Mantido por compatibilidade — o backend ignora este header após validar o JWT
export const setProfileId = (profileId: string) => {
    api.defaults.headers.common['x-profile-id'] = profileId;
};

export const dashboardApi = {
    getStats: (days = 30) => cachedGet('/dashboard/stats', { params: { days } }),
    getAttribution: () => cachedGet('/dashboard/attribution'),
    getGrowth: () => cachedGet('/dashboard/growth'),
    getChart: () => cachedGet('/dashboard/chart'),
    getHeatmap: () => cachedGet('/dashboard/heatmap'),
    getRetention: () => cachedGet('/dashboard/retention'),
    getTopCustomers: () => cachedGet('/dashboard/top-customers'),
    getChannelTrends: () => cachedGet('/dashboard/channel-trends'),
    getAdCampaigns: (days = 365) => cachedGet('/dashboard/ad-campaigns', { params: { days } }),
    getAdCampaignDetail: (campaignId: string, days = 365) => cachedGet(`/dashboard/ad-campaigns/${campaignId}`, { params: { days } }),
    getFull: (days = 30) => cachedGet('/dashboard/full', { params: { days } }),
};

// Wrap api.get for demo mode
function demoGet(url: string, config?: Parameters<typeof api.get>[1]): Promise<any> {
    if (DEMO_MODE) {
        const mock = matchMockRoute(url);
        if (mock !== null) return Promise.resolve({ data: mock });
    }
    return api.get(url, config);
}


export const integrationApi = {
    getStatus: () => demoGet('/integrations/status'),
    connect: (platform: string, shop?: string) => api.get(`/integrations/connect/${platform}`, { params: shop ? { shop } : {} }),
    disconnect: (platform: string) => api.post(`/integrations/disconnect/${platform}`),
    sync: (platform: string, days = 2) => api.post(`/integrations/sync/${platform}`, { days }),
};

export const campaignApi = {
    list: () => api.get('/campaigns'),
    create: (data: any) => api.post('/campaigns', data),
    listCreators: (id: string) => api.get(`/campaigns/${id}/creators`),
    addCreator: (data: any) => api.post('/campaigns/add-creator', data),
    confirmPayout: (data: any) => api.post('/campaigns/confirm-payout', data),
};

export const dataApi = {
    getTransactions: (days = 30) => cachedGet('/data/transactions', { params: { days } }),
    getCustomers: () => cachedGet('/data/customers'),
};

export const aiApi = {
    chat: (message: string, pageContext?: string, mode: 'general' | 'growth' = 'general', model?: string, skillId?: string) =>
        api.post('/ai/chat', { message, page_context: pageContext, mode, model, skill_id: skillId }, { timeout: 90000 }),
    growthChat: (message: string) =>
        api.post('/ai/chat', { message, page_context: 'Growth', mode: 'growth' }, { timeout: 90000 }),
    clearHistory: (mode?: 'general' | 'growth') =>
        api.delete('/ai/history', { params: mode ? { mode } : undefined }),
};

export const skillsApi = {
    list: () => demoGet('/skills'),
    create: (data: { name: string; description?: string; content: string }) => api.post('/skills', data),
    update: (id: string, data: { name?: string; description?: string; content?: string }) => api.patch(`/skills/${id}`, data),
    toggle: (id: string) => api.patch(`/skills/${id}/toggle`),
    remove: (id: string) => api.delete(`/skills/${id}`),
};

export const growthApi = {
    listRecommendations: () => cachedGet('/growth/recommendations'),
    approve: (id: string) => api.post(`/growth/recommendations/${id}/approve`),
    dismiss: (id: string) => api.post(`/growth/recommendations/${id}/dismiss`),
    reject: (id: string) => api.post(`/growth/recommendations/${id}/reject`),
    cancel: (id: string) => api.post(`/growth/recommendations/${id}/cancel`),
    getStatus: (id: string) => cachedGet(`/growth/recommendations/${id}/status`, undefined, 5000),
    getMetrics: () => cachedGet('/growth/metrics'),
    runDiagnostic: (days = 30) => api.post('/growth/diagnostic', { days }, { timeout: 180000 }),
    getLatestDiagnostic: () => cachedGet('/growth/diagnostic/latest', { timeout: 10000 }),
    getExecutionHistory: () => cachedGet('/growth/execution-history'),
    collaborate: (id: string) => api.post(`/growth/recommendations/${id}/collaborate`),
    sendCollabMessage: (sessionId: string, message: string) =>
        api.post(`/growth/collaboration/${sessionId}/message`, { message }),
    getCollabSession: (sessionId: string) => cachedGet(`/growth/collaboration/${sessionId}`, undefined, 5000),
    confirmExecution: (sessionId: string, approvedMessage: string) =>
        api.post(`/growth/collaboration/${sessionId}/confirm`, { approved_message: approvedMessage }),
    abandonSession: (sessionId: string) => api.post(`/growth/collaboration/${sessionId}/abandon`),
};

export const pixelApi = {
    getSnippet: () => cachedGet('/pixel/snippet'),
    getStats: () => cachedGet('/pixel/stats'),
};

export const reportsApi = {
    getConfig: () => cachedGet('/reports/config'),
    saveConfig: (data: any) => api.post('/reports/config', data),
    generate: (frequency: string, format: string, extra?: Record<string, unknown>) =>
        api.post('/reports/generate', { frequency, format, ...extra }, {
            responseType: 'blob',
            timeout: format === 'pdf' ? 90000 : 20000,
        }),
    getLogs: (page = 0) => cachedGet('/reports/logs', { params: { page } }),
    getPreview: (frequency: string, extra?: Record<string, unknown>) =>
        cachedGet('/reports/preview', { params: { frequency, ...extra }, timeout: 15000 }),
    getAIAnalysis: (frequency: string, extra?: Record<string, unknown>) =>
        cachedGet('/reports/ai-analysis', { params: { frequency, ...extra }, timeout: 90000 }),
    sendEmail: (frequency: string, format: string, email?: string) =>
        api.post('/reports/send-email', { frequency, format, ...(email ? { email } : {}) }, { timeout: 90000 }),
    exportQuick: (format: 'pdf' | 'xlsx', period: string) =>
        api.get('/reports/export', { params: { format, period }, responseType: 'blob', timeout: 60000 }),
    redownload: (logId: string, format: 'pdf' | 'xlsx' | 'json') =>
        api.get(`/reports/logs/${logId}/download`, { params: { format }, responseType: 'blob', timeout: 60000 }),
};

export const cardApi = {
    getScore: () => cachedGet('/card/score'),
    getHistory: () => cachedGet('/card/history'),
    getApplication: () => cachedGet('/card/application'),
    request: (data: { requested_limit_brl: number; purposes?: string[]; term_months: number }) =>
        api.post('/card/request', data),
};

export const contextApi = {
    get: () => cachedGet('/context'),
    save: (data: Record<string, unknown>) => api.post('/context', data),
};

export const pipelineApi = {
    listLeads: () => cachedGet('/pipeline/leads'),
    createLead: (data: Record<string, unknown>) => api.post('/pipeline/leads', data),
    updateLead: (id: string, data: Record<string, unknown>) => api.patch(`/pipeline/leads/${id}`, data),
    deleteLead: (id: string) => api.delete(`/pipeline/leads/${id}`),
    listMeetings: () => cachedGet('/pipeline/meetings'),
    createMeeting: (data: Record<string, unknown>) => api.post('/pipeline/meetings', data),
    updateMeeting: (id: string, data: Record<string, unknown>) => api.patch(`/pipeline/meetings/${id}`, data),
};

export const alertsApi = {
    list: () => cachedGet('/alerts', undefined, 10000),
    markRead: (id: string) => api.patch(`/alerts/${id}/read`),
    markAllRead: () => api.patch('/alerts/read-all'),
};

export const agentsApi = {
    chat: (agentId: string, message: string, conversationHistory: Array<{role: string, content: string}>) =>
        api.post('/agents/chat', { agentId, message, conversationHistory }, { timeout: 60000 }),
};

export const whatsappApi = {
    getStatus: () => api.get('/whatsapp/status'),
    test: () => api.post('/whatsapp/test'),
    send: (data: { to: string; type: string; text?: string; params?: Record<string, string>; growthActionId?: string }) =>
        api.post('/whatsapp/send', data),
};

export const calendarApi = {
    getStatus: () => api.get('/calendar/status'),
    getEvents: (limit = 20, offset = 0) => api.get('/calendar/events', { params: { limit, offset } }),
    getInsights: () => api.get('/calendar/insights'),
    sync: () => api.post('/calendar/sync'),
    linkToCustomer: (meetingId: string, customerId: string) =>
        api.post(`/calendar/link/${meetingId}/${customerId}`),
};

export const profileApi = {
    deleteAccount: () => api.delete('/profile'),
};

export default api;
