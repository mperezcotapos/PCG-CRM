import { useState, useMemo, useRef, useEffect } from 'react'
import { useApp, getActivityMs } from '../context/AppContext'
import { getPelota, ESTADOS, PELOTA, buildPcgId } from '../lib/constants'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import ActivityForm from '../components/ActivityForm'
import { EditActivityForm } from './History'
import { differenceInDays, format, parseISO, isAfter, startOfToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { updatePartida, updateProject, updateActivity, deletePartida, deleteActivity } from '../lib/db'

// ── Column definitions ────────────────────────────────────────────
const COL_DEFS = [
  { key: 'cliente',      label: 'Cliente'           },
  { key: 'proyecto',     label: 'Proyecto'          },
  { key: 'partida',      label: 'Partida'           },
  { key: 'estado',       label: 'Estado'            },
  { key: 'pelota',       label: 'Pelota'            },
  { key: 'responsable',  label: 'Responsable'       },
  { key: 'proveedor',    label: 'Proveedor'         },
  { key: 'prioridad',    label: 'Prioridad'         },
  { key: 'pcgId',        label: 'ID'                },
  { key: 'comentario',   label: 'Último comentario' },
  { key: 'proxima',      label: 'Próxima acción'    },
  { key: 'sinAct',       label: 'Sin act.'          },
]
const DEFAULT_VISIBLE = new Set(['cliente','proyecto','partida','estado','pelota','responsable','proveedor','prioridad','comentario','proxima','sinAct'])
const LS_ORDER = 'crm_col_order_v4'
const LS_VIS   = 'crm_col_vis_v4'

function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback }
  catch { return fallback }
}

// ── Sort value per column ─────────────────────────────────────────
function sortVal(colKey, row) {
  const { partida, project, client, latest, daysSince } = row
  switch (colKey) {
    case 'cliente':    return (client?.name   || '').toLowerCase()
    case 'proyecto':   return (project?.name  || '').toLowerCase()
    case 'partida':    return (partida.name   || '').toLowerCase()
    case 'estado':     return latest?.status  || ''
    case 'pelota':     return latest?.pelota  || ''
    case 'proveedor':  return (partida.provider || '').toLowerCase()
    case 'prioridad':  return Number(partida.priority) || 99
    case 'pcgId':      return buildPcgId(client?.name, project?.name, partida.name, partida.provider)
    case 'responsable': return (latest?.responsible || '').toLowerCase()
    case 'comentario': return (latest?.comment || '').toLowerCase()
    case 'proxima':    return latest?.nextActionDate || 'zzzz'
    case 'sinAct':     return daysSince ?? 9999
    default:           return ''
  }
}

// ── Small chips ────────────────────────────────────────────────────
function DaysChip({ days }) {
  if (days === null || days === undefined) return <span className="text-gray-400 text-xs">—</span>
  if (days === 0)  return <span className="badge bg-green-100 text-green-700">Hoy</span>
  if (days <= 3)   return <span className="badge bg-green-100 text-green-700">{days}d</span>
  if (days <= 7)   return <span className="badge bg-yellow-100 text-yellow-700">{days}d</span>
  if (days <= 14)  return <span className="badge bg-orange-100 text-orange-700">{days}d</span>
  return <span className="badge bg-red-100 text-red-700">{days}d</span>
}

function NextActionChip({ date }) {
  if (!date) return <span className="text-gray-400 text-xs">—</span>
  try {
    const d    = parseISO(date)
    const days = differenceInDays(d, startOfToday())
    const lbl  = format(d, 'd MMM', { locale: es })
    if (days < 0)   return <span className="badge bg-red-100 text-red-700">Vencido · {lbl}</span>
    if (days === 0) return <span className="badge bg-orange-100 text-orange-700">Hoy · {lbl}</span>
    if (days <= 3)  return <span className="badge bg-yellow-100 text-yellow-700">{lbl}</span>
    return <span className="badge bg-gray-100 text-gray-600">{lbl}</span>
  } catch { return <span className="text-gray-400 text-xs">—</span> }
}

// ── Sort icon ─────────────────────────────────────────────────────
function SortIcon({ active, dir }) {
  return (
    <span className={`inline-flex flex-col ml-1 ${active ? 'opacity-100' : 'opacity-25'}`}>
      <svg className={`w-2.5 h-2.5 -mb-0.5 ${active && dir === 'asc' ? 'text-navy-600' : 'text-gray-400'}`}
        viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 0L10 6H0z"/>
      </svg>
      <svg className={`w-2.5 h-2.5 ${active && dir === 'desc' ? 'text-navy-600' : 'text-gray-400'}`}
        viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 6L0 0h10z"/>
      </svg>
    </span>
  )
}

// ── Inline priority editor ────────────────────────────────────────
function PriorityCell({ partida }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(Number(partida.priority) || 15))
  const inputRef = useRef(null)

  const n = Number(partida.priority) || 15
  let cls
  if (n <= 5)       cls = 'bg-red-100 text-red-700 font-bold'
  else if (n <= 10) cls = 'bg-orange-100 text-orange-700 font-semibold'
  else if (n <= 20) cls = 'bg-gray-100 text-gray-600'
  else              cls = 'bg-gray-50 text-gray-300'

  const startEdit = (e) => {
    e.stopPropagation()
    setDraft(String(n))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commit = async () => {
    const val = Math.min(30, Math.max(1, Number(draft) || n))
    setEditing(false)
    if (val !== n) await updatePartida(partida.id, { priority: val })
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); commit() }
    if (e.key === 'Escape') { setEditing(false) }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="1" max="30" step="1"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className="priority-edit-cell w-12 h-6 text-center text-xs border border-navy-400 rounded-full outline-none focus:ring-1 focus:ring-navy-500 bg-white"
      />
    )
  }

  return (
    <span
      data-priority-cell
      title="Click para editar prioridad"
      onClick={startEdit}
      className={`inline-flex items-center justify-center w-7 h-6 rounded-full text-xs cursor-pointer hover:opacity-70 transition-opacity ${cls}`}
    >
      {n}
    </span>
  )
}

