import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import TopBar from '../components/layout/TopBar'
import { PageHeader, Divider, Btn } from '../components/ui/shared'
import { comunidadeApi } from '../lib/api'

const fmtBR = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

// ── Types ─────────────────────────────────────────────────────────────────────

interface Post {
  id: string
  content: string
  space: string
  likes_count: number
  comments_count: number
  liked_by_me: boolean
  created_at: string
  author: { id: string; community_display_name?: string; community_level?: string; community_points?: number }
}

interface Member {
  id: string
  community_display_name?: string
  community_level?: string
  community_points?: number
  community_joined_at?: string
  business_type?: string
}

interface CEvent {
  id: string
  title: string
  type: string
  scheduled_at: string
  duration_minutes: number
  enrollments_count: number
  max_enrollments?: number
  meet_url?: string
  replay_url?: string
  replay_duration_minutes?: number
  status: string
  enrolled?: boolean
}

interface Drop {
  id: string
  title: string
  description?: string
  price_brl: number
  total_slots: number
  sold_slots: number
  status: string
  expires_at?: string
}

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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ height = 80 }: { height?: number }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      style={{ height, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}
    />
  )
}

// ── Post Card ─────────────────────────────────────────────────────────────────

function PostCard({ post, onLike }: { post: Post; onLike: (id: string) => void }) {
  const authorName = post.author?.community_display_name || 'Founder'
  const level = post.author?.community_level || 'member'
  const isFounder = level === 'inner_circle'
  const badge = level === 'inner_circle' ? 'INNER CIRCLE' : level === 'og' ? 'OG' : 'MEMBER'
  const initials = authorName.split(' ').map((w: string) => w[0]).join('').slice(0, 2)
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 3600000) return `${Math.round(diff / 60000)}min atrás`
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h atrás`
    return `${Math.round(diff / 86400000)}d atrás`
  }
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
          background: isFounder ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 600,
          color: isFounder ? '#fff' : 'var(--color-text-secondary)',
        }}>
          {initials}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {authorName}
            </span>
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
              padding: '1px 6px', borderRadius: 'var(--radius-full)',
              background: isFounder ? 'var(--color-primary-light)' : 'var(--color-bg-tertiary)',
              color: isFounder ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
              letterSpacing: '0.05em',
            }}>
              {badge}
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            {timeAgo(post.created_at)}
          </span>
        </div>
      </div>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-primary)', lineHeight: 1.6, margin: '0 0 16px' }}>
        {post.content}
      </p>
      <div style={{ display: 'flex', gap: 20, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => onLike(post.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: post.liked_by_me ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }}
        >
          🙌 {post.likes_count}
        </motion.button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
          💬 {post.comments_count} comentários
        </button>
      </div>
    </div>
  )
}

// ── Tab: Início (Feed) ────────────────────────────────────────────────────────

const SPACES = [
  { label: 'Feed Geral', value: 'feed_geral' },
  { label: 'Novidades', value: 'novidades' },
  { label: 'Votações', value: 'votacoes' },
  { label: 'Bastidores', value: 'bastidores' },
]

function FeedTab() {
  const [posts, setPosts] = useState<Post[]>([])
  const [topMembers, setTopMembers] = useState<Member[]>([])
  const [space, setSpace] = useState('feed_geral')
  const [newPost, setNewPost] = useState('')
  const [posting, setPosting] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await comunidadeApi.getPosts(space)
      setPosts(res.data?.data || [])
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [space])

  useEffect(() => { loadPosts() }, [loadPosts])

  useEffect(() => {
    comunidadeApi.getMembers('points', 5)
      .then(res => setTopMembers(res.data?.data || []))
      .catch(() => {})
  }, [])

  const handlePost = async () => {
    if (!newPost.trim() || posting) return
    setPosting(true)
    try {
      await comunidadeApi.createPost(newPost.trim(), space)
      setNewPost('')
      loadPosts()
    } catch { /* silencioso */ }
    finally { setPosting(false) }
  }

  const handleLike = async (postId: string) => {
    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.liked_by_me ? p.likes_count - 1 : p.likes_count + 1 }
      : p
    ))
    try { await comunidadeApi.toggleLike(postId) }
    catch { loadPosts() }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 260px', gap: 32 }}>
      {/* Sidebar esquerda */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div>
          <SectionLabel>Espaços</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {SPACES.map(item => (
              <button key={item.value} onClick={() => setSpace(item.value)} style={{
                textAlign: 'left',
                background: space === item.value ? 'var(--color-bg-tertiary)' : 'none',
                border: 'none',
                padding: '6px 8px', borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                color: space === item.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: space === item.value ? 500 : 400,
                cursor: 'pointer',
              } as React.CSSProperties}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Níveis</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Inner Circle', value: 'inner_circle' },
              { label: 'OGs', value: 'og' },
              { label: 'Members', value: 'member' },
            ].map(level => (
              <div key={level.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{level.label}</span>
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
            value={newPost}
            onChange={e => setNewPost(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handlePost()}
            placeholder="Compartilhe algo com a comunidade..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)',
              color: 'var(--color-text-primary)',
            }}
          />
          {newPost.trim() && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePost}
              disabled={posting}
              style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, padding: '6px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer' }}
            >
              {posting ? '...' : 'Postar'}
            </motion.button>
          )}
        </div>

        {loading ? (
          [1, 2, 3].map(i => <Skeleton key={i} height={120} />)
        ) : posts.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>Nenhum post ainda. Seja o primeiro!</p>
          </div>
        ) : posts.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
          >
            <PostCard post={post} onLike={handleLike} />
          </motion.div>
        ))}
      </div>

      {/* Sidebar direita */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Membros ativos */}
        <div style={{ padding: '18px 20px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' }}>
          <SectionLabel>Top membros</SectionLabel>
          {topMembers.length === 0 ? (
            <div style={{ display: 'flex', gap: -8, marginBottom: 10 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-bg-tertiary)', marginLeft: i > 1 ? -8 : 0 }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', marginBottom: 10 }}>
              {topMembers.slice(0, 5).map((m, i) => {
                const name = m.community_display_name || 'F'
                const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)
                return (
                  <div key={m.id} title={name} style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--color-bg-tertiary)',
                    border: '2px solid var(--color-bg-primary)',
                    marginLeft: i > 0 ? -8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                  }}>
                    {initials}
                  </div>
                )
              })}
            </div>
          )}
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            {topMembers.length > 0 ? `${topMembers.length}+ membros ativos` : 'Carregando...'}
          </span>
        </div>

        {/* Top ranking snapshot */}
        <div style={{ padding: '18px 20px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' }}>
          <SectionLabel>Ranking da semana</SectionLabel>
          {topMembers.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => <Skeleton key={i} height={32} />)}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topMembers.slice(0, 3).map((m, i) => {
                const name = m.community_display_name || 'Founder'
                const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 600, color: i === 0 ? 'var(--color-primary)' : 'var(--color-text-tertiary)', width: 16 }}>{i + 1}</span>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--color-bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', margin: 0, fontWeight: 500, color: 'var(--color-text-primary)' }}>{name.split(' ')[0]}</p>
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)', margin: 0 }}>{fmtBR(m.community_points || 0)} pts</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

// ── Tab: Eventos ──────────────────────────────────────────────────────────────

function EventosTab() {
  const [events, setEvents] = useState<CEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState<string | null>(null)

  useEffect(() => {
    comunidadeApi.getEvents()
      .then(res => setEvents(res.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleEnroll = async (eventId: string) => {
    setEnrolling(eventId)
    try {
      await comunidadeApi.enrollEvent(eventId)
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, enrolled: true, enrollments_count: e.enrollments_count + 1 } : e))
    } catch { /* silencioso */ }
    finally { setEnrolling(null) }
  }

  const upcoming = events.filter(e => e.status === 'upcoming' || e.status === 'scheduled')
  const replays = events.filter(e => e.status === 'done' && e.replay_url)

  const fmtEventDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <SectionLabel>Próximos Eventos</SectionLabel>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {[1, 2].map(i => <Skeleton key={i} height={200} />)}
          </div>
        ) : upcoming.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>Nenhum evento agendado por enquanto.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {upcoming.map((ev, i) => (
              <motion.div
                key={ev.id}
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
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: '0 0 16px' }}>
                  {fmtEventDate(ev.scheduled_at)} · {ev.duration_minutes}min
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {ev.enrollments_count}{ev.max_enrollments ? ` / ${ev.max_enrollments}` : ''} inscritos
                  </span>
                  {ev.max_enrollments && (
                    <div style={{ width: 120, height: 4, background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min((ev.enrollments_count / ev.max_enrollments) * 100, 100)}%`, background: 'var(--color-primary)', borderRadius: 'var(--radius-full)' }} />
                    </div>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => !ev.enrolled && handleEnroll(ev.id)}
                  disabled={ev.enrolled || enrolling === ev.id}
                  style={{
                    width: '100%', padding: '9px',
                    background: ev.enrolled ? 'var(--color-bg-tertiary)' : 'var(--color-text-primary)',
                    color: ev.enrolled ? 'var(--color-text-secondary)' : 'var(--color-bg-primary)',
                    border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)',
                    fontWeight: 500, cursor: ev.enrolled ? 'default' : 'pointer', fontSize: 'var(--text-sm)',
                  }}
                >
                  {enrolling === ev.id ? '...' : ev.enrolled ? 'Inscrito ✓' : 'Me inscrever'}
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Divider margin="0" />

      <div>
        <SectionLabel>Replays</SectionLabel>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2].map(i => <Skeleton key={i} height={60} />)}
          </div>
        ) : replays.length === 0 ? (
          <div style={{ padding: '24px 20px', textAlign: 'center', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>Nenhum replay disponível ainda.</p>
          </div>
        ) : (
          <div style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {replays.map((r, i) => (
              <div key={r.id} style={{
                padding: '14px 20px', borderBottom: i < replays.length - 1 ? '1px solid var(--color-border)' : 'none',
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>▶</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>{r.title}</p>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>
                    {r.replay_duration_minutes ? `${r.replay_duration_minutes}min` : ''} · {fmtEventDate(r.scheduled_at)}
                  </p>
                </div>
                <a href={r.replay_url} target="_blank" rel="noopener noreferrer" style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '5px 12px', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', cursor: 'pointer', textDecoration: 'none' }}>
                  Assistir
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Membros ──────────────────────────────────────────────────────────────

function MembrosTab() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    comunidadeApi.getMembers('joined', 50)
      .then(res => setMembers(res.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const levelLabel = (level?: string) => {
    if (level === 'inner_circle') return 'Inner Circle'
    if (level === 'og') return 'OG'
    return 'Member'
  }

  const fmtJoined = (iso?: string) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <SectionLabel>{loading ? 'Carregando...' : `${members.length} membros`}</SectionLabel>
      </div>
      <div style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px', padding: '10px 20px', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
          {['Membro', 'Nível', 'Pontos'].map(h => (
            <span key={h} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
          ))}
        </div>
        {loading ? (
          [1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <Skeleton height={32} />
            </div>
          ))
        ) : members.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>Nenhum membro ainda.</p>
          </div>
        ) : members.map((m, i) => {
          const name = m.community_display_name || 'Founder'
          const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 140px 100px',
                padding: '12px 20px', alignItems: 'center',
                borderBottom: i < members.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-bg-tertiary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  {initials}
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>{name}</p>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>desde {fmtJoined(m.community_joined_at)}</p>
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{levelLabel(m.community_level)}</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{fmtBR(m.community_points || 0)}</span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ── Tab: Ranking ──────────────────────────────────────────────────────────────

function RankingTab() {
  const [period, setPeriod] = useState<'semanal' | 'mensal'>('semanal')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    comunidadeApi.getMembers('points', 20)
      .then(res => setMembers(res.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  const levelLabel = (level?: string) => {
    if (level === 'inner_circle') return 'Inner Circle'
    if (level === 'og') return 'OG'
    return 'Member'
  }

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
        <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 140px 100px', padding: '10px 20px', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
          {['Pos', 'Membro', 'Nível', 'Pontos'].map(h => (
            <span key={h} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
          ))}
        </div>
        {loading ? (
          [1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <Skeleton height={32} />
            </div>
          ))
        ) : members.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>Nenhum dado de ranking ainda.</p>
          </div>
        ) : members.map((m, i) => {
          const name = m.community_display_name || 'Founder'
          const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)
          const rank = i + 1
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              style={{
                display: 'grid', gridTemplateColumns: '52px 1fr 140px 100px',
                padding: '12px 20px', alignItems: 'center',
                borderBottom: i < members.length - 1 ? '1px solid var(--color-border)' : 'none',
                background: rank === 1 ? 'var(--color-primary-light)' : 'transparent',
              }}
            >
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 700, color: rank <= 3 ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }}>
                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-bg-tertiary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  {initials}
                </div>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{name}</span>
              </div>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{levelLabel(m.community_level)}</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{fmtBR(m.community_points || 0)}</span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ── Tab: Drops ────────────────────────────────────────────────────────────────

function DropsTab() {
  const [drops, setDrops] = useState<Drop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    comunidadeApi.getDrops()
      .then(res => setDrops(res.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const active = drops.filter(d => d.status === 'active')
  const past = drops.filter(d => d.status !== 'active')

  const timeLeft = (iso?: string) => {
    if (!iso) return '—'
    const diff = new Date(iso).getTime() - Date.now()
    if (diff <= 0) return 'Encerrado'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (h > 48) return `${Math.floor(h / 24)}d`
    return `${h}h ${m}m`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <SectionLabel>Drops Ativos</SectionLabel>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {[1, 2].map(i => <Skeleton key={i} height={220} />)}
          </div>
        ) : active.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>Nenhum drop ativo no momento.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {active.map((drop, i) => (
              <motion.div
                key={drop.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                style={{
                  padding: '20px 24px', background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)',
                }}
              >
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 500, margin: '0 0 6px', color: 'var(--color-text-primary)' }}>{drop.title}</p>
                {drop.description && (
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}>{drop.description}</p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Vagas', value: `${drop.sold_slots}/${drop.total_slots}` },
                    { label: 'Preço', value: fmtBRL(drop.price_brl) },
                    { label: 'Timer', value: timeLeft(drop.expires_at), highlight: true },
                  ].map(s => (
                    <div key={s.label}>
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 600, margin: '0 0 2px', color: s.highlight ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{s.value}</p>
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
                <div style={{ height: 4, background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ height: '100%', width: `${Math.min((drop.sold_slots / drop.total_slots) * 100, 100)}%`, background: 'var(--color-primary)', borderRadius: 'var(--radius-full)' }} />
                </div>
                <button style={{
                  width: '100%', padding: '9px', background: 'var(--color-text-primary)', color: 'var(--color-bg-primary)',
                  border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)',
                  fontWeight: 500, cursor: 'pointer', fontSize: 'var(--text-sm)',
                }}>Garantir vaga</button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Divider margin="0" />

      <div>
        <SectionLabel>Histórico de Drops</SectionLabel>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2].map(i => <Skeleton key={i} height={60} />)}
          </div>
        ) : past.length === 0 ? (
          <div style={{ padding: '24px 20px', textAlign: 'center', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>Nenhum drop encerrado ainda.</p>
          </div>
        ) : (
          <div style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {past.map((drop, i) => (
              <div key={drop.id} style={{
                padding: '14px 20px', borderBottom: i < past.length - 1 ? '1px solid var(--color-border)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>{drop.title}</p>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>
                    {drop.total_slots} vagas · {fmtBRL(drop.price_brl)}
                  </p>
                </div>
                <span className="tag tag-complete">Encerrado</span>
              </div>
            ))}
          </div>
        )}
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

      {/* Pill subnav */}
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
