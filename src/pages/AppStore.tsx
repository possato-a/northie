import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '../components/TopBar'
import { supabase } from '../lib/supabase'

// ── Types & Mock Data ────────────────────────────────────────────────────────

type Category = 'Todos' | 'Integrações' | 'Marketing' | 'Pagamentos' | 'Fiscal' | 'Em breve'

interface Plugin {
    id: string
    name: string
    category: Category
    description: string
    fullDescription: string
    installCount: string
    status: 'Instalar' | 'Em breve'
    iconColor: string
    developer: string
    reviews: string
    metricInstalls: string
    features: string[]
}

const PLUGINS: Plugin[] = [
    {
        id: 'meta-ads',
        name: 'Meta Ads',
        category: 'Integrações',
        description: 'Conecte sua conta e acompanhe gastos, ROAS e CAC em tempo real dentro da Northie.',
        fullDescription: 'O Meta Ads é a integração oficial para rastreamento de conversões em campanhas do Facebook e Instagram Ads.',
        installCount: '5.410 instalaram nos últimos 7 dias',
        status: 'Instalar',
        iconColor: '#0064E0',
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
        id: 'hotmart',
        name: 'Hotmart',
        category: 'Integrações',
        description: 'Importe histórico de vendas e clientes automaticamente.',
        fullDescription: 'Sincronize sua conta Hotmart para ter uma visão consolidada de suas vendas de infoprodutos diretamente na Northie.',
        installCount: '3.200 instalaram nos últimos 7 dias',
        status: 'Instalar',
        iconColor: '#F04E23',
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
        description: 'Sincronize transações e receita recorrente com a Northie.',
        fullDescription: 'A integração mais robusta para pagamentos globais e MRR.',
        installCount: '1.850 instalaram nos últimos 7 dias',
        status: 'Instalar',
        iconColor: '#635BFF',
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
        id: 'kiwify',
        name: 'Kiwify',
        category: 'Integrações',
        description: 'Conecte sua loja e unifique dados de vendas na plataforma.',
        fullDescription: 'Unifique seus dados da Kiwify com outras fontes para uma análise de growth completa.',
        installCount: '2.100 instalaram nos últimos 7 dias',
        status: 'Instalar',
        iconColor: '#00D1FF',
        developer: '@northie',
        reviews: '4.8',
        metricInstalls: '6k+',
        features: [
            'Webhook integrado para vendas imediatas',
            'Relatórios de checkout e abandono de carrinho',
            'Gestão de afiliados sincronizada',
            'Dashboard de comissões simplificado'
        ]
    },
    {
        id: 'whatsapp',
        name: 'WhatsApp',
        category: 'Marketing',
        description: 'Dispare notificações automáticas para clientes via WhatsApp.',
        fullDescription: 'Automação de mensagens para recuperação de carrinho e pós-venda.',
        installCount: '4.500 instalaram nos últimos 7 dias',
        status: 'Instalar',
        iconColor: '#25D366',
        developer: '@northie',
        reviews: '4.9',
        metricInstalls: '15k+',
        features: [
            'Mensagens de boas-vindas automáticas',
            'Recuperação de boletos e Pix pendentes',
            'Pesquisas de NPS pós-venda',
            'Atendimento centralizado'
        ]
    },
    {
        id: 'resend',
        name: 'Resend Email',
        category: 'Marketing',
        description: 'Envie emails transacionais e de reativação direto da Northie.',
        fullDescription: 'Infraestrutura de email moderna para desenvolvedores e founders.',
        installCount: '1.200 instalaram nos últimos 7 dias',
        status: 'Instalar',
        iconColor: '#1E1E1E',
        developer: '@northie',
        reviews: '5.0',
        metricInstalls: '3k+',
        features: [
            'Templates de email personalizáveis',
            'Alta entregabilidade garantida',
            'Analytics de abertura e cliques',
            'Automação baseada em triggers de compra'
        ]
    },
    {
        id: 'shopify',
        name: 'Shopify',
        category: 'Integrações',
        description: 'Sincronize produtos, pedidos e clientes do seu e-commerce.',
        fullDescription: 'A maior plataforma de e-commerce do mundo integrada à Northie.',
        installCount: '0 instalados',
        status: 'Em breve',
        iconColor: '#96BF48',
        developer: '@northie',
        reviews: '-',
        metricInstalls: '0',
        features: ['Em desenvolvimento']
    },
    {
        id: 'google-ads',
        name: 'Google Ads',
        category: 'Integrações',
        description: 'Acompanhe performance e CAC das suas campanhas do Google.',
        fullDescription: 'Análise detalhada de Search, Display e YouTube Ads.',
        installCount: '0 instalados',
        status: 'Em breve',
        iconColor: '#4285F4',
        developer: '@northie',
        reviews: '-',
        metricInstalls: '0',
        features: ['Em desenvolvimento']
    },
    {
        id: 'discord',
        name: 'Discord',
        category: 'Marketing',
        description: 'Conecte sua comunidade e notifique membros automaticamente.',
        fullDescription: 'Integração de comunidade para membros VIP e alertas.',
        installCount: '0 instalados',
        status: 'Em breve',
        iconColor: '#5865F2',
        developer: '@northie',
        reviews: '-',
        metricInstalls: '0',
        features: ['Em desenvolvimento']
    }
]

