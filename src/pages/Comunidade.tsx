import { useState } from 'react'
import { motion } from 'framer-motion'
import TopBar from '../components/layout/TopBar'
import { PageHeader, Divider, Btn } from '../components/ui/shared'

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_POSTS = [
  {
    id: 1, author: 'Matheus Possato', badge: 'FOUNDER', isFounder: true,
    content: 'Bem-vindos ao Inner Circle! Este é o espaço para trocarmos estratégias reais sobre escala. Compartilhei ontem um playbook de reativação de leads frios que gerou R$14k em 72h — vou postar aqui em breve.',
    date: '2h atrás', reactions: 24, comments: 8,
  },
  {
    id: 2, author: 'Ana Silva', badge: 'INNER CIRCLE', isFounder: false,
    content: 'Apliquei o playbook de cohort que o Possato compartilhou e os resultados foram absurdos. Recuperei 11 clientes inativos com uma sequência de 3 emails. Alguém mais testou essa abordagem?',
    date: '5h atrás', reactions: 18, comments: 6,
  },
  {
    id: 3, author: 'João Mendes', badge: 'OG', isFounder: false,
    content: 'Dica rápida: se você ainda não está cruzando LTV com canal de aquisição, está deixando dinheiro na mesa. Meta Ads está trazendo meu pior LTV há 3 meses, mas o Google Ads tem LTV 2.8x maior.',
    date: '1d atrás', reactions: 31, comments: 12,
  },
  {
    id: 4, author: 'Mariana Costa', badge: 'MEMBER', isFounder: false,
    content: 'Pergunta para quem trabalha com SaaS: qual vocês usam como threshold de churn? Estou usando 1.5x o intervalo médio mas fico com muitos falsos positivos.',
    date: '2d atrás', reactions: 9, comments: 14,
  },
]

const MOCK_MEMBROS = [
  { name: 'Ana Silva',      level: 'Inner Circle', points: 1250, joined: 'Set/24', active: true },
  { name: 'João Mendes',    level: 'OG',           points: 980,  joined: 'Out/24', active: true },
  { name: 'Pedro Lima',     level: 'OG',           points: 850,  joined: 'Nov/24', active: false },
  { name: 'Mariana Costa',  level: 'Member',       points: 720,  joined: 'Dez/24', active: true },
  { name: 'Rafael Torres',  level: 'Member',       points: 610,  joined: 'Jan/25', active: false },
  { name: 'Camila Rocha',   level: 'Member',       points: 540,  joined: 'Jan/25', active: true },
  { name: 'Bruno Alves',    level: 'Member',       points: 410,  joined: 'Fev/25', active: false },
  { name: 'Letícia Souza',  level: 'Member',       points: 390,  joined: 'Fev/25', active: true },
]

const MOCK_EVENTOS = [
  { title: 'Live de Mentoria Estratégica', date: '25 Mar, 19:00', type: 'LIVE',    spots: 40, enrolled: 28 },
  { title: 'Q&A: Lançamento em 7 Dias',   date: '28 Mar, 15:00', type: 'Q&A',     spots: 60, enrolled: 41 },
  { title: 'Workshop: Pipeline Nativo',    date: '02 Abr, 18:00', type: 'WORKSHOP', spots: 20, enrolled: 12 },
  { title: 'Office Hours — Cohort & LTV', date: '05 Abr, 17:00', type: 'OFFICE HOURS', spots: 15, enrolled: 9 },
]

const MOCK_REPLAYS = [
  { title: 'Live: Como escalar para R$100k MRR', date: 'Mar/25', duration: '1h 24min' },
  { title: 'Q&A: Atribuição e Meta Ads avançado', date: 'Fev/25', duration: '58min' },
  { title: 'Workshop: RFM na prática',            date: 'Fev/25', duration: '1h 10min' },
]

const MOCK_DROPS = [
  { title: 'Template Dashboard Financeiro',    slots: 12, total: 50,  revenue: 4800,  time: '02:14:45', active: true  },
  { title: 'Playbook de Tráfego Pago v2',      slots: 45, total: 100, revenue: 15200, time: '14:20:10', active: true  },
  { title: 'Kit Reativação de Leads Frios',    slots: 50, total: 50,  revenue: 9750,  time: null,       active: false },
  { title: 'Planilha de Unit Economics',       slots: 80, total: 80,  revenue: 6400,  time: null,       active: false },
]

