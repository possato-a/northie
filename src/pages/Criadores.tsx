import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import { campaignApi } from '../lib/api'
import { fmtBR } from '../lib/utils'
import type { Creator } from '../types'
import {
    PageHeader, SectionLabel, TH, Divider,
    Btn, Modal, Input, Textarea,
    EmptyState, LoadingRow, FilterPills, SelectField
} from '../components/ui/shared'

// ── Commision status tag ──────────────────────────────────────────────────────

function CommTag({ pending }: { pending: number }) {
    return pending > 0
        ? <span className="tag tag-planning">Pendente</span>
        : <span className="tag tag-complete">Pago</span>
}

// ── Campaign Detail ────────────────────────────────────────────────────────────

function CampaignDetails({
    campaign, onBack, onAddCreator, onPayCreator
}: {
    campaign: any
    onBack: () => void
    onAddCreator: () => void
    onPayCreator: (creator: any) => void
}) {
    const totalRevenue = campaign.creators.reduce((a: number, c: Creator) => a + c.revenue, 0)
    const totalCommission = campaign.creators.reduce((a: number, c: Creator) => a + (c.paid_commission + c.pending_commission), 0)
    const salesCount = campaign.creators.reduce((a: number, c: Creator) => a + c.sales_count, 0)
    const roi = totalCommission > 0 ? (totalRevenue / totalCommission).toFixed(1) : '—'

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            <PageHeader
                title={campaign.name}
                subtitle={`${campaign.product_name} · ${campaign.type === 'percentual' ? `${campaign.commission_rate}%` : `R$ ${campaign.commission_rate}`} de comissão`}
                breadcrumb={{ label: 'Voltar para campanhas', onClick: onBack }}
                actions={
                    <Btn variant="secondary" size="sm" onClick={onAddCreator}
                        icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
                    >
                        Adicionar criador
                    </Btn>
                }
            />

            {/* Stats strip */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 24,
                margin: '32px 0',
                padding: '24px 0',
                borderTop: '1px solid var(--color-border)',
                borderBottom: '1px solid var(--color-border)',
            }}>
                {[
                    { label: 'Vendas', value: salesCount },
                    { label: 'Receita total', value: `R$ ${fmtBR(totalRevenue)}` },
                    { label: 'Comissões', value: `R$ ${fmtBR(totalCommission)}` },
                    { label: 'ROI', value: `${roi}x` },
                ].map((s, i) => (
                    <div key={i} style={{ paddingLeft: i > 0 ? 24 : 0, borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none' }}>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{s.label}</p>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.5px' }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Creators table */}
            <SectionLabel gutterBottom={12}>Criadores participantes</SectionLabel>

            {/* Table header */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 130px 80px 110px 110px 90px 90px',
                gap: '0 16px',
                paddingBottom: 10,
                borderBottom: '1px solid var(--color-border)',
                marginBottom: 2,
            }}>
                <TH>Nome</TH>
                <TH>Instagram</TH>
                <TH align="right">Vendas</TH>
                <TH align="right">Receita</TH>
                <TH align="right">Comissão</TH>
                <TH>Status</TH>
                <TH align="right">Ações</TH>
            </div>

            {campaign.creators.length === 0 ? (
                <EmptyState
                    title="Nenhum criador ainda"
                    description="Adicione criadores para começar a rastrear vendas."
                    action={<Btn variant="primary" size="sm" onClick={onAddCreator}>Adicionar criador</Btn>}
                />
            ) : (
                campaign.creators.map((creator: Creator, i: number) => (
                    <motion.div
                        key={creator.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="notion-row"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 130px 80px 110px 110px 90px 90px',
                            gap: '0 16px',
                            alignItems: 'center',
                            height: 'var(--table-row-height)',
                            borderBottom: '1px solid var(--color-border)',
                            transition: 'background var(--transition-fast)',
                        }}
                        onHoverStart={e => (e.target as HTMLElement).style.background = 'var(--color-bg-secondary)'}
                        onHoverEnd={e => (e.target as HTMLElement).style.background = 'transparent'}
                    >
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                            {creator.name}
                        </span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                            {creator.instagram || '—'}
                        </span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                            {creator.sales_count}
                        </span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                            R$ {fmtBR(creator.revenue)}
                        </span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', textAlign: 'right' }}>
                            R$ {fmtBR(creator.pending_commission)}
                        </span>
                        <div>
                            <CommTag pending={creator.pending_commission} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            {creator.pending_commission > 0 && (
                                <Btn variant="primary" size="sm" onClick={() => onPayCreator(creator)}>Pagar</Btn>
                            )}
                            <Btn variant="ghost" size="sm">Copiar</Btn>
                        </div>
                    </motion.div>
                ))
            )}
        </motion.div>
    )
}

