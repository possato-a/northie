import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '../components/layout/TopBar'

interface PageProps {
  onToggleChat: () => void
}

// ── Dados ─────────────────────────────────────────────────────────────────────

const MODELOS = [
  { value: 'saas',       label: 'SaaS / Assinatura' },
  { value: 'ecommerce',  label: 'E-commerce' },
  { value: 'lancamento', label: 'Lançamento / Perpétuo' },
  { value: 'servicos',   label: 'Serviços / Consultoria' },
  { value: 'outro',      label: 'Outro' },
]

const FATURAMENTOS = [
  'Menos de R$ 10k/mês',
  'R$ 10k – R$ 50k/mês',
  'R$ 50k – R$ 150k/mês',
  'R$ 150k – R$ 500k/mês',
  'Acima de R$ 500k/mês',
]

const OBJETIVOS = [
  'Marketing e tráfego pago',
  'Contratar equipe',
  'Desenvolver produto',
  'Comprar estoque',
  'Capital de giro',
  'Outro',
]

const STEPS = [
  { label: 'Modelo',     question: 'Qual é o modelo do seu negócio?',       hint: 'Escolha o que melhor descreve sua operação.' },
  { label: 'Faturamento',question: 'Qual é o seu faturamento mensal médio?', hint: 'Usado para calcular o limite do seu Capital Score.' },
  { label: 'Objetivo',   question: 'Para o que você usaria o capital?',      hint: 'Selecione todos que se aplicam.' },
  { label: 'Contato',    question: 'Quase lá — seus dados de contato.',      hint: 'Entraremos em contato pelo WhatsApp para análise.' },
]

