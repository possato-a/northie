import { useState } from 'react'
import { motion } from 'framer-motion'

// Icons (mocking some if not in icons.tsx, but I'll try to use standard SVG or existing ones)
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.4)', letterSpacing: '0.08em', marginBottom: 16, textTransform: 'uppercase' }}>
        {children}
    </p>
)

type CommunityTab = 'inicio' | 'eventos' | 'membros' | 'ranking' | 'drops'

export default function Comunidade() {
    const [activeTab, setActiveTab] = useState<CommunityTab>('inicio')

    return (
        <div style={{ padding: '0 40px 40px', maxWidth: 1600, margin: '0 auto' }}>
            {/* BLOCO 1 — Navbar superior (estilo Circle) */}
            <nav style={{
                height: 72,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(var(--fg-rgb), 0.08)',
                marginBottom: 32,
                position: 'sticky',
                top: 0,
                background: 'var(--bg)',
                zIndex: 50
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
                                fontFamily: "'Poppins', sans-serif",
                                fontSize: 14,
                                fontWeight: activeTab === tab ? 500 : 400,
                                color: activeTab === tab ? 'var(--fg)' : 'rgba(var(--fg-rgb), 0.45)',
                                padding: '24px 0',
                                position: 'relative',
                                textTransform: 'capitalize'
                            }}
                        >
                            {tab === 'inicio' ? 'Início' : tab}
                            {activeTab === tab && (
                                <motion.div
                                    layoutId="activeTab"
                                    style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'var(--fg)' }}
                                />
                            )}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            padding: '10px 20px',
                            background: 'var(--inv)',
                            color: 'var(--on-inv)',
                            border: 'none',
                            borderRadius: 6,
                            fontFamily: "'Poppins', sans-serif",
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: 'pointer'
                        }}
                    >
                        Novo post
                    </motion.button>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(var(--fg-rgb), 0.1)', border: '1px solid rgba(var(--fg-rgb), 0.1)' }} />
                </div>
            </nav>

            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 300px', gap: 48 }}>
                {/* BLOCO 2 — Sidebar esquerda */}
                <aside>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 48 }}>
                        {['Feed', 'Novidades e Bastidores', 'Votações Ativas'].map(item => (
                            <button key={item} style={{
                                textAlign: 'left', background: 'none', border: 'none', padding: '8px 0',
                                fontFamily: "'Poppins', sans-serif", fontSize: 14, color: 'rgba(var(--fg-rgb), 0.7)', cursor: 'pointer'
                            }}>
                                {item}
                            </button>
                        ))}
                    </div>

                    <div>
                        <SectionLabel>NÍVEIS</SectionLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[
                                { label: 'Inner Circle', count: 12 },
                                { label: 'OGs', count: 48 },
                                { label: 'Members', count: 187 }
                            ].map(level => (
                                <div key={level.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                    <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: 'rgba(var(--fg-rgb), 0.7)' }}>{level.label}</span>
                                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.3)' }}>{level.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: 80, borderTop: '1px solid rgba(var(--fg-rgb), 0.06)', paddingTop: 24 }}>
                        <button style={{ background: 'none', border: 'none', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: 'rgba(var(--fg-rgb), 0.4)', cursor: 'pointer' }}>
                            Configurar Comunidade
                        </button>
                    </div>
                </aside>

                {/* ÁREAS CENTRAIS E DIREITA DEPENDEM DA ABA */}
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
            {/* BLOCO 3 — Área central — Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                {/* Banner */}
                <div style={{ height: 200, borderRadius: 12, background: 'linear-gradient(135deg, var(--inv) 0%, rgba(var(--fg-rgb), 0.8) 100%)', position: 'relative', overflow: 'hidden', padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 32, fontWeight: 500, color: 'var(--on-inv)', margin: 0, letterSpacing: '-1px' }}>Inner Circle Northie</h1>
                    <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15, color: 'rgba(var(--on-inv-rgb, 252, 248, 248), 0.7)', margin: '8px 0 0' }}>Sua jornada rumo ao próximo nível começa aqui.</p>
                </div>

                {/* Create Post */}
                <div style={{ padding: 24, background: 'var(--surface)', border: '1px solid rgba(var(--fg-rgb), 0.08)', borderRadius: 12, display: 'flex', gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(var(--fg-rgb), 0.1)', flexShrink: 0 }} />
                    <input
                        placeholder="Criar um post..."
                        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: "'Poppins', sans-serif", fontSize: 15 }}
                    />
                </div>

                {/* Cronológico Feed */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <SectionLabel>POSTS RECENTES</SectionLabel>
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

            {/* BLOCO 4 — Sidebar direita */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
                <div>
                    <SectionLabel>MEMBROS ATIVOS AGORA</SectionLabel>
                    <div style={{ display: 'flex', gap: -8 }}>
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(var(--fg-rgb), 0.1)', border: '2px solid var(--bg)', marginLeft: i > 1 ? -8 : 0 }} />
                        ))}
                    </div>
                </div>

                <div style={{ padding: 24, background: 'var(--inv)', borderRadius: 12, color: 'var(--on-inv)' }}>
                    <SectionLabel><span style={{ color: 'rgba(var(--on-inv-rgb, 252, 248, 248), 0.4)' }}>PRÓXIMO DROP</span></SectionLabel>
                    <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.5px' }}>Template Dashboard Financeiro</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div>
                            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 18, margin: 0 }}>02:14:45</p>
                            <p style={{ fontSize: 9, opacity: 0.4 }}>RESTANTES</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 18, margin: 0 }}>12/50</p>
                            <p style={{ fontSize: 9, opacity: 0.4 }}>VAGAS PREENCHIDAS</p>
                        </div>
                    </div>
                    <button style={{ width: '100%', padding: '12px', background: 'var(--on-inv)', color: 'var(--inv)', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                        Me avisar
                    </button>
                </div>

                <div>
                    <SectionLabel>RANKING DA SEMANA</SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {[
                            { name: 'Ana Silva', points: 1250, rank: 1 },
                            { name: 'João Mendes', points: 980, rank: 2 },
                            { name: 'Pedro Lima', points: 850, rank: 3 }
                        ].map(user => (
                            <div key={user.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, color: user.rank === 1 ? 'var(--fg)' : 'rgba(var(--fg-rgb), 0.3)' }}>{user.rank}</span>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(var(--fg-rgb), 0.1)' }} />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, margin: 0, fontWeight: 500 }}>{user.name}</p>
                                    <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'rgba(var(--fg-rgb), 0.4)', margin: 0 }}>{user.points} pts</p>
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
        <div style={{ padding: 24, background: 'var(--surface)', border: '1px solid rgba(var(--fg-rgb), 0.08)', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(var(--fg-rgb), 0.1)' }} />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14, fontWeight: 500, margin: 0 }}>{author}</p>
                            <span style={{
                                fontFamily: "'Geist Mono', monospace", fontSize: 9,
                                padding: '2px 6px', borderRadius: 100,
                                background: isFounder ? 'var(--inv)' : 'rgba(var(--fg-rgb), 0.05)',
                                color: isFounder ? 'var(--on-inv)' : 'rgba(var(--fg-rgb), 0.5)',
                                letterSpacing: '0.05em'
                            }}>{badge}</span>
                        </div>
                        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.3)', margin: 0 }}>{date}</p>
                    </div>
                </div>
            </div>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15, color: 'var(--fg)', lineHeight: 1.6, margin: '0 0 24px' }}>{content}</p>
            <div style={{ display: 'flex', gap: 24, borderTop: '1px solid rgba(var(--fg-rgb), 0.04)', paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(var(--fg-rgb), 0.4)' }}>
                    <span>🙌</span> {reactions}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(var(--fg-rgb), 0.4)' }}>
                    <span>💬</span> {comments} Comentários
                </div>
            </div>
        </div>
    )
}

// ── TAB COMPONENTS ──────────────────────────────────────────────────────────

function DropsTab() {
    return (
        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SectionLabel>DROPS ATIVOS</SectionLabel>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        padding: '8px 16px', background: 'var(--inv)', color: 'var(--on-inv)', border: 'none', borderRadius: 4,
                        fontFamily: "'Poppins', sans-serif", fontSize: 13, fontWeight: 500, cursor: 'pointer'
                    }}
                >
                    Criar Drop
                </motion.button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {[
                    { title: 'Template Dashboard Financeiro', slots: '12/50', revenue: 'R$ 4.800', time: '02:14:45' },
                    { title: 'Playbook de Tráfego Pago v2', slots: '45/100', revenue: 'R$ 15.200', time: '14:20:10' }
                ].map(drop => (
                    <div key={drop.title} style={{ padding: 24, background: 'var(--surface)', border: '1px solid rgba(var(--fg-rgb), 0.08)', borderRadius: 12 }}>
                        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 18, fontWeight: 500, margin: '0 0 16px', color: 'var(--fg)' }}>{drop.title}</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                            <div>
                                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, margin: 0 }}>{drop.slots}</p>
                                <p style={{ fontSize: 9, color: 'rgba(var(--fg-rgb), 0.4)' }}>VAGAS</p>
                            </div>
                            <div>
                                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, margin: 0 }}>{drop.revenue}</p>
                                <p style={{ fontSize: 9, color: 'rgba(var(--fg-rgb), 0.4)' }}>RECEITA</p>
                            </div>
                            <div>
                                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, margin: 0, color: '#E01E1E' }}>{drop.time}</p>
                                <p style={{ fontSize: 9, color: 'rgba(var(--fg-rgb), 0.4)' }}>TIMER</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 24 }}>
                <SectionLabel>HISTÓRICO DE DROPS</SectionLabel>
                <div style={{ border: '1px solid rgba(var(--fg-rgb), 0.06)', borderRadius: 8, overflow: 'hidden' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{ padding: '16px 20px', borderBottom: i < 3 ? '1px solid rgba(var(--fg-rgb), 0.06)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14, color: 'rgba(var(--fg-rgb), 0.6)' }}>Drop Antigo #{i}</span>
                            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.3)' }}>Concluído em Jan/25</span>
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
            <SectionLabel>LISTA DE MEMBROS</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                    { name: 'Ana Silva', level: 'Inner Circle', points: 1250, joined: 'Set/24' },
                    { name: 'João Mendes', level: 'OGs', points: 980, joined: 'Out/24' },
                    { name: 'Pedro Lima', level: 'Members', points: 850, joined: 'Nov/24' },
                    { name: 'Mariana Costa', level: 'Members', points: 720, joined: 'Dez/24' }
                ].map(m => (
                    <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'var(--surface)', border: '1px solid rgba(var(--fg-rgb), 0.08)', borderRadius: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(var(--fg-rgb), 0.1)' }} />
                        <div style={{ flex: 1 }}>
                            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14, fontWeight: 500, margin: 0 }}>{m.name}</p>
                            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.4)', margin: 0 }}>{m.level}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, margin: 0 }}>{m.points} pts</p>
                            <p style={{ fontSize: 9, color: 'rgba(var(--fg-rgb), 0.3)' }}>DESDE {m.joined}</p>
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
            <div style={{ display: 'flex', gap: 32, marginBottom: 32 }}>
                <button style={{ background: 'none', border: 'none', borderBottom: '2px solid var(--fg)', paddingBottom: 8, fontFamily: "'Poppins', sans-serif", fontSize: 14, color: 'var(--fg)', cursor: 'pointer' }}>Semanal</button>
                <button style={{ background: 'none', border: 'none', paddingBottom: 8, fontFamily: "'Poppins', sans-serif", fontSize: 14, color: 'rgba(var(--fg-rgb), 0.4)', cursor: 'pointer' }}>Mensal</button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid rgba(var(--fg-rgb), 0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.4)' }}>POS</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.4)' }}>MEMBRO</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.4)' }}>NÍVEL</th>
                        <th style={{ textAlign: 'right', padding: '12px 16px', fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'rgba(var(--fg-rgb), 0.4)' }}>PONTOS</th>
                    </tr>
                </thead>
                <tbody>
                    {[
                        { rank: 1, name: 'Ana Silva', level: 'Inner Circle', points: 1250 },
                        { rank: 2, name: 'João Mendes', level: 'OGs', points: 980 },
                        { rank: 3, name: 'Pedro Lima', level: 'Members', points: 850 }
                    ].map(r => (
                        <tr key={r.name} style={{ borderBottom: '1px solid rgba(var(--fg-rgb), 0.06)' }}>
                            <td style={{ padding: '16px', fontFamily: "'Geist Mono', monospace", fontSize: 14 }}>{r.rank}</td>
                            <td style={{ padding: '16px', fontFamily: "'Poppins', sans-serif", fontSize: 14, fontWeight: 500 }}>{r.name}</td>
                            <td style={{ padding: '16px', fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.5)' }}>{r.level}</td>
                            <td style={{ padding: '16px', textAlign: 'right', fontFamily: "'Geist Mono', monospace", fontSize: 14 }}>{r.points}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function EventosTab() {
    return (
        <div style={{ gridColumn: 'span 2' }}>
            <SectionLabel>PRÓXIMOS EVENTOS</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 48 }}>
                {[
                    { title: 'Live de Mentoria Estratégica', date: '25 Fev, 19:00', type: 'LIVE' },
                    { title: 'Q&A: Lançamento em 7 Dias', date: '28 Fev, 15:00', type: 'Q&A' }
                ].map(ev => (
                    <div key={ev.title} style={{ padding: 24, background: 'var(--surface)', border: '1px solid rgba(var(--fg-rgb), 0.08)', borderRadius: 12 }}>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(var(--fg-rgb), 0.05)', color: 'rgba(var(--fg-rgb), 0.6)' }}>{ev.type}</span>
                        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 16, fontWeight: 500, margin: '12px 0 8px', color: 'var(--fg)' }}>{ev.title}</p>
                        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'rgba(var(--fg-rgb), 0.4)', margin: '0 0 20px' }}>{ev.date}</p>
                        <button style={{ width: '100%', padding: '10px', background: 'var(--inv)', color: 'var(--on-inv)', border: 'none', borderRadius: 6, fontWeight: 500, cursor: 'pointer' }}>Me inscrever</button>
                    </div>
                ))}
            </div>

            <SectionLabel>REPLAYS PASSADOS</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {[1, 2].map(i => (
                    <div key={i} style={{ height: 120, background: 'rgba(var(--fg-rgb), 0.02)', border: '1px dashed rgba(var(--fg-rgb), 0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 24 }}>play_circle</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
