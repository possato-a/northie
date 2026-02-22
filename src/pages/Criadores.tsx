import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KpiCard } from '../components/KpiCard'
import TopBar from '../components/TopBar'

// ── Types ───────────────────────────────────────────────────────────

type Status = 'pendente' | 'pago'
type CommissionType = 'percentual' | 'fixo'

interface Creator {
    id: string
    name: string
    email: string
    affiliateLink: string
    sales: number
    revenue: number
    commission: number
    status: Status
    paidAt?: string
}

interface Campaign {
    id: string
    name: string
    product: string
    description: string
    commissionType: CommissionType
    commissionValue: number
    startDate: string
    endDate: string
    creators: Creator[]
}

// ── Mock Data ────────────────────────────────────────────────────────

const INITIAL_CAMPAIGNS: Campaign[] = [
    {
        id: '1',
        name: 'Lançamento Verão 2026',
        product: 'Northie Pro Plan',
        description: 'Foco em founders que precisam de analytics avançado.',
        commissionType: 'percentual',
        commissionValue: 20,
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        creators: [
            { id: 'c1', name: 'Ana Silva', email: 'ana@creators.com', affiliateLink: 'northie.co/ref/ana-silva', sales: 24, revenue: 4800, commission: 960, status: 'pendente' },
            { id: 'c2', name: 'Bruno Costa', email: 'bruno@creators.com', affiliateLink: 'northie.co/ref/bruno-c', sales: 12, revenue: 2400, commission: 480, status: 'pago', paidAt: '20/02/2026' },
            { id: 'c3', name: 'Carla Souza', email: 'carla@influencer.co', affiliateLink: 'northie.co/ref/carla-influencer', sales: 56, revenue: 11200, commission: 2240, status: 'pendente' },
        ]
    },
    {
        id: '2',
        name: 'Black Friday 2025',
        product: 'Módulo Analytics',
        description: 'Promoção exclusiva para a base de seguidores.',
        commissionType: 'fixo',
        commissionValue: 100,
        startDate: '2025-11-20',
        endDate: '2025-11-30',
        creators: [
            { id: 'c4', name: 'Ricardo Nunes', email: 'ric@tech.com', affiliateLink: 'northie.co/ref/ricardo-n', sales: 15, revenue: 1500, commission: 150, status: 'pago', paidAt: '15/12/2025' },
        ]
    },
]

// ── Shared Primitives ────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11, color: 'rgba(30,30,30,0.4)',
            letterSpacing: '0.08em', marginBottom: 16,
            textTransform: 'uppercase'
        }}>
            {children}
        </p>
    )
}

const inputStyle: React.CSSProperties = {
    padding: '12px 16px', borderRadius: 6, border: '1px solid rgba(30,30,30,0.1)',
    background: '#FFF', fontSize: 14, outline: 'none', fontFamily: "'Poppins', sans-serif"
}

const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: 'rgba(30,30,30,0.4)', letterSpacing: '0.05em', marginBottom: 8
}