// ── New Campaign Modal ────────────────────────────────────────────────────────

function NewCampaignModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: any) => void }) {
    const [formData, setFormData] = useState({
        name: '',
        product_name: '',
        type: 'percentual',
        commission_rate: 20,
        start_date: '',
        end_date: '',
        description: ''
    })

    function set(key: string, val: any) {
        setFormData(prev => ({ ...prev, [key]: val }))
    }

    return (
        <Modal onClose={onClose} maxWidth={520} title="Nova Campanha" subtitle="Defina os termos do seu novo programa de criadores.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
                <Input
                    label="Nome da campanha"
                    value={formData.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="Ex: Lançamento Coleção Verão"
                />
                <Input
                    label="Produto vinculado"
                    value={formData.product_name}
                    onChange={e => set('product_name', e.target.value)}
                    placeholder="Nome do produto ou serviço"
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                    <SelectField
                        label="Tipo de comissão"
                        value={formData.type}
                        onChange={e => set('type', e.target.value)}
                    >
                        <option value="percentual">Percentual (%)</option>
                        <option value="fixo">Valor fixo (R$)</option>
                    </SelectField>
                    <Input
                        label="Valor"
                        value={formData.commission_rate}
                        onChange={e => set('commission_rate', Number(e.target.value))}
                        type="number"
                        placeholder="20"
                    />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Input label="Início" type="date" value={formData.start_date} onChange={e => set('start_date', e.target.value)} />
                    <Input label="Fim" type="date" value={formData.end_date} onChange={e => set('end_date', e.target.value)} />
                </div>
                <Textarea
                    label="Descrição"
                    value={formData.description}
                    onChange={e => set('description', e.target.value)}
                    placeholder="Briefing para os criadores..."
                    style={{ minHeight: 80 }}
                />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <Btn variant="secondary" size="md" fullWidth onClick={onClose}>Cancelar</Btn>
                <Btn variant="primary" size="md" fullWidth onClick={() => onCreate(formData)}>Criar campanha</Btn>
            </div>
        </Modal>
    )
}

// ── Add Creator Modal ─────────────────────────────────────────────────────────

function AddCreatorModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, email: string) => void }) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')

    return (
        <Modal onClose={onClose} maxWidth={440} title="Novo Criador" subtitle="Adicione um parceiro para esta campanha.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
                <Input label="Nome completo" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Lucas Montano" />
                <Input label="Email de contato" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="lucas@northie.co" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <Btn variant="secondary" size="md" fullWidth onClick={onClose}>Cancelar</Btn>
                <Btn variant="primary" size="md" fullWidth onClick={() => onAdd(name, email)}>Confirmar</Btn>
            </div>
        </Modal>
    )
}

// ── Payment Confirm Modal ─────────────────────────────────────────────────────

function PaymentConfirmModal({ creator, onClose, onConfirm }: { creator: any; onClose: () => void; onConfirm: () => void }) {
    return (
        <Modal onClose={onClose} maxWidth={420} title="Confirmar Pagamento">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 16 }}>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Registrar pagamento para <strong style={{ color: 'var(--color-text-primary)' }}>{creator.name}</strong>?
                </p>
                <div style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                    textAlign: 'center',
                    margin: '16px 0',
                }}>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>VALOR A LIQUIDAR</p>
                    <p style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 36,
                        fontWeight: 500,
                        letterSpacing: '-1.4px',
                        color: 'var(--color-text-primary)',
                        margin: 0,
                    }}>R$ {fmtBR(creator.pending_commission)}</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <Btn variant="secondary" size="md" fullWidth onClick={onClose}>Voltar</Btn>
                    <Btn variant="primary" size="md" fullWidth onClick={onConfirm}>Confirmar pagamento</Btn>
                </div>
            </div>
        </Modal>
    )
}

// ── Campaign Card ─────────────────────────────────────────────────────────────

