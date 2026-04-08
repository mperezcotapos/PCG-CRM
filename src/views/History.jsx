import { useState, useMemo } from 'react'
import { useApp, getActivityMs } from '../context/AppContext'
import { getEstado, getPelota, ESTADOS } from '../lib/constants'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { updateActivity, deleteActivity, updatePartida, syncAllPartidaStatuses } from '../lib/db'

export default function History() {
  const { clients, projects, partidas, activities, getClient, getProject, getPartida } = useApp()

  const [filterCliente, setFilterCliente] = useState('')
  const [filterProyecto, setFilterProyecto] = useState('')
  const [filterPartida, setFilterPartida] = useState('')
  const [filterEstado,  setFilterEstado]  = useState('')
  const [filterFrom,    setFilterFrom]    = useState('')
  const [filterTo,      setFilterTo]      = useState('')
  const [search,        setSearch]        = useState('')
  const [editing,       setEditing]       = useState(null)
  const [syncing,       setSyncing]       = useState(false)

  const handleSync = async () => {
    if (!confirm('¿Sincronizar el estado de todas las partidas con su última actividad?')) return
    setSyncing(true)
    try {
      const count = await syncAllPartidaStatuses()
      alert(`Listo. Se sincronizaron ${count} partidas.`)
    } finally {
      setSyncing(false)
    }
  }

  // Filter cascades
  const filteredProjects = projects.filter(p => !filterCliente || p.clientId === filterCliente)
  const filteredPartidas = partidas.filter(p => !filterProyecto || p.projectId === filterProyecto)

  const filtered = useMemo(() => {
    return activities.filter(act => {
      const partida = getPartida(act.partidaId)
      const project = partida ? getProject(partida.projectId) : null
      const client  = project ? getClient(project.clientId)   : null

      if (filterCliente  && client?.id   !== filterCliente)  return false
      if (filterProyecto && project?.id  !== filterProyecto) return false
      if (filterPartida  && partida?.id  !== filterPartida)  return false
      if (filterEstado   && act.status   !== filterEstado)   return false
      if (filterFrom     && act.date < filterFrom)           return false
      if (filterTo       && act.date > filterTo)             return false
      if (search) {
        const q = search.toLowerCase()
        const hay = [client?.name, project?.name, partida?.name, act.comment, act.responsible, act.nextAction]
          .join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    }).sort((a, b) => {
      const getMs = act => {
        const ts = act.createdAt
        if (ts === null) return Date.now() + 1e9
        if (ts == null)  return new Date(act.date || 0).getTime()
        return ts.toMillis?.() ?? ts.seconds * 1000
      }
      return getMs(b) - getMs(a)
    })
  }, [activities, filterCliente, filterProyecto, filterPartida, filterEstado, filterFrom, filterTo, search])

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return
    const act = activities.find(a => a.id === id)
    await deleteActivity(id)
    if (act?.partidaId) {
      const prev = activities
        .filter(a => a.id !== id && a.partidaId === act.partidaId)
        .sort((a, b) => getActivityMs(b) - getActivityMs(a))[0]
      await updatePartida(act.partidaId, { status: prev?.status || 'cotizando' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial</h1>
          <p className="text-sm text-gray-500 mt-0.5">Todos los registros de actividad en orden cronológico</p>
        </div>
        <button className="btn-secondary text-xs whitespace-nowrap" onClick={handleSync} disabled={syncing}>
          {syncing ? 'Sincronizando…' : 'Sincronizar estados'}
        </button>
      </div>

      {/* Filters */}
      <div className="card px-4 py-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <input
            type="text" className="input w-48" placeholder="Buscar en historial…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
          <select className="select w-44" value={filterCliente}
            onChange={e => { setFilterCliente(e.target.value); setFilterProyecto(''); setFilterPartida('') }}>
            <option value="">Todos los clientes</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select w-44" value={filterProyecto}
            onChange={e => { setFilterProyecto(e.target.value); setFilterPartida('') }}
            disabled={!filterCliente}>
            <option value="">Todos los proyectos</option>
            {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="select w-44" value={filterPartida}
            onChange={e => setFilterPartida(e.target.value)}
            disabled={!filterProyecto}>
            <option value="">Todas las partidas</option>
            {filteredPartidas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="select w-36" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Desde</span>
            <input type="date" className="input w-36" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Hasta</span>
            <input type="date" className="input w-36" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          </div>
          {(search || filterCliente || filterProyecto || filterPartida || filterEstado || filterFrom || filterTo) && (
            <button className="btn-ghost text-xs" onClick={() => {
              setSearch(''); setFilterCliente(''); setFilterProyecto('');
              setFilterPartida(''); setFilterEstado(''); setFilterFrom(''); setFilterTo('');
            }}>Limpiar</button>
          )}
          <span className="ml-auto text-xs text-gray-400">{filtered.length} registros</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card px-4 py-12 text-center text-gray-400 text-sm">
            No hay registros para los filtros seleccionados
          </div>
        )}
        {filtered.map(act => {
          const partida = getPartida(act.partidaId)
          const project = partida ? getProject(partida.projectId) : null
          const client  = project ? getClient(project.clientId)   : null
          const pelota  = getPelota(act.pelota)

          return (
            <div key={act.id} className="card px-5 py-4 hover:shadow-md transition-shadow">
              <div className="flex flex-wrap items-start gap-3">
                {/* Date */}
                <div className="text-center w-14 flex-shrink-0">
                  <div className="text-xs text-gray-400 uppercase">
                    {act.date ? format(parseISO(act.date), 'MMM', { locale: es }) : '—'}
                  </div>
                  <div className="text-xl font-bold text-gray-900 leading-none">
                    {act.date ? format(parseISO(act.date), 'd') : '—'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {act.date ? format(parseISO(act.date), 'yyyy') : ''}
                  </div>
                </div>

                {/* Divider */}
                <div className="w-px self-stretch bg-gray-100 flex-shrink-0" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Path */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span className="font-semibold text-gray-900 text-sm">{client?.name || '—'}</span>
                    <span className="text-gray-300">›</span>
                    <span className="text-gray-600 text-sm">{project?.name || '—'}</span>
                    <span className="text-gray-300">›</span>
                    <span className="text-gray-600 text-sm">{partida?.name || '—'}</span>
                    {partida?.provider && (
                      <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">{partida.provider}</span>
                    )}
                    <StatusBadge value={act.status} />
                    {act.pelota && act.pelota !== '-' && (
                      <span className={`badge ${pelota.color}`}>{pelota.label}</span>
                    )}
                  </div>

                  {/* Comment */}
                  <p className="text-gray-800 text-sm leading-relaxed">{act.comment}</p>

                  {/* Next action */}
                  {act.nextAction && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-1.5">
                      <svg className="w-3.5 h-3.5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                      <span className="font-medium text-yellow-700">Próximo:</span>
                      <span className="text-gray-700">{act.nextAction}</span>
                      {act.nextActionDate && (
                        <span className="text-gray-400 ml-1">
                          · {format(parseISO(act.nextActionDate), 'd MMM yyyy', { locale: es })}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Observations */}
                  {act.observations && (
                    <p className="mt-1.5 text-xs text-gray-400 italic">{act.observations}</p>
                  )}

                  {/* Footer */}
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                    {act.responsible && <span>👤 {act.responsible}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                  <button className="btn-ghost p-1.5" title="Editar"
                    onClick={() => setEditing(act)}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button className="btn-ghost p-1.5 hover:text-red-500" title="Eliminar"
                    onClick={() => handleDelete(act.id)}>
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

      {/* Edit modal */}
      {editing && (
        <Modal title="Editar registro" onClose={() => setEditing(null)} size="lg">
          <EditActivityForm act={editing} onSave={() => setEditing(null)} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  )
}

function EditActivityForm({ act, onSave, onCancel }) {
  const { activities } = useApp()
  const [form, setForm] = useState({ ...act })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { id, createdAt, ...data } = form
    await updateActivity(act.id, data)

    // Actualizar el status de la partida según la actividad más reciente (por createdAt)
    const updatedAct = { ...act, ...data }
    const latest = activities
      .filter(a => a.partidaId === act.partidaId)
      .map(a => a.id === act.id ? updatedAct : a)
      .sort((a, b) => getActivityMs(b) - getActivityMs(a))[0]
    if (latest?.status) {
      await updatePartida(act.partidaId, { status: latest.status })
    }

    onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Fecha</label>
          <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
        <div>
          <label className="label">Estado</label>
          <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Comentario</label>
        <textarea className="textarea" rows={3} value={form.comment} onChange={e => set('comment', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Próxima acción</label>
          <input className="input" value={form.nextAction || ''} onChange={e => set('nextAction', e.target.value)} />
        </div>
        <div>
          <label className="label">Fecha recordatorio</label>
          <input type="date" className="input" value={form.nextActionDate || ''} onChange={e => set('nextActionDate', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </form>
  )
}
