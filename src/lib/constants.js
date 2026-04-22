export const ESTADOS = [
  { value: 'esp_antecedentes', label: 'Esperando Antecedentes', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  { value: 'ant_recibidos',    label: 'Antecedentes Recibidos', color: 'bg-teal-100 text-teal-700',   dot: 'bg-teal-500'  },
  { value: 'cotizando',    label: 'Cotizando a China',    color: 'bg-sky-100 text-sky-700',      dot: 'bg-sky-500'     },
  { value: 'cot_recibida', label: 'Cotización recibida',  color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500'  },
  { value: 'cot_enviada',  label: 'Cotización enviada',   color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500'  },
  { value: 'negociacion',  label: 'Negociación',          color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500'  },
  { value: 'ganado',       label: 'Ganado',               color: 'bg-green-100 text-green-700',   dot: 'bg-green-500'   },
  { value: 'perdido',      label: 'Perdido',              color: 'bg-red-100 text-red-700',       dot: 'bg-red-500'     },
  { value: 'pausado',      label: 'Pausado',              color: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-400'    },
]

export const PELOTA = [
  { value: '-',          label: '—',         color: '' },
  { value: 'nosotros',   label: 'Nosotros',  color: 'bg-green-100 text-green-800' },
  { value: 'cliente',    label: 'Cliente',   color: 'bg-amber-50 text-amber-700' },
  { value: 'proveedor',  label: 'Proveedor', color: 'bg-purple-50 text-purple-700' },
]

export const CATEGORIAS = [
  'Muebles de Cocina',
  'Closets',
  'Muebles de Baño',
  'Puertas',
  'Ventanas',
  'Puertas y Ventanas',
  'Revestimientos',
  'Artefactos',
  'Kit de Cocina',
  'Piso',
  'Otro',
]

// Prioridad numérica: 1 (más urgente) → 30 (menos urgente)
export const PRIORIDAD_DEFAULT = 15
export const PRIORIDAD_MIN = 1
export const PRIORIDAD_MAX = 30

export const getEstado = (value) =>
  ESTADOS.find(e => e.value === value) || ESTADOS[0]

export const getPelota = (value) =>
  PELOTA.find(p => p.value === value) || PELOTA[0]

const gen2 = (str) => (str || '').trim().toUpperCase().slice(0, 2).padEnd(2, 'X')

export const buildPcgId = (clientName, projectName, partidaName, providerName) =>
  gen2(clientName) + gen2(projectName) + gen2(partidaName) + gen2(providerName)
