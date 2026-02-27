import axios from 'axios';

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
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
    getTransactions: () => api.get('/data/transactions'),
    getCustomers: () => api.get('/data/customers'),
};

export const aiApi = {
    chat: (message: string) => api.post('/ai/chat', { message }),
};

export default api;
