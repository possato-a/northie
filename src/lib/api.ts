import axios from 'axios';
import { supabase } from './supabase';

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000, // 15s — sync now returns 202 immediately, so this is enough
});

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
    getStats: () => api.get('/dashboard/stats'),
    getAttribution: () => api.get('/dashboard/attribution'),
    getGrowth: () => api.get('/dashboard/growth'),
    getChart: () => api.get('/dashboard/chart'),
    getHeatmap: () => api.get('/dashboard/heatmap'),
    getRetention: () => api.get('/dashboard/retention'),
    getTopCustomers: () => api.get('/dashboard/top-customers'),
    getChannelTrends: () => api.get('/dashboard/channel-trends'),
    getAdCampaigns: (days = 365) => api.get('/dashboard/ad-campaigns', { params: { days } }),
    getAdCampaignDetail: (campaignId: string, days = 365) => api.get(`/dashboard/ad-campaigns/${campaignId}`, { params: { days } }),
    getFull: (days = 30) => api.get('/dashboard/full', { params: { days } }),
};

export const integrationApi = {
    getStatus: () => api.get('/integrations/status'),
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
    getTransactions: (days = 30) => api.get('/data/transactions', { params: { days } }),
    getCustomers: () => api.get('/data/customers'),
};

export const aiApi = {
    chat: (message: string, pageContext?: string, model?: string) => api.post('/ai/chat', { message, page_context: pageContext, model }, { timeout: 60000 }),
    growthChat: (message: string, model?: string) => api.post('/ai/growth-chat', { message, model }, { timeout: 60000 }),
    clearHistory: () => api.delete('/ai/history'),
};

export const growthApi = {
    listRecommendations: () => api.get('/growth/recommendations'),
    approve: (id: string) => api.post(`/growth/recommendations/${id}/approve`),
    dismiss: (id: string) => api.post(`/growth/recommendations/${id}/dismiss`),
    reject: (id: string) => api.post(`/growth/recommendations/${id}/reject`),
    cancel: (id: string) => api.post(`/growth/recommendations/${id}/cancel`),
    getStatus: (id: string) => api.get(`/growth/recommendations/${id}/status`),
    getMetrics: () => api.get('/growth/metrics'),
    runDiagnostic: (days = 30) => api.post('/growth/diagnostic', { days }, { timeout: 180000 }),
    getLatestDiagnostic: () => api.get('/growth/diagnostic/latest', { timeout: 10000 }),
    getExecutionHistory: () => api.get('/growth/execution-history'),
    collaborate: (id: string) => api.post(`/growth/recommendations/${id}/collaborate`),
    sendCollabMessage: (sessionId: string, message: string) =>
        api.post(`/growth/collaboration/${sessionId}/message`, { message }),
    getCollabSession: (sessionId: string) => api.get(`/growth/collaboration/${sessionId}`),
    confirmExecution: (sessionId: string, approvedMessage: string) =>
        api.post(`/growth/collaboration/${sessionId}/confirm`, { approved_message: approvedMessage }),
    abandonSession: (sessionId: string) => api.post(`/growth/collaboration/${sessionId}/abandon`),
};

export const pixelApi = {
    getSnippet: () => api.get('/pixel/snippet'),
    getStats: () => api.get('/pixel/stats'),
};

export const reportsApi = {
    getConfig: () => api.get('/reports/config'),
    saveConfig: (data: any) => api.post('/reports/config', data),
    generate: (frequency: string, format: string, extra?: Record<string, unknown>) =>
        api.post('/reports/generate', { frequency, format, ...extra }, {
            responseType: 'blob',
            timeout: format === 'pdf' ? 90000 : 20000,
        }),
    getLogs: (page = 0) => api.get('/reports/logs', { params: { page } }),
    getPreview: (frequency: string, extra?: Record<string, unknown>) =>
        api.get('/reports/preview', { params: { frequency, ...extra }, timeout: 15000 }),
    getAIAnalysis: (frequency: string, extra?: Record<string, unknown>) =>
        api.get('/reports/ai-analysis', { params: { frequency, ...extra }, timeout: 90000 }),
    sendEmail: (frequency: string, format: string, email?: string) =>
        api.post('/reports/send-email', { frequency, format, ...(email ? { email } : {}) }, { timeout: 90000 }),
    exportQuick: (format: 'pdf' | 'xlsx', period: string) =>
        api.get('/reports/export', { params: { format, period }, responseType: 'blob', timeout: 60000 }),
    redownload: (logId: string, format: 'pdf' | 'xlsx' | 'json') =>
        api.get(`/reports/logs/${logId}/download`, { params: { format }, responseType: 'blob', timeout: 60000 }),
};

export const cardApi = {
    getScore: () => api.get('/card/score'),
    getHistory: () => api.get('/card/history'),
    getApplication: () => api.get('/card/application'),
    request: (data: { requested_limit_brl: number; purposes?: string[]; term_months: number }) =>
        api.post('/card/request', data),
};

export const contextApi = {
    get: () => api.get('/context'),
    save: (data: Record<string, unknown>) => api.post('/context', data),
};

export const pipelineApi = {
    listLeads: () => api.get('/pipeline/leads'),
    createLead: (data: Record<string, unknown>) => api.post('/pipeline/leads', data),
    updateLead: (id: string, data: Record<string, unknown>) => api.patch(`/pipeline/leads/${id}`, data),
    deleteLead: (id: string) => api.delete(`/pipeline/leads/${id}`),
    listMeetings: () => api.get('/pipeline/meetings'),
    createMeeting: (data: Record<string, unknown>) => api.post('/pipeline/meetings', data),
    updateMeeting: (id: string, data: Record<string, unknown>) => api.patch(`/pipeline/meetings/${id}`, data),
};

export const alertsApi = {
    list: () => api.get('/alerts'),
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
