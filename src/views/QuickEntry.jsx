import { useState } from 'react'
import { useApp } from '../context/AppContext'
import ActivityForm from '../components/ActivityForm'
import { addClient, addProject, addPartida } from '../lib/db'
import { CATEGORIAS } from '../lib/constants'

export default function QuickEntry() {
  const { clients, projects, partidas } = useApp()
  const [clientId,  setClientId]  = useState('')
  const [projectId, setProjectId] = useState('')
  const [partidaId, setPartidaId] = useState('')
  const [saved, setSaved]         = useState(false)

  // New entity modals
  const [newClient,  setNewClient]  = useState(false)
  const [newProject, setNewProject] = useState(false)
  const [newPartida, setNewPartida] = useState(false)

  const filteredProjects = projects.filter(p => p.clientId === clientId)
  const filteredPartidas = partidas.filter(p => p.projectId === projectId)

  const partida = partidas.find(p => p.id === partidaId)
  const project = projects.find(p => p.id === projectId)
  const client  = clients.find(c => c.id === clientId)

  const handleSaved = () => {
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setPartidaId('')
    }, 2000)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo Registro</h1>
        <p className="text-sm text-gray-500 mt-0.5">Registra una acción o novedad en una partida</p>
      </div>

      {/* Step 1: Select context */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">1. Selecciona el contexto</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Cliente */}
          <div>
            <label className="label">Cliente</label>
            <div className="flex gap-1.5">
              <select className="select" value={clientId}
                onChange={e => { setClientId(e.target.value); setProjectId(''); setPartidaId('') }}>
                <option value="">Seleccionar…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="btn-secondary px-2 text-xs" title="Nuevo cliente"
                onClick={() => setNewClient(true)}>+</button>
            </div>
          </div>

          {/* Proyecto */}
          <div>
            <label className="label">Proyecto</label>
            <div className="flex gap-1.5">
              <select className="select" value={projectId} disabled={!clientId}
                onChange={e => { setProjectId(e.target.value); setPartidaId('') }}>
                <option value="">Seleccionar…</option>
                {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn-secondary px-2 text-xs" title="Nuevo proyecto"
                disabled={!clientId} onClick={() => setNewProject(true)}>+</button>
            </div>
          </div>

          {/* Partida */}
          <div>
            <label className="label">Partida</label>
            <div className="flex gap-1.5">
              <select className="select" value={partidaId} disabled={!projectId}
                onChange={e => setPartidaId(e.target.value)}>
                <option value="">Seleccionar…</option>
                {filteredPartidas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn-secondary px-2 text-xs" title="Nueva partida"
                disabled={!projectId} onClick={() => setNewPartida(true)}>+</button>
            </div>
          </div>
        </div>

        {/* Breadcrumb visual */}
        {client && (
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            <span className="font-medium text-gray-900">{client.name}</span>
            {project && <>
              <span className="text-gray-300">›</span>
              <span className="text-gray-700">{project.name}</span>
            </>}
            {partida && <>
              <span className="text-gray-300">›</span>
              <span className="text-gray-700">{partida.name}</span>
            </>}
          </div>
        )}
      </div>

      {/* Step 2: Activity form */}
      {partida ? (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">2. Registra la actividad</h2>
          {saved ? (
            <div className="flex items-center justify-center gap-2 py-8 text-green-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">Registro guardado correctamente</span>
            </div>
          ) : (
            <ActivityForm
              partida={partida}
              project={project}
              client={client}
              onSave={handleSaved}
            />
          )}
        </div>
      ) : (
        <div className="card p-8 text-center text-gray-400 text-sm border-dashed border-2">
          Selecciona cliente → proyecto → partida para registrar una actividad
        </div>
      )}

      {/* Inline forms for new entities */}
      {newClient  && <InlineNewClient  onDone={(id) => { setClientId(id);  setNewClient(false)  }} onCancel={() => setNewClient(false)} />}
      {newProject && <InlineNewProject clientId={clientId} onDone={(id) => { setProjectId(id); setNewProject(false) }} onCancel={() => setNewProject(false)} />}
      {newPartida && <InlineNewPartida projectId={projectId} onDone={(id) => { setPartidaId(id); setNewPartida(false) }} onCancel={() => setNewPartida(false)} />}
    </div>
  )
}

function InlineNewClient({ onDone, onCancel }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    const ref = await addClient({ name: name.trim(), contacts: [], notes: '' })
    onDone(ref.id)
  }
  return (
    <div className="card p-4 border-navy-200 bg-navy-50">
      <h3 className="text-sm font-semibold text-navy-800 mb-3">Nuevo cliente</h3>
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="Nombre empresa…" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <button className="btn-primary" onClick={save} disabled={saving || !name.trim()}>Crear</button>
        <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

function InlineNewProject({ clientId, onDone, onCancel }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    const ref = await addProject({ clientId, name: name.trim(), status: 'activo' })
    onDone(ref.id)
  }
  return (
    <div className="card p-4 border-navy-200 bg-navy-50">
      <h3 className="text-sm font-semibold text-navy-800 mb-3">Nuevo proyecto</h3>
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="Nombre del proyecto…" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <button className="btn-primary" onClick={save} disabled={saving || !name.trim()}>Crear</button>
        <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

function InlineNewPartida({ projectId, onDone, onCancel }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    const ref = await addPartida({ projectId, name: name.trim(), category: category || name, status: 'activo', providers: [], priority: 'normal' })
    onDone(ref.id)
  }
  return (
    <div className="card p-4 border-navy-200 bg-navy-50">
      <h3 className="text-sm font-semibold text-navy-800 mb-3">Nueva partida</h3>
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="Nombre (ej: Muebles de Cocina)…" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <select className="select w-48" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">Categoría…</option>
          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
        </select>
        <button className="btn-primary" onClick={save} disabled={saving || !name.trim()}>Crear</button>
        <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}
