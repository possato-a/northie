import { useMemo } from 'react'
import { motion } from 'framer-motion'

interface DayData {
    date: Date
    count: number
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function SalesHeatmap() {
    const data = useMemo(() => {
        const items: DayData[] = []
        const today = new Date()
        for (let i = 364; i >= 0; i--) {
            const d = new Date()
            d.setDate(today.getDate() - i)
            // Mock random sales count
            const count = Math.floor(Math.random() * 25)
            items.push({ date: d, count })
        }
        return items
    }, [])

    const weeks = useMemo(() => {
        const result: DayData[][] = []
        let currentWeek: DayData[] = []

        // Align first week
        const firstDayPadding = data[0].date.getDay()
        for (let i = 0; i < firstDayPadding; i++) {
            currentWeek.push({ date: new Date(0), count: -1 }) // Empty days
        }

        data.forEach((day) => {
            currentWeek.push(day)
            if (currentWeek.length === 7) {
                result.push(currentWeek)
                currentWeek = []
            }
        })

        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) {
                currentWeek.push({ date: new Date(0), count: -1 })
            }
            result.push(currentWeek)
        }

        return result
    }, [data])

    const getColor = (count: number) => {
        if (count === -1) return 'transparent'
        if (count === 0) return 'rgba(30,30,30,0.03)'
        if (count <= 5) return 'rgba(30,30,30,0.1)'
        if (count <= 10) return 'rgba(30,30,30,0.25)'
        if (count <= 18) return 'rgba(30,30,30,0.5)'
        return '#1E1E1E'
    }

    return (
        <div style={{ marginTop: 40, overflow: 'hidden' }}>
            <p style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 12, color: 'rgba(30,30,30,0.5)',
                letterSpacing: '0.06em', marginBottom: 24,
                textTransform: 'uppercase'
            }}>
                Intensidade de Vendas Diárias
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
                {/* Day Labels */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px 0 6px', height: 130 }}>
                    {DAYS.map((d, i) => i % 2 === 1 && (
                        <span key={d} style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: 'rgba(30,30,30,0.3)', lineHeight: 1 }}>{d}</span>
                    ))}
                </div>

                <div style={{ flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {weeks.map((week, wi) => (
                            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {/* Month label logic - simplified */}
                                {wi % 4 === 0 && (
                                    <span style={{
                                        fontFamily: "'Poppins', sans-serif",
                                        fontSize: 11,
                                        color: 'rgba(30,30,30,0.4)',
                                        marginBottom: 6,
                                        height: 14,
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {MONTHS[week.find(d => d.count !== -1)?.date.getMonth() || 0]}
                                    </span>
                                )}
                                {wi % 4 !== 0 && <div style={{ height: 20 }} />}

                                {week.map((day, di) => (
                                    <motion.div
                                        key={di}
                                        whileHover={{ scale: 1.15, zIndex: 10 }}
                                        title={day.count !== -1 ? `${day.date.toLocaleDateString('pt-BR')}: ${day.count} vendas` : ''}
                                        style={{
                                            width: 16,
                                            height: 16,
                                            borderRadius: 2,
                                            background: getColor(day.count),
                                            cursor: day.count !== -1 ? 'pointer' : 'default',
                                            transition: 'background 0.3s'
                                        }}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 10, color: 'rgba(30,30,30,0.4)' }}>Menos</span>
                {[0, 5, 10, 18, 25].map(c => (
                    <div key={c} style={{ width: 10, height: 10, borderRadius: 2, background: getColor(c) }} />
                ))}
                <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 10, color: 'rgba(30,30,30,0.4)' }}>Mais</span>
            </div>
        </div>
    )
}
