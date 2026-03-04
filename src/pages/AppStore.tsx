import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '../components/layout/TopBar'
import { integrationApi, setProfileId } from '../lib/api'
import {
    PageHeader, SectionLabel,
    Btn, Modal, EmptyState, FilterPills, Input
} from '../components/ui/shared'

// ── Types & Mock Data ────────────────────────────────────────────────────────

type Category = 'Todos' | 'Integrações' | 'Marketing' | 'Pagamentos' | 'Fiscal' | 'Em breve'

interface Plugin {
    id: string
    name: string
    category: Category
    description: string
    fullDescription: string
    installCount: string
    status: 'Instalar' | 'Em breve' | 'Conectado' | 'Expirado'
    iconColor: string
    developer: string
    reviews: string
    metricInstalls: string
    features: string[]
    logoUrl?: string
    connectedAccounts?: number
}

const PLUGINS: Plugin[] = [
    {
        id: 'meta-ads',
        name: 'Meta Ads',
        category: 'Integrações',
        description: 'Conecte sua conta e acompanhe gastos, ROAS e CAC em tempo real.',
        fullDescription: 'O Meta Ads é a integração oficial para rastreamento de conversões em campanhas do Facebook e Instagram Ads.',
        installCount: '5.410 instalaram nos últimos 7 dias',
        status: 'Instalar',
        iconColor: '#FFFFFF',
        logoUrl: '/logos/logo-meta.png',
        developer: '@northie',
        reviews: '5.0',
        metricInstalls: '12k+',
        features: [
            'Rastrear automaticamente todas as conversões de vendas',
            'Criar públicos personalizados baseados em compradores',
            'Otimizar suas campanhas para eventos de compra',
            'Acompanhar o ROAS em tempo real',
            'Configurar eventos personalizados para cada etapa do funil'
        ]
    },
    {
        id: 'google-ads',
        name: 'Google Ads',
        category: 'Integrações',
        description: 'Acompanhe performance e CAC das suas campanhas do Google.',
        fullDescription: 'Análise detalhada de Search, Display e YouTube Ads.',
        installCount: '2.800 instalaram nos últimos 7 dias',
        status: 'Instalar',
        iconColor: '#FFFFFF',
        logoUrl: '/logos/logo-googleads.png',
        developer: '@northie',
        reviews: '4.9',
        metricInstalls: '4k+',
        features: [
            'Sincronização de custos de campanhas',
            'Atribuição de conversões via GCLID',
            'Cálculo de ROAS por palavra-chave',
            'Monitoramento de CTR e CPC'
        ]
    },
    {
        id: 'hotmart',
        name: 'Hotmart',
        category: 'Integrações',
        description: 'Importe histórico de vendas e clientes automaticamente.',
        fullDescription: 'Sincronize sua conta Hotmart para ter uma visão consolidada de suas vendas de infoprodutos.',
        installCount: '3.200 instalaram nos últimos 7 dias',
        status: 'Instalar',
        iconColor: '#F04E23',
        logoUrl: '/logos/logo-hotmart.jpg',
        developer: '@northie',
        reviews: '4.9',
        metricInstalls: '8k+',
        features: [
            'Sincronização em tempo real de vendas e reembolsos',
            'Mapeamento automático de produtos para o dashboard',
            'Importação de histórico de clientes para CRM',
            'Notificações de vendas em tempo real'
        ]
    },
    {
        id: 'stripe',
        name: 'Stripe',
        category: 'Pagamentos',
        description: 'Sincronize transações e receita recorrente.',
        fullDescription: 'A integração mais robusta para pagamentos globais e MRR.',
        installCount: '1.850 instalaram nos últimos 7 dias',
        status: 'Instalar',
        iconColor: '#635BFF',
        logoUrl: '/logos/logo-stripe.png',
        developer: '@northie',
        reviews: '5.0',
        metricInstalls: '5k+',
        features: [
            'Cálculo automático de MRR e Churn',
            'Gestão de assinaturas e planos',
            'Conciliação bancária automática',
            'Suporte a múltiplas moedas'
        ]
    },
    {
        id: 'shopify',
        name: 'Shopify',
        category: 'Integrações',
        description: 'Sincronize produtos, pedidos e clientes do seu e-commerce.',
        fullDescription: 'A maior plataforma de e-commerce do mundo integrada à Northie.',
        installCount: '1.100 instalaram nos últimos 7 dias',
        status: 'Instalar',
        iconColor: '#FFFFFF',
        logoUrl: '/logos/logo-shopify.png',
        developer: '@northie',
        reviews: '4.8',
        metricInstalls: '2k+',
        features: [
            'Sincronização automática de pedidos',
            'Rastreamento de conversão por canal',
            'Gestão de estoque sincronizada',
            'Analytics de clientes recorrentes'
        ]
    }
]

