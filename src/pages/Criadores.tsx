import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KpiCard } from '../components/KpiCard'
import TopBar from '../components/TopBar'

// ── Types & Mock Data ────────────────────────────────────────────────────────

interface Campaign {
    id: string
    name: string
    product: string
    commission: string // e.g., "15%" or "R$ 50"
    sales: number
    totalPaid: number
}

interface Creator {
    id: string
    name: string
    affiliateLink: string
    sales: number
    revenue: number
    commissionToPay: number
    status: 'pendente' | 'pago'
}

const MOCK_CAMPAIGNS: Campaign[] = [
    { id: '1', name: 'Lançamento Verão', product: 'Northie Pro Plan', commission: '20%', sales: 45, totalPaid: 12400 },
    { id: '2', name: 'Black Friday 2025', product: 'Módulo Analytics', commission: 'R$ 100', sales: 128, totalPaid: 12800 },
]

const MOCK_CREATORS: Creator[] = [
    { id: '1', name: 'Ana Silva', affiliateLink: 'northie.co/ref/ana-silva', sales: 24, revenue: 4800, commissionToPay: 960, status: 'pendente' },
    { id: '2', name: 'Bruno Costa', affiliateLink: 'northie.co/ref/bruno-c', sales: 12, revenue: 2400, commissionToPay: 480, status: 'pago' },
    { id: '3', name: 'Carla Souza', affiliateLink: 'northie.co/ref/carla-influencer', sales: 56, revenue: 11200, commissionToPay: 2240, status: 'pendente' },
]