// ── Cell renderer ─────────────────────────────────────────────────
function Cell({ colKey, row }) {
  const { partida, project, client, latest, daysSince } = row
  const pelota = getPelota(latest?.pelota)
  switch (colKey) {
    case 'cliente':
      return <span className="font-medium text-gray-900 whitespace-nowrap">{client?.name || '—'}</span>
    case 'proyecto':
      return <span className="text-gray-600 whitespace-nowrap">{project?.name || '—'}</span>
    case 'partida':
      return <span className="font-medium text-gray-800">{partida.name}</span>
    case 'estado':
      return <StatusBadge value={latest?.status || 'cotizando'} />
    case 'pelota':
      return latest?.pelota && latest.pelota !== '-'
        ? <span className={`badge ${pelota.color}`}>{pelota.label}</span>
        : <span className="text-gray-300 text-xs">—</span>
    case 'responsable':
      return <span className="text-gray-600 whitespace-nowrap text-sm">{latest?.responsible || '—'}</span>
    case 'proveedor':
      return <span className="text-gray-600 whitespace-nowrap text-xs">{partida.provider || '—'}</span>
    case 'prioridad':
      return <PriorityCell partida={partida} />
    case 'pcgId':
      return <span className="text-xs text-gray-400 font-mono">{buildPcgId(client?.name, project?.name, partida.name, partida.provider)}</span>
    case 'comentario':
      return (
        <div className="max-w-xs">
          <p className="truncate text-gray-700">{latest?.comment || '—'}</p>
          {latest?.date && (
            <p className="text-xs text-gray-400 mt-0.5">
              {format(parseISO(latest.date), 'd MMM yyyy', { locale: es })}
              {latest.responsible && ` · ${latest.responsible}`}
            </p>
          )}
        </div>
      )
    case 'proxima':
      return (
        <div className="max-w-xs">
          {latest?.nextAction && <p className="text-xs text-gray-600 truncate mb-0.5">{latest.nextAction}</p>}
          <NextActionChip date={latest?.nextActionDate} />
        </div>
      )
    case 'sinAct':
      return <DaysChip days={daysSince} />
    default:
      return null
  }
}

