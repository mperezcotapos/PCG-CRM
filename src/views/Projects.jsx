import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { addProject, updateProject, deleteProject, addPartida, updatePartida, deletePartida } from '../lib/db'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { ESTADOS, CATEGORIAS, getPelota, buildPcgId } from '../lib/constants'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import ActivityForm from '../components/ActivityForm'

export default function Projects() {
  const { clients, projects, partidas, activities, getClient, getProject, getPartidaActivities } = useApp()
  const [filterClient, setFilterClient] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [expandedProject, setExpandedProject] = useState(null)
  const [creatingPartida, setCreatingPartida] = useState(null)
  const [editingProject, setEditingProject] = useState(null) // project object
  const [registeringActivity, setRegisteringActivity] = useState(null)
  const [viewingPartida, setViewingPartida] = useState(null) // { partida, project, client }

  const filtered = projects.filter(proj => {
    const client = getClient(proj.clientId)
    if (filterClient && proj.clientId !== filterClient) return false
    if (search) {
      const q = search.toLowerCase()
      return [proj.name, client?.name].join(' ').toLowerCase().includes(q)
    }
    return true
  })

  const handleDeleteProject = async (id) => {
    if (!confirm('¿Eliminar este proyecto?')) return
    await deleteProject(id)
  }

  const handleDeletePartida = async (id) => {
    if (!confirm('¿Eliminar esta partida?')) return
    await deletePartida(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proyectos y Partidas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{projects.length} proyectos · {partidas.length} partidas</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Nuevo proyecto</button>
      </div>

      {/* Filters */}
      <div className="card px-4 py-3 flex gap-3 flex-wrap">
        <input className="input w-48" placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="select w-44" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
          <option value="">Todos los clientes</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(search || filterClient) && (
          <button className="btn-ghost text-xs" onClick={() => { setSearch(''); setFilterClient('') }}>Limpiar</button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} proyectos</span>
      </div>

      {/* Project list */}
      <div className="space-y-3">
        {filtered.map(proj => {
          const client = getClient(proj.clientId)
          const projPartidas = partidas.filter(p => p.projectId === proj.id)
          const isExpanded = expandedProject === proj.id

          return (
            <div key={proj.id} className="card overflow-hidden">
              {/* Project header */}
              <div
                className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedProject(isExpanded ? null : proj.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-gray-900">{proj.name}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {client?.name} · {projPartidas.length} partida(s)
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-secondary text-xs"
                    onClick={e => { e.stopPropagation(); setCreatingPartida(proj.id) }}>
                    + Partida
                  </button>
                  <button className="btn-ghost p-1.5 text-gray-400 hover:text-gray-700"
                    title="Editar proyecto"
                    onClick={e => { e.stopPropagation(); setEditingProject(proj) }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button className="btn-ghost p-1.5 hover:text-red-500 text-gray-400"
                    onClick={e => { e.stopPropagation(); handleDeleteProject(proj.id) }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Partidas */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {projPartidas.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-gray-400 text-center">
                      Sin partidas. <button className="text-navy-600 hover:underline" onClick={() => setCreatingPartida(proj.id)}>Crear una</button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {projPartidas.map(partida => {
                        const acts = getPartidaActivities(partida.id)
                        const latest = acts[0]
                        const daysSince = latest
                          ? Math.floor((new Date() - new Date(latest.date)) / 86400000)
                          : null

                        return (
                          <div key={partida.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50/60">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-gray-800 text-sm">{partida.name}</span>
                                {partida.provider && (
                                  <span className="text-xs text-gray-400">· {partida.provider}</span>
                                )}
                                <StatusBadge value={latest?.status || 'activo'} />
                              </div>
                              {latest && (
                                <p className="text-xs text-gray-500 truncate mt-0.5">{latest.comment}</p>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 whitespace-nowrap">
                              {daysSince !== null ? `${daysSince}d sin act.` : 'Sin registro'}
                            </div>
                            <button
                              className="btn-ghost text-xs whitespace-nowrap"
                              onClick={() => setViewingPartida({ partida, project: proj, client })}
                            >
                              Ver historial
                            </button>
                          <button
                              className="btn-secondary text-xs whitespace-nowrap"
                              onClick={() => setRegisteringActivity({ partida, project: proj, client })}
                            >
                              + Registro
                            </button>
                            <button className="btn-ghost p-1.5 hover:text-red-500 text-gray-400"
                              onClick={() => handleDeletePartida(partida.id)}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="card py-12 text-center text-gray-400 text-sm">No hay proyectos</div>
        )}
      </div>

      {/* Create project modal */}
      {creating && (
        <Modal title="Nuevo proyecto" onClose={() => setCreating(false)}>
          <ProjectForm
            clients={clients}
            onSave={async (data) => { await addProject(data); setCreating(false) }}
            onCancel={() => setCreating(false)}
          />
        </Modal>
      )}

      {/* Edit project modal */}
      {editingProject && (
        <Modal title="Editar proyecto" onClose={() => setEditingProject(null)}>
          <ProjectForm
            clients={clients}
            initial={editingProject}
            onSave={async (data) => { await updateProject(editingProject.id, data); setEditingProject(null) }}
            onCancel={() => setEditingProject(null)}
          />
        </Modal>
      )}

      {/* Create partida modal */}
      {creatingPartida && (
        <Modal title="Nueva partida" onClose={() => setCreatingPartida(null)}>
          <PartidaForm
            projectId={creatingPartida}
            onSave={async (data) => { await addPartida(data); setCreatingPartida(null) }}
            onCancel={() => setCreatingPartida(null)}
          />
        </Modal>
      )}

      {/* Register activity modal */}
      {registeringActivity && (
        <Modal
          title={`Nuevo registro · ${registeringActivity.partida.name}`}
          onClose={() => setRegisteringActivity(null)}
          size="lg"
        >
          <ActivityForm
            partida={registeringActivity.partida}
            project={registeringActivity.project}
            client={registeringActivity.client}
            onSave={() => setRegisteringActivity(null)}
            onCancel={() => setRegisteringActivity(null)}
          />
        </Modal>
      )}

      {/* Partida history modal */}
      {viewingPartida && (
        <Modal
          title={`Historial · ${viewingPartida.partida.name}`}
          onClose={() => setViewingPartida(null)}
          size="xl"
        >
          <PartidaHistory
            partida={viewingPartida.partida}
            project={viewingPartida.project}
            client={viewingPartida.client}
            onNewRecord={() => {
              setRegisteringActivity(viewingPartida)
              setViewingPartida(null)
            }}
          />
        </Modal>
      )}
    </div>
  )
}

function ProjectForm({ clients, initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    clientId: initial?.clientId || '',
    name:     initial?.name     || '',
    status:   initial?.status   || 'activo',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave(form) }} className="space-y-4">
      <div>
        <label className="label">Cliente <span className="text-red-500">*</span></label>
        <select className="select" value={form.clientId} onChange={e => set('clientId', e.target.value)} required>
          <option value="">Seleccionar cliente…</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Nombre del proyecto <span className="text-red-500">*</span></label>
        <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
      </div>
      <div>
        <label className="label">Estado</label>
        <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
          {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Crear proyecto'}</button>
      </div>
    </form>
  )
}



function PartidaForm({ projectId, onSave, onCancel }) {
  const { clients, projects, partidas } = useApp()
  const project  = projects.find(p => p.id === projectId)
  const client   = clients.find(c => c.id === project?.clientId)

  const [form, setForm]   = useState({ projectId, name: '', category: '', provider: '', priority: 15 })
  const [saving, setSaving] = useState(false)
  const [idError, setIdError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const previewId = buildPcgId(client?.name, project?.name, form.name, form.provider)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const pcgId = buildPcgId(client?.name, project?.name, form.name, form.provider)
    const duplicate = partidas.find(p => p.pcgId === pcgId)
    if (duplicate) {
      setIdError(`El ID "${pcgId}" ya existe en la partida "${duplicate.name}". Cambia el nombre o el proveedor para diferenciarlo.`)
      return
    }
    setSaving(true)
    try { await onSave({ ...form, pcgId }) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nombre de la partida <span className="text-red-500">*</span></label>
        <input className="input" value={form.name} onChange={e => { set('name', e.target.value); setIdError('') }} required />
      </div>
      <div>
        <label className="label">Proveedor</label>
        <input className="input" placeholder="Nombre del proveedor…" value={form.provider} onChange={e => { set('provider', e.target.value); setIdError('') }} />
      </div>
      <div>
        <label className="label">Categoría</label>
        <select className="select" value={form.category} onChange={e => set('category', e.target.value)}>
          <option value="">Seleccionar…</option>
          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
        ID generado: <span className="font-mono font-bold text-gray-900">{previewId}</span>
      </div>
      {idError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          ⚠️ {idError}
        </div>
      )}
      <div className="flex gap-2 justify-end pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Crear partida'}</button>
      </div>
    </form>
  )
}

// ── Partida detail / history ──────────────────────────────────────
function PartidaHistory({ partida, project, client, onNewRecord }) {
  const { getPartidaActivities } = useApp()
  const acts = getPartidaActivities(partida.id)

  return (
    <div className="space-y-4">
      {/* Breadcrumb + action */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{client?.name}</span>
          <span className="mx-1.5 text-gray-300">›</span>
          <span>{project?.name}</span>
          <span className="mx-1.5 text-gray-300">›</span>
          <span className="font-medium text-gray-700">{partida.name}</span>
        </div>
        <button className="btn-primary text-sm" onClick={onNewRecord}>
          + Nuevo registro
        </button>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-sm text-gray-500">
        <span><strong className="text-gray-900">{acts.length}</strong> registros</span>
        {acts[0] && (
          <span>Último: <strong className="text-gray-900">{format(parseISO(acts[0].date), 'd MMM yyyy', { locale: es })}</strong></span>
        )}
      </div>

      {/* Activities timeline */}
      {acts.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">
          Sin registros aún.{' '}
          <button className="text-navy-600 hover:underline" onClick={onNewRecord}>Agregar el primero</button>
        </div>
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {acts.map(act => {
            const pelota = getPelota(act.pelota)
            return (
              <div key={act.id} className="card px-4 py-3">
                {/* Header row */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase">
                    {format(parseISO(act.date), "d 'de' MMMM yyyy", { locale: es })}
                  </span>
                  <StatusBadge value={act.status} />
                  {act.pelota && act.pelota !== '-' && (
                    <span className={`badge ${pelota.color}`}>{pelota.label}</span>
                  )}
                  {act.responsible && (
                    <span className="ml-auto text-xs text-gray-500">👤 {act.responsible}</span>
                  )}
                </div>

                {/* Comment */}
                <p className="text-sm text-gray-800 leading-relaxed">{act.comment}</p>

                {/* Next action */}
                {act.nextAction && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-1.5">
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