// ── Components ───────────────────────────────────────────────────────────────

function PluginCard({ plugin, onClick }: { plugin: Plugin; onClick: () => void }) {
    const isAvailable = plugin.status === 'Instalar'

    return (
        <motion.div
            whileHover={{ y: -4, borderColor: 'rgba(var(--fg-rgb),0.2)' }}
            onClick={onClick}
            style={{
                padding: 24, borderRadius: 12, border: '1px solid rgba(var(--fg-rgb),0.1)',
                background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 16,
                transition: 'all 0.2s', cursor: 'pointer', position: 'relative'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 10, background: plugin.iconColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF',
                        fontSize: 20, fontWeight: 700
                    }}>
                        {plugin.name[0]}
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 16, fontWeight: 600, color: 'var(--fg)' }}>
                                {plugin.name}
                            </span>
                            <span style={{
                                fontSize: 9, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,0.1)',
                                padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase'
                            }}>
                                Northie
                            </span>
                        </div>
                        <p style={{
                            fontFamily: "'Poppins', sans-serif", fontSize: 13, color: 'rgba(var(--fg-rgb),0.5)',
                            margin: '4px 0 0', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                        }}>
                            {plugin.description}
                        </p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 12 }}>
                <span style={{ fontSize: 11, color: 'rgba(var(--fg-rgb),0.4)', fontFamily: "'Poppins', sans-serif" }}>
                    {plugin.installCount}
                </span>
                <button
                    disabled={!isAvailable}
                    style={{
                        padding: '8px 16px', borderRadius: 6, border: 'none',
                        background: isAvailable ? 'var(--inv)' : 'rgba(var(--fg-rgb),0.05)',
                        color: isAvailable ? 'var(--on-inv)' : 'rgba(var(--fg-rgb),0.3)',
                        fontSize: 12, fontWeight: 600, cursor: isAvailable ? 'pointer' : 'default',
                        fontFamily: "'Poppins', sans-serif", transition: 'all 0.2s'
                    }}
                >
                    {plugin.status}
                </button>
            </div>
        </motion.div>
    )
}


function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
    return (
        <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(var(--fg-rgb),0.4)', letterSpacing: '0.05em', marginBottom: 8 }}>
                {label}
            </p>
            <p style={{ fontSize: 24, fontWeight: 500, color: 'var(--fg)', margin: 0, letterSpacing: '-0.5px' }}>
                {value}
            </p>
            <p style={{ fontSize: 11, color: 'rgba(var(--fg-rgb),0.4)', marginTop: 4 }}>
                {sub}
            </p>
        </div>
    )
}

// ── Main Page Component ─────────────────────────────────────────────────────

