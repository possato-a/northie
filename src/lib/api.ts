import axios from 'axios';

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000, // 15s — sync now returns 202 immediately, so this is enough
});

// Helper to set profile ID in headers for all requests
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
    chat: (message: string, pageContext?: string, model?: string) => api.post('/ai/chat', { message, page_context: pageContext, model }),
    growthChat: (message: string, model?: string) => api.post('/ai/growth-chat', { message, model }),
};

export const growthApi = {
    listRecommendations: () => api.get('/growth/recommendations'),
    approve: (id: string) => api.post(`/growth/recommendations/${id}/approve`),
    dismiss: (id: string) => api.post(`/growth/recommendations/${id}/dismiss`),
    getStatus: (id: string) => api.get(`/growth/recommendations/${id}/status`),
    getMetrics: () => api.get('/growth/metrics'),
};

export const pixelApi = {
    getSnippet: () => api.get('/pixel/snippet'),
};

export const reportsApi = {
    getConfig: () => api.get('/reports/config'),
    saveConfig: (data: any) => api.post('/reports/config', data),
    generate: (frequency: string, format: string) =>
        api.post('/reports/generate', { frequency, format }, {
            responseType: 'blob',
            timeout: format === 'pdf' ? 90000 : 15000,
        }),
    getLogs: () => api.get('/reports/logs'),
    getPreview: (frequency: string) => api.get('/reports/preview', { params: { frequency }, timeout: 15000 }),
    getAIAnalysis: (frequency: string) => api.get('/reports/ai-analysis', { params: { frequency }, timeout: 90000 }),
    sendEmail: (frequency: string, format: string, email?: string) =>
        api.post('/reports/send-email', { frequency, format, ...(email ? { email } : {}) }, { timeout: 90000 }),
};

export default api;
