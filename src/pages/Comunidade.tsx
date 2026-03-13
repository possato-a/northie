import { useState } from 'react'
import { motion } from 'framer-motion'
import TopBar from '../components/layout/TopBar'

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-xs)',
        fontWeight: 500,
        color: 'var(--color-text-tertiary)',
        letterSpacing: '0.08em',
        marginBottom: 16,
        textTransform: 'uppercase',
    }}>
        {children}
    </p>
)

type CommunityTab = 'inicio' | 'eventos' | 'membros' | 'ranking' | 'drops'

export default function Comunidade({ onToggleChat }: { onToggleChat?: () => void }) {
    const [activeTab, setActiveTab] = useState<CommunityTab>('inicio')

    return (
        <div style={{ paddingTop: 28, paddingBottom: 80 }}>
            <TopBar onToggleChat={onToggleChat} />

            {/* Community nav */}
            <nav style={{
                height: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--color-border)',
                marginBottom: 32,
                marginTop: 24,
            }}>
                <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                    {(['inicio', 'eventos', 'membros', 'ranking', 'drops'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-sans)',
                                fontSize: 'var(--text-base)',
                                fontWeight: activeTab === tab ? 500 : 400,
                                color: activeTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                padding: '16px 0',
                                position: 'relative',
                                textTransform: 'capitalize',
                            }}
                        >
                            {tab === 'inicio' ? 'Início' : tab}
                            {activeTab === tab && (
                                <motion.div
                                    layoutId="activeTab"
                                    style={{
                                        position: 'absolute',
                                        bottom: -1,
                                        left: 0,
                                        right: 0,
                                        height: 2,
                                        background: 'var(--color-text-primary)',
                                    }}
                                />
                            )}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            padding: '8px 16px',
                            background: 'var(--color-text-primary)',
                            color: 'var(--color-bg-primary)',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            fontFamily: 'var(--font-sans)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        Novo post
                    </motion.button>
                    <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'var(--color-bg-tertiary)',
                        border: '1px solid var(--color-border)',
                    }} />
                </div>
            </nav>

            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 280px', gap: 40 }}>
                {/* Sidebar esquerda */}
                <aside>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 40 }}>
                        {['Feed', 'Novidades e Bastidores', 'Votações Ativas'].map(item => (
                            <button key={item} style={{
                                textAlign: 'left',
                                background: 'none',
                                border: 'none',
                                padding: '6px 0',
                                fontFamily: 'var(--font-sans)',
                                fontSize: 'var(--text-sm)',
                                color: 'var(--color-text-secondary)',
                                cursor: 'pointer',
                            }}>
                                {item}
                            </button>
                        ))}
                    </div>

                    <div>
                        <SectionLabel>Níveis</SectionLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                { label: 'Inner Circle', count: 12 },
                                { label: 'OGs', count: 48 },
                                { label: 'Members', count: 187 },
                            ].map(level => (
                                <div key={level.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{level.label}</span>
                                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{level.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: 60, borderTop: '1px solid var(--color-border)', paddingTop: 20 }}>
                        <button style={{
                            background: 'none',
                            border: 'none',
                            fontFamily: 'var(--font-sans)',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--color-text-tertiary)',
                            cursor: 'pointer',
                        }}>
                            Configurar Comunidade
                        </button>
                    </div>
                </aside>

                {/* Área central e direita dependem da aba */}
                {activeTab === 'inicio' && <FeedTab />}
                {activeTab === 'drops' && <DropsTab />}
                {activeTab === 'membros' && <MembrosTab />}
                {activeTab === 'ranking' && <RankingTab />}
                {activeTab === 'eventos' && <EventosTab />}
            </div>
        </div>
    )
}

