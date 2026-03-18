import { motion } from 'framer-motion'
import type { SegmentItem } from '../../hooks/useCollaborationSession'

interface CustomerSegmentPreviewProps {
  items: SegmentItem[]
  customersWithPhone: number
  customersWithoutPhone: number
}

function fmtLtv(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function truncateEmail(email: string, max = 28): string {
  if (email.length <= max) return email
  return email.slice(0, max) + '...'
}

function formatDaysInactive(days: number | undefined): string {
  if (days === undefined || days === null) return '—'
  if (days === 1) return 'há 1 dia'
  return `há ${days} dias`
}

export default function CustomerSegmentPreview({
  items,
  customersWithPhone,
  customersWithoutPhone,
}: CustomerSegmentPreviewProps) {
  const total = items.length

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            fontWeight: 400,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            color: 'var(--color-text-tertiary)',
          }}>
            Segmento identificado
          </span>
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 99,
            padding: '1px 8px',
          }}>
            {total} {total === 1 ? 'cliente' : 'clientes'}
          </span>
        </div>

        {/* Channel stats */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#25D366',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              color: 'var(--color-text-secondary)',
            }}>
              {customersWithPhone} com WhatsApp
            </span>
          </div>
          {customersWithoutPhone > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#F59E0B',
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                color: 'var(--color-text-secondary)',
              }}>
                {customersWithoutPhone} sem telefone
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Customer list — scrollable */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        scrollbarWidth: 'thin' as const,
        padding: '8px 0',
      }}>
        {total === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 8,
            padding: 32,
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              color: 'var(--color-text-tertiary)',
              margin: 0,
              textAlign: 'center' as const,
            }}>
              Nenhum cliente no segmento
            </p>
          </div>
        ) : (
          items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04, ease: [0.25, 0.1, 0.25, 1] }}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 24px',
                borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none',
                gap: 12,
              }}
            >
              {/* Phone indicator */}
              <div style={{ flexShrink: 0 }}>
                {item.phone ? (
                  <span style={{
                    display: 'block',
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#25D366',
                  }} />
                ) : (
                  <span style={{
                    display: 'block',
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#F59E0B',
                    opacity: 0.7,
                  }} />
                )}
              </div>

              {/* Email + days inactive */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'block',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  color: 'var(--color-text-primary)',
                  whiteSpace: 'nowrap' as const,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {truncateEmail(item.email)}
                </span>
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11,
                  color: 'var(--color-text-tertiary)',
                }}>
                  {formatDaysInactive(item.days_inactive)}
                </span>
              </div>

              {/* LTV */}
              <div style={{ flexShrink: 0, textAlign: 'right' as const }}>
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                }}>
                  R$ {fmtLtv(item.total_ltv)}
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Footer note */}
      {total > 8 && (
        <div style={{
          padding: '10px 24px',
          borderTop: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
          }}>
            Mostrando todos os {total} clientes do segmento
          </span>
        </div>
      )}
    </div>
  )
}