export default function AppStore({ onToggleChat, user }: { onToggleChat?: () => void; user?: any }) {
    const [activeCategory, setActiveCategory] = useState<Category>('Todos')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null)
    const [installedPlugins, setInstalledPlugins] = useState<string[]>([])

    // Fetch existing integrations from Supabase
    useEffect(() => {
        const fetchIntegrations = async () => {
            const { data, error } = await supabase
                .from('integrations')
                .select('platform')
                .eq('profile_id', user?.id)
                .eq('status', 'active')

            if (data && !error) {
                const platforms = data.map((item: { platform: string }) =>
                    item.platform === 'meta' ? 'meta-ads' : `${item.platform}-ads`
                )
                setInstalledPlugins(platforms)
            }
        }
        fetchIntegrations()
    }, [])

    // Listen for OAuth success from popup
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'NORTHIE_OAUTH_SUCCESS') {
                const { platform } = event.data
                const id = platform === 'meta' ? 'meta-ads' : `${platform}-ads`
                setInstalledPlugins(prev => [...new Set([...prev, id])])
            }
        }
        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [])

    const categories: Category[] = ['Todos', 'Integrações', 'Marketing', 'Pagamentos', 'Fiscal', 'Em breve']

    const currentPlugins = useMemo(() => {
        return PLUGINS.map(p => ({
            ...p,
            status: installedPlugins.includes(p.id) ? 'Conectado' : p.status
        }))
    }, [installedPlugins])

    const filteredPlugins = useMemo(() => {
        return currentPlugins.filter(p => {
            const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.description.toLowerCase().includes(searchQuery.toLowerCase())
            return matchesCategory && matchesSearch
        })
    }, [activeCategory, searchQuery, currentPlugins])

    const handleInstall = (pluginId: string) => {
        if (pluginId === 'meta-ads') {
            const width = 600
            const height = 700
            const left = window.screen.width / 2 - width / 2
            const top = window.screen.height / 2 - height / 2

            const profileId = user?.id
            const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin

            window.open(
                `${baseUrl}/api/integrations/connect/meta?profileId=${profileId}`,
                'NorthieMetaAuth',
                `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
            )
        } else {
            alert('Esta integração estará disponível em breve.')
        }
    }

    const currentSelectedPlugin = useMemo(() => {
        if (!selectedPlugin) return null
        return currentPlugins.find(p => p.id === selectedPlugin.id) || selectedPlugin
    }, [selectedPlugin, currentPlugins])

    return (
        <div style={{ paddingTop: 28, paddingBottom: 80 }}>
            {/* Search & Back Header always visible or managed by state */}
            {!selectedPlugin && <TopBar onToggleChat={onToggleChat} />}

            <AnimatePresence mode='wait'>
                {currentSelectedPlugin ? (
                    <DetailView
                        key="detail"
                        plugin={currentSelectedPlugin}
                        onBack={() => setSelectedPlugin(null)}
                        onInstall={() => handleInstall(currentSelectedPlugin.id)}
                    />
                ) : (
                    <motion.div
                        key="grid"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h1 style={{
                                fontFamily: "'Poppins', sans-serif", fontWeight: 400, fontSize: 40,
                                letterSpacing: '-1.6px', color: 'var(--fg)', margin: 0
                            }}>
                                App Store
                            </h1>

                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    placeholder="Pesquisar plugins..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        padding: '12px 16px 12px 40px', borderRadius: 8, border: '1px solid rgba(var(--fg-rgb),0.1)',
                                        background: 'var(--surface)', width: 280, fontSize: 14, outline: 'none',
                                        fontFamily: "'Poppins', sans-serif", transition: 'border-color 0.2s',
                                        color: 'var(--fg)'
                                    }}
                                />
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{
                                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                                    color: 'rgba(var(--fg-rgb),0.3)'
                                }}>
                                    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="2" />
                                    <path d="M11 11L14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>

                        {/* Filters */}
                        <div style={{ display: 'flex', gap: 12, marginTop: 40, flexWrap: 'wrap' }}>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    style={{
                                        padding: '8px 20px', borderRadius: 20, border: '1px solid',
                                        borderColor: activeCategory === cat ? 'var(--inv)' : 'rgba(var(--fg-rgb),0.1)',
                                        background: activeCategory === cat ? 'var(--inv)' : 'transparent',
                                        color: activeCategory === cat ? 'var(--on-inv)' : 'rgba(var(--fg-rgb),0.6)',
                                        fontSize: 14, fontWeight: 500, cursor: 'pointer',
                                        fontFamily: "'Poppins', sans-serif", transition: 'all 0.2s'
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Grid */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginTop: 48
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
                            <div style={{
                                textAlign: 'center', marginTop: 100, color: 'rgba(var(--fg-rgb),0.3)',
                                fontFamily: "'Poppins', sans-serif"
                            }}>
                                Nenhum plugin encontrado para sua busca.
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// Wrapper for DetailView back and enable functional install
function DetailView({ plugin, onBack, onInstall }: { plugin: Plugin | any; onBack: () => void; onInstall: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            style={{ width: '100%' }}
        >
            <button
                onClick={onBack}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(var(--fg-rgb),0.5)',
                    display: 'flex', alignItems: 'center', gap: 8, padding: 0, marginBottom: 40,
                    fontFamily: "'Poppins', sans-serif", fontSize: 14
                }}
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 13L5 8L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Voltar para a App Store
            </button>

            <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
                <div style={{
                    width: 120, height: 120, borderRadius: 24, background: plugin.iconColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF',
                    fontSize: 48, fontWeight: 700, flexShrink: 0
                }}>
                    {plugin.name[0]}
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h1 style={{
                                fontFamily: "'Poppins', sans-serif", fontSize: 32, fontWeight: 500, margin: 0,
                                letterSpacing: '-1.2px', color: 'var(--fg)'
                            }}>
                                {plugin.name}
                            </h1>
                            <p style={{
                                fontFamily: "'Poppins', sans-serif", fontSize: 18, color: 'rgba(var(--fg-rgb),0.5)',
                                margin: '8px 0 0', fontWeight: 400
                            }}>
                                {plugin.description}
                            </p>
                        </div>
                        <button
                            onClick={onInstall}
                            disabled={plugin.status === 'Conectado'}
                            style={{
                                padding: '12px 32px', borderRadius: 8, border: 'none',
                                background: plugin.status === 'Conectado' ? '#059669' : (plugin.status === 'Instalar' ? 'var(--inv)' : 'rgba(var(--fg-rgb),0.05)'),
                                color: (plugin.status === 'Instalar' || plugin.status === 'Conectado') ? 'var(--on-inv)' : 'rgba(var(--fg-rgb),0.3)',
                                fontSize: 14, fontWeight: 600, cursor: (plugin.status === 'Instalar' && plugin.status !== 'Conectado') ? 'pointer' : 'default',
                                fontFamily: "'Poppins', sans-serif", transition: 'all 0.3s'
                            }}
                        >
                            {plugin.status === 'Conectado' ? '✓ Conectado' : plugin.status}
                        </button>
                    </div>

                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40,
                        marginTop: 48, padding: '32px 0', borderTop: '1px solid rgba(var(--fg-rgb),0.1)',
                        borderBottom: '1px solid rgba(var(--fg-rgb),0.1)'
                    }}>
                        <Metric label="REVIEWS" value={plugin.reviews} sub="⭐⭐⭐⭐⭐" />
                        <Metric label="INSTALLS" value={plugin.metricInstalls} sub="Mensalmente" />
                        <Metric label="DESENVOLVIDO POR" value={plugin.developer} sub="Official Partner" />
                        <Metric label="CATEGORIA" value={plugin.category} sub="Northie Store" />
                    </div>

                    <div style={{ marginTop: 48 }}>
                        <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 500, marginBottom: 24 }}>
                            Sobre o App
                        </h2>
                        <p style={{
                            fontFamily: "'Poppins', sans-serif", fontSize: 16, lineHeight: 1.6,
                            color: 'rgba(var(--fg-rgb),0.7)', marginBottom: 32
                        }}>
                            {plugin.fullDescription}
                        </p>
                        <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                            Benefícios principais:
                        </h3>
                        <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 20 }}>
                            {plugin.features.map((f: any, i: any) => (
                                <li key={i} style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15, color: 'rgba(var(--fg-rgb),0.7)' }}>
                                    {f}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
