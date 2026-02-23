import { motion } from 'framer-motion'

const CLIENTS = [
  { name: 'Ana Silva',      value: 12400, cac: 340,  ltv: 48000 },
  { name: 'João Mendes',    value: 9800,  cac: 280,  ltv: 35000 },
  { name: 'Carla Souza',    value: 8200,  cac: 420,  ltv: 29000 },
  { name: 'Pedro Lima',     value: 7600,  cac: 190,  ltv: 52000 },
  { name: 'Mariana Costa',  value: 6900,  cac: 310,  ltv: 24000 },
]

function fmtBR(v: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

const COL_LABEL: React.CSSProperties = {
  fontFamily: "'Geist Mono', 'Courier New', monospace",
  fontSize: 11,
  color: 'rgba(var(--fg-rgb), 0.45)',
  letterSpacing: '0.04em',
}

const COL_VALUE: React.CSSProperties = {
  fontFamily: "'Geist Mono', 'Courier New', monospace",
  fontSize: 13,
  color: 'rgba(var(--fg-rgb), 0.65)',
  textAlign: 'right' as const,
}

export default function TopClients() {
  return (
    <section>
      <p
        style={{
          fontFamily: "'Geist Mono', 'Courier New', monospace",
          fontSize: 12,
          color: 'rgba(var(--fg-rgb), 0.5)',
          letterSpacing: '0.06em',
          marginBottom: 28,
        }}
      >
        TOP CLIENTES DO PERÍODO
      </p>

      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 100px 80px 100px',
          paddingBottom: 10,
          borderBottom: '1px solid rgba(var(--fg-rgb), 0.1)',
          marginBottom: 2,
        }}
      >
        <span style={COL_LABEL}>NOME</span>
        <span style={{ ...COL_LABEL, textAlign: 'right' }}>VALOR</span>
        <span style={{ ...COL_LABEL, textAlign: 'right' }}>CAC</span>
        <span style={{ ...COL_LABEL, textAlign: 'right' }}>LTV</span>
      </div>

      {/* Rows */}
      {CLIENTS.map((c, i) => (
        <motion.div
          key={c.name}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.07 + 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 100px 80px 100px',
            alignItems: 'center',
            padding: '15px 0',
            borderBottom: '1px solid rgba(var(--fg-rgb), 0.06)',
          }}
        >
          {/* Name */}
          <span
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 14,
              color: 'var(--fg)',
              letterSpacing: '-0.3px',
            }}
          >
            {c.name}
          </span>

          {/* Valor */}
          <span style={COL_VALUE}>R$ {fmtBR(c.value)}</span>

          {/* CAC */}
          <span style={COL_VALUE}>R$ {fmtBR(c.cac)}</span>

          {/* LTV */}
          <motion.span
            style={{ ...COL_VALUE, color: 'rgba(var(--fg-rgb), 0.8)' }}
            whileHover={{ color: 'var(--fg)' }}
            transition={{ duration: 0.15 }}
          >
            R$ {fmtBR(c.ltv)}
          </motion.span>
        </motion.div>
      ))}
    </section>
  )
}
