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
            textTransform: 'uppercase',
            fontWeight: 500
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
    fontSize: 10, fontWeight: 600, color: 'rgba(30,30,30,0.4)', letterSpacing: '0.05em', marginBottom: 8,
    fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase'
}

const thBaseStyle: React.CSSProperties = {
    padding: '16px 0', fontSize: 10, fontWeight: 500, color: 'rgba(30,30,30,0.4)',
    letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Geist Mono', monospace"
}

const tdBaseStyle: React.CSSProperties = {
    padding: '20px 0', fontSize: 14, color: '#1E1E1E',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 400
}

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
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        color: 'rgba(30,30,30,0.5)',
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: 14,
                        fontWeight: 500
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                    Voltar para campanhas
                </motion.button>
            </div>

            <div style={{
                background: '#FFF',
                border: '1px solid rgba(30,30,30,0.06)',
                borderRadius: 24,
                padding: '56px 48px',
                marginBottom: 64,
                boxShadow: '0 4px 30px rgba(0,0,0,0.02)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 64 }}>
                    <div>
                        <h2 style={{
                            fontFamily: "'Poppins', sans-serif",
                            fontSize: 40,
                            fontWeight: 500,
                            margin: 0,
                            letterSpacing: '-1.8px',
                            color: '#1E1E1E'
                        }}>
                            {campaign.name}
                        </h2>
                        <p style={{
                            fontFamily: "'Poppins', sans-serif",
                            fontSize: 18,
                            color: 'rgba(30,30,30,0.4)',
                            marginTop: 12,
                            letterSpacing: '-0.2px'
                        }}>
                            {campaign.product} · {campaign.commissionType === 'percentual' ? `${campaign.commissionValue}%` : `R$ ${campaign.commissionValue}`} de comissão
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{
                            fontSize: 11,
                            fontFamily: "'Geist Mono', monospace",
                            color: 'rgba(30,30,30,0.3)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            fontWeight: 500
                        }}>
                            ROI DA CAMPANHA
                        </span>
                        <p style={{
                            fontSize: 72,
                            fontFamily: "'Poppins', sans-serif",
                            fontWeight: 500,
                            margin: '4px 0 0',
                            color: '#1E1E1E',
                            letterSpacing: '-2px'
                        }}>
                            {roi}x
                        </p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40 }}>
                    {[
                        { label: 'VENDAS', val: salesCount, prefix: '' },
                        { label: 'RECEITA TOTAL', val: `R$ ${totalRevenue.toLocaleString('pt-BR')}`, prefix: '' },
                        { label: 'COMISSÕES', val: `R$ ${totalCommission.toLocaleString('pt-BR')}`, prefix: '' },
                        { label: 'PRAZO', val: new Date(campaign.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase(), prefix: '' },
                    ].map((item, idx) => (
                        <div key={idx} style={{ borderLeft: '1px solid rgba(30,30,30,0.08)', paddingLeft: 24 }}>
                            <SectionLabel>{item.label}</SectionLabel>
                            <p style={{ fontSize: 24, fontWeight: 500, margin: 0, letterSpacing: '-0.5px' }}>{item.val}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <SectionLabel>CRIADORES PARTICIPANTES</SectionLabel>
                <motion.button
                    onClick={onAddCreator}
                    whileHover={{ scale: 1.02, backgroundColor: '#1E1E1E', color: '#FFF' }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        padding: '12px 24px', borderRadius: 8, border: '1px solid #1E1E1E',
                        background: 'transparent', cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
                        fontSize: 14, fontWeight: 500, transition: 'all 0.2s'
                    }}
                >
                    Adicionar criador
                </motion.button>
            </div>

            <div style={{ background: '#FFF', borderRadius: 16, border: '1px solid rgba(30,30,30,0.06)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(30,30,30,0.08)', background: 'rgba(30,30,30,0.01)' }}>
                            <th style={{ ...thBaseStyle, paddingLeft: 24, textAlign: 'left' }}>NOME</th>
                            <th style={{ ...thBaseStyle, textAlign: 'left' }}>LINK</th>
                            <th style={{ ...thBaseStyle, textAlign: 'right' }}>VENDAS</th>
                            <th style={{ ...thBaseStyle, textAlign: 'right' }}>RECEITA</th>
                            <th style={{ ...thBaseStyle, textAlign: 'right' }}>COMISSÃO</th>
                            <th style={{ ...thBaseStyle, textAlign: 'left' }}>STATUS</th>
                            <th style={{ ...thBaseStyle, paddingRight: 24, textAlign: 'right' }}>AÇÕES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {campaign.creators.map(creator => (
                            <motion.tr
                                key={creator.id}
                                whileHover={{ backgroundColor: 'rgba(30,30,30,0.01)' }}
                                style={{ borderBottom: '1px solid rgba(30,30,30,0.04)', transition: 'background 0.2s' }}
                            >
                                <td style={{ ...tdBaseStyle, paddingLeft: 24, fontWeight: 500 }}>{creator.name}</td>
                                <td style={{ ...tdBaseStyle, fontFamily: "'Geist Mono', monospace", color: 'rgba(30,30,30,0.4)', fontSize: 13 }}>{creator.affiliateLink}</td>
                                <td style={{ ...tdBaseStyle, textAlign: 'right', fontFamily: "'Geist Mono', monospace" }}>{creator.sales}</td>
                                <td style={{ ...tdBaseStyle, textAlign: 'right', fontFamily: "'Geist Mono', monospace" }}>R$ {creator.revenue.toLocaleString('pt-BR')}</td>
                                <td style={{ ...tdBaseStyle, textAlign: 'right', fontFamily: "'Geist Mono', monospace", fontWeight: 500 }}>R$ {creator.commission.toLocaleString('pt-BR')}</td>
                                <td style={{ ...tdBaseStyle }}>
                                    <span style={{
                                        padding: '4px 10px', borderRadius: 100, fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
                                        backgroundColor: creator.status === 'pago' ? '#1E1E1E' : 'rgba(30,30,30,0.04)',
                                        color: creator.status === 'pago' ? '#FFF' : 'rgba(30,30,30,0.4)',
                                        letterSpacing: '0.04em'
                                    }}>
                                        {creator.status}
                                    </span>
                                </td>
                                <td style={{ ...tdBaseStyle, paddingRight: 24, textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
                                        {creator.status === 'pendente' && (
                                            <button
                                                onClick={() => onPayCreator(creator)}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: '#1E1E1E', fontWeight: 600 }}
                                            >
                                                Pagar
                                            </button>
                                        )}
                                        <button style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: 'rgba(30,30,30,0.4)', fontWeight: 500 }}>Copiar</button>
                                    </div>
                                </td>
                            </motion.tr>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,30,30,0.4)', backdropFilter: 'blur(8px)' }} />
            <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                style={{ width: '100%', maxWidth: 540, background: '#FFF', borderRadius: 24, padding: 48, position: 'relative', zIndex: 1001, boxShadow: '0 32px 80px rgba(0,0,0,0.2)' }}
            >
                <h2 style={{ fontFamily: "'Poppins', sans-serif", margin: '0 0 12px', fontSize: 32, fontWeight: 500, letterSpacing: '-1.2px' }}>Nova Campanha</h2>
                <p style={{ color: 'rgba(30,30,30,0.4)', fontSize: 16, marginBottom: 40 }}>Defina os termos do seu novo programa de criadores.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={labelStyle}>NOME DA CAMPANHA</label>
                        <input placeholder="Ex: Lançamento Coleção Outono" style={inputStyle} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={labelStyle}>PRODUTO VINCULADO</label>
                        <select style={inputStyle}>
                            <option>Northie Pro Plan</option>
                            <option>Módulo Analytics</option>
                            <option>Mentoria Individual</option>
                        </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
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
                        <label style={labelStyle}>DESCRIÇÃO</label>
                        <textarea placeholder="Briefing rápido para os criadores..." style={{ ...inputStyle, minHeight: 100, resize: 'none' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 16, marginTop: 48 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '14px', background: 'none', border: '1px solid rgba(30,30,30,0.1)', borderRadius: 10, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontWeight: 500 }}>Cancelar</button>
                    <button onClick={onCreate} style={{ flex: 1, padding: '14px', background: '#1E1E1E', color: '#FFF', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>Criar campanha</button>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,30,30,0.4)', backdropFilter: 'blur(8px)' }} />
            <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                style={{ width: '100%', maxWidth: 440, background: '#FFF', borderRadius: 24, padding: 48, position: 'relative', zIndex: 1101, boxShadow: '0 32px 80px rgba(0,0,0,0.2)' }}
            >
                <h3 style={{ fontFamily: "'Poppins', sans-serif", margin: '0 0 12px', fontSize: 26, fontWeight: 500, letterSpacing: '-0.8px' }}>Novo Criador</h3>
                <p style={{ color: 'rgba(30,30,30,0.4)', fontSize: 15, marginBottom: 32 }}>Adicione um parceiro para esta campanha.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={labelStyle}>NOME COMPLETO</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Lucas Montano" style={inputStyle} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={labelStyle}>EMAIL DE CONTATO</label>
                        <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="lucas@northie.co" style={inputStyle} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid rgba(30,30,30,0.1)', borderRadius: 10, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontWeight: 500 }}>Cancelar</button>
                    <button onClick={() => onAdd(name, email)} style={{ flex: 1, padding: '12px', background: '#1E1E1E', color: '#FFF', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>Confirmar</button>
                </div>
            </motion.div>
        </div>
    )
}

function PaymentConfirmModal({ creator, onClose, onConfirm }: { creator: Creator; onClose: () => void; onConfirm: () => void }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,30,30,0.4)', backdropFilter: 'blur(8px)' }} />
            <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                style={{ width: '100%', maxWidth: 440, background: '#FFF', borderRadius: 24, padding: 48, position: 'relative', zIndex: 1201, boxShadow: '0 32px 80px rgba(0,0,0,0.2)' }}
            >
                <h3 style={{ fontFamily: "'Poppins', sans-serif", margin: '0 0 12px', fontSize: 26, fontWeight: 500, letterSpacing: '-0.8px' }}>Confirmar Payout</h3>
                <p style={{ color: 'rgba(30,30,30,0.4)', fontSize: 15, marginBottom: 32 }}>Deseja registrar o pagamento para <strong>{creator.name}</strong>?</p>

                <div style={{ background: 'rgba(30,30,30,0.02)', padding: 32, borderRadius: 16, textAlign: 'center', marginBottom: 40, border: '1px dashed rgba(30,30,30,0.1)' }}>
                    <span style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", color: 'rgba(30,30,30,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>VALOR A LIQUIDAR</span>
                    <p style={{ fontSize: 40, fontFamily: "'Poppins', sans-serif", fontWeight: 600, margin: '8px 0 0', color: '#1E1E1E', letterSpacing: '-1.5px' }}>R$ {creator.commission.toLocaleString('pt-BR')}</p>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid rgba(30,30,30,0.1)', borderRadius: 10, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontWeight: 500 }}>Voltar</button>
                    <button onClick={onConfirm} style={{ flex: 1, padding: '12px', background: '#1E1E1E', color: '#FFF', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>Confirmar Pagamento</button>
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
                transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                style={{
                    fontFamily: "'Poppins', sans-serif", fontWeight: 400, fontSize: 40,
                    letterSpacing: '-1.6px', color: '#1E1E1E', margin: 0
                }}
            >
                Creators
            </motion.h1>

            <AnimatePresence mode="wait">
                {!selectedCampaignId ? (
                    <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap', marginTop: 48 }}>
                            <KpiCard label="COMISSÕES PAGAS" value={globalKPIs.paid} prefix="R$ " decimals={0} delay={0.1} />
                            <KpiCard label="PENDENTES" value={globalKPIs.pending} prefix="R$ " decimals={0} delay={0.2} />
                            <KpiCard label="VENDAS VIA CRIADOR" value={globalKPIs.sales} decimals={0} delay={0.3} />
                            <KpiCard label="CRIADORES ATIVOS" value={globalKPIs.creators} decimals={0} delay={0.4} />
                        </div>

                        <div style={{ marginTop: 100 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
                                <div>
                                    <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 26, fontWeight: 500, margin: 0, letterSpacing: '-0.8px' }}>Campanhas</h2>
                                    <p style={{ color: 'rgba(30,30,30,0.4)', fontSize: 15, marginTop: 6 }}>Gerencie seus programas de parcerias.</p>
                                </div>
                                <motion.button
                                    onClick={() => setIsNewCampaignOpen(true)}
                                    whileHover={{ scale: 1.02, backgroundColor: '#1E1E1E', color: '#FFF' }}
                                    whileTap={{ scale: 0.98 }}
                                    style={{
                                        padding: '12px 28px', borderRadius: 10, border: '1px solid #1E1E1E',
                                        background: 'transparent', cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
                                        fontSize: 15, fontWeight: 500, transition: 'all 0.2s'
                                    }}
                                >
                                    Nova campanha
                                </motion.button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 32 }}>
                                {campaigns.map((camp, i) => {
                                    const rev = camp.creators.reduce((a, c) => a + c.revenue, 0)
                                    const com = camp.creators.reduce((a, c) => a + c.commission, 0)
                                    const sales = camp.creators.reduce((a, c) => a + c.sales, 0)
                                    const roi = com > 0 ? (rev / com).toFixed(1) : '—'

                                    return (
                                        <motion.div
                                            key={camp.id}
                                            onClick={() => handleOpenCampaign(camp.id)}
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.4, delay: i * 0.08 }}
                                            whileHover={{ y: -8, boxShadow: '0 12px 40px rgba(0,0,0,0.06)', borderColor: 'rgba(30,30,30,0.1)' }}
                                            style={{
                                                padding: 36,
                                                borderRadius: 20,
                                                border: '1px solid rgba(30,30,30,0.06)',
                                                background: 'rgba(255, 255, 255, 0.7)',
                                                backdropFilter: 'blur(10px)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 28,
                                                cursor: 'pointer',
                                                transition: 'border-color 0.2s, box-shadow 0.2s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.5px' }}>{camp.name}</h3>
                                                    <p style={{ fontSize: 14, color: 'rgba(30,30,30,0.4)', marginTop: 6 }}>{camp.product}</p>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <span style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: 'rgba(30,30,30,0.3)', fontWeight: 600 }}>ROI</span>
                                                    <p style={{ fontSize: 20, fontFamily: "'Poppins', sans-serif", fontWeight: 600, margin: 0 }}>{roi}x</p>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: '24px 0', borderTop: '1px solid rgba(30,30,30,0.04)', borderBottom: '1px solid rgba(30,30,30,0.04)' }}>
                                                <div>
                                                    <SectionLabel>COMISSÃO</SectionLabel>
                                                    <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>{camp.commissionType === 'percentual' ? `${camp.commissionValue}%` : `R$ ${camp.commissionValue}`}</p>
                                                </div>
                                                <div>
                                                    <SectionLabel>VENDAS</SectionLabel>
                                                    <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>{sales}</p>
                                                </div>
                                                <div>
                                                    <SectionLabel>TOTAL PAGO</SectionLabel>
                                                    <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>R$ {camp.creators.filter(c => c.status === 'pago').reduce((a, c) => a + c.commission, 0).toLocaleString('pt-BR')}</p>
                                                </div>
                                                <div>
                                                    <SectionLabel>PRAZO</SectionLabel>
                                                    <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>{new Date(camp.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()}</p>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    {camp.creators.slice(0, 3).map((cre, idx) => (
                                                        <div key={cre.id} style={{
                                                            width: 32, height: 32, borderRadius: 10,
                                                            background: '#1E1E1E', color: '#FFF',
                                                            border: '2px solid #FFF', marginLeft: idx > 0 ? -12 : 0,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: 12, fontWeight: 600,
                                                            boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                                        }}>
                                                            {cre.name[0]}
                                                        </div>
                                                    ))}
                                                    {camp.creators.length > 3 && (
                                                        <div style={{
                                                            width: 32, height: 32, borderRadius: 10,
                                                            background: 'rgba(30,30,30,0.05)', color: 'rgba(30,30,30,0.4)',
                                                            border: '2px solid #FFF', marginLeft: -12,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: 11, fontWeight: 700
                                                        }}>
                                                            +{camp.creators.length - 3}
                                                        </div>
                                                    )}
                                                </div>
                                                <p style={{ fontSize: 12, color: 'rgba(30,30,30,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{camp.creators.length} criadores</p>
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
