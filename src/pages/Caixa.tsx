import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '../components/layout/TopBar'
import { caixaApi } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Posicao {
  caixa_estimado: number
  variacao_mes_anterior: number
  runway_meses: number
  custos_fixos_mensais: number
  media_ads_spend: number
}

interface ForecastItem {
  cenario: 'base' | 'otimista' | 'pessimista'
  projecao_30d: number
  projecao_60d: number
}

interface EntradasSaidas {
  entradas: Record<string, number>
  saidas_ads: Record<string, number>
  saidas_fixos: Array<{ name: string; category: string; valor: number }>
}

interface RunwayData {
  runway_meses: number
  custos_fixos_mensais: number
  media_ads_spend: number
}

interface PageProps {
  onToggleChat: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] as const },
  }
}

function fmtBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function fmtPct(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '20px 24px',
  boxShadow: 'var(--shadow-md)',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AvisoEstimativa() {
  return (
    <motion.div
      {...fadeUp(0.05)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 16px',
        background: '#EBF4FF',
        border: '1px solid #BFDBFE',
        borderRadius: 8,
        marginBottom: 24,
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="none"
        style={{ flexShrink: 0, marginTop: 1, color: '#2563EB' }}
      >
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
        <line x1="8" y1="6" x2="8" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
      </svg>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: '#1E3A5F',
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        Caixa estimado com base na receita das plataformas conectadas e custos cadastrados. Não é o saldo bancário real.
      </p>
    </motion.div>
  )
}

function KpiGrid({ posicao, forecast }: { posicao: Posicao; forecast: ForecastItem[] }) {
  const base30 = forecast.find(f => f.cenario === 'base')?.projecao_30d ?? 0
  const base60 = forecast.find(f => f.cenario === 'base')?.projecao_60d ?? 0
  const variacaoPositiva = posicao.variacao_mes_anterior >= 0

  const kpis = [
    {
      label: 'Caixa Estimado',
      value: fmtBRL(posicao.caixa_estimado),
      sub: (
        <span
          style={{
            color: variacaoPositiva ? 'var(--status-complete)' : 'var(--accent-red)',
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {fmtPct(posicao.variacao_mes_anterior)} vs. mês anterior
        </span>
      ),
    },
    {
      label: 'Projeção 30 dias',
      value: fmtBRL(base30),
      sub: (
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          cenário base
        </span>
      ),
    },
    {
      label: 'Projeção 60 dias',
      value: fmtBRL(base60),
      sub: (
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          cenário base
        </span>
      ),
    },
    {
      label: 'Runway',
      value: `${posicao.runway_meses} meses`,
      sub: (
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          com custos atuais
        </span>
      ),
    },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 24,
      }}
    >
      {kpis.map((kpi, i) => (
        <motion.div key={kpi.label} {...fadeUp(0.08 + i * 0.06)} style={CARD_STYLE}>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}
          >
            {kpi.label}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.5px',
              lineHeight: 1.1,
              marginBottom: 6,
            }}
          >
            {kpi.value}
          </p>
          <div>{kpi.sub}</div>
        </motion.div>
      ))}
    </div>
  )
}

const CENARIO_CONFIG: Record<
  string,
  { label: string; color30: string; color60: string; textColor: string }
> = {
  otimista: {
    label: 'Otimista',
    color30: '#0F7B6C',
    color60: '#0A5C51',
    textColor: '#0F7B6C',
  },
  base: {
    label: 'Base',
    color30: '#2563EB',
    color60: '#1D4ED8',
    textColor: '#2563EB',
  },
  pessimista: {
    label: 'Pessimista',
    color30: '#D9730D',
    color60: '#B85C08',
    textColor: '#D9730D',
  },
}

