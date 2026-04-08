import { useState, useMemo, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { addReminder, updateReminder, deleteReminder } from '../lib/db'

function MultiSelect({ placeholder, options, values, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  const toggle = val => { const n = new Set(values); n.has(val) ? n.delete(val) : n.add(val); onChange(n) }
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
        <div className="absolute z-50 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-full max-h-56 overflow-y-auto">
          {values.size > 0 && (
            <button type="button" className="w-full text-left text-xs text-navy-600 hover:underline px-2 pb-2" onClick={() => onChange(new Set())}>
              Limpiar selección
            </button>
          )}
          {options.map(o => (
            <label key={o} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded">
              <input type="checkbox" checked={values.has(o)} onChange={() => toggle(o)} className="accent-navy-600" />
              <span className="text-sm text-gray-700">{o}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function DueDateChip({ fecha }) {
  if (!fecha) return null
  const date = parseISO(fecha)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = differenceInDays(date, today)

  if (isPast(date) && !isToday(date))
    return <span className="badge bg-red-100 text-red-700">Vencido · {format(date, 'd MMM', { locale: es })}</span>
  if (isToday(date))
    return <span className="badge bg-orange-100 text-orange-700">Hoy</span>
  if (diff <= 7)
    return <span className="badge bg-yellow-100 text-yellow-700">{diff}d · {format(date, 'd MMM', { locale: es })}</span>
  return <span className="badge bg-gray-100 text-gray-600">{format(date, 'd MMM yyyy', { locale: es })}</span>
}

export default function Reminders() {
  const { reminders } = useApp()
  const [filterEstado,      setFilterEstado]      = useState('pendiente')
  const [filterResponsable, setFilterResponsable] = useState(new Set())
  const [filterFechaDesde,  setFilterFechaDesde]  = useState('')
  const [filterFechaHasta,  setFilterFechaHasta]  = useState('')
  const [sortKey, setSortKey] = useState('fecha')
  const [sortDir, setSortDir] = useState('asc')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)

  const responsableOptions = useMemo(() =>
    [...new Set(reminders.map(r => r.responsable).filter(Boolean))].sort()
  , [reminders])

  const filtered = useMemo(() => {
    return reminders
      .filter(r => {
        if (filterEstado !== 'todos' && r.estado !== filterEstado) return false
        if (filterResponsable.size && !filterResponsable.has(r.responsable)) return false
        if (filterFechaDesde && r.fechaLimite && r.fechaLimite < filterFechaDesde) return false
        if (filterFechaHasta && r.fechaLimite && r.fechaLimite > filterFechaHasta) return false
        return true
      })
      .sort((a, b) => {
        let cmp = 0
        if (sortKey === 'fecha') {
          const fa = a.fechaLimite || 'zzzz'
          const fb = b.fechaLimite || 'zzzz'
          cmp = fa.localeCompare(fb)
        } else if (sortKey === 'responsable') {
          cmp = (a.responsable || '').localeCompare(b.responsable || '', 'es')
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [reminders, filterEstado, filterResponsable, filterFechaDesde, filterFechaHasta, sortKey, sortDir])

  const pendingCount = reminders.filter(r => r.estado === 'pendiente').length
  const overdueCount = reminders.filter(r => {
    if (r.estado !== 'pendiente' || !r.fechaLimite) return false
    const d = parseISO(r.fechaLimite)
    return isPast(d) && !isToday(d)
  }).length

  const handleToggle = async (r) => {
    await updateReminder(r.id, { estado: r.estado === 'pendiente' ? 'completado' : 'pendiente' })
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este recordatorio?')) return
    await deleteReminder(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recordatorios</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            {overdueCount > 0 && <span className="text-red-600 font-medium"> · {overdueCount} vencido{overdueCount !== 1 ? 's' : ''}</span>}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Nuevo</button>
      </div>

      {/* Filtros */}
      <div className="card px-4 py-3 flex gap-3 flex-wrap items-center">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {[['pendiente', 'Pendientes'], ['completado', 'Completados'], ['todos', 'Todos']].map(([val, label]) => (
            <button key={val} onClick={() => setFilterEstado(val)}
              className={`px-3 py-1.5 font-medium transition-colors ${filterEstado === val ? 'bg-navy-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <MultiSelect placeholder="Responsable" options={responsableOptions} values={filterResponsable} onChange={setFilterResponsable} />
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>Desde</span>
          <input type="date" className="input w-36" value={filterFechaDesde} onChange={e => setFilterFechaDesde(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>Hasta</span>
          <input type="date" className="input w-36" value={filterFechaHasta} onChange={e => setFilterFechaHasta(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 border-l border-gray-200 pl-3 ml-1">
          <span className="font-medium">Ordenar:</span>
          <select className="select text-xs py-1 h-auto" value={sortKey} onChange={e => setSortKey(e.target.value)}>
            <option value="fecha">Fecha</option>
            <option value="responsable">Responsable</option>
          </select>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            className="btn-ghost px-1.5 py-1 text-xs flex items-center gap-0.5 font-mono">
            {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
        </div>
        {(filterResponsable.size || filterFechaDesde || filterFechaHasta) && (
          <button className="btn-ghost text-xs" onClick={() => { setFilterResponsable(new Set()); setFilterFechaDesde(''); setFilterFechaHasta('') }}>
            Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} registros</span>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card py-12 text-center text-gray-400 text-sm">
            No hay recordatorios{filterEstado === 'pendiente' ? ' pendientes' : ''}.
          </div>
        )}
        {filtered.map(r => {
          const done = r.estado === 'completado'
          return (
            <div key={r.id} className={`card px-5 py-4 transition-opacity ${done ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <button
                  onClick={() => handleToggle(r)}
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                    done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-navy-500'
                  }`}
                >
                  {done && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`font-semibold text-sm ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {r.tema}
                    </span>
                    {!done && <DueDateChip fecha={r.fechaLimite} />}
                  </div>
                  {r.descripcion && (
                    <p className="text-sm text-gray-600 leading-relaxed">{r.descripcion}</p>
                  )}
                  {r.responsable && (
                    <div className="mt-1.5 text-xs text-gray-400">👤 {r.responsable}</div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex gap-1 flex-shrink-0">
                  <button className="btn-ghost p-1.5" title="Editar" onClick={() => setEditing(r)}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button className="btn-ghost p-1.5 hover:text-red-500" title="Eliminar" onClick={() => handleDelete(r.id)}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {creating && (
        <Modal title="Nuevo recordatorio" onClose={() => setCreating(false)} size="lg">
          <ReminderForm
            onSave={async (data) => { await addReminder(data); setCreating(false) }}
            onCancel={() => setCreating(false)}
          />
        </Modal>
      )}

      {editing && (
        <Modal title="Editar recordatorio" onClose={() => setEditing(null)} size="lg">
          <ReminderForm
            initial={editing}
            onSave={async (data) => { await updateReminder(editing.id, data); setEditing(null) }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  )
}

function ReminderForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    tema:        initial?.tema        || '',
    descripcion: initial?.descripcion || '',
    responsable: initial?.responsable || '',
    fechaLimite: initial?.fechaLimite || '',
    estado:      initial?.estado      || 'pendiente',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Tema <span className="text-red-500">*</span></label>
        <input className="input" placeholder="Ej: Llamar al proveedor de cortinas"
          value={form.tema} onChange={e => set('tema', e.target.value)} required />
      </div>
      <div>
        <label className="label">Descripción</label>
        <textarea className="textarea" rows={3} placeholder="Detalles…"
          value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Responsable</label>
          <input className="input" placeholder="Nombre…"
            value={form.responsable} onChange={e => set('responsable', e.target.value)} />
        </div>
        <div>
          <label className="label">Fecha límite</label>
          <input type="date" className="input"
            value={form.fechaLimite} onChange={e => set('fechaLimite', e.target.value)} />
        </div>
      </div>
      {initial && (
        <div>
          <label className="label">Estado</label>
          <select className="select" value={form.estado} onChange={e => set('estado', e.target.value)}>
            <option value="pendiente">Pendiente</option>
            <option value="completado">Completado</option>
          </select>
        </div>
      )}
      <div className="flex gap-2 justify-end pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear recordatorio'}
        </button>
      </div>
    </form>
  )
}