const MOCK_RANKING = [
  { rank: 1, name: 'Ana Silva',      level: 'Inner Circle', points: 1250, delta: +120 },
  { rank: 2, name: 'João Mendes',    level: 'OG',           points: 980,  delta: +45  },
  { rank: 3, name: 'Pedro Lima',     level: 'OG',           points: 850,  delta: -20  },
  { rank: 4, name: 'Mariana Costa',  level: 'Member',       points: 720,  delta: +80  },
  { rank: 5, name: 'Rafael Torres',  level: 'Member',       points: 610,  delta: +15  },
  { rank: 6, name: 'Camila Rocha',   level: 'Member',       points: 540,  delta: +60  },
  { rank: 7, name: 'Bruno Alves',    level: 'Member',       points: 410,  delta: -5   },
]

const fmtBR = (n: number) => new Intl.NumberFormat('pt-BR').format(n)

// ── Section Label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-xs)',
      fontWeight: 500,
      color: 'var(--color-text-tertiary)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      marginBottom: 14,
    }}>
      {children}
    </p>
  )
}

// ── Post Card ─────────────────────────────────────────────────────────────────

function PostCard({ post }: { post: typeof MOCK_POSTS[0] }) {
  const initials = post.author.split(' ').map(w => w[0]).join('').slice(0, 2)
  return (
    <div style={{
      padding: '20px 24px',
      background: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: post.isFounder ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 600,
          color: post.isFounder ? '#fff' : 'var(--color-text-secondary)',
        }}>
          {initials}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {post.author}
            </span>
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
              padding: '1px 6px', borderRadius: 'var(--radius-full)',
              background: post.isFounder ? 'var(--color-primary-light)' : 'var(--color-bg-tertiary)',
              color: post.isFounder ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
              letterSpacing: '0.05em',
            }}>
              {post.badge}
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            {post.date}
          </span>
        </div>
      </div>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-primary)', lineHeight: 1.6, margin: '0 0 16px' }}>
        {post.content}
      </p>
      <div style={{ display: 'flex', gap: 20, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
          🙌 {post.reactions}
        </button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
          💬 {post.comments} comentários
        </button>
      </div>
    </div>
  )
}

// ── Tab: Início (Feed) ────────────────────────────────────────────────────────

function FeedTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 260px', gap: 32 }}>
      {/* Sidebar esquerda */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div>
          <SectionLabel>Espaços</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {['Feed Geral', 'Novidades', 'Votações Ativas', 'Bastidores'].map(item => (
              <button key={item} style={{
                textAlign: 'left',
                background: item === 'Feed Geral' ? 'var(--color-bg-tertiary)' : 'none',
                border: 'none',
                padding: '6px 8px', borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                color: item === 'Feed Geral' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: item === 'Feed Geral' ? 500 : 400,
                cursor: 'pointer',
              } as React.CSSProperties}>
                {item}
              </button>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Níveis</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Inner Circle', count: 12 },
              { label: 'OGs',          count: 48 },
              { label: 'Members',      count: 187 },
            ].map(level => (
              <div key={level.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{level.label}</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', background: 'var(--color-bg-tertiary)', padding: '1px 7px', borderRadius: 'var(--radius-full)' }}>{level.count}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Feed central */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Create post */}
        <div style={{
          padding: '14px 20px',
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex', gap: 12, alignItems: 'center',
        }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-bg-tertiary)', flexShrink: 0 }} />
          <input
            placeholder="Compartilhe algo com a comunidade..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {MOCK_POSTS.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
          >
            <PostCard post={post} />
          </motion.div>
        ))}
      </div>

      {/* Sidebar direita */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Membros ativos */}
        <div style={{ padding: '18px 20px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' }}>
          <SectionLabel>Online agora</SectionLabel>
          <div style={{ display: 'flex', marginBottom: 10 }}>
            {MOCK_MEMBROS.filter(m => m.active).slice(0, 5).map((m, i) => (
              <div key={m.name} title={m.name} style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--color-bg-tertiary)',
                border: '2px solid var(--color-bg-primary)',
                marginLeft: i > 0 ? -8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600,
                color: 'var(--color-text-secondary)',
              }}>
                {m.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
            ))}
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            {MOCK_MEMBROS.filter(m => m.active).length} membros ativos
          </span>
        </div>

        {/* Próximo drop */}
        <div style={{
          padding: '20px', background: 'var(--color-text-primary)',
          borderRadius: 'var(--radius-lg)', color: '#fff',
        }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>Próximo Drop</p>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, margin: '0 0 14px', lineHeight: 1.4 }}>
            {MOCK_DROPS[0].title}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0 }}>{MOCK_DROPS[0].time}</p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: 0, textTransform: 'uppercase' }}>Restante</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0 }}>{MOCK_DROPS[0].slots}/{MOCK_DROPS[0].total}</p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: 0, textTransform: 'uppercase' }}>Vagas</p>
            </div>
          </div>
          <button style={{
            width: '100%', padding: '9px', background: '#fff', color: 'var(--color-text-primary)',
            border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)',
            fontWeight: 600, cursor: 'pointer', fontSize: 'var(--text-sm)',
          }}>
            Me avisar
          </button>
        </div>

        {/* Top ranking */}
        <div style={{ padding: '18px 20px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' }}>
          <SectionLabel>Ranking da semana</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {MOCK_RANKING.slice(0, 3).map(user => (
              <div key={user.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 600, color: user.rank === 1 ? 'var(--color-primary)' : 'var(--color-text-tertiary)', width: 16 }}>{user.rank}</span>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--color-bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  {user.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', margin: 0, fontWeight: 500, color: 'var(--color-text-primary)' }}>{user.name.split(' ')[0]}</p>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)', margin: 0 }}>{fmtBR(user.points)} pts</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}