function ForecastChart({ forecast }: { forecast: ForecastItem[] }) {
  const allValues = forecast.flatMap(f => [f.projecao_30d, f.projecao_60d])
  const maxVal = Math.max(...allValues, 1)

  const ordered: Array<'otimista' | 'base' | 'pessimista'> = ['otimista', 'base', 'pessimista']

  return (
    <motion.div {...fadeUp(0.28)} style={{ ...CARD_STYLE, marginBottom: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.2px',
          }}
        >
          Forecast de Caixa — 3 cenários
        </p>
        <div style={{ display: 'flex', gap: 16 }}>
          {ordered.map(c => {
            const cfg = CENARIO_CONFIG[c]
            return (
              <span
                key={c}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  color: cfg.textColor,
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: cfg.color30,
                    flexShrink: 0,
                  }}
                />
                {cfg.label}
              </span>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 32 }}>
        {(['30d', '60d'] as const).map(period => (
          <div key={period} style={{ flex: 1 }}>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 12,
              }}
            >
              {period === '30d' ? '30 dias' : '60 dias'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ordered.map(cenario => {
                const item = forecast.find(f => f.cenario === cenario)
                if (!item) return null
                const val = period === '30d' ? item.projecao_30d : item.projecao_60d
                const cfg = CENARIO_CONFIG[cenario]
                const barColor = period === '30d' ? cfg.color30 : cfg.color60
                const pct = (val / maxVal) * 100

                return (
                  <div key={cenario}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: 12,
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {cfg.label}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          letterSpacing: '-0.2px',
                        }}
                      >
                        {fmtBRL(val)}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: 'var(--color-bg-tertiary)',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
                        style={{ height: '100%', background: barColor, borderRadius: 4 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function EntradaSaida({ data }: { data: EntradasSaidas }) {
  const totalEntradas = Object.values(data.entradas).reduce((a, b) => a + b, 0)
  const totalAds = Object.values(data.saidas_ads).reduce((a, b) => a + b, 0)
  const totalFixos = data.saidas_fixos.reduce((a, b) => a + b.valor, 0)
  const totalSaidas = totalAds + totalFixos

  const SOURCE_LABELS: Record<string, string> = {
    stripe: 'Stripe',
    hotmart: 'Hotmart',
    shopify: 'Shopify',
    organico: 'Orgânico',
    other: 'Outros',
  }

  return (
    <motion.div
      {...fadeUp(0.34)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        marginBottom: 24,
      }}
    >
      {/* Entradas */}
      <div style={CARD_STYLE}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.2px',
            }}
          >
            Entradas previstas
          </p>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--status-complete)',
              letterSpacing: '-0.2px',
            }}
          >
            {fmtBRL(totalEntradas)}
          </span>
        </div>
        {Object.entries(data.entradas).length === 0 ? (
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              color: 'var(--color-text-tertiary)',
            }}
          >
            Nenhuma entrada registrada
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(data.entradas).map(([source, valor]) => {
              const pct = totalEntradas > 0 ? (valor / totalEntradas) * 100 : 0
              return (
                <div key={source}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 13,
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {SOURCE_LABELS[source] ?? source}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {fmtBRL(valor)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: 'var(--color-bg-tertiary)',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                      style={{ height: '100%', background: 'var(--status-complete)', borderRadius: 4 }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Saídas */}
      <div style={CARD_STYLE}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.2px',
            }}
          >
            Saídas previstas
          </p>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--accent-red)',
              letterSpacing: '-0.2px',
            }}
          >
            {fmtBRL(totalSaidas)}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Ads spend */}
          {Object.entries(data.saidas_ads).map(([platform, valor]) => (
            <div
              key={`ads-${platform}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 0',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {platform === 'meta_ads' ? 'Meta Ads' : platform === 'google_ads' ? 'Google Ads' : platform}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 11,
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  Mídia paga
                </span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                }}
              >
                {fmtBRL(valor)}
              </span>
            </div>
          ))}
          {/* Fixed costs */}
          {data.saidas_fixos.map(item => (
            <div
              key={item.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 0',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {item.name}
                </span>
                {item.category && (
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 11,
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    {item.category}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                }}
              >
                {fmtBRL(item.valor)}
              </span>
            </div>
          ))}
          {Object.keys(data.saidas_ads).length === 0 && data.saidas_fixos.length === 0 && (
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                color: 'var(--color-text-tertiary)',
              }}
            >
              Nenhum custo cadastrado
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function AlertaCaixa({
  forecast,
  custos_fixos_mensais,
}: {
  forecast: ForecastItem[]
  custos_fixos_mensais: number
}) {
  const base30 = forecast.find(f => f.cenario === 'base')?.projecao_30d ?? 0
  const threshold = custos_fixos_mensais * 2

  if (base30 >= threshold || custos_fixos_mensais === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 16px',
        background: '#FFF7ED',
        border: '1px solid #FED7AA',
        borderRadius: 8,
        marginBottom: 16,
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="none"
        style={{ flexShrink: 0, marginTop: 1, color: '#D9730D' }}
      >
        <path
          d="M8 2L14 13H2L8 2Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <line x1="8" y1="7" x2="8" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
      </svg>
      <div>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            fontWeight: 600,
            color: '#92400E',
            marginBottom: 2,
          }}
        >
          Atenção: caixa projetado abaixo de 2x os custos fixos
        </p>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: '#92400E',
            lineHeight: 1.5,
          }}
        >
          A projeção base de 30 dias ({fmtBRL(base30)}) está abaixo de duas vezes seus custos fixos mensais (
          {fmtBRL(threshold)}). Revise seus custos ou acelere a geração de receita.
        </p>
      </div>
    </motion.div>
  )
}

function OportunidadeCrescimento({ runway_meses }: { runway_meses: number }) {
  if (runway_meses < 6) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 20px',
        background: 'rgba(255, 89, 0, 0.04)',
        border: '1px solid rgba(255, 89, 0, 0.18)',
        borderRadius: 8,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{ flexShrink: 0, marginTop: 1, color: 'var(--color-primary)' }}
        >
          <path
            d="M2 13L6 8L9 11L13 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M11 5H13V7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              marginBottom: 2,
            }}
          >
            Margem confortável — {runway_meses} meses de runway
          </p>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            Seu caixa suporta crescimento acelerado. Considere escalar investimento em ads ou novos canais de aquisição.
          </p>
        </div>
      </div>
      <motion.button
        whileHover={{ opacity: 0.85 }}
        whileTap={{ scale: 0.97 }}
        onClick={() =>
          window.dispatchEvent(new CustomEvent('northie:navigate', { detail: 'growth' }))
        }
        style={{
          flexShrink: 0,
          padding: '7px 14px',
          background: 'var(--color-primary)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 6,
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          letterSpacing: '-0.1px',
          whiteSpace: 'nowrap',
        }}
      >
        Ver Growth
      </motion.button>
    </motion.div>
  )
}

function LoadingState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 240,
        gap: 12,
      }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        style={{
          width: 20,
          height: 20,
          border: '2px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
        }}
      />
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: 'var(--color-text-tertiary)',
        }}
      >
        Carregando posição de caixa…
      </p>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 240,
        gap: 12,
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          color: 'var(--color-text-secondary)',
        }}
      >
        Não foi possível carregar os dados de caixa.
      </p>
      <motion.button
        whileHover={{ opacity: 0.8 }}
        whileTap={{ scale: 0.97 }}
        onClick={onRetry}
        style={{
          padding: '7px 16px',
          background: 'var(--color-bg-tertiary)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
        }}
      >
        Tentar novamente
      </motion.button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Caixa({ onToggleChat }: PageProps) {
  const [posicao, setPosicao] = useState<Posicao | null>(null)
  const [forecast, setForecast] = useState<ForecastItem[]>([])
  const [entradasSaidas, setEntradasSaidas] = useState<EntradasSaidas | null>(null)
  const [runway, setRunway] = useState<RunwayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function fetchData() {
    setLoading(true)
    setError(false)
    try {
      const [posRes, fcRes, esRes, rwRes] = await Promise.all([
        caixaApi.getPosicao(),
        caixaApi.getForecast(),
        caixaApi.getEntradasSaidas(),
        caixaApi.getRunway(),
      ])
      setPosicao(posRes.data?.data ?? posRes.data)
      setForecast(fcRes.data?.data ?? fcRes.data ?? [])
      setEntradasSaidas(esRes.data?.data ?? esRes.data)
      setRunway(rwRes.data?.data ?? rwRes.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-secondary)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 64px' }}>
        <TopBar onToggleChat={onToggleChat} />

        {/* Page title */}
        <motion.div {...fadeUp(0)} style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 24,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.5px',
              margin: 0,
            }}
          >
            Caixa
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              color: 'var(--color-text-tertiary)',
              marginTop: 4,
            }}
          >
            Posição estimada, projeções e runway do negócio
          </p>
        </motion.div>

        <AvisoEstimativa />

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <LoadingState />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ErrorState onRetry={fetchData} />
            </motion.div>
          ) : posicao && forecast.length > 0 ? (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <KpiGrid posicao={posicao} forecast={forecast} />

              {/* Conditional banners — show before charts */}
              <AlertaCaixa
                forecast={forecast}
                custos_fixos_mensais={posicao.custos_fixos_mensais}
              />
              {runway && <OportunidadeCrescimento runway_meses={runway.runway_meses} />}

              <ForecastChart forecast={forecast} />

              {entradasSaidas && <EntradaSaida data={entradasSaidas} />}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: 240,
                gap: 8,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  color: 'var(--color-text-secondary)',
                  textAlign: 'center',
                }}
              >
                Conecte uma plataforma de pagamento para visualizar a posição de caixa.
              </p>
              <motion.button
                whileHover={{ opacity: 0.8 }}
                whileTap={{ scale: 0.97 }}
                onClick={() =>
                  window.dispatchEvent(new CustomEvent('northie:navigate', { detail: 'appstore' }))
                }
                style={{
                  padding: '7px 16px',
                  background: 'var(--color-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 6,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Conectar integração
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