// ── Components ───────────────────────────────────────────────────────────────

function PluginCard({ plugin, onClick }: { plugin: Plugin; onClick: () => void }) {
    const isAvailable = plugin.status !== 'Em breve'
    const isConnected = plugin.status === 'Conectado'
    const isExpired = plugin.status === 'Expirado'

    return (
        <motion.div
            whileHover={{ y: -2, borderColor: 'var(--color-border)' }}
            onClick={onClick}
            style={{
                padding: 20,
                borderRadius: 'var(--radius-lg)',
                border: `1px solid ${isExpired ? 'var(--status-critical)' : 'var(--color-border)'}`,
                background: 'var(--color-bg-primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                transition: 'all var(--transition-base)',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: 'var(--shadow-sm)',
            }}
        >
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{
                    width: 44, height: 44, borderRadius: 'var(--radius-md)', background: plugin.iconColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, fontWeight: 700, overflow: 'hidden',
                    border: '1px solid var(--color-border)',
                    flexShrink: 0,
                }}>
                    {plugin.logoUrl ? (
                        <img src={plugin.logoUrl} alt={plugin.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                    ) : (
                        <span style={{ color: 'var(--color-text-secondary)' }}>{plugin.name[0]}</span>
                    )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                            {plugin.name}
                        </span>
                        {plugin.developer === '@northie' && (
                            <span className="tag tag-complete" style={{ fontSize: 9 }}>Oficial</span>
                        )}
                    </div>
                    <p style={{
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
                        margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                        {plugin.description}
                    </p>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>
                    {plugin.installCount.split(' ')[0]} instalações
                </span>
                <Btn
                    variant={isExpired ? 'danger' : isConnected ? 'ghost' : isAvailable ? 'secondary' : 'ghost'}
                    size="sm"
                    disabled={!isAvailable && !isConnected && !isExpired}
                    icon={isConnected ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : undefined}
                >
                    {isExpired ? 'Reconectar' : isConnected ? 'Conectado' : plugin.status}
                </Btn>
            </div>
        </motion.div>
    )
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
    return (
        <div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                {label}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
                {value}
            </p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                {sub}
            </p>
        </div>
    )
}

function WebhookModal({ plugin, onClose }: { plugin: Plugin; onClose: () => void }) {
    const webhookUrl = `https://northie.vercel.app/api/webhooks/${plugin.id.replace('-ads', '')}`

    return (
        <Modal onClose={onClose} maxWidth={520} title={`Configurar ${plugin.name}`} subtitle={`Para sincronizar suas vendas, configure o Webhook no painel da ${plugin.name}.`}>
            <div style={{ marginTop: 24 }}>
                <div style={{ background: 'var(--color-bg-secondary)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
                    <SectionLabel gutterBottom={8}>URL DE DESTINO (POST)</SectionLabel>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <code style={{
                            flex: 1, background: 'transparent', color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)',
                            fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                            {webhookUrl}
                        </code>
                        <Btn
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                navigator.clipboard.writeText(webhookUrl)
                                alert('URL Copiada!')
                            }}
                        >
                            COPIAR
                        </Btn>
                    </div>
                </div>

                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                    <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 12 }}>Passo a passo:</p>
                    <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <li>Acesse o painel da {plugin.name}</li>
                        <li>Procure por "Webhooks" ou "Configurações de API"</li>
                        <li>Cole a URL acima e selecione o evento "Venda Aprovada"</li>
                        <li>Salve as modificações</li>
                    </ol>
                </div>

                <Btn variant="primary" size="md" fullWidth style={{ marginTop: 32 }} onClick={onClose}>
                    Concluir configuração
                </Btn>
            </div>
        </Modal>
    )
}

// ── Main Page Component ─────────────────────────────────────────────────────

export default function AppStore({ onToggleChat, user }: { onToggleChat?: () => void; user?: any }) {
    const [activeCategory, setActiveCategory] = useState<Category>('Todos')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null)
    const [installedPlugins, setInstalledPlugins] = useState<string[]>([])
    const [expiredPlugins, setExpiredPlugins] = useState<string[]>([])
    const [pluginMeta, setPluginMeta] = useState<Record<string, { connectedAccounts?: number }>>({})
    const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null)
    const [webhookOpen, setWebhookOpen] = useState<Plugin | null>(null)

    useEffect(() => {
        if (!user?.id) return
        const fetchIntegrations = async () => {
            try {
                setProfileId(user.id)
                const { data } = await integrationApi.getStatus()
                if (Array.isArray(data)) {
                    const platformMap: Record<string, string> = {
                        meta: 'meta-ads',
                        google: 'google-ads',
                    }
                    const active = data
                        .filter((item: { status: string }) => item.status === 'active')
                        .map((item: { platform: string }) => platformMap[item.platform] ?? item.platform)
                    const expired = data
                        .filter((item: { status: string }) => item.status === 'expired' || item.status === 'inactive')
                        .map((item: { platform: string }) => platformMap[item.platform] ?? item.platform)

                    // Mapeia metadados extras (ex: contas Google conectadas)
                    const meta: Record<string, { connectedAccounts?: number }> = {}
                    for (const item of data) {
                        const pluginId = platformMap[item.platform] ?? item.platform
                        if (item.google_customer_ids?.length) {
                            meta[pluginId] = { connectedAccounts: item.google_customer_ids.length }
                        }
                    }

                    setInstalledPlugins(active)
                    setExpiredPlugins(expired)
                    setPluginMeta(meta)
                }
            } catch (err) {
                console.error('[AppStore] fetchIntegrations error:', err)
            }
        }
        fetchIntegrations()
    }, [user?.id])

    const handleSync = useCallback(async (pluginId: string, days = 30) => {
        const platform = pluginId === 'meta-ads' ? 'meta' : pluginId.replace('-ads', '')
        setSyncingPlatform(days === 0 ? `${pluginId}-full` : pluginId)
        try {
            await integrationApi.sync(platform, days)
            const msg = days === 0
                ? 'Sincronização iniciada! O histórico completo será importado em alguns instantes.'
                : `Sincronização iniciada! Os dados dos últimos ${days} dias serão importados em breve.`
            alert(msg)
        } catch (err: any) {
            const status = err?.response?.status
            const isTimeout = err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')
            if (status === 401) {
                alert('Sessão da Hotmart expirada. Desconecte e reconecte a integração para sincronizar.')
            } else if (isTimeout) {
                alert('A sincronização foi iniciada, mas demorou para confirmar. Os dados serão importados em breve.')
            } else {
                alert('Falha ao iniciar sincronização. Tente novamente.')
            }
        } finally {
            setSyncingPlatform(null)
        }
    }, [])

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'NORTHIE_OAUTH_SUCCESS') {
                const { platform } = event.data
                // Map platform name → pluginId
                const pluginIdMap: Record<string, string> = {
                    meta: 'meta-ads',
                    google: 'google-ads',
                    hotmart: 'hotmart',
                }
                const id = pluginIdMap[platform] ?? `${platform}-ads`
                setInstalledPlugins(prev => [...new Set([...prev, id])])
                // Trigger 30-day sync automatically after OAuth completes
                handleSync(id, 30)
            }
        }
        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [handleSync])

    const categories: Category[] = ['Todos', 'Integrações', 'Marketing', 'Pagamentos', 'Fiscal', 'Em breve']

    const currentPlugins = useMemo(() => {
        return PLUGINS.map(p => ({
            ...p,
            status: (
                installedPlugins.includes(p.id) ? 'Conectado' :
                expiredPlugins.includes(p.id) ? 'Expirado' :
                p.status
            ) as any,
            connectedAccounts: pluginMeta[p.id]?.connectedAccounts,
        }))
    }, [installedPlugins, expiredPlugins, pluginMeta])

    const filteredPlugins = useMemo(() => {
        return currentPlugins.filter(p => {
            const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.description.toLowerCase().includes(searchQuery.toLowerCase())
            return matchesCategory && matchesSearch
        })
    }, [activeCategory, searchQuery, currentPlugins])

    const handleInstall = (pluginId: string) => {
        // Plataformas com fluxo OAuth (popup)
        const oauthPlatforms: Record<string, string> = {
            'meta-ads': 'meta',
            'google-ads': 'google',
            'hotmart': 'hotmart',
        }

        if (pluginId in oauthPlatforms) {
            const platform = oauthPlatforms[pluginId]!
            const width = 600
            const height = 700
            const left = window.screen.width / 2 - width / 2
            const top = window.screen.height / 2 - height / 2
            // Use relative URL in production, absolute only in localhost (backend runs on port 3001)
            const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin
            fetch(`${apiBase}/api/integrations/connect/${platform}?profileId=${user?.id}`)
                .then(r => {
                    if (!r.ok) throw new Error(`Server error: ${r.status}`)
                    return r.json()
                })
                .then(({ authUrl }) => {
                    if (!authUrl) throw new Error('authUrl não retornado pelo servidor')
                    window.open(
                        authUrl,
                        `Northie${platform}Auth`,
                        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
                    )
                })
                .catch((err) => {
                    console.error('[AppStore] Erro ao iniciar OAuth:', err)
                    alert('Não foi possível conectar. Verifique sua conexão e tente novamente.')
                })
        } else if (['stripe', 'shopify'].includes(pluginId)) {
            const plugin = PLUGINS.find(p => p.id === pluginId)
            if (plugin) setWebhookOpen(plugin)
        } else {
            alert('Esta integração estará disponível em breve.')
        }
    }

    const handleDisconnect = async (pluginId: string) => {
        if (!window.confirm(`Tem certeza que deseja desconectar o ${pluginId}?`)) return

        try {
            await integrationApi.disconnect(pluginId)
            setInstalledPlugins(prev => prev.filter(id => id !== pluginId))
            if (selectedPlugin?.id === pluginId) {
                setSelectedPlugin(prev => prev ? { ...prev, status: 'Instalar' } : null)
            }
        } catch (error) {
            console.error('Failed to disconnect:', error)
            alert('Falha ao desconectar. Tente novamente.')
        }
    }

    const currentSelectedPlugin = useMemo(() => {
        if (!selectedPlugin) return null
        return currentPlugins.find(p => p.id === selectedPlugin.id) || selectedPlugin
    }, [selectedPlugin, currentPlugins])

    return (
        <div style={{ paddingTop: 28, paddingBottom: 80 }}>
            {!selectedPlugin && <TopBar onToggleChat={onToggleChat} />}

            <AnimatePresence mode='wait'>
                {currentSelectedPlugin ? (
                    <DetailView
                        key="detail"
                        plugin={currentSelectedPlugin}
                        onBack={() => setSelectedPlugin(null)}
                        onInstall={() => handleInstall(currentSelectedPlugin.id)}
                        onDisconnect={() => handleDisconnect(currentSelectedPlugin.id)}
                        onSync={() => handleSync(currentSelectedPlugin.id, 30)}
                        onSyncFull={() => handleSync(currentSelectedPlugin.id, 0)}
                        isSyncing={syncingPlatform === currentSelectedPlugin.id}
                        isSyncingFull={syncingPlatform === `${currentSelectedPlugin.id}-full`}
                        userId={user?.id}
                    />
                ) : (
                    <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <PageHeader
                            title="App Store"
                            subtitle="Encontre e instale integrações oficiais para potencializar seu dashboard."
                            actions={
                                <div style={{ position: 'relative' }}>
                                    <Input
                                        type="text"
                                        placeholder="Pesquisar plugins..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{ width: 280 }}
                                        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-tertiary)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>}
                                    />
                                </div>
                            }
                        />

                        <div style={{ marginTop: 32 }}>
                            <FilterPills
                                options={categories}
                                active={activeCategory}
                                onChange={(c) => setActiveCategory(c as Category)}
                            />
                        </div>

                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20, marginTop: 32
                        }}>
                            {filteredPlugins.map(plugin => (
                                <PluginCard
                                    key={plugin.id}
                                    plugin={plugin as Plugin}
                                    onClick={() => setSelectedPlugin(plugin as Plugin)}
                                />
                            ))}
                        </div>

                        {filteredPlugins.length === 0 && (
                            <EmptyState
                                title="Não encontramos este App"
                                description={`Não existem resultados para "${searchQuery}" nesta categoria.`}
                                action={<Btn variant="secondary" size="sm" onClick={() => setSearchQuery('')}>Limpar busca</Btn>}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {webhookOpen && (
                    <WebhookModal plugin={webhookOpen} onClose={() => setWebhookOpen(null)} />
                )}
            </AnimatePresence>
        </div>
    )
}