const TH = ({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) => (
    <th style={{
        padding: '16px 0', fontSize: 10, fontWeight: 600, color: 'rgba(30,30,30,0.4)',
        letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: align
    }}>
        {children}
    </th>
)

const TD = ({ children, align = 'left', bold = false, mono = false }: { children: React.ReactNode; align?: 'left' | 'right'; bold?: boolean; mono?: boolean }) => (
    <td style={{
        padding: '20px 0', fontSize: 14, color: '#1E1E1E',
        fontFamily: mono ? "'Geist Mono', monospace" : "'Poppins', sans-serif",
        fontWeight: bold ? 500 : 400,
        textAlign: align
    }}>
        {children}
    </td>
)

// ── Campaign Detail View ─────────────────────────────────────────────

function CampaignDetails({
    campaign,
    onBack,
    onAddCreator,
    onPayCreator
}: {
    campaign: Campaign
    onBack: () => void
    onAddCreator: () => void
    onPayCreator: (creator: Creator) => void
}) {
    const totalRevenue = campaign.creators.reduce((acc, c) => acc + c.revenue, 0)
    const totalCommission = campaign.creators.reduce((acc, c) => acc + c.commission, 0)
    const salesCount = campaign.creators.reduce((acc, c) => acc + c.sales, 0)

    const roi = totalCommission > 0 ? (totalRevenue / totalCommission).toFixed(1) : '—'

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
                <motion.button
                    onClick={onBack}
                    whileHover={{ x: -4 }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(30,30,30,0.5)', fontFamily: "'Poppins', sans-serif", fontSize: 14 }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                    Voltar para campanhas
                </motion.button>
            </div>

            <div style={{ background: '#FFF', border: '1px solid rgba(30,30,30,0.08)', borderRadius: 12, padding: 40, marginBottom: 64 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 48 }}>
                    <div>
                        <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 32, fontWeight: 500, margin: 0, letterSpacing: '-1.2px' }}>{campaign.name}</h2>
                        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 16, color: 'rgba(30,30,30,0.5)', marginTop: 8 }}>{campaign.product} · {campaign.commissionType === 'percentual' ? `${campaign.commissionValue}%` : `R$ ${campaign.commissionValue}`} de comissão</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", color: 'rgba(30,30,30,0.4)', textTransform: 'uppercase' }}>ROI DA CAMPANHA</span>
                        <p style={{ fontSize: 24, fontWeight: 500, margin: '4px 0 0', color: '#1E1E1E' }}>{roi}x</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40 }}>
                    <div>
                        <SectionLabel>VENDAS</SectionLabel>
                        <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>{salesCount}</p>
                    </div>
                    <div>
                        <SectionLabel>RECEITA TOTAL</SectionLabel>
                        <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>R$ {totalRevenue.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                        <SectionLabel>COMISSÕES</SectionLabel>
                        <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>R$ {totalCommission.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                        <SectionLabel>PRAZO</SectionLabel>
                        <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>{new Date(campaign.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <SectionLabel>CRIADORES PARTICIPANTES</SectionLabel>
                <motion.button
                    onClick={onAddCreator}
                    whileHover={{ backgroundColor: '#1E1E1E', color: '#FFF' }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        padding: '10px 20px', borderRadius: 6, border: '1px solid #1E1E1E',
                        background: 'transparent', cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
                        fontSize: 13, fontWeight: 500, transition: 'all 0.2s'
                    }}
                >
                    Adicionar criador
                </motion.button>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(30,30,30,0.08)' }}>
                            <TH>NOME</TH>
                            <TH>LINK</TH>
                            <TH align="right">VENDAS</TH>
                            <TH align="right">RECEITA</TH>
                            <TH align="right">COMISSÃO</TH>
                            <TH>STATUS</TH>
                            <TH align="right">AÇÕES</TH>
                        </tr>
                    </thead>
                    <tbody>
                        {campaign.creators.map(creator => (
                            <tr key={creator.id} style={{ borderBottom: '1px solid rgba(30,30,30,0.04)' }}>
                                <TD bold>{creator.name}</TD>
                                <TD mono>{creator.affiliateLink}</TD>
                                <TD align="right">{creator.sales}</TD>
                                <TD align="right">R$ {creator.revenue.toLocaleString('pt-BR')}</TD>
                                <TD align="right">R$ {creator.commission.toLocaleString('pt-BR')}</TD>
                                <TD>
                                    <span style={{
                                        padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                                        backgroundColor: creator.status === 'pago' ? 'rgba(30,30,30,0.08)' : 'rgba(30,30,30,0.03)',
                                        color: creator.status === 'pago' ? '#1E1E1E' : 'rgba(30,30,30,0.4)',
                                    }}>
                                        {creator.status}
                                    </span>
                                </TD>
                                <TD align="right">
                                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                        {creator.status === 'pendente' && (
                                            <button
                                                onClick={() => onPayCreator(creator)}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: 12, color: '#1E1E1E', fontWeight: 600 }}
                                            >
                                                Pagar
                                            </button>
                                        )}
                                        <button style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: 12, color: 'rgba(30,30,30,0.4)' }}>Copiar</button>
                                    </div>
                                </TD>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
    )
}

// ── Modals ────────────────────────────────────────────────────────────

function NewCampaignModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: any) => void }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,30,30,0.4)', backdropFilter: 'blur(4px)' }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} style={{ width: '100%', maxWidth: 500, background: '#FCF8F8', borderRadius: 12, padding: 40, position: 'relative', zIndex: 1001, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                <h2 style={{ fontFamily: "'Poppins', sans-serif", margin: '0 0 8px', fontSize: 24, letterSpacing: '-0.8px' }}>Nova Campanha</h2>
                <p style={{ color: 'rgba(30,30,30,0.5)', fontSize: 14, marginBottom: 32 }}>Configure as regras da nova parceria.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={labelStyle}>NOME DA CAMPANHA</label>
                        <input placeholder="Ex: Campanha de Lançamento" style={inputStyle} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={labelStyle}>PRODUTO VINCULADO</label>
                        <select style={inputStyle}>
                            <option>Northie Pro Plan</option>
                            <option>Módulo Analytics</option>
                            <option>Mentoria Individual</option>
                        </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={labelStyle}>TIPO DE COMISSÃO</label>
                            <select style={inputStyle}>
                                <option value="percentual">Percentual (%)</option>
                                <option value="fixo">Valor Fixo (R$)</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={labelStyle}>VALOR</label>
                            <input placeholder="20" style={inputStyle} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={labelStyle}>INÍCIO</label>
                            <input type="date" style={inputStyle} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={labelStyle}>FIM</label>
                            <input type="date" style={inputStyle} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={labelStyle}>DESCRIÇÃO PARA O CRIADOR</label>
                        <textarea placeholder="Explique brevemente a campanha..." style={{ ...inputStyle, minHeight: 80, resize: 'none' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 16, marginTop: 40 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid rgba(30,30,30,0.1)', borderRadius: 6, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>Cancelar</button>
                    <button onClick={onCreate} style={{ flex: 1, padding: '12px', background: '#1E1E1E', color: '#FFF', border: 'none', borderRadius: 6, fontWeight: 500, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>Criar campanha</button>
                </div>
            </motion.div>
        </div>
    )
}

function AddCreatorModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, email: string) => void }) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,30,30,0.4)', backdropFilter: 'blur(4px)' }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} style={{ width: '100%', maxWidth: 400, background: '#FCF8F8', borderRadius: 12, padding: 40, position: 'relative', zIndex: 1101, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontFamily: "'Poppins', sans-serif", margin: '0 0 8px', fontSize: 20 }}>Adicionar Criador</h3>
                <p style={{ color: 'rgba(30,30,30,0.5)', fontSize: 13, marginBottom: 24 }}>Geraremos um link exclusivo para ele.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={labelStyle}>NOME DO CRIADOR</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Felipe Neto" style={inputStyle} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={labelStyle}>EMAIL</label>
                        <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@contato.com" style={inputStyle} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid rgba(30,30,30,0.1)', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={() => onAdd(name, email)} style={{ flex: 1, padding: '10px', background: '#1E1E1E', color: '#FFF', border: 'none', borderRadius: 6, fontWeight: 500, cursor: 'pointer' }}>Confirmar</button>
                </div>
            </motion.div>
        </div>
    )
}