function FeedTab() {
    return (
        <>
            {/* Área central — Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                {/* Banner */}
                <div style={{
                    height: 180,
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--color-text-primary)',
                    position: 'relative',
                    overflow: 'hidden',
                    padding: '28px 32px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                }}>
                    <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 28, fontWeight: 600, color: 'var(--color-bg-primary)', margin: 0, letterSpacing: '-0.5px' }}>Inner Circle Northie</h1>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'rgba(255,255,255,0.6)', margin: '6px 0 0' }}>Sua jornada rumo ao próximo nível começa aqui.</p>
                </div>

                {/* Create Post */}
                <div style={{
                    padding: '20px 24px',
                    background: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-md)',
                    display: 'flex',
                    gap: 16,
                }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-bg-tertiary)', flexShrink: 0 }} />
                    <input
                        placeholder="Criar um post..."
                        style={{
                            flex: 1,
                            background: 'none',
                            border: 'none',
                            outline: 'none',
                            fontFamily: 'var(--font-sans)',
                            fontSize: 'var(--text-base)',
                            color: 'var(--color-text-primary)',
                        }}
                    />
                </div>

                {/* Feed cronológico */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <SectionLabel>Posts Recentes</SectionLabel>
                    <Post
                        author="Matheus Possato"
                        badge="FOUNDER"
                        content="Bem-vindos ao Inner Circle! Este é o nosso espaço para trocarmos estratégias reais sobre escala."
                        date="2h atrás"
                        reactions={12}
                        comments={5}
                        isFounder
                    />
                    <Post
                        author="Ana Silva"
                        badge="INNER CIRCLE"
                        content="Acabei de aplicar o novo playbook de cohort e os resultados foram insanos. Alguém mais testou?"
                        date="5h atrás"
                        reactions={8}
                        comments={2}
                    />
                </div>
            </div>

            {/* Sidebar direita */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                <div>
                    <SectionLabel>Membros Ativos Agora</SectionLabel>
                    <div style={{ display: 'flex' }}>
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} style={{
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                background: 'var(--color-bg-tertiary)',
                                border: '2px solid var(--color-bg-secondary)',
                                marginLeft: i > 1 ? -8 : 0,
                            }} />
                        ))}
                    </div>
                </div>

                <div style={{
                    padding: 24,
                    background: 'var(--color-text-primary)',
                    borderRadius: 'var(--radius-lg)',
                    color: 'var(--color-bg-primary)',
                }}>
                    <SectionLabel><span style={{ color: 'rgba(255,255,255,0.4)' }}>Próximo Drop</span></SectionLabel>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.3px' }}>Template Dashboard Financeiro</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 500, margin: 0 }}>02:14:45</p>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', opacity: 0.4, margin: 0 }}>Restantes</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 500, margin: 0 }}>12/50</p>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', opacity: 0.4, margin: 0 }}>Vagas</p>
                        </div>
                    </div>
                    <button style={{
                        width: '100%',
                        padding: '10px',
                        background: 'var(--color-bg-primary)',
                        color: 'var(--color-text-primary)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}>
                        Me avisar
                    </button>
                </div>

                <div>
                    <SectionLabel>Ranking da Semana</SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {[
                            { name: 'Ana Silva', points: 1250, rank: 1 },
                            { name: 'João Mendes', points: 980, rank: 2 },
                            { name: 'Pedro Lima', points: 850, rank: 3 },
                        ].map(user => (
                            <div key={user.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: user.rank === 1 ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', width: 16 }}>{user.rank}</span>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-bg-tertiary)' }} />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', margin: 0, fontWeight: 500, color: 'var(--color-text-primary)' }}>{user.name}</p>
                                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>{user.points} pts</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>
        </>
    )
}

function Post({ author, badge, content, date, reactions, comments, isFounder = false }: any) {
    return (
        <div style={{
            padding: '20px 24px',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-bg-tertiary)' }} />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>{author}</p>
                            <span style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: 'var(--text-xs)',
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-full)',
                                background: isFounder ? 'var(--color-text-primary)' : 'var(--color-bg-tertiary)',
                                color: isFounder ? 'var(--color-bg-primary)' : 'var(--color-text-tertiary)',
                                letterSpacing: '0.04em',
                                fontWeight: 500,
                            }}>{badge}</span>
                        </div>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>{date}</p>
                    </div>
                </div>
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-primary)', lineHeight: 1.6, margin: '0 0 20px' }}>{content}</p>
            <div style={{ display: 'flex', gap: 24, borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                    <span>🙌</span> {reactions}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                    <span>💬</span> {comments} Comentários
                </div>
            </div>
        </div>
    )
}

// ── Tab Components ───────────────────────────────────────────────────────────

function DropsTab() {
    return (
        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SectionLabel>Drops Ativos</SectionLabel>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        padding: '8px 16px',
                        background: 'var(--color-text-primary)',
                        color: 'var(--color-bg-primary)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 500,
                        cursor: 'pointer',
                    }}
                >
                    Criar Drop
                </motion.button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {[
                    { title: 'Template Dashboard Financeiro', slots: '12/50', revenue: 'R$ 4.800', time: '02:14:45' },
                    { title: 'Playbook de Tráfego Pago v2', slots: '45/100', revenue: 'R$ 15.200', time: '14:20:10' },
                ].map(drop => (
                    <div key={drop.title} style={{
                        padding: '20px 24px',
                        background: 'var(--color-bg-primary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: 'var(--shadow-md)',
                    }}>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 500, margin: '0 0 16px', color: 'var(--color-text-primary)' }}>{drop.title}</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                            {[
                                { label: 'Vagas', value: drop.slots },
                                { label: 'Receita', value: drop.revenue },
                                { label: 'Timer', value: drop.time, highlight: true },
                            ].map(s => (
                                <div key={s.label}>
                                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, margin: '0 0 2px', color: s.highlight ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{s.value}</p>
                                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div>
                <SectionLabel>Histórico de Drops</SectionLabel>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--color-bg-primary)' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{
                            padding: '14px 20px',
                            borderBottom: i < 3 ? '1px solid var(--color-border)' : 'none',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)' }}>Drop Antigo #{i}</span>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Concluído em Jan/25</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function MembrosTab() {
    return (
        <div style={{ gridColumn: 'span 2' }}>
            <SectionLabel>Lista de Membros</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                    { name: 'Ana Silva', level: 'Inner Circle', points: 1250, joined: 'Set/24' },
                    { name: 'João Mendes', level: 'OGs', points: 980, joined: 'Out/24' },
                    { name: 'Pedro Lima', level: 'Members', points: 850, joined: 'Nov/24' },
                    { name: 'Mariana Costa', level: 'Members', points: 720, joined: 'Dez/24' },
                ].map(m => (
                    <div key={m.name} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: '14px 20px',
                        background: 'var(--color-bg-primary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)',
                    }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-bg-tertiary)' }} />
                        <div style={{ flex: 1 }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>{m.name}</p>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>{m.level}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>{m.points} pts</p>
                            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>desde {m.joined}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function RankingTab() {
    return (
        <div style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
                <button style={{ background: 'none', border: 'none', borderBottom: '2px solid var(--color-text-primary)', paddingBottom: 8, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-primary)', cursor: 'pointer' }}>Semanal</button>
                <button style={{ background: 'none', border: 'none', paddingBottom: 8, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-tertiary)', cursor: 'pointer' }}>Mensal</button>
            </div>

            <div style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '48px 1fr 140px 100px',
                    padding: '10px 20px',
                    borderBottom: '1px solid var(--color-border)',
                    background: 'var(--color-bg-secondary)',
                }}>
                    {['Pos', 'Membro', 'Nível', 'Pontos'].map((h, i) => (
                        <span key={h} style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 500,
                            color: 'var(--color-text-tertiary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            textAlign: i === 3 ? 'right' : 'left',
                        }}>{h}</span>
                    ))}
                </div>
                {[
                    { rank: 1, name: 'Ana Silva', level: 'Inner Circle', points: 1250 },
                    { rank: 2, name: 'João Mendes', level: 'OGs', points: 980 },
                    { rank: 3, name: 'Pedro Lima', level: 'Members', points: 850 },
                ].map(r => (
                    <div key={r.name} style={{
                        display: 'grid',
                        gridTemplateColumns: '48px 1fr 140px 100px',
                        padding: '14px 20px',
                        borderBottom: '1px solid var(--color-border)',
                        alignItems: 'center',
                    }}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{r.rank}</span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{r.name}</span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>{r.level}</span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', textAlign: 'right' }}>{r.points}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function EventosTab() {
    return (
        <div style={{ gridColumn: 'span 2' }}>
            <SectionLabel>Próximos Eventos</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 40 }}>
                {[
                    { title: 'Live de Mentoria Estratégica', date: '25 Fev, 19:00', type: 'LIVE' },
                    { title: 'Q&A: Lançamento em 7 Dias', date: '28 Fev, 15:00', type: 'Q&A' },
                ].map(ev => (
                    <div key={ev.title} style={{
                        padding: '20px 24px',
                        background: 'var(--color-bg-primary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: 'var(--shadow-md)',
                    }}>
                        <span style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 500,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--color-bg-tertiary)',
                            color: 'var(--color-text-secondary)',
                            letterSpacing: '0.04em',
                        }}>{ev.type}</span>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 500, margin: '12px 0 6px', color: 'var(--color-text-primary)' }}>{ev.title}</p>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: '0 0 20px' }}>{ev.date}</p>
                        <button style={{
                            width: '100%',
                            padding: '10px',
                            background: 'var(--color-text-primary)',
                            color: 'var(--color-bg-primary)',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}>Me inscrever</button>
                    </div>
                ))}
            </div>

            <SectionLabel>Replays Passados</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {[1, 2].map(i => (
                    <div key={i} style={{
                        height: 120,
                        background: 'var(--color-bg-secondary)',
                        border: '1px dashed var(--color-border)',
                        borderRadius: 'var(--radius-lg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-text-tertiary)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                    }}>
                        ▶ Replay em breve
                    </div>
                ))}
            </div>
        </div>
    )
}
