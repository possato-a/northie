import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '../components/layout/TopBar'
import { KpiCard } from '../components/ui/KpiCard'
import { PageHeader, Divider, Btn, SectionLabel, Modal, Input, TH, NotionRow, EmptyState } from '../components/ui/shared'

interface PageProps {
    onToggleChat: () => void
}

interface DataRoom {
    id: string
    name: string
    status: 'active' | 'archived' | 'expired'
    northie_score: number
    views_count: number
    last_viewed_at: string | null
    expires_at: string | null
    access_token: string
    created_at: string
}

// ── Northie Score Ring ────────────────────────────────────────────
function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
    const radius = (size - 8) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (score / 100) * circumference
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke="var(--color-border)" strokeWidth={4} />
                <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke="var(--color-text-primary)" strokeWidth={4}
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                    strokeLinecap="round" />
            </svg>
            <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13, fontWeight: 600,
                    color: 'var(--color-text-primary)',
                }}>
                    {score}
                </span>
            </div>
        </div>
    )
}

// ── Status badge ──────────────────────────────────────────────────
const ROOM_STATUS: Record<string, { label: string; cls: string }> = {
    active: { label: 'Ativo', cls: 'tag-complete' },
    archived: { label: 'Arquivado', cls: 'tag-neutral' },
    expired: { label: 'Expirado', cls: 'tag-planning' },
}

// ── Modal de novo data room ───────────────────────────────────────
function NewRoomModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
    const [name, setName] = useState('')
    return (
        <Modal onClose={onClose} title="Novo Data Room">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6,
                }}>
                    O data room é gerado automaticamente com as métricas reais do seu negócio. Você controla quem vê o quê via permissões.
                </p>
                <Input
                    label="Nome do data room"
                    placeholder="Ex: Rodada Seed — Mar 2026"
                    value={name}
                    onChange={e => setName(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
                    <Btn variant="primary" disabled={!name.trim()} onClick={() => onCreate(name)}>
                        Criar Data Room
                    </Btn>
                </div>
            </div>
        </Modal>
    )
}

// ── Modal de detalhes do data room ────────────────────────────────
function RoomDetailModal({ room, onClose }: { room: DataRoom; onClose: () => void }) {
    const link = `https://northie.app/raise/${room.access_token}`
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Modal onClose={onClose} title={room.name}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Northie Score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <ScoreRing score={room.northie_score} size={72} />
                    <div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', margin: '0 0 4px' }}>
                            Northie Score
                        </p>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>
                            Índice de saúde calculado automaticamente com base em faturamento, LTV, churn e CAC.
                        </p>
                    </div>
                </div>

                <Divider margin="0" />

                {/* Link de acesso */}
                <div>
                    <SectionLabel gutterBottom={12}>Link de acesso</SectionLabel>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{
                            flex: 1, fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
                            background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)', padding: '8px 14px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {link}
                        </div>
                        <Btn variant="secondary" size="sm" onClick={handleCopy}>
                            {copied ? 'Copiado!' : 'Copiar'}
                        </Btn>
                    </div>
                </div>

                {/* Permissões */}
                <div>
                    <SectionLabel gutterBottom={12}>Métricas visíveis para investidores</SectionLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {[
                            { label: 'Faturamento', enabled: true },
                            { label: 'MRR / ARR', enabled: true },
                            { label: 'LTV médio', enabled: true },
                            { label: 'CAC por canal', enabled: false },
                            { label: 'Churn rate', enabled: false },
                            { label: 'Cohort de retenção', enabled: false },
                            { label: 'Canais de aquisição', enabled: false },
                            { label: 'Valuation', enabled: false },
                        ].map((perm) => (
                            <div key={perm.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                                    background: perm.enabled ? 'var(--color-text-primary)' : 'var(--color-border)',
                                }} />
                                <span style={{
                                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                                    color: perm.enabled ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                }}>
                                    {perm.label}
                                </span>
                            </div>
                        ))}
                    </div>
                    <p style={{
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                        color: 'var(--color-text-tertiary)', margin: '12px 0 0',
                    }}>
                        Configuração de permissões disponível em breve.
                    </p>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 32 }}>
                    <div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', margin: '0 0 4px' }}>Views</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{room.views_count}</p>
                    </div>
                    <div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', margin: '0 0 4px' }}>Último acesso</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                            {room.last_viewed_at ? new Date(room.last_viewed_at).toLocaleDateString('pt-BR') : '—'}
                        </p>
                    </div>
                </div>
            </div>
        </Modal>
    )
}

