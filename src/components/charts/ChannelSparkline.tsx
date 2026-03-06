/**
 * @file components/charts/ChannelSparkline.tsx
 * Mini sparkline SVG para tendências de canal (ROAS/CAC).
 */

import { motion } from 'framer-motion'

interface ChannelSparklineProps {
    data: number[]
    height?: number
    id?: string
}

export default function ChannelSparkline({ data, height = 40, id = 'default' }: ChannelSparklineProps) {
    if (data.length < 2) return null
    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = (max - min) || 1
    const padding = range * 0.15
    const effectiveMax = max + padding
    const effectiveMin = min - padding
    const effectiveRange = effectiveMax - effectiveMin

    const points = data.map((v, i) => ({
        x: (i / (data.length - 1)) * 100,
        y: 100 - ((v - effectiveMin) / effectiveRange) * 100,
    }))

    let pathData = `M ${points[0]!.x},${points[0]!.y}`
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i]!
        const p1 = points[i + 1]!
        const cp1x = p0.x + (p1.x - p0.x) / 3
        const cp2x = p0.x + 2 * (p1.x - p0.x) / 3
        pathData += ` C ${cp1x},${p0.y} ${cp2x},${p1.y} ${p1.x},${p1.y}`
    }

    const fillData = `${pathData} L 100,100 L 0,100 Z`
    const gradId = `grad-${id.replace(/[\s_]/g, '-').toLowerCase()}`
    const lastPoint = points[points.length - 1]!

    return (
        <div style={{ width: '100%', height, position: 'relative' }}>
            <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
            >
                <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" style={{ stopColor: 'rgba(var(--fg-rgb), 0.07)' }} />
                        <stop offset="100%" style={{ stopColor: 'rgba(var(--fg-rgb), 0)' }} />
                    </linearGradient>
                </defs>
                <path d={fillData} fill={`url(#${gradId})`} />
                <motion.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.4, ease: 'easeOut' }}
                    d={pathData}
                    fill="none"
                    stroke="rgba(var(--fg-rgb), 0.45)"
                    strokeWidth={1.8}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1.1, duration: 0.25 }}
                style={{
                    position: 'absolute',
                    left: `${lastPoint.x}%`,
                    top: `${lastPoint.y}%`,
                    width: 5, height: 5,
                    borderRadius: '50%',
                    background: 'var(--fg)',
                    transform: 'translate(-50%, -50%)',
                    opacity: 0.65,
                }}
            />
        </div>
    )
}