// ── Tab: Eventos ──────────────────────────────────────────────────────────────

function EventosTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <SectionLabel>Próximos Eventos</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {MOCK_EVENTOS.map((ev, i) => (
            <motion.div
              key={ev.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              style={{
                padding: '20px 24px', background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
                padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>{ev.type}</span>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 500, margin: '12px 0 4px', color: 'var(--color-text-primary)' }}>{ev.title}</p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: '0 0 16px' }}>{ev.date}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                  {ev.enrolled} / {ev.spots} inscritos
                </span>
                <div style={{ width: 120, height: 4, background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(ev.enrolled / ev.spots) * 100}%`, background: 'var(--color-primary)', borderRadius: 'var(--radius-full)' }} />
                </div>
              </div>
              <button style={{
                width: '100%', padding: '9px', background: 'var(--color-text-primary)', color: 'var(--color-bg-primary)',
                border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)',
                fontWeight: 500, cursor: 'pointer', fontSize: 'var(--text-sm)',
              }}>Me inscrever</button>
            </motion.div>
          ))}
        </div>
      </div>

      <Divider margin="0" />

      <div>
        <SectionLabel>Replays</SectionLabel>
        <div style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {MOCK_REPLAYS.map((r, i) => (
            <div key={r.title} style={{
              padding: '14px 20px', borderBottom: i < MOCK_REPLAYS.length - 1 ? '1px solid var(--color-border)' : 'none',
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>▶</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>{r.title}</p>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>{r.duration} · {r.date}</p>
              </div>
              <button style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '5px 12px', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                Assistir
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tab: Membros ──────────────────────────────────────────────────────────────

function MembrosTab() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <SectionLabel>247 membros</SectionLabel>
      </div>
      <div style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px 80px', padding: '10px 20px', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
          {['Membro', 'Nível', 'Pontos', 'Status'].map(h => (
            <span key={h} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
          ))}
        </div>
        {MOCK_MEMBROS.map((m, i) => (
          <motion.div
            key={m.name}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 140px 100px 80px',
              padding: '12px 20px', alignItems: 'center',
              borderBottom: i < MOCK_MEMBROS.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-bg-tertiary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                {m.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>{m.name}</p>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>desde {m.joined}</p>
              </div>
            </div>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{m.level}</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{fmtBR(m.points)}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: m.active ? 'var(--status-complete)' : 'var(--color-text-tertiary)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.active ? 'var(--status-complete)' : 'var(--color-bg-tertiary)', display: 'inline-block' }} />
              {m.active ? 'Ativo' : 'Offline'}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Tab: Ranking ──────────────────────────────────────────────────────────────

function RankingTab() {
  const [period, setPeriod] = useState<'semanal' | 'mensal'>('semanal')

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['semanal', 'mensal'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: '6px 14px', borderRadius: 'var(--radius-md)',
              background: period === p ? 'var(--color-bg-tertiary)' : 'none',
              border: '1px solid ' + (period === p ? 'var(--color-border)' : 'transparent'),
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
              fontWeight: period === p ? 500 : 400,
              color: period === p ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 140px 100px 80px', padding: '10px 20px', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
          {['Pos', 'Membro', 'Nível', 'Pontos', 'Semana'].map(h => (
            <span key={h} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
          ))}
        </div>
        {MOCK_RANKING.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            style={{
              display: 'grid', gridTemplateColumns: '52px 1fr 140px 100px 80px',
              padding: '12px 20px', alignItems: 'center',
              borderBottom: i < MOCK_RANKING.length - 1 ? '1px solid var(--color-border)' : 'none',
              background: r.rank === 1 ? 'var(--color-primary-light)' : 'transparent',
            }}
          >
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 700, color: r.rank <= 3 ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }}>
              {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-bg-tertiary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                {r.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{r.name}</span>
            </div>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{r.level}</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{fmtBR(r.points)}</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: r.delta > 0 ? 'var(--status-complete)' : 'var(--accent-red)' }}>
              {r.delta > 0 ? '+' : ''}{r.delta}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Tab: Drops ────────────────────────────────────────────────────────────────

function DropsTab() {
  const active = MOCK_DROPS.filter(d => d.active)
  const past = MOCK_DROPS.filter(d => !d.active)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <SectionLabel>Drops Ativos</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {active.map((drop, i) => (
            <motion.div
              key={drop.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              style={{
                padding: '20px 24px', background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)',
              }}
            >
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 500, margin: '0 0 16px', color: 'var(--color-text-primary)' }}>{drop.title}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Vagas', value: `${drop.slots}/${drop.total}` },
                  { label: 'Receita', value: `R$ ${fmtBR(drop.revenue)}` },
                  { label: 'Timer', value: drop.time!, highlight: true },
                ].map(s => (
                  <div key={s.label}>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 600, margin: '0 0 2px', color: s.highlight ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{s.value}</p>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                  </div>
                ))}
              </div>
              <div style={{ height: 4, background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ height: '100%', width: `${(drop.slots / drop.total) * 100}%`, background: 'var(--color-primary)', borderRadius: 'var(--radius-full)' }} />
              </div>
              <button style={{
                width: '100%', padding: '9px', background: 'var(--color-text-primary)', color: 'var(--color-bg-primary)',
                border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)',
                fontWeight: 500, cursor: 'pointer', fontSize: 'var(--text-sm)',
              }}>Garantir vaga</button>
            </motion.div>
          ))}
        </div>
      </div>

      <Divider margin="0" />

      <div>
        <SectionLabel>Histórico de Drops</SectionLabel>
        <div style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {past.map((drop, i) => (
            <div key={drop.title} style={{
              padding: '14px 20px', borderBottom: i < past.length - 1 ? '1px solid var(--color-border)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>{drop.title}</p>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>{drop.total} vagas · R$ {fmtBR(drop.revenue)}</p>
              </div>
              <span className="tag tag-complete">Encerrado</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Page Component ────────────────────────────────────────────────────────────

const TABS = ['Início', 'Eventos', 'Membros', 'Ranking', 'Drops']

export default function Comunidade({ onToggleChat }: { onToggleChat?: () => void }) {
  const [activeTab, setActiveTab] = useState('Início')

  return (
    <div style={{ paddingTop: 28, paddingBottom: 80 }}>
      <TopBar onToggleChat={onToggleChat} />

      <PageHeader
        title="Comunidade"
        subtitle="Inner Circle Northie — founders que constroem para escalar."
        actions={
          <Btn variant="primary" size="md"
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
          >
            Novo post
          </Btn>
        }
      />

      <Divider margin="32px 0" />

      {/* Pill subnav — idêntico ao Growth */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px', background: 'var(--color-bg-secondary)', borderRadius: 10, width: 'fit-content', border: '1px solid var(--color-border)' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab
          return (
            <motion.button
              key={tab}
              onClick={() => setActiveTab(tab)}
              whileTap={{ scale: 0.97 }}
              style={{
                fontFamily: 'var(--font-sans)', fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                background: isActive ? 'var(--color-bg-primary)' : 'transparent',
                border: isActive ? '1px solid var(--color-border)' : '1px solid transparent',
                borderRadius: 7, padding: '6px 16px', cursor: 'pointer',
                transition: 'all 0.15s ease', letterSpacing: '-0.1px',
              }}
            >
              {tab}
            </motion.button>
          )
        })}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ marginTop: 24 }}
      >
        {activeTab === 'Início'  && <FeedTab />}
        {activeTab === 'Eventos' && <EventosTab />}
        {activeTab === 'Membros' && <MembrosTab />}
        {activeTab === 'Ranking' && <RankingTab />}
        {activeTab === 'Drops'   && <DropsTab />}
      </motion.div>
    </div>
  )
}