export default function Raise({ onToggleChat }: PageProps) {
    const [showNewRoom, setShowNewRoom] = useState(false)
    const [selectedRoom, setSelectedRoom] = useState<DataRoom | null>(null)

    // Mock data — será substituído pela API quando backend Raise estiver pronto
    const northieScore = 71
    const rooms: DataRoom[] = [
        {
            id: '1',
            name: 'Rodada Seed — Mar 2026',
            status: 'active',
            northie_score: 71,
            views_count: 12,
            last_viewed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            expires_at: null,
            access_token: 'abc123def456',
            created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
            id: '2',
            name: 'Due Diligence — Investidor Anjo',
            status: 'archived',
            northie_score: 68,
            views_count: 4,
            last_viewed_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            expires_at: null,
            access_token: 'xyz789uvw012',
            created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        },
    ]

    const handleCreate = (_name: string) => {
        setShowNewRoom(false)
        // TODO: chamar API e atualizar lista
    }

    return (
        <div style={{ paddingTop: 28, paddingBottom: 80 }}>
            <TopBar onToggleChat={onToggleChat} />

            <PageHeader
                title="Northie Raise"
                subtitle="Métricas auditadas para founders que querem captar ou vender o negócio."
                actions={
                    <Btn variant="primary" size="sm" onClick={() => setShowNewRoom(true)}>
                        + Novo Data Room
                    </Btn>
                }
            />

            {/* KPIs */}
            <div style={{ display: 'flex', gap: 48, marginTop: 40, flexWrap: 'wrap' }}>
                <KpiCard label="NORTHIE SCORE" value={northieScore} suffix="/100" delay={0.10} />
                <KpiCard label="DATA ROOMS ATIVOS" value={rooms.filter(r => r.status === 'active').length} delay={0.20} />
                <KpiCard label="TOTAL DE VIEWS" value={rooms.reduce((a, r) => a + r.views_count, 0)} delay={0.30} />
                <KpiCard label="ÚLTIMO ACESSO" value={2} suffix="d atrás" delay={0.40} />
            </div>

            <Divider margin="48px 0" />

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 64 }}>
                {/* Lista de data rooms */}
                <div>
                    <SectionLabel>Data rooms</SectionLabel>

                    {rooms.length === 0 ? (
                        <EmptyState
                            title="Nenhum data room criado"
                            description="Crie seu primeiro data room para compartilhar métricas auditadas com investidores."
                        />
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3, delay: 0.1 }}
                            style={{ marginTop: 20 }}
                        >
                            {/* Header */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 56px 60px 80px',
                                gap: 16,
                                padding: '0 0 8px',
                                borderBottom: '1px solid var(--color-border)',
                                marginBottom: 4,
                            }}>
                                <TH>NOME</TH>
                                <TH align="center">SCORE</TH>
                                <TH align="center">VIEWS</TH>
                                <TH align="right">STATUS</TH>
                            </div>

                            {rooms.map((room, i) => (
                                <motion.div
                                    key={room.id}
                                    initial={{ opacity: 0, x: -4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 + i * 0.07, duration: 0.25 }}
                                >
                                <NotionRow
                                    onClick={() => setSelectedRoom(room)}
                                >
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 56px 60px 80px',
                                        gap: 16,
                                        alignItems: 'center',
                                    }}>
                                        <div>
                                            <p style={{
                                                fontFamily: 'var(--font-sans)',
                                                fontSize: 'var(--text-base)',
                                                color: 'var(--color-text-primary)',
                                                margin: '0 0 2px',
                                                fontWeight: 500,
                                            }}>
                                                {room.name}
                                            </p>
                                            <p style={{
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: 11,
                                                color: 'var(--color-text-tertiary)',
                                                margin: 0,
                                            }}>
                                                Criado em {new Date(room.created_at).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <ScoreRing score={room.northie_score} size={40} />
                                        </div>
                                        <p style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: 'var(--text-sm)',
                                            color: 'var(--color-text-primary)',
                                            textAlign: 'center',
                                            margin: 0,
                                        }}>
                                            {room.views_count}
                                        </p>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <span className={`tag ${ROOM_STATUS[room.status].cls}`}>
                                                {ROOM_STATUS[room.status].label}
                                            </span>
                                        </div>
                                    </div>
                                </NotionRow>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </div>

                {/* Northie Score breakdown */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
                >
                    <div>
                        <SectionLabel>Northie Score</SectionLabel>
                        <div style={{
                            marginTop: 20,
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 24,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 20,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                <ScoreRing score={northieScore} size={72} />
                                <div>
                                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '0 0 4px', lineHeight: 1.5 }}>
                                        Índice de saúde do negócio calculado com base em todas as suas integrações.
                                    </p>
                                    <span className="tag tag-complete">Acima da média</span>
                                </div>
                            </div>
                            {[
                                { label: 'Consistência de receita', value: 82 },
                                { label: 'Qualidade da base de clientes', value: 70 },
                                { label: 'Eficiência de aquisição', value: 65 },
                                { label: 'Saúde do caixa', value: 68 },
                            ].map((dim, i) => (
                                <div key={dim.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                                            {dim.label}
                                        </span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                                            {dim.value}
                                        </span>
                                    </div>
                                    <div style={{ height: 3, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${dim.value}%` }}
                                            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 + i * 0.1 }}
                                            style={{
                                                height: '100%',
                                                background: 'rgba(var(--fg-rgb), 0.65)',
                                                borderRadius: 'var(--radius-full)',
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Métricas auditadas */}
                    <div>
                        <SectionLabel>Métricas disponíveis</SectionLabel>
                        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                { label: 'Faturamento bruto', value: 'R$ 47.200', source: 'Hotmart' },
                                { label: 'MRR', value: 'R$ 12.400', source: 'Stripe' },
                                { label: 'LTV médio', value: 'R$ 890', source: 'Northie' },
                                { label: 'CAC médio', value: 'R$ 124', source: 'Meta Ads' },
                                { label: 'Churn rate', value: '3.2%', source: 'Northie' },
                            ].map((m) => (
                                <div key={m.label} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '10px 0',
                                    borderBottom: '1px solid var(--color-border)',
                                }}>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                                        {m.label}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                                            {m.value}
                                        </span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.05em' }}>
                                            {m.source}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Modais */}
            <AnimatePresence>
                {showNewRoom && (
                    <NewRoomModal onClose={() => setShowNewRoom(false)} onCreate={handleCreate} />
                )}
                {selectedRoom && (
                    <RoomDetailModal room={selectedRoom} onClose={() => setSelectedRoom(null)} />
                )}
            </AnimatePresence>
        </div>
    )
}