// ── Components ───────────────────────────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: Campaign }) {
    return (
        <motion.div
            whileHover={{ y: -4, borderColor: 'rgba(30,30,30,0.2)' }}
            style={{
                padding: 24, borderRadius: 8, border: '1px solid rgba(30,30,30,0.1)',
                background: '#FFF', display: 'flex', flexDirection: 'column', gap: 16,
                transition: 'all 0.2s', minWidth: 280, flex: 1
            }}
        >
            <div>
                <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 18, fontWeight: 500, margin: 0, color: '#1E1E1E' }}>
                    {campaign.name}
                </h3>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14, color: 'rgba(30,30,30,0.5)', margin: '4px 0 0' }}>
                    {campaign.product}
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                    <p style={{ fontSize: 10, color: 'rgba(30,30,30,0.4)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comissão</p>
                    <p style={{ fontSize: 16, fontWeight: 500, margin: '4px 0 0', color: '#1E1E1E' }}>{campaign.commission}</p>
                </div>
                <div>
                    <p style={{ fontSize: 10, color: 'rgba(30,30,30,0.4)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vendas</p>
                    <p style={{ fontSize: 16, fontWeight: 500, margin: '4px 0 0', color: '#1E1E1E' }}>{campaign.sales}</p>
                </div>
            </div>

            <div style={{ height: 1, background: 'rgba(30,30,30,0.05)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 10, color: 'rgba(30,30,30,0.4)', margin: 0, textTransform: 'uppercase' }}>Total Pago</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: '#1E1E1E' }}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(campaign.totalPaid)}
                </p>
            </div>
        </motion.div>
    )
}

// ── Main Page Component ─────────────────────────────────────────────────────

export default function Criadores({ onToggleChat }: { onToggleChat?: () => void }) {
    const [isModalOpen, setIsModalOpen] = useState(false)

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

            {/* KPI Section */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap', marginTop: 48 }}
            >
                <KpiCard label="COMISSÕES PAGAS" value={25200} prefix="R$ " decimals={0} delay={0.15} />
                <KpiCard label="VENDAS VIA CRIADOR" value={173} decimals={0} delay={0.25} />
                <KpiCard label="TICKET MÉDIO (REF)" value={214.5} prefix="R$ " decimals={2} delay={0.35} />
                <KpiCard label="CRIADORES ATIVOS" value={12} decimals={0} delay={0.45} />
            </motion.div>

            {/* Campaigns Section */}
            <div style={{ marginTop: 80 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
                    <div>
                        <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 24, fontWeight: 400, margin: 0, letterSpacing: '-0.8px' }}>
                            Campanhas Ativas
                        </h2>
                        <p style={{ color: 'rgba(30,30,30,0.5)', fontSize: 14, marginTop: 4 }}>Gerencie suas parcerias e ofertas abertas.</p>
                    </div>
                    <motion.button
                        onClick={() => setIsModalOpen(true)}
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
                    {MOCK_CAMPAIGNS.map(c => <CampaignCard key={c.id} campaign={c} />)}
                </div>
            </div>

            {/* Creators Table */}
            <div style={{ marginTop: 80 }}>
                <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 24, fontWeight: 400, margin: '0 0 32px', letterSpacing: '-0.8px' }}>
                    Performance por Criador
                </h2>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(30,30,30,0.1)' }}>
                                <th style={tableHeaderStyle}>NOME</th>
                                <th style={tableHeaderStyle}>LINK DE AFILIADO</th>
                                <th style={tableHeaderStyle}>VENDAS</th>
                                <th style={tableHeaderStyle}>RECEITA</th>
                                <th style={tableHeaderStyle}>COMISSÃO</th>
                                <th style={tableHeaderStyle}>STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MOCK_CREATORS.map(creator => (
                                <motion.tr
                                    key={creator.id}
                                    whileHover={{ backgroundColor: 'rgba(30,30,30,0.02)' }}
                                    style={{ borderBottom: '1px solid rgba(30,30,30,0.05)', cursor: 'pointer' }}
                                >
                                    <td style={tableCellStyle}>{creator.name}</td>
                                    <td style={{ ...tableCellStyle, fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'rgba(30,30,30,0.6)' }}>
                                        {creator.affiliateLink}
                                    </td>
                                    <td style={tableCellStyle}>{creator.sales}</td>
                                    <td style={tableCellStyle}>R$ {creator.revenue.toLocaleString('pt-BR')}</td>
                                    <td style={tableCellStyle}>R$ {creator.commissionToPay.toLocaleString('pt-BR')}</td>
                                    <td style={tableCellStyle}>
                                        <span style={{
                                            padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                                            backgroundColor: creator.status === 'pago' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                            color: creator.status === 'pago' ? '#059669' : '#D97706'
                                        }}>
                                            {creator.status}
                                        </span>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Campaign Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
                    }}>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(30,30,30,0.4)', backdropFilter: 'blur(4px)' }}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            style={{
                                width: '100%', maxWidth: 500, background: '#FCF8F8', borderRadius: 12, padding: 40,
                                position: 'relative', zIndex: 1001, boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
                            }}
                        >
                            <h2 style={{ fontFamily: "'Poppins', sans-serif", margin: '0 0 8px', fontSize: 24, letterSpacing: '-0.8px' }}>
                                Nova Campanha
                            </h2>
                            <p style={{ color: 'rgba(30,30,30,0.5)', fontSize: 14, marginBottom: 32 }}>Configure as regras da nova parceria.</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div style={inputGroupStyle}>
                                    <label style={labelStyle}>NOME DA CAMPANHA</label>
                                    <input type="text" placeholder="Ex: Black Friday 2025" style={inputStyle} />
                                </div>
                                <div style={inputGroupStyle}>
                                    <label style={labelStyle}>PRODUTO VINCULADO</label>
                                    <select style={inputStyle}>
                                        <option>Northie Pro Plan</option>
                                        <option>Módulo Analytics</option>
                                        <option>Mentoria Individual</option>
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                    <div style={inputGroupStyle}>
                                        <label style={labelStyle}>TIPO COMISSÃO</label>
                                        <select style={inputStyle}>
                                            <option>Porcentagem (%)</option>
                                            <option>Valor Fixo (R$)</option>
                                        </select>
                                    </div>
                                    <div style={inputGroupStyle}>
                                        <label style={labelStyle}>VALOR</label>
                                        <input type="text" placeholder="20" style={inputStyle} />
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: 40, display: 'flex', gap: 16 }}>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: 6, border: '1px solid rgba(30,30,30,0.1)',
                                        background: 'transparent', cursor: 'pointer', fontFamily: "'Poppins', sans-serif"
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: 6, border: 'none',
                                        background: '#1E1E1E', color: '#FFF', cursor: 'pointer', fontFamily: "'Poppins', sans-serif"
                                    }}
                                >
                                    Criar Campanha
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

const tableHeaderStyle: React.CSSProperties = {
    padding: '16px 0', fontSize: 10, fontWeight: 600, color: 'rgba(30,30,30,0.4)',
    letterSpacing: '0.05em', textTransform: 'uppercase'
}

const tableCellStyle: React.CSSProperties = {
    padding: '20px 0', fontSize: 14, color: '#1E1E1E', fontFamily: "'Poppins', sans-serif"
}

const inputGroupStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 8
}

const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: 'rgba(30,30,30,0.4)', letterSpacing: '0.05em'
}

const inputStyle: React.CSSProperties = {
    padding: '12px 16px', borderRadius: 6, border: '1px solid rgba(30,30,30,0.1)',
    background: '#FFF', fontSize: 14, outline: 'none', fontFamily: "'Poppins', sans-serif"
}