function DetailView({ plugin, onBack, onInstall, onDisconnect, onSync, onSyncFull, isSyncing, isSyncingFull, userId }: {
    plugin: Plugin
    onBack: () => void
    onInstall: () => void
    onDisconnect: () => void
    onSync: () => void
    onSyncFull: () => void
    isSyncing: boolean
    isSyncingFull: boolean
    userId?: string
}) {
    const isConnected = plugin.status === 'Conectado'
    const isExpired = plugin.status === 'Expirado'
    const supportsSync = ['meta-ads', 'google-ads', 'hotmart'].includes(plugin.id)
    const anySyncing = isSyncing || isSyncingFull
    const [copied, setCopied] = useState(false)
    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const webhookUrl = userId ? `${window.location.origin}/api/webhooks/hotmart/${userId}` : null

    const handleCopy = () => {
        if (!webhookUrl) return
        navigator.clipboard.writeText(webhookUrl)
        setCopied(true)
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
    }

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {isExpired && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        background: 'rgba(239,68,68,0.08)', border: '1px solid var(--status-critical)',
                        borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 24,
                        display: 'flex', alignItems: 'center', gap: 10,
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--status-critical)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--status-critical)' }}>
                        Token expirado — clique em <strong>Reconectar</strong> para reautorizar.
                    </span>
                </motion.div>
            )}
            <PageHeader
                title={plugin.name}
                subtitle={plugin.connectedAccounts ? `${plugin.connectedAccounts} conta(s) conectada(s)` : plugin.description}
                breadcrumb={{ label: 'Voltar para App Store', onClick: onBack }}
                actions={
                    <div style={{ display: 'flex', gap: 12 }}>
                        <Btn
                            variant={isExpired ? 'danger' : isConnected ? 'secondary' : 'primary'}
                            size="md"
                            onClick={onInstall}
                            disabled={isConnected}
                            icon={isConnected ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : undefined}
                        >
                            {isExpired ? 'Reconectar' : isConnected ? 'Conectado' : plugin.status}
                        </Btn>
                        {isConnected && supportsSync && (
                            <>
                                <Btn variant="ghost" size="md" onClick={onSync} disabled={anySyncing}
                                    icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.81" /></svg>}
                                >
                                    {isSyncing ? 'Sincronizando...' : 'Últ. 30 dias'}
                                </Btn>
                                <Btn variant="ghost" size="md" onClick={onSyncFull} disabled={anySyncing}
                                    icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.81" /></svg>}
                                >
                                    {isSyncingFull ? 'Sincronizando...' : 'Histórico completo'}
                                </Btn>
                            </>
                        )}
                        {isConnected && (
                            <Btn variant="danger" size="md" onClick={onDisconnect}>
                                Desconectar
                            </Btn>
                        )}
                    </div>
                }
            />

            <div style={{ display: 'flex', gap: 48, marginTop: 40, alignItems: 'flex-start' }}>
                <div style={{
                    width: 120, height: 120, borderRadius: 'var(--radius-xl)', background: plugin.iconColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', border: '1px solid var(--color-border)', flexShrink: 0
                }}>
                    {plugin.logoUrl ? (
                        <img src={plugin.logoUrl} alt={plugin.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 16 }} />
                    ) : (
                        <span style={{ fontSize: 40, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{plugin.name[0]}</span>
                    )}
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24,
                        paddingBottom: 32, borderBottom: '1px solid var(--color-border)'
                    }}>
                        <Metric label="REVIEWS" value={plugin.reviews} sub="⭐⭐⭐⭐⭐" />
                        <Metric label="INSTALLS" value={plugin.metricInstalls} sub="Globalmente" />
                        <Metric label="DESENVOLVEDOR" value={plugin.developer} sub="Official Partner" />
                        <Metric label="CATEGORIA" value={plugin.category} sub="App Type" />
                    </div>

                    <div style={{ marginTop: 40 }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 400, color: 'var(--color-text-primary)', marginBottom: 16 }}>
                            Sobre o App
                        </h2>
                        <p style={{
                            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', lineHeight: 1.6,
                            color: 'var(--color-text-secondary)', marginBottom: 32, maxWidth: 640
                        }}>
                            {plugin.fullDescription}
                        </p>

                        <SectionLabel gutterBottom={16}>Benefícios principais</SectionLabel>
                        <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 0, listStyle: 'none' }}>
                            {plugin.features.map((f, i) => (
                                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', color: 'var(--color-text-secondary)' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2 }}>
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    {f}
                                </li>
                            ))}
                        </ul>

                        {plugin.id === 'hotmart' && isConnected && webhookUrl && (
                            <div style={{ marginTop: 40 }}>
                                <SectionLabel gutterBottom={12}>Configuração de Webhook</SectionLabel>
                                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                                    Para receber vendas em tempo real, cole a URL abaixo no painel da Hotmart em <strong>Ferramentas → Webhooks</strong>.
                                </p>

                                <div style={{
                                    background: 'var(--color-bg-secondary)', padding: '16px 20px',
                                    borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
                                    display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20
                                }}>
                                    <code style={{
                                        flex: 1, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
                                        color: 'var(--color-text-primary)', overflow: 'hidden',
                                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0
                                    }}>
                                        {webhookUrl}
                                    </code>
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleCopy}
                                        style={{
                                            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                                            padding: '8px 14px', borderRadius: 'var(--radius-md)',
                                            border: `1px solid ${copied ? 'var(--color-success, #22c55e)' : 'var(--color-border)'}`,
                                            background: copied ? 'rgba(34,197,94,0.08)' : 'var(--color-bg-primary)',
                                            color: copied ? 'var(--color-success, #22c55e)' : 'var(--color-text-secondary)',
                                            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                                            fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
                                            letterSpacing: '0.04em', textTransform: 'uppercase'
                                        }}
                                    >
                                        {copied ? (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                                Copiado
                                            </>
                                        ) : (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                </svg>
                                                Copiar
                                            </>
                                        )}
                                    </motion.button>
                                </div>

                                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                                    <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 10 }}>Passo a passo na Hotmart:</p>
                                    <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, lineHeight: 1.6 }}>
                                        <li>Acesse <strong>Meus Produtos → Ferramentas → Webhooks</strong></li>
                                        <li>Clique em <strong>Adicionar URL de Notificação</strong></li>
                                        <li>Cole a URL acima no campo de destino</li>
                                        <li>Selecione os eventos: <strong>Compra Aprovada</strong>, <strong>Reembolso</strong> e <strong>Assinatura Cancelada</strong></li>
                                        <li>Salve. A Northie começa a receber vendas em tempo real.</li>
                                    </ol>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