function PaymentConfirmModal({ creator, onClose, onConfirm }: { creator: Creator; onClose: () => void; onConfirm: () => void }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,30,30,0.4)', backdropFilter: 'blur(4px)' }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} style={{ width: '100%', maxWidth: 400, background: '#FCF8F8', borderRadius: 12, padding: 40, position: 'relative', zIndex: 1201, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontFamily: "'Poppins', sans-serif", margin: '0 0 8px', fontSize: 20 }}>Confirmar Pagamento</h3>
                <p style={{ color: 'rgba(30,30,30,0.5)', fontSize: 13, marginBottom: 24 }}>Deseja registrar o pagamento para <strong>{creator.name}</strong>?</p>

                <div style={{ background: 'rgba(30,30,30,0.03)', padding: 20, borderRadius: 8, textAlign: 'center', marginBottom: 32 }}>
                    <span style={{ fontSize: 10, color: 'rgba(30,30,30,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>VALOR A PAGAR</span>
                    <p style={{ fontSize: 32, fontWeight: 500, margin: '8px 0 0', color: '#1E1E1E' }}>R$ {creator.commission.toLocaleString('pt-BR')}</p>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid rgba(30,30,30,0.1)', borderRadius: 6, cursor: 'pointer' }}>Voltar</button>
                    <button onClick={onConfirm} style={{ flex: 1, padding: '10px', background: '#1E1E1E', color: '#FFF', border: 'none', borderRadius: 6, fontWeight: 500, cursor: 'pointer' }}>Confirmar Payout</button>
                </div>
            </motion.div>
        </div>
    )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function Criadores({ onToggleChat }: { onToggleChat?: () => void }) {
    const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS)
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
    const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false)
    const [isAddCreatorOpen, setIsAddCreatorOpen] = useState(false)
    const [creatorToPay, setCreatorToPay] = useState<Creator | null>(null)

    const selectedCampaign = useMemo(() =>
        campaigns.find(c => c.id === selectedCampaignId),
        [campaigns, selectedCampaignId])

    const globalKPIs = useMemo(() => {
        let paid = 0, pending = 0, sales = 0, revenue = 0, creators = 0
        campaigns.forEach(camp => {
            creators += camp.creators.length
            camp.creators.forEach(c => {
                sales += c.sales
                revenue += c.revenue
                if (c.status === 'pago') paid += c.commission
                else pending += c.commission
            })
        })
        return { paid, pending, sales, ticket: sales > 0 ? (revenue / sales).toFixed(2) : 0, creators }
    }, [campaigns])

    const handleCreateCampaign = () => {
        // Mock creation
        setIsNewCampaignOpen(false)
    }

    const handleAddCreator = (name: string, email: string) => {
        if (!selectedCampaignId) return
        const slug = name.toLowerCase().replace(/ /g, '-')
        const newCreator: Creator = {
            id: Math.random().toString(),
            name,
            email,
            affiliateLink: `northie.co/ref/${slug}`,
            sales: 0,
            revenue: 0,
            commission: 0,
            status: 'pendente'
        }
        setCampaigns(prev => prev.map(c =>
            c.id === selectedCampaignId
                ? { ...c, creators: [newCreator, ...c.creators] }
                : c
        ))
        setIsAddCreatorOpen(false)
    }

    const handleConfirmPayment = () => {
        if (!creatorToPay || !selectedCampaignId) return
        setCampaigns(prev => prev.map(c => ({
            ...c,
            creators: c.creators.map(cre =>
                cre.id === creatorToPay.id
                    ? { ...cre, status: 'pago', paidAt: new Date().toLocaleDateString('pt-BR') }
                    : cre
            )
        })))
        setCreatorToPay(null)
    }

    const handleOpenCampaign = (id: string) => {
        setSelectedCampaignId(id)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    return (
        <div style={{ paddingTop: 28, paddingBottom: 80 }}>
            <TopBar onToggleChat={onToggleChat} />

            <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                    fontFamily: "'Poppins', sans-serif", fontWeight: 400, fontSize: 40,
                    letterSpacing: '-1.6px', color: '#1E1E1E', margin: 0
                }}
            >
                Portal de Criadores
            </motion.h1>

            <AnimatePresence mode="wait">
                {!selectedCampaignId ? (
                    <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap', marginTop: 48 }}>
                            <KpiCard label="COMISSÕES PAGAS" value={globalKPIs.paid} prefix="R$ " decimals={0} delay={0.1} />
                            <KpiCard label="COMISSÕES PENDENTES" value={globalKPIs.pending} prefix="R$ " decimals={0} delay={0.2} />
                            <KpiCard label="VENDAS VIA CRIADOR" value={globalKPIs.sales} decimals={0} delay={0.3} />
                            <KpiCard label="CRIADORES ATIVOS" value={globalKPIs.creators} decimals={0} delay={0.4} />
                        </div>

                        <div style={{ marginTop: 80 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
                                <div>
                                    <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 24, fontWeight: 400, margin: 0, letterSpacing: '-0.8px' }}>Campanhas Ativas</h2>
                                    <p style={{ color: 'rgba(30,30,30,0.5)', fontSize: 14, marginTop: 4 }}>Gerencie suas parcerias e ofertas abertas.</p>
                                </div>
                                <motion.button
                                    onClick={() => setIsNewCampaignOpen(true)}
                                    whileHover={{ scale: 1.02, backgroundColor: '#1E1E1E', color: '#FFF' }}
                                    whileTap={{ scale: 0.98 }}
                                    style={{
                                        padding: '12px 24px', borderRadius: 6, border: '1px solid #1E1E1E',
                                        background: 'transparent', cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
                                        fontSize: 14, fontWeight: 500, transition: 'all 0.2s'
                                    }}
                                >
                                    Nova campanha
                                </motion.button>
                            </div>

                            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                {campaigns.map(camp => {
                                    const rev = camp.creators.reduce((a, c) => a + c.revenue, 0)
                                    const com = camp.creators.reduce((a, c) => a + c.commission, 0)
                                    const sales = camp.creators.reduce((a, c) => a + c.sales, 0)
                                    const roi = com > 0 ? (rev / com).toFixed(1) : '—'

                                    return (
                                        <motion.div
                                            key={camp.id}
                                            onClick={() => handleOpenCampaign(camp.id)}
                                            whileHover={{ y: -6, borderColor: 'rgba(30,30,30,0.2)' }}
                                            style={{
                                                padding: 32, borderRadius: 12, border: '1px solid rgba(30,30,30,0.08)',
                                                background: '#FFF', display: 'flex', flexDirection: 'column', gap: 24,
                                                cursor: 'pointer', minWidth: 320, flex: '1 1 320px', transition: 'border-color 0.2s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 18, fontWeight: 500, margin: 0 }}>{camp.name}</h3>
                                                    <p style={{ fontSize: 13, color: 'rgba(30,30,30,0.5)', marginTop: 4 }}>{camp.product}</p>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <span style={{ fontSize: 9, fontFamily: "'Geist Mono', monospace", color: 'rgba(30,30,30,0.4)' }}>ROI</span>
                                                    <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>{roi}x</p>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                                                <div>
                                                    <SectionLabel>COMISSÃO</SectionLabel>
                                                    <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{camp.commissionType === 'percentual' ? `${camp.commissionValue}%` : `R$ ${camp.commissionValue}`}</p>
                                                </div>
                                                <div>
                                                    <SectionLabel>VENDAS</SectionLabel>
                                                    <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{sales}</p>
                                                </div>
                                                <div>
                                                    <SectionLabel>TOTAL PAGO</SectionLabel>
                                                    <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>R$ {camp.creators.filter(c => c.status === 'pago').reduce((a, c) => a + c.commission, 0).toLocaleString('pt-BR')}</p>
                                                </div>
                                                <div>
                                                    <SectionLabel>PRAZO</SectionLabel>
                                                    <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{new Date(camp.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                                                </div>
                                            </div>

                                            <div style={{ height: 1, background: 'rgba(30,30,30,0.05)' }} />

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    {camp.creators.slice(0, 3).map((cre, idx) => (
                                                        <div key={cre.id} style={{ width: 24, height: 24, borderRadius: '50%', background: '#FCF8F8', border: '1px solid rgba(30,30,30,0.1)', marginLeft: idx > 0 ? -8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>{cre.name[0]}</div>
                                                    ))}
                                                    {camp.creators.length > 3 && <div style={{ fontSize: 11, color: 'rgba(30,30,30,0.4)', alignSelf: 'center', marginLeft: 4 }}>+{camp.creators.length - 3}</div>}
                                                </div>
                                                <p style={{ fontSize: 11, color: 'rgba(30,30,30,0.4)', fontWeight: 500 }}>{camp.creators.length} criadores ativos</p>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <CampaignDetails
                        key="details"
                        campaign={selectedCampaign!}
                        onBack={() => setSelectedCampaignId(null)}
                        onAddCreator={() => setIsAddCreatorOpen(true)}
                        onPayCreator={setCreatorToPay}
                    />
                )}
            </AnimatePresence>

            {/* Modals */}
            <AnimatePresence>
                {isNewCampaignOpen && (
                    <NewCampaignModal onClose={() => setIsNewCampaignOpen(false)} onCreate={handleCreateCampaign} />
                )}
                {isAddCreatorOpen && (
                    <AddCreatorModal onClose={() => setIsAddCreatorOpen(false)} onAdd={handleAddCreator} />
                )}
                {creatorToPay && (
                    <PaymentConfirmModal creator={creatorToPay} onClose={() => setCreatorToPay(null)} onConfirm={handleConfirmPayment} />
                )}
            </AnimatePresence>
        </div>
    )
}
