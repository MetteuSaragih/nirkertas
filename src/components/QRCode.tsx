import { useMemo } from 'react'
import { qrPath } from '../lib/ticket'

/** QR Code standar (ISO/IEC 18004) yang dapat dipindai, dirender sebagai satu path SVG. */
export function QRCode({
  value,
  className,
  fg = '#022c22',
  label,
}: {
  value: string
  className?: string
  fg?: string
  label?: string
}) {
  const { d, size } = useMemo(() => qrPath(value), [value])
  const q = 4 // quiet zone sesuai standar
  return (
    <svg
      viewBox={`${-q} ${-q} ${size + q * 2} ${size + q * 2}`}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label ?? 'QR Code e-tiket'}
    >
      <rect x={-q} y={-q} width={size + q * 2} height={size + q * 2} fill="#fff" />
      <path d={d} fill={fg} />
    </svg>
  )
}