function CampaignCard({ camp, onClick, index }: { camp: any; onClick: () => void; index: number }) {
    const [hovered, setHovered] = useState(false)

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.06 }}
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                padding: '20px 24px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                background: hovered ? 'var(--color-bg-secondary)' : 'var(--color-bg-primary)',
                cursor: 'pointer',
                transition: 'all var(--transition-base)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-md)',
                        fontWeight: 500,
                        color: 'var(--color-text-primary)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}>
                        {camp.name}
                    </h3>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 3 }}>
                        {camp.product_name}
                    </p>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Criadores</span>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--color-text-primary)', margin: '2px 0 0' }}>{camp.creators_count}</p>
                </div>
            </div>

            {/* Stats grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px 24px',
                padding: '14px 0',
                borderTop: '1px solid var(--color-border)',
            }}>
                {[
                    { label: 'Comissão', value: camp.type === 'percentual' ? `${camp.commission_rate}%` : `R$ ${camp.commission_rate}` },
                    { label: 'Vendas', value: camp.sales_count || 0 },
                    { label: 'Pendente', value: `R$ ${new Intl.NumberFormat('pt-BR').format(Number(camp.commission_total || 0))}` },
                    { label: 'Prazo', value: camp.end_date ? new Date(camp.end_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase() : 'OPEN' },
                ].map((s, i) => (
                    <div key={i}>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 3px' }}>{s.label}</p>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', margin: 0 }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Creator avatars */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex' }}>
                    {(camp.creators || []).slice(0, 4).map((c: any, idx: number) => (
                        <div key={c.id} style={{
                            width: 24, height: 24, borderRadius: 'var(--radius-sm)',
                            background: 'var(--color-bg-tertiary)',
                            border: `2px solid var(--color-bg-primary)`,
                            marginLeft: idx > 0 ? -8 : 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
                            color: 'var(--color-text-secondary)',
                        }}>
                            {c.name.charAt(0).toUpperCase()}
                        </div>
                    ))}
                    {(camp.creators || []).length > 4 && (
                        <div style={{
                            width: 24, height: 24, borderRadius: 'var(--radius-sm)',
                            background: 'var(--color-bg-tertiary)',
                            border: `2px solid var(--color-bg-primary)`,
                            marginLeft: -8,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--font-sans)', fontSize: 9,
                            color: 'var(--color-text-tertiary)',
                        }}>
                            +{camp.creators.length - 4}
                        </div>
                    )}
                </div>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {(camp?.creators || []).length} criadores
                </span>
                <svg style={{ marginLeft: 'auto', color: 'var(--color-text-tertiary)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
            </div>
        </motion.div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Criadores({ onToggleChat }: { onToggleChat?: () => void }) {
    const [campaigns, setCampaigns] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
    const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false)
    const [isAddCreatorOpen, setIsAddCreatorOpen] = useState(false)
    const [creatorToPay, setCreatorToPay] = useState<any | null>(null)
    const [campaignCreators, setCampaignCreators] = useState<any[]>([])
    const [statusFilter, setStatusFilter] = useState('Todas')

    const fetchCampaigns = async () => {
        try {
            const res = await campaignApi.list()
            setCampaigns(res.data)
        } catch (error) {
            console.error('Failed to fetch campaigns:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchCampaigns() }, [])

    useEffect(() => {
        if (selectedCampaignId) {
            campaignApi.listCreators(selectedCampaignId).then(res => setCampaignCreators(res.data))
        }
    }, [selectedCampaignId])

    const selectedCampaign = useMemo(() => campaigns.find(c => c.id === selectedCampaignId), [campaigns, selectedCampaignId])

    const globalKPIs = useMemo(() => {
        let pending = 0, sales = 0, creators = 0
        campaigns.forEach(camp => {
            creators += camp.creators_count || 0
            sales += camp.sales_count || 0
            pending += Number(camp.commission_total || 0)
        })
        return { pending, sales, creators, paid: 0 }
    }, [campaigns])

    const filteredCampaigns = useMemo(() => {
        if (statusFilter === 'Todas') return campaigns
        return campaigns.filter(c => c.type === statusFilter.toLowerCase())
    }, [campaigns, statusFilter])

    const handleCreateCampaign = async (data: any) => {
        try {
            await campaignApi.create(data)
            fetchCampaigns()
            setIsNewCampaignOpen(false)
        } catch {
            alert('Erro ao criar campanha')
        }
    }

    const handleAddCreator = async (name: string, email: string) => {
        if (!selectedCampaignId) return
        try {
            await campaignApi.addCreator({ campaignId: selectedCampaignId, name, email })
            const res = await campaignApi.listCreators(selectedCampaignId)
            setCampaignCreators(res.data)
            setIsAddCreatorOpen(false)
            fetchCampaigns()
        } catch {
            alert('Erro ao adicionar criador')
        }
    }

    const handleConfirmPayment = async () => {
        if (!creatorToPay || !selectedCampaignId) return
        try {
            await campaignApi.confirmPayout({ campaignId: selectedCampaignId, creatorId: creatorToPay.id })
            const res = await campaignApi.listCreators(selectedCampaignId)
            setCampaignCreators(res.data)
            setCreatorToPay(null)
            fetchCampaigns()
        } catch {
            alert('Erro ao confirmar pagamento')
        }
    }

    return (
        <div style={{ paddingTop: 28, paddingBottom: 80 }}>
            <TopBar onToggleChat={onToggleChat} />

            <AnimatePresence mode="wait">
                {!selectedCampaignId ? (
                    <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {/* Page Header */}
                        <PageHeader
                            title="Creators"
                            subtitle="Gerencie suas campanhas de parceria e comissões de criadores."
                            actions={
                                <Btn variant="primary" size="md" onClick={() => setIsNewCampaignOpen(true)}
                                    icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
                                >
                                    Nova campanha
                                </Btn>
                            }
                        />

                        {/* KPIs */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: 16,
                            marginTop: 32,
                        }}>
                            <KpiCard label="COMISSÕES PAGAS" value={globalKPIs.paid} prefix="R$ " decimals={0} delay={0.05} />
                            <KpiCard label="PENDENTES" value={globalKPIs.pending} prefix="R$ " decimals={0} delay={0.1} />
                            <KpiCard label="VENDAS VIA CRIADOR" value={globalKPIs.sales} decimals={0} delay={0.15} />
                            <KpiCard label="CRIADORES ATIVOS" value={globalKPIs.creators} decimals={0} delay={0.2} />
                        </div>

                        <Divider margin="32px 0 28px" />

                        {/* Filters + Section */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <SectionLabel gutterBottom={0}>Campanhas ({filteredCampaigns.length})</SectionLabel>
                            <FilterPills
                                options={['Todas', 'Percentual', 'Fixo']}
                                active={statusFilter}
                                onChange={setStatusFilter}
                            />
                        </div>

                        {/* Campaigns Grid */}
                        {loading ? (
                            <LoadingRow />
                        ) : filteredCampaigns.length === 0 ? (
                            <EmptyState
                                title="Nenhuma campanha ainda"
                                description="Crie sua primeira campanha de criadores para começar."
                                action={<Btn variant="primary" size="sm" onClick={() => setIsNewCampaignOpen(true)}>Nova campanha</Btn>}
                            />
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                                {filteredCampaigns.map((camp, i) => (
                                    <CampaignCard
                                        key={camp.id}
                                        camp={camp}
                                        index={i}
                                        onClick={() => {
                                            setSelectedCampaignId(camp.id)
                                            window.scrollTo({ top: 0, behavior: 'smooth' })
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <CampaignDetails
                        key="details"
                        campaign={{ ...selectedCampaign!, creators: campaignCreators }}
                        onBack={() => setSelectedCampaignId(null)}
                        onAddCreator={() => setIsAddCreatorOpen(true)}
                        onPayCreator={setCreatorToPay}
                    />
                )}
            </AnimatePresence>

            {/* Modals */}
            <AnimatePresence>
                {isNewCampaignOpen && <NewCampaignModal onClose={() => setIsNewCampaignOpen(false)} onCreate={handleCreateCampaign} />}
                {isAddCreatorOpen && <AddCreatorModal onClose={() => setIsAddCreatorOpen(false)} onAdd={handleAddCreator} />}
                {creatorToPay && <PaymentConfirmModal creator={creatorToPay} onClose={() => setCreatorToPay(null)} onConfirm={handleConfirmPayment} />}
            </AnimatePresence>
        </div>
    )
}