// ── Multi-select dropdown ─────────────────────────────────────────
function MultiSelect({ placeholder, options, values, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  const toggle = val => {
    const n = new Set(values); n.has(val) ? n.delete(val) : n.add(val); onChange(n)
  }
  const display = values.size ? `${values.size} seleccionado${values.size > 1 ? 's' : ''}` : placeholder
  return (
    <div className="relative" ref={ref}>
      <button type="button"
        className={`select text-left flex items-center justify-between min-w-44 ${values.size ? 'ring-2 ring-navy-400 border-navy-400' : ''}`}
        onClick={() => setOpen(v => !v)}>
        <span className={`text-sm ${values.size ? 'text-navy-700 font-medium' : 'text-gray-500'}`}>{display}</span>
        <svg className="w-3 h-3 ml-2 text-gray-400 flex-shrink-0" viewBox="0 0 10 6" fill="currentColor"><path d="M5 6L0 0h10z"/></svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-full max-h-64 overflow-y-auto">
          {values.size > 0 && (
            <button type="button" className="w-full text-left text-xs text-navy-600 hover:underline px-2 pb-2" onClick={() => onChange(new Set())}>
              Limpiar selección
            </button>
          )}
          {options.map(o => (
            <label key={o.value} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded">
              <input type="checkbox" checked={values.has(o.value)} onChange={() => toggle(o.value)} className="accent-navy-600" />
              <span className="text-sm text-gray-700">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Column picker ─────────────────────────────────────────────────
function ColPicker({ colOrder, visibleCols, onToggle, onReset, onClose }) {
  return (
    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-48">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Columnas</span>
        <button className="text-xs text-navy-600 hover:underline" onClick={onReset}>Restablecer</button>
      </div>
      <div className="space-y-1">
        {colOrder.map(key => {
          const col = COL_DEFS.find(c => c.key === key)
          if (!col) return null
          return (
            <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
              <input
                type="checkbox"
                checked={visibleCols.has(key)}
                onChange={() => onToggle(key)}
                className="accent-navy-600"
              />
              <span className="text-sm text-gray-700">{col.label}</span>
            </label>
          )
        })}
      </div>
      <button className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600" onClick={onClose}>Cerrar</button>
    </div>
  )
}

// ── Per-column filter input ───────────────────────────────────────
function ColFilterInput({ colKey, value, onChange, options }) {
  if (!options || options.length === 0) return null
  const cls = 'w-full text-xs rounded border border-gray-200 bg-gray-50 px-1.5 py-1 focus:outline-none focus:border-navy-400 focus:bg-white transition-colors'
  return (
    <select className={cls} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">—</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────
export default function Dashboard() {
  const { getDashboardRows, clients, projects, loading } = useApp()

  // Global filters (top bar + mobile)
  const [filterClientes,    setFilterClientes]    = useState(new Set())
  const [filterEstados,     setFilterEstados]      = useState(new Set())
  const [filterPelota,      setFilterPelota]       = useState(new Set())
  const [filterResponsable, setFilterResponsable]  = useState(new Set())
  const [filterProveedor,   setFilterProveedor]    = useState(new Set())
  const [filterProyectos,   setFilterProyectos]    = useState(new Set())
  const [filterPrioridad,   setFilterPrioridad]    = useState('')
  const [filterSearch,      setFilterSearch]       = useState('')

  // Per-column filters (desktop filter row)
  const [colFilters, setColFilters] = useState({})
  const setColFilter = (key, val) => setColFilters(f => ({ ...f, [key]: val }))
  const hasColFilters = Object.values(colFilters).some(v => v)
  const clearColFilters = () => setColFilters({})

  // Modals
  const [selectedRow, setSelectedRow] = useState(null)
  const [editRow,     setEditRow]     = useState(null)
  const [historyRow,  setHistoryRow]  = useState(null)

  // Column config (persisted)
  const [colOrder, setColOrder] = useState(() =>
    loadLS(LS_ORDER, COL_DEFS.map(c => c.key)))
  const [visibleCols, setVisibleCols] = useState(() =>
    new Set(loadLS(LS_VIS, [...DEFAULT_VISIBLE])))
  const [showColPicker, setShowColPicker] = useState(false)

  // Sorting — default: próxima acción ascendente
  const [sortKey, setSortKey] = useState('proxima')
  const [sortDir, setSortDir] = useState('asc')

  // Drag & drop
  const dragSrc    = useRef(null)
  const dragTarget = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  // Persist column prefs
  useEffect(() => { localStorage.setItem(LS_ORDER, JSON.stringify(colOrder)) }, [colOrder])
  useEffect(() => { localStorage.setItem(LS_VIS, JSON.stringify([...visibleCols])) }, [visibleCols])

  // Close col picker on outside click
  const pickerRef = useRef(null)
  useEffect(() => {
    if (!showColPicker) return
    const handler = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowColPicker(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showColPicker])

  const rows = getDashboardRows()

  // Filter — global bar + per-column
  const filtered = useMemo(() => rows.filter(({ partida, project, client, latest, daysSince }) => {
    // global bar
    if (filterClientes.size    && !filterClientes.has(client?.id))                      return false
    if (filterProyectos.size   && !filterProyectos.has(project?.id))                   return false
    if (filterEstados.size     && !filterEstados.has(latest?.status))                   return false
    if (filterPelota.size      && !filterPelota.has(latest?.pelota || '-'))             return false
    if (filterResponsable.size && !filterResponsable.has(latest?.responsible || ''))   return false
    if (filterProveedor.size   && !filterProveedor.has(partida.provider || ''))        return false
    if (filterPrioridad        && Number(partida.priority || 15) > Number(filterPrioridad)) return false
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      const hay = [client?.name, project?.name, partida.name, latest?.comment, latest?.responsible, partida.pcgId]
        .join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    // per-column filters (all dropdowns → exact match)
    for (const [key, val] of Object.entries(colFilters)) {
      if (!val) continue
      switch (key) {
        case 'cliente':     if ((client?.name        || '') !== val) return false; break
        case 'proyecto':    if ((project?.name       || '') !== val) return false; break
        case 'partida':     if ((partida.name        || '') !== val) return false; break
        case 'estado':      if ((latest?.status      || '') !== val) return false; break
        case 'pelota':      if ((latest?.pelota      || '') !== val) return false; break
        case 'responsable': if ((latest?.responsible || '') !== val) return false; break
        case 'proveedor':   if ((partida.provider    || '') !== val) return false; break
        case 'prioridad':   if ((partida.priority    || '') !== val) return false; break
        case 'pcgId':       if (buildPcgId(client?.name, project?.name, partida.name, partida.provider) !== val) return false; break
        default: break
      }
    }
    return true
  }), [rows, filterClientes, filterProyectos, filterEstados, filterPelota, filterResponsable, filterProveedor, filterPrioridad, filterSearch, colFilters])

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const va = sortVal(sortKey, a)
      const vb = sortVal(sortKey, b)
      const cmp = typeof va === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'es')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  // Per-column dropdown options (built from all rows)
  const colOptions = useMemo(() => {
    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
    const opts = (arr) => uniq(arr).map(v => ({ value: v, label: v }))
    return {
      cliente:     opts(rows.map(r => r.client?.name)),
      proyecto:    opts(rows.map(r => r.project?.name)),
      partida:     opts(rows.map(r => r.partida?.name)),
      estado:      ESTADOS.map(e => ({ value: e.value, label: e.label })),
      pelota:      PELOTA.filter(p => p.value !== '-').map(p => ({ value: p.value, label: p.label })),
      responsable: opts(rows.map(r => r.latest?.responsible)),
      proveedor:   opts(rows.map(r => r.partida?.provider)),
      prioridad:   [], // filtro numérico no aplica como dropdown
      pcgId:       opts(rows.map(r => r.partida?.pcgId)),
    }
  }, [rows])

  // Stats
  const stats = useMemo(() => {
    const total     = rows.filter(r => r.latest?.status !== 'perdido' && r.latest?.status !== 'pausado').length
    const cotizando = rows.filter(r => ['cotizando','cot_recibida'].includes(r.latest?.status)).length
    const enviadas  = rows.filter(r => ['cot_enviada','negociacion'].includes(r.latest?.status)).length
    const ganadas   = rows.filter(r => r.latest?.status === 'ganado').length
    const sinUpdate = rows.filter(r => r.daysSince != null && r.daysSince > 7 && !['ganado','perdido','pausado'].includes(r.latest?.status)).length
    return { total, cotizando, enviadas, ganadas, sinUpdate }
  }, [rows])

  // Column handlers
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  const toggleCol = (key) => setVisibleCols(s => {
    const n = new Set(s)
    n.has(key) ? n.delete(key) : n.add(key)
    return n
  })
  const resetCols = () => {
    setColOrder(COL_DEFS.map(c => c.key))
    setVisibleCols(new Set(DEFAULT_VISIBLE))
  }

  // Drag & drop handlers
  const onDragStart = (e, key) => { dragSrc.current = key; dragTarget.current = null; e.dataTransfer.effectAllowed = 'move' }
  const onDragOver  = (e, key) => { e.preventDefault(); dragTarget.current = key; setDragOver(key) }
  const onDrop      = (e, targetKey) => {
    e.preventDefault()
    applyReorder(targetKey)
  }
  const onDragEnd = () => {
    // Fallback: aplica el reorden si onDrop no se disparó
    applyReorder(dragTarget.current)
  }
  const applyReorder = (targetKey) => {
    setDragOver(null)
    const src = dragSrc.current
    dragSrc.current = null
    dragTarget.current = null
    if (!src || !targetKey || src === targetKey) return
    setColOrder(order => {
      const arr = [...order]
      const fi  = arr.indexOf(src)
      const ti  = arr.indexOf(targetKey)
      if (fi < 0 || ti < 0) return arr
      arr.splice(fi, 1)
      arr.splice(ti, 0, src)
      return arr
    })
  }

  const activeCols = colOrder.filter(k => visibleCols.has(k))

  // ── Export XLSX ───────────────────────────────────────────────────
  const exportXLSX = async () => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = 'PCG Group CRM'
    wb.created = new Date()

    const monthYear = format(new Date(), 'MMMM yyyy', { locale: es })
      .replace(/^\w/, c => c.toUpperCase())
    const fileName  = `PCG_Supplier_Report_${format(new Date(), 'MMMMyyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())}.xlsx`

    // ── helpers ──
    const actionRequired = (status, nextAction) => {
      if (nextAction) return nextAction
      switch (status) {
        case 'esp_antecedentes': return '⏳ Awaiting project specs from client'
        case 'ant_recibidos':    return '📋 Specs received — please prepare quote'
        case 'cotizando':        return '🔄 Quote in preparation — pending from supplier'
        case 'cot_recibida':     return '✅ Quote received — under PCG review'
        case 'cot_enviada':      return '📤 Quote sent to client — awaiting response'
        case 'negociacion':      return '🤝 Under negotiation'
        case 'ganado':           return '✅ Awarded'
        case 'perdido':          return '✖ Not awarded'
        case 'pausado':          return '⏸ On hold — project paused'
        default:                 return ''
      }
    }
    const priorityLabel = (n) => {
      if (n <= 5)  return '🔴 High'
      if (n <= 15) return '🟡 Medium'
      return '⬇ Low'
    }
    const STATUS_EN = {
      esp_antecedentes: 'Awaiting Specs',
      ant_recibidos:    'Specs Received',
      cotizando:        'Quoting to China',
      cot_recibida:     'Quote Received',
      cot_enviada:      'Quote Sent',
      negociacion:      'Negotiation',
      ganado:           'Won',
      perdido:          'Lost',
      pausado:          'On Hold',
    }
    const statusLabel = (s) => STATUS_EN[s] || s || ''

    // Navy-ish fill and font helpers
    const navy    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A5C' } }
    const white   = { argb: 'FFFFFFFF' }
    const bold14  = { name: 'Calibri', size: 14, bold: true, color: white }
    const bold11  = { name: 'Calibri', size: 11, bold: true, color: white }
    const bold10  = { name: 'Calibri', size: 10, bold: true }
    const reg10   = { name: 'Calibri', size: 10 }
    const gray50  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
    const thinBorder = {
      top:    { style: 'thin', color: { argb: 'FFD0D0D0' } },
      left:   { style: 'thin', color: { argb: 'FFD0D0D0' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      right:  { style: 'thin', color: { argb: 'FFD0D0D0' } },
    }

    const applyHeaderRow = (ws, colCount, labels) => {
      const headerRow = ws.getRow(6)
      labels.forEach((lbl, i) => {
        const cell = headerRow.getCell(i + 1)
        cell.value = lbl
        cell.font  = bold10
        cell.fill  = navy
        cell.font  = { ...bold10, color: white }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = thinBorder
      })
      headerRow.height = 22
    }

    const applyTitleBlock = (ws, title, colCount, statsText) => {
      // Row 1: title
      ws.mergeCells(1, 1, 1, colCount)
      const t = ws.getCell('A1')
      t.value = title
      t.font  = bold14
      t.fill  = navy
      t.alignment = { vertical: 'middle', horizontal: 'left' }
      ws.getRow(1).height = 32

      // Row 2: subtitle
      ws.mergeCells(2, 1, 2, colCount)
      const s = ws.getCell('A2')
      s.value = `PCG Group · Commercial Report · ${monthYear}`
      s.font  = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF555555' } }
      s.fill  = gray50
      ws.getRow(2).height = 16

      // Row 3: stats
      ws.mergeCells(3, 1, 3, colCount)
      const st = ws.getCell('A3')
      st.value = statsText
      st.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF333333' } }
      st.fill  = gray50
      ws.getRow(3).height = 16

      // Row 4: empty spacer
      ws.mergeCells(4, 1, 4, colCount)
      ws.getRow(4).height = 6
    }

    const applyFooter = (ws, colCount, dataRowCount) => {
      const footerRow = 7 + dataRowCount
      ws.mergeCells(footerRow, 1, footerRow, colCount)
      const f = ws.getCell(`A${footerRow}`)
      f.value = `PCG Group · Commercial Team · ${monthYear} · Confidential`
      f.font  = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF888888' } }
      f.alignment = { horizontal: 'center' }
      ws.getRow(footerRow).height = 18
    }

    // ── Build data rows from sorted ──
    const dataRows = sorted.map(({ partida, project, client, latest }) => ({
      project:  project?.name  || '',
      client:   client?.name   || '',
      itemType: partida.name   || '',
      pcgId:    buildPcgId(client?.name, project?.name, partida.name, partida.provider),
      supplier: partida.provider || '',
      status:   statusLabel(latest?.status),
      priority: priorityLabel(Number(partida.priority) || 15),
      action:   actionRequired(latest?.status, latest?.nextAction),
      comment:  latest?.comment || '',
    }))

    // ── Master Summary sheet ──
    const masterCols  = ['PROJECT', 'CLIENT', 'ITEM TYPE', 'PCG-ID', 'SUPPLIER', 'STATUS', 'PRIORITY', 'ACTION REQUIRED', 'COMMENTS']
    const masterWidths = [28, 22, 28, 14, 20, 22, 14, 42, 40]
    const ws0 = wb.addWorksheet('Master Summary')
    masterWidths.forEach((w, i) => { ws0.getColumn(i + 1).width = w })

    applyTitleBlock(ws0, 'PCG Group · Supplier Report', masterCols.length,
      `Total items: ${dataRows.length}  |  Suppliers: ${[...new Set(dataRows.map(r => r.supplier).filter(Boolean))].length}  |  Month: ${monthYear}`)
    applyHeaderRow(ws0, masterCols.length, masterCols)

    dataRows.forEach((r, idx) => {
      const row = ws0.getRow(7 + idx)
      const vals = [r.project, r.client, r.itemType, r.pcgId, r.supplier, r.status, r.priority, r.action, r.comment]
      vals.forEach((v, i) => {
        const cell = row.getCell(i + 1)
        cell.value = v
        cell.font  = reg10
        cell.fill  = idx % 2 === 0 ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } } : gray50
        cell.border = thinBorder
        cell.alignment = { vertical: 'top', wrapText: i >= 7 }
      })
      row.height = 18
    })
    applyFooter(ws0, masterCols.length, dataRows.length)

    // ── One sheet per supplier ──
    const suppliers = [...new Set(dataRows.map(r => r.supplier).filter(Boolean))].sort()
    const supplierCols  = ['PROJECT', 'CLIENT', 'ITEM TYPE', 'PCG-ID', 'STATUS', 'PRIORITY', 'ACTION REQUIRED', 'COMMENTS']
    const supplierWidths = [28, 22, 28, 14, 22, 14, 42, 40]

    for (const supplier of suppliers) {
      const sheetName = supplier.slice(0, 31) // Excel max 31 chars
      const ws = wb.addWorksheet(sheetName)
      supplierWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

      const sRows = dataRows.filter(r => r.supplier === supplier)
      applyTitleBlock(ws, supplier, supplierCols.length,
        `Items: ${sRows.length}  |  Month: ${monthYear}`)
      applyHeaderRow(ws, supplierCols.length, supplierCols)

      sRows.forEach((r, idx) => {
        const row = ws.getRow(7 + idx)
        const vals = [r.project, r.client, r.itemType, r.pcgId, r.status, r.priority, r.action, r.comment]
        vals.forEach((v, i) => {
          const cell = row.getCell(i + 1)
          cell.value = v
          cell.font  = reg10
          cell.fill  = idx % 2 === 0 ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } } : gray50
          cell.border = thinBorder
          cell.alignment = { vertical: 'top', wrapText: i >= 6 }
        })
        row.height = 18
      })
      applyFooter(ws, supplierCols.length, sRows.length)
    }

    // ── Download ──
    const buffer = await wb.xlsx.writeBuffer()
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href       = url
    a.download   = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="w-8 h-8 border-2 border-navy-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Cargando datos…</span>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={exportXLSX}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar
          </button>
          <button className="btn-primary" onClick={() => setSelectedRow('new')}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo registro
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Activas',           value: stats.total,     color: 'text-gray-900',   bg: '' },
          { label: 'Cotizando a China', value: stats.cotizando, color: 'text-sky-700',    bg: 'bg-sky-50' },
          { label: 'Cot. enviadas',     value: stats.enviadas,  color: 'text-violet-700', bg: 'bg-violet-50' },
          { label: 'Ganadas',           value: stats.ganadas,   color: 'text-green-700',  bg: 'bg-green-50' },
          { label: 'Sin act. >7d',      value: stats.sinUpdate, color: 'text-orange-700', bg: 'bg-orange-50' },
        ].map(s => (
          <div key={s.label} className={`card px-4 py-3 ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters — desktop inline, mobile collapsible */}
      <MobileFilters
        filterSearch={filterSearch}           setFilterSearch={setFilterSearch}
        filterClientes={filterClientes}       setFilterClientes={setFilterClientes}
        filterEstados={filterEstados}         setFilterEstados={setFilterEstados}
        filterPelota={filterPelota}           setFilterPelota={setFilterPelota}
        filterResponsable={filterResponsable} setFilterResponsable={setFilterResponsable}
        filterProveedor={filterProveedor}     setFilterProveedor={setFilterProveedor}
        filterProyectos={filterProyectos}     setFilterProyectos={setFilterProyectos}
        filterPrioridad={filterPrioridad}     setFilterPrioridad={setFilterPrioridad}
        clients={clients} projects={projects} rows={rows} count={sorted.length}
      />

      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {sorted.length === 0 && (
          <div className="card px-4 py-12 text-center text-gray-400 text-sm">No hay partidas</div>
        )}
        {sorted.map(row => (
          <MobileCard key={row.partida.id} row={row}
            onClick={() => setHistoryRow(row)}
            onNew={() => setSelectedRow(row)}
            onEdit={() => setEditRow(row)}
          />
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block card overflow-hidden">
        {hasColFilters && (
          <div className="px-4 py-2 bg-navy-50 border-b border-navy-100 flex items-center gap-2 text-xs text-navy-700">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6" />
            </svg>
            Filtros de columna activos
            <button className="ml-auto text-navy-600 hover:underline font-medium" onClick={clearColFilters}>
              Limpiar filtros
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                {activeCols.map(key => {
                  const col = COL_DEFS.find(c => c.key === key)
                  if (!col) return null
                  const isOver = dragOver === key
                  return (
                    <th
                      key={key}
                      draggable
                      onDragStart={e => onDragStart(e, key)}
                      onDragOver={e  => onDragOver(e, key)}
                      onDrop={e      => onDrop(e, key)}
                      onDragEnd={onDragEnd}
                      className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap select-none cursor-grab active:cursor-grabbing transition-colors ${isOver ? 'bg-navy-50 border-l-2 border-navy-400' : ''}`}
                    >
                      <button
                        className="flex items-center gap-1 hover:text-gray-800 transition-colors"
                        onClick={() => handleSort(key)}
                      >
                        {col.label}
                        <SortIcon active={sortKey === key} dir={sortDir} />
                      </button>
                    </th>
                  )
                })}
                {/* Column picker + actions */}
                <th className="px-4 py-3 text-right whitespace-nowrap">
                  <div className="relative inline-block" ref={pickerRef}>
                    <button
                      className="btn-ghost px-2 py-1 text-xs flex items-center gap-1"
                      onClick={() => setShowColPicker(v => !v)}
                      title="Configurar columnas"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Columnas
                    </button>
                    {showColPicker && (
                      <ColPicker
                        colOrder={colOrder}
                        visibleCols={visibleCols}
                        onToggle={toggleCol}
                        onReset={resetCols}
                        onClose={() => setShowColPicker(false)}
                      />
                    )}
                  </div>
                </th>
              </tr>
              {/* Per-column filter row */}
              <tr className="border-b border-gray-100 bg-white">
                {activeCols.map(key => (
                  <td key={key} className="px-2 py-1.5">
                    <ColFilterInput
                      colKey={key}
                      value={colFilters[key] || ''}
                      onChange={val => setColFilter(key, val)}
                      options={colOptions[key]}
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.length === 0 && (
                <tr><td colSpan={activeCols.length + 1} className="px-4 py-12 text-center text-gray-400 text-sm">
                  No hay partidas para mostrar
                </td></tr>
              )}
              {sorted.map(row => {
                const { partida, project, client, latest } = row
                const isOverdue = latest?.nextActionDate && latest?.status &&
                  !['ganado','perdido','pausado'].includes(latest.status) &&
                  isAfter(new Date(), parseISO(latest.nextActionDate))
                return (
                  <tr
                    key={partida.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${isOverdue ? 'bg-red-50/40' : ''}`}
                    onClick={e => { if (e.target.closest('.priority-edit-cell')) return; setHistoryRow(row) }}
                  >
                    {activeCols.map(key => (
                      <td key={key} className="px-4 py-3">
                        <Cell colKey={key} row={row} />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        className="btn-ghost px-2 py-1 text-gray-400 hover:text-gray-600"
                        title="Editar partida"
                        onClick={e => { e.stopPropagation(); setEditRow(row) }}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {selectedRow && selectedRow !== 'new' && (
        <Modal
          title={`Nuevo registro · ${selectedRow.partida?.name}`}
          onClose={() => setSelectedRow(null)}
          size="lg"
        >
          <ActivityForm
            partida={selectedRow.partida}
            project={selectedRow.project}
            client={selectedRow.client}
            onSave={() => setSelectedRow(null)}
            onCancel={() => setSelectedRow(null)}
          />
        </Modal>
      )}
      {selectedRow === 'new' && (
        <Modal title="Nuevo registro rápido" onClose={() => setSelectedRow(null)} size="lg">
          <QuickEntryInline onSave={() => setSelectedRow(null)} onCancel={() => setSelectedRow(null)} />
        </Modal>
      )}
      {editRow && (
        <Modal title={`Editar · ${editRow.partida?.name}`} onClose={() => setEditRow(null)} size="lg">
          <EditRowForm row={editRow} clients={clients} projects={projects} onClose={() => setEditRow(null)} />
        </Modal>
      )}
      {historyRow && (
        <PartidaHistoryModal
          row={historyRow}
          onClose={() => setHistoryRow(null)}
          onNew={() => { setHistoryRow(null); setSelectedRow(historyRow) }}
        />
      )}
    </div>
  )
}

// ── Partida history modal (mobile + desktop) ─────────────────────
function PartidaHistoryModal({ row, onClose, onNew }) {
  const { partida, project, client } = row
  const { activities } = useApp()
  const [editingAct, setEditingAct] = useState(null)

  const acts = activities
    .filter(a => a.partidaId === partida.id)
    .sort((a, b) => getActivityMs(b) - getActivityMs(a))

  const title = `${client?.name ? client.name + ' › ' : ''}${project?.name ? project.name + ' › ' : ''}${partida.name}`

  return (
    <>
      <Modal title={title} onClose={onClose} size="xl">
        <div className="space-y-3">
          {/* Nuevo registro */}
          <button onClick={onNew} className="btn-primary w-full sm:w-auto">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo registro
          </button>

          {/* Lista de actividades */}
          {acts.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-12">Sin registros todavía</div>
          )}
          {acts.map(act => {
            const pelota = getPelota(act.pelota)
            return (
              <button key={act.id} onClick={() => setEditingAct(act)}
                className="w-full text-left card px-4 py-3 hover:shadow-md active:bg-gray-50 transition-all">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-500">
                      {act.date ? format(parseISO(act.date), 'd MMM yyyy', { locale: es }) : '—'}
                    </span>
                    <StatusBadge value={act.status} />
                    {act.pelota && act.pelota !== '-' && (
                      <span className={`badge text-xs ${pelota.color}`}>{pelota.label}</span>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                {act.comment && (
                  <p className="text-sm text-gray-700 line-clamp-2">{act.comment}</p>
                )}
                {act.responsible && (
                  <p className="text-xs text-gray-400 mt-1">{act.responsible}</p>
                )}
                {act.nextAction && (
                  <p className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1 mt-1.5 truncate">
                    → {act.nextAction}
                    {act.nextActionDate && ` · ${format(parseISO(act.nextActionDate), 'd MMM', { locale: es })}`}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </Modal>

      {/* Editar actividad */}
      {editingAct && (
        <Modal title="Editar registro" onClose={() => setEditingAct(null)} size="lg">
          <EditActivityForm
            act={editingAct}
            onSave={() => setEditingAct(null)}
            onCancel={() => setEditingAct(null)}
          />
        </Modal>
      )}
    </>
  )
}

// ── Mobile filters ────────────────────────────────────────────────
function MobileFilters({
  filterSearch, setFilterSearch,
  filterClientes, setFilterClientes,
  filterEstados, setFilterEstados,
  filterPelota, setFilterPelota,
  filterResponsable, setFilterResponsable,
  filterProveedor, setFilterProveedor,
  filterProyectos, setFilterProyectos,
  filterPrioridad, setFilterPrioridad,
  clients, projects, rows, count,
}) {
  const [open, setOpen] = useState(false)

  const hasFilters = filterSearch || filterClientes.size || filterProyectos.size || filterEstados.size ||
    filterPelota.size || filterResponsable.size || filterProveedor.size || filterPrioridad

  const clear = () => {
    setFilterSearch(''); setFilterClientes(new Set()); setFilterProyectos(new Set())
    setFilterEstados(new Set()); setFilterPelota(new Set()); setFilterResponsable(new Set())
    setFilterProveedor(new Set()); setFilterPrioridad('')
  }

  const clientOptions     = clients.map(c => ({ value: c.id, label: c.name }))
  // Proyectos filtrados por cliente seleccionado (si hay alguno)
  const proyectoOptions   = projects
    .filter(p => !filterClientes.size || filterClientes.has(p.clientId))
    .map(p => ({ value: p.id, label: p.name }))
  const estadoOptions     = ESTADOS.map(e => ({ value: e.value, label: e.label }))
  const pelotaOptions     = PELOTA.filter(p => p.value !== '-').map(p => ({ value: p.value, label: p.label }))
  const responsableOptions = [...new Set(rows.map(r => r.latest?.responsible).filter(Boolean))].sort()
    .map(v => ({ value: v, label: v }))
  const proveedorOptions  = [...new Set(rows.map(r => r.partida?.provider).filter(Boolean))].sort()
    .map(v => ({ value: v, label: v }))

  return (
    <>
      {/* Desktop filters */}
      <div className="hidden md:flex card px-4 py-3 flex-wrap gap-3 items-center">
        <input type="text" className="input w-40" placeholder="Buscar…"
          value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
        <MultiSelect placeholder="Clientes"     options={clientOptions}      values={filterClientes}    onChange={setFilterClientes} />
        <MultiSelect placeholder="Proyectos"    options={proyectoOptions}    values={filterProyectos}   onChange={setFilterProyectos} />
        <MultiSelect placeholder="Estados"      options={estadoOptions}      values={filterEstados}     onChange={setFilterEstados} />
        <MultiSelect placeholder="Pelota"       options={pelotaOptions}      values={filterPelota}      onChange={setFilterPelota} />
        <MultiSelect placeholder="Responsable"  options={responsableOptions} values={filterResponsable} onChange={setFilterResponsable} />
        <MultiSelect placeholder="Proveedor"    options={proveedorOptions}   values={filterProveedor}   onChange={setFilterProveedor} />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 whitespace-nowrap">Prioridad hasta</span>
          <input type="number" min="1" max="30" className="input w-16 text-center"
            placeholder="30" value={filterPrioridad}
            onChange={e => setFilterPrioridad(e.target.value)} />
        </div>
        {hasFilters && <button className="btn-ghost text-xs" onClick={clear}>Limpiar</button>}
        <span className="ml-auto text-xs text-gray-400">{count} registros</span>
      </div>

      {/* Mobile search + filter button */}
      <div className="md:hidden flex gap-2">
        <input type="text" className="input flex-1" placeholder="Buscar partida…"
          value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
        <button
          onClick={() => setOpen(true)}
          className={`btn-secondary px-3 relative flex-shrink-0 ${hasFilters ? 'ring-2 ring-navy-400' : ''}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6" />
          </svg>
          {hasFilters && <span className="absolute -top-1 -right-1 w-2 h-2 bg-navy-600 rounded-full" />}
        </button>
        <span className="btn-secondary px-3 text-xs text-gray-500 flex-shrink-0 flex items-center">{count}</span>
      </div>

      {/* Mobile filter sheet */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white rounded-t-2xl shadow-2xl px-4 pt-3 pb-8 overflow-y-auto max-h-[85vh]">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <p className="font-semibold text-gray-900 mb-4">Filtrar partidas</p>
            <div className="space-y-4">
              <div>
                <label className="label">Cliente</label>
                <MultiSelect placeholder="Todos los clientes" options={clientOptions} values={filterClientes} onChange={setFilterClientes} />
              </div>
              <div>
                <label className="label">Proyecto</label>
                <MultiSelect placeholder="Todos los proyectos" options={proyectoOptions} values={filterProyectos} onChange={setFilterProyectos} />
              </div>
              <div>
                <label className="label">Estado</label>
                <MultiSelect placeholder="Todos los estados" options={estadoOptions} values={filterEstados} onChange={setFilterEstados} />
              </div>
              <div>
                <label className="label">Pelota</label>
                <MultiSelect placeholder="Todos" options={pelotaOptions} values={filterPelota} onChange={setFilterPelota} />
              </div>
              <div>
                <label className="label">Responsable</label>
                <MultiSelect placeholder="Todos" options={responsableOptions} values={filterResponsable} onChange={setFilterResponsable} />
              </div>
              <div>
                <label className="label">Proveedor</label>
                <MultiSelect placeholder="Todos" options={proveedorOptions} values={filterProveedor} onChange={setFilterProveedor} />
              </div>
              <div>
                <label className="label">Prioridad hasta (1–30)</label>
                <input type="number" min="1" max="30" className="input"
                  placeholder="Sin límite" value={filterPrioridad}
                  onChange={e => setFilterPrioridad(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              {hasFilters && <button className="btn-secondary flex-1" onClick={() => { clear(); setOpen(false) }}>Limpiar</button>}
              <button className="btn-primary flex-1" onClick={() => setOpen(false)}>Ver {count} resultados</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── Mobile card ───────────────────────────────────────────────────
function MobileCard({ row, onClick, onNew, onEdit }) {
  const { partida, project, client, latest, daysSince } = row
  const isOverdue = latest?.nextActionDate && latest?.status &&
    !['ganado','perdido','pausado'].includes(latest.status) &&
    isAfter(new Date(), parseISO(latest.nextActionDate))

  return (
    <div className={`card overflow-hidden ${isOverdue ? 'border-l-4 border-red-400' : ''}`}>
      {/* Área principal — abre ActivityForm */}
      <button onClick={onClick} className="w-full text-left px-4 pt-4 pb-3 active:bg-gray-50 transition-colors">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-xs text-gray-400 truncate">
              {client?.name || '—'}
              {project?.name ? <span className="mx-1 text-gray-300">›</span> : null}
              {project?.name}
            </p>
            <p className="font-semibold text-gray-900 text-sm mt-0.5 leading-tight">{partida.name}</p>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <StatusBadge value={latest?.status || 'cotizando'} />
            {partida.provider && <span className="text-xs text-gray-400">{partida.provider}</span>}
          </div>
        </div>

        {latest?.comment && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{latest.comment}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {latest?.nextActionDate && <NextActionChip date={latest.nextActionDate} />}
          <DaysChip days={daysSince} />
          {latest?.pelota && latest.pelota !== '-' && (
            <span className={`badge text-xs ${getPelota(latest.pelota).color}`}>
              {getPelota(latest.pelota).label}
            </span>
          )}
        </div>

        {latest?.nextAction && (
          <p className="text-xs text-gray-400 mt-2 truncate">
            <span className="font-medium text-gray-500">Próximo:</span> {latest.nextAction}
          </p>
        )}
      </button>

      {/* Barra de acciones */}
      <div className="flex border-t border-gray-100">
        <button onClick={onNew}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-navy-600 font-medium active:bg-gray-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo registro
        </button>
        <div className="w-px bg-gray-100" />
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-gray-600 font-medium active:bg-gray-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editar
        </button>
      </div>
    </div>
  )
}

// ── Inline quick entry ─────────────────────────────────────────────
function QuickEntryInline({ onSave, onCancel }) {
  const { clients, projects, partidas } = useApp()
  const [clientId,  setClientId]  = useState('')
  const [projectId, setProjectId] = useState('')
  const [partidaId, setPartidaId] = useState('')

  const filteredProjects = projects.filter(p => p.clientId === clientId)
  const filteredPartidas = partidas.filter(p => p.projectId === projectId)
  const partida = partidas.find(p => p.id === partidaId)
  const project = projects.find(p => p.id === projectId)
  const client  = clients.find(c => c.id === clientId)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Cliente</label>
          <select className="select" value={clientId}
            onChange={e => { setClientId(e.target.value); setProjectId(''); setPartidaId('') }}>
            <option value="">Seleccionar…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Proyecto</label>
          <select className="select" value={projectId} disabled={!clientId}
            onChange={e => { setProjectId(e.target.value); setPartidaId('') }}>
            <option value="">Seleccionar…</option>
            {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Partida</label>
          <select className="select" value={partidaId} disabled={!projectId}
            onChange={e => setPartidaId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {filteredPartidas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      {partida && (
        <ActivityForm partida={partida} project={project} client={client} onSave={onSave} onCancel={onCancel} />
      )}
    </div>
  )
}

// ── Edit row form ─────────────────────────────────────────────────
function EditRowForm({ row, clients, projects, onClose }) {
  const { partida, project, latest } = row
  const { activities } = useApp()

  // Campos de partida
  const [clientId,    setClientId]    = useState(project?.clientId   || '')
  const [projectId,   setProjectId]   = useState(partida.projectId   || '')
  const [name,        setName]        = useState(partida.name        || '')
  const [provider,    setProvider]    = useState(partida.provider    || '')
  const [priority,    setPriority]    = useState(Number(partida.priority) || 15)

  // Campos de la última actividad
  const [date,           setDate]           = useState(latest?.date           || '')
  const [status,         setStatus]         = useState(partida.status         || 'cotizando')
  const [pelota,         setPelota]         = useState(latest?.pelota         || '-')
  const [responsible,    setResponsible]    = useState(latest?.responsible    || '')
  const [comment,        setComment]        = useState(latest?.comment        || '')
  const [nextAction,     setNextAction]     = useState(latest?.nextAction     || '')
  const [nextActionDate, setNextActionDate] = useState(latest?.nextActionDate || '')
  const [observations,   setObservations]   = useState(latest?.observations   || '')

  const [saving, setSaving] = useState(false)

  const clientProjects = projects.filter(p => p.clientId === clientId)

  const handleClientChange = (val) => {
    setClientId(val)
    const stillValid = projects.find(p => p.id === projectId && p.clientId === val)
    if (!stillValid) setProjectId('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Actualizar partida
      const partidaUp = {}
      if (name      !== partida.name)                    partidaUp.name      = name
      if (status    !== partida.status)                  partidaUp.status    = status
      if (provider  !== (partida.provider || ''))        partidaUp.provider  = provider
      if (projectId !== partida.projectId)               partidaUp.projectId = projectId
      if (priority  !== (Number(partida.priority) || 15)) partidaUp.priority  = priority
      if (Object.keys(partidaUp).length > 0)
        await updatePartida(partida.id, partidaUp)

      if (clientId !== project?.clientId)
        await updateProject(project.id, { clientId })

      // Actualizar última actividad
      if (latest) {
        await updateActivity(latest.id, {
          date, status, pelota, responsible,
          comment, nextAction, nextActionDate, observations,
        })
      }

      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar la partida "${partida.name}" y todos sus registros? Esta acción no se puede deshacer.`)) return
    setSaving(true)
    try {
      const acts = activities.filter(a => a.partidaId === partida.id)
      await Promise.all(acts.map(a => deleteActivity(a.id)))
      await deletePartida(partida.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── Sección: Partida ── */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Partida</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Cliente</label>
          <select className="select" value={clientId} onChange={e => handleClientChange(e.target.value)}>
            <option value="">Seleccionar…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Proyecto</label>
          <select className="select" value={projectId} disabled={!clientId}
            onChange={e => setProjectId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {clientProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Nombre partida</label>
          <input type="text" className="input" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Proveedor</label>
          <input type="text" className="input" placeholder="Nombre del proveedor"
            value={provider} onChange={e => setProvider(e.target.value)} />
        </div>
        <div>
          <label className="label">Prioridad (1 urgente · 30 baja)</label>
          <input type="number" className="input" min="1" max="30" step="1"
            value={priority} onChange={e => setPriority(Math.min(30, Math.max(1, Number(e.target.value) || 15)))} />
        </div>
      </div>

      {/* ── Sección: Último registro ── */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2 border-t border-gray-100">
        Último registro {!latest && <span className="text-gray-300 normal-case font-normal">(sin actividad)</span>}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Fecha</label>
          <input type="date" className="input" value={date}
            onChange={e => setDate(e.target.value)} disabled={!latest} />
        </div>
        <div>
          <label className="label">Estado</label>
          <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Responsable</label>
          <input type="text" className="input" placeholder="Nombre del responsable"
            value={responsible} onChange={e => setResponsible(e.target.value)} disabled={!latest} />
        </div>
        <div>
          <label className="label">La pelota está en</label>
          <select className="select" value={pelota} onChange={e => setPelota(e.target.value)} disabled={!latest}>
            {PELOTA.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Comentario</label>
        <textarea className="textarea" rows={3} value={comment}
          onChange={e => setComment(e.target.value)} disabled={!latest} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Próxima acción</label>
          <input type="text" className="input" placeholder="¿Qué sigue?"
            value={nextAction} onChange={e => setNextAction(e.target.value)} disabled={!latest} />
        </div>
        <div>
          <label className="label">Fecha recordatorio</label>
          <input type="date" className="input" value={nextActionDate}
            onChange={e => setNextActionDate(e.target.value)} disabled={!latest} />
        </div>
      </div>
      <div>
        <label className="label">Observaciones internas</label>
        <textarea className="textarea" rows={2} value={observations}
          onChange={e => setObservations(e.target.value)} disabled={!latest} />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
        <button type="button" disabled={saving}
          className="btn-ghost text-xs text-red-500 hover:text-red-700 hover:bg-red-50 flex items-center gap-1.5"
          onClick={handleDelete}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Eliminar partida
        </button>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </form>
  )
}