const BENEFICIOS = [
  { label: 'Sem garantia física', desc: 'Nenhum ativo imobilizado como garantia.' },
  { label: 'Limite real',         desc: 'Calculado pelo seu LTV, faturamento e saúde do caixa.' },
  { label: 'Split na fonte',      desc: 'Pagamento como percentual da receita diária.' },
  { label: 'Decisão em 48h',      desc: 'Análise rápida baseada nos seus dados integrados.' },
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function OptionRow({ label, selected, onSelect, multi = false }: {
  label: string; selected: boolean; onSelect: () => void; multi?: boolean
}) {
  return (
    <motion.button
      onClick={onSelect}
      whileTap={{ scale: 0.99 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 16px', width: '100%', textAlign: 'left',
        background: selected ? 'var(--color-bg-secondary)' : 'transparent',
        border: `1px solid ${selected ? 'var(--color-text-tertiary)' : 'var(--color-border)'}`,
        borderRadius: 10, cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{
        width: 16, height: 16, flexShrink: 0,
        borderRadius: multi ? 4 : '50%',
        border: `1.5px solid ${selected ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
        background: selected ? 'var(--color-text-primary)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s ease',
      }}>
        {selected && (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 13,
        color: selected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        fontWeight: selected ? 500 : 400, transition: 'color 0.15s ease',
      }}>
        {label}
      </span>
    </motion.button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Card({ onToggleChat }: PageProps) {
  const [pageState, setPageState] = useState<'form' | 'success'>('form')
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [submitting, setSubmitting] = useState(false)

  const [modelo, setModelo] = useState('')
  const [faturamento, setFaturamento] = useState('')
  const [objetivos, setObjetivos] = useState<string[]>([])
  const [descricao, setDescricao] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  const toggleObjetivo = (obj: string) =>
    setObjetivos(prev => prev.includes(obj) ? prev.filter(o => o !== obj) : [...prev, obj])

  const canProceed = [
    !!modelo,
    !!faturamento,
    objetivos.length > 0,
    true,
  ][currentStep]

  const goNext = () => {
    if (!canProceed) return
    if (currentStep === STEPS.length - 1) { handleSubmit(); return }
    setDirection(1)
    setCurrentStep(s => s + 1)
  }

  const goBack = () => {
    if (currentStep === 0) return
    setDirection(-1)
    setCurrentStep(s => s - 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 1400))
    setSubmitting(false)
    setPageState('success')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border)',
    borderRadius: 10, padding: '11px 14px',
    fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.6,
    color: 'var(--color-text-primary)', outline: 'none',
  }

  const step = STEPS[currentStep]!
  const isLast = currentStep === STEPS.length - 1

  return (
    <div>
      <TopBar onToggleChat={onToggleChat} />

      <AnimatePresence mode="wait">
        {pageState === 'success' ? (

          /* ── Success ── */
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              textAlign: 'center', paddingTop: 80, gap: 18,
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 12L10 17L19 7" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.div>
            <h2 style={{
              fontFamily: 'var(--font-sans)', fontSize: 26, fontWeight: 500,
              letterSpacing: '-0.5px', color: 'var(--color-text-primary)', margin: 0,
            }}>
              Interesse registrado
            </h2>
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-text-secondary)',
              margin: 0, lineHeight: 1.65, maxWidth: 400,
            }}>
              Recebemos sua solicitação. Vamos analisar seu perfil financeiro e entrar em contato pelo WhatsApp em breve.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {['Northie Card', 'Capital Score', 'Split automático'].map(tag => (
                <span key={tag} style={{
                  fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
                  background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-full)', padding: '3px 10px',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>

        ) : (

          /* ── Form layout ── */
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 24, alignItems: 'start' }}
          >

            {/* ═══ Coluna esquerda — Hero ═══ */}
            <div style={{ position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Headline card */}
              <div style={{
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-md)',
                padding: '32px 28px 28px',
              }}>
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400,
                  color: 'var(--color-text-tertiary)', letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  Northie Card
                </span>
                <h2 style={{
                  fontFamily: 'var(--font-sans)', fontSize: 28, fontWeight: 500,
                  letterSpacing: '-0.6px', color: 'var(--color-text-primary)',
                  lineHeight: 1.2, margin: '10px 0 16px',
                }}>
                  Capital que cresce com o seu negócio.
                </h2>
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-secondary)',
                  lineHeight: 1.65, margin: '0 0 24px',
                }}>
                  Sem garantia física, sem equity, sem burocracia. O limite é calculado diretamente pelos seus dados de faturamento, LTV e saúde do caixa — não por quem você conhece.
                </p>
                <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 20 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {BENEFICIOS.map((b, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.35, delay: 0.1 + i * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                        border: '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5L4.5 7.5L8 2.5" stroke="var(--color-text-primary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>
                          {b.label}
                        </p>
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-tertiary)', margin: 0, lineHeight: 1.5 }}>
                          {b.desc}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Nota regulatória */}
              <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
                margin: 0, lineHeight: 1.55, padding: '0 4px',
              }}>
                Opera via parceiro financeiro regulado. Limite calculado com base nos seus dados reais — não em score de crédito tradicional.
              </p>
            </div>

            {/* ═══ Coluna direita — Formulário por etapas ═══ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Progress */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {STEPS.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: i < currentStep ? 'var(--color-text-primary)' : i === currentStep ? 'var(--color-bg-primary)' : 'transparent',
                        border: `1.5px solid ${i <= currentStep ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.25s ease',
                        flexShrink: 0,
                      }}>
                        {i < currentStep ? (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <span style={{
                            fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
                            color: i === currentStep ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                          }}>
                            {i + 1}
                          </span>
                        )}
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-sans)', fontSize: 11,
                        color: i === currentStep ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
                        fontWeight: i === currentStep ? 500 : 400,
                        transition: 'color 0.2s ease',
                      }}>
                        {s.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div style={{ width: 20, height: 1, background: i < currentStep ? 'var(--color-text-tertiary)' : 'var(--color-border)', transition: 'background 0.25s ease' }} />
                    )}
                  </div>
                ))}
              </motion.div>

              {/* Step card */}
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentStep}
                  custom={direction}
                  variants={{
                    enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
                    center: { opacity: 1, x: 0 },
                    exit: (dir: number) => ({ opacity: 0, x: -dir * 28 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                  style={{
                    background: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-md)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Step header */}
                  <div style={{ padding: '28px 28px 20px' }}>
                    <span style={{
                      fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400,
                      color: 'var(--color-text-tertiary)', letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}>
                      Etapa {currentStep + 1} de {STEPS.length}
                    </span>
                    <h3 style={{
                      fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 500,
                      letterSpacing: '-0.35px', color: 'var(--color-text-primary)',
                      margin: '8px 0 4px',
                    }}>
                      {step.question}
                    </h3>
                    <p style={{
                      fontFamily: 'var(--font-sans)', fontSize: 13,
                      color: 'var(--color-text-tertiary)', margin: 0,
                    }}>
                      {step.hint}
                    </p>
                  </div>

                  {/* Step content */}
                  <div style={{ padding: '0 20px 4px' }}>
                    {currentStep === 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {MODELOS.map(m => (
                          <OptionRow key={m.value} label={m.label} selected={modelo === m.value} onSelect={() => setModelo(m.value)} />
                        ))}
                      </div>
                    )}
                    {currentStep === 1 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {FATURAMENTOS.map(f => (
                          <OptionRow key={f} label={f} selected={faturamento === f} onSelect={() => setFaturamento(f)} />
                        ))}
                      </div>
                    )}
                    {currentStep === 2 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {OBJETIVOS.map(obj => (
                          <OptionRow key={obj} label={obj} selected={objetivos.includes(obj)} onSelect={() => toggleObjetivo(obj)} multi />
                        ))}
                      </div>
                    )}
                    {currentStep === 3 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <textarea
                          value={descricao}
                          onChange={e => setDescricao(e.target.value)}
                          placeholder="Conte sobre o momento do seu negócio e como o capital seria usado... (opcional)"
                          rows={4}
                          style={{ ...inputStyle, resize: 'none' }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-text-tertiary)' }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
                        />
                        <div>
                          <p style={{
                            fontFamily: 'var(--font-sans)', fontSize: 11,
                            color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
                            textTransform: 'uppercase', margin: '0 0 8px',
                          }}>
                            WhatsApp
                          </p>
                          <input
                            type="tel"
                            value={whatsapp}
                            onChange={e => setWhatsapp(e.target.value)}
                            placeholder="(11) 99999-9999"
                            style={inputStyle}
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-text-tertiary)' }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Navigation footer */}
                  <div style={{
                    padding: '20px 20px 24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>

                    {/* Back */}
                    <motion.button
                      onClick={goBack}
                      whileHover={currentStep > 0 ? { x: -2 } : {}}
                      whileTap={currentStep > 0 ? { scale: 0.96 } : {}}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '9px 16px',
                        background: 'transparent',
                        border: `1px solid ${currentStep > 0 ? 'var(--color-border)' : 'transparent'}`,
                        borderRadius: 10, cursor: currentStep > 0 ? 'pointer' : 'default',
                        fontFamily: 'var(--font-sans)', fontSize: 13,
                        color: currentStep > 0 ? 'var(--color-text-secondary)' : 'transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Voltar
                    </motion.button>

                    {/* Hint text */}
                    {!canProceed && currentStep < 3 && (
                      <p style={{
                        fontFamily: 'var(--font-sans)', fontSize: 11,
                        color: 'var(--color-text-tertiary)', margin: 0,
                      }}>
                        Selecione uma opção para continuar
                      </p>
                    )}

                    {/* Next / Submit */}
                    <motion.button
                      onClick={goNext}
                      disabled={!canProceed || submitting}
                      whileHover={canProceed ? { x: isLast ? 0 : 2 } : {}}
                      whileTap={canProceed ? { scale: 0.97 } : {}}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px',
                        background: canProceed ? 'var(--color-text-primary)' : 'var(--color-border)',
                        color: canProceed ? 'white' : 'var(--color-text-tertiary)',
                        border: 'none', borderRadius: 10,
                        fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
                        cursor: canProceed ? 'pointer' : 'default',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {submitting ? (
                        <>
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                            style={{ display: 'flex' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <circle cx="6" cy="6" r="4.5" stroke="white" strokeWidth="1.5" strokeDasharray="8 20" strokeLinecap="round"/>
                            </svg>
                          </motion.span>
                          Enviando...
                        </>
                      ) : isLast ? (
                        'Registrar interesse'
                      ) : (
                        <>
                          Próximo
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Resumo das etapas concluídas */}
              {currentStep > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                  style={{
                    background: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px 20px',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}
                >
                  <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400,
                    color: 'var(--color-text-tertiary)', letterSpacing: '0.06em',
                    textTransform: 'uppercase', margin: 0,
                  }}>
                    Respostas anteriores
                  </p>
                  {currentStep > 0 && modelo && (
                    <SummaryRow label="Modelo" value={MODELOS.find(m => m.value === modelo)?.label ?? modelo} onEdit={() => { setDirection(-1); setCurrentStep(0) }} />
                  )}
                  {currentStep > 1 && faturamento && (
                    <SummaryRow label="Faturamento" value={faturamento} onEdit={() => { setDirection(-1); setCurrentStep(1) }} />
                  )}
                  {currentStep > 2 && objetivos.length > 0 && (
                    <SummaryRow label="Objetivo" value={objetivos.join(', ')} onEdit={() => { setDirection(-1); setCurrentStep(2) }} />
                  )}
                </motion.div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)', margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </p>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </p>
      </div>
      <button
        onClick={onEdit}
        style={{
          fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
          background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0,
        }}
      >
        Editar
      </button>
    </div>
  )
}
