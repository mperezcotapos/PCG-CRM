import { getEstado } from '../lib/constants'

export default function StatusBadge({ value, size = 'sm' }) {
  const estado = getEstado(value)
  const sizes  = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
  return (
    <span className={`badge ${estado.color} ${sizes} gap-1.5`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${estado.dot}`} />
      {estado.label}
    </span>
  )
}
