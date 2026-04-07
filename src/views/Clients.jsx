import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { addClient, updateClient, deleteClient } from '../lib/db'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'

const emptyClient = () => ({
  name: '', contacts: [{ name: '', role: '', email: '', phone: '' }], notes: ''
})

export default function Clients() {
  const { clients, projects, partidas, activities, getClientProjects, getPartida } = useApp()
  const [selected, setSelected] = useState(null)
  const [editing,  setEditing]  = useState(null)
  const [creating, setCreating] = useState(false)
  const [search,   setSearch]   = useState('')

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este cliente y todos sus datos?')) return
    await deleteClient(id)
    if (selected?.id === id) setSelected(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clients.length} empresas registradas</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          + Nuevo cliente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Client list */}
        <div className="col-span-1 md:col-span-1 space-y-3">
          <input
            type="text" className="input" placeholder="Buscar cliente…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
          <div className="space-y-1.5">
            {filtered.map(client => {
              const clientProjects = getClientProjects(client.id)
              const activeProjects = clientProjects.length
              return (
                <button
                  key={client.id}
                  onClick={() => setSelected(client)}
                  className={`w-full text-left card px-4 py-3 hover:shadow-md transition-all ${
                    selected?.id === client.id ? 'ring-2 ring-navy-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="font-medium text-gray-900 text-sm">{client.name}</div>
                    <span className="text-xs text-gray-400">{activeProjects}P</span>
                  </div>
                  {client.contacts?.[0]?.name && (
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {client.contacts[0].name}
                    </div>
                  )}
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-8">
                No hay clientes
              </div>
            )}
          </div>
        </div>

        {/* Client detail */}
        <div className="col-span-1 md:col-span-2">
          {selected ? (
            <ClientDetail
              client={selected}
              projects={projects.filter(p => p.clientId === selected.id)}
              partidas={partidas}
              activities={activities}
              onEdit={() => setEditing(selected)}
              onDelete={() => handleDelete(selected.id)}
            />
          ) : (
            <div className="card h-64 flex items-center justify-center text-gray-400 text-sm border-dashed border-2">
              Selecciona un cliente para ver el detalle
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {creating && (
        <Modal title="Nuevo cliente" onClose={() => setCreating(false)} size="lg">
          <ClientForm
            initial={emptyClient()}
            onSave={async (data) => { await addClient(data); setCreating(false) }}
            onCancel={() => setCreating(false)}
          />
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title={`Editar · ${editing.name}`} onClose={() => setEditing(null)} size="lg">
          <ClientForm
            initial={editing}
            onSave={async (data) => { await updateClient(editing.id, data); setEditing(null); setSelected({ ...editing, ...data }) }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  )
}

function ClientDetail({ client, projects, partidas, activities, onEdit, onDelete }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card px-5 py-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{client.name}</h2>
            <p className="text-sm text-gray-400">{projects.length} proyecto(s)</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs" onClick={onEdit}>Editar</button>
            <button className="btn-danger text-xs" onClick={onDelete}>Eliminar</button>
          </div>
        </div>

        {/* Contacts */}
        {client.contacts?.filter(c => c.name).length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contactos</div>
            <div className="space-y-2">
              {client.contacts.filter(c => c.name).map((c, i) => (
                <div key={i} className="flex flex-wrap gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-medium text-gray-900">{c.name}</span>
                  {c.role  && <span className="text-gray-500">{c.role}</span>}
                  {c.email && <a href={`mailto:${c.email}`} className="text-navy-600 hover:underline">{c.email}</a>}
                  {c.phone && <a href={`tel:${c.phone}`} className="text-gray-500">{c.phone}</a>}
                </div>
              ))}
            </div>
          </div>
        )}

        {client.notes && (
          <p className="mt-3 text-sm text-gray-600 bg-yellow-50 rounded-lg px-3 py-2">{client.notes}</p>
        )}
      </div>

      {/* Projects & Partidas */}
      {projects.map(proj => {
        const projPartidas = partidas.filter(p => p.projectId === proj.id)
        return (
          <div key={proj.id} className="card overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="font-semibold text-gray-800 text-sm">{proj.name}</span>
              <StatusBadge value={proj.status} />
            </div>
            <div className="divide-y divide-gray-50">
              {projPartidas.length === 0 && (
                <div className="px-5 py-3 text-xs text-gray-400">Sin partidas</div>
              )}
              {projPartidas.map(partida => {
                const acts = activities
                  .filter(a => a.partidaId === partida.id)
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                const latest = acts[0]
                return (
                  <div key={partida.id} className="px-5 py-3 flex items-center gap-3">
                    <span className="text-sm text-gray-700 flex-1">{partida.name}</span>
                    <StatusBadge value={latest?.status || 'activo'} />
                    {latest?.comment && (
                      <span className="text-xs text-gray-400 max-w-xs truncate">{latest.comment}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ClientForm({ initial, onSave, onCancel }) {
  const [form, setForm]       = useState(initial)
  const [saving, setSaving]   = useState(false)
  const set = (k, v)          => setForm(f => ({ ...f, [k]: v }))

  const setContact = (i, k, v) => {
    const contacts = [...(form.contacts || [])]
    contacts[i] = { ...contacts[i], [k]: v }
    set('contacts', contacts)
  }
  const addContact    = () => set('contacts', [...(form.contacts || []), { name: '', role: '', email: '', phone: '' }])
  const removeContact = (i) => set('contacts', form.contacts.filter((_, idx) => idx !== i))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    await onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="label">Nombre empresa <span className="text-red-500">*</span></label>
        <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Contactos</label>
          <button type="button" className="btn-ghost text-xs" onClick={addContact}>+ Agregar contacto</button>
        </div>
        <div className="space-y-2">
          {(form.contacts || []).map((c, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 bg-gray-50 rounded-lg p-2">
              <input className="input text-xs" placeholder="Nombre" value={c.name} onChange={e => setContact(i, 'name', e.target.value)} />
              <input className="input text-xs" placeholder="Cargo" value={c.role} onChange={e => setContact(i, 'role', e.target.value)} />
              <input className="input text-xs" placeholder="Email" value={c.email} onChange={e => setContact(i, 'email', e.target.value)} />
              <div className="flex gap-1">
                <input className="input text-xs flex-1" placeholder="Teléfono" value={c.phone} onChange={e => setContact(i, 'phone', e.target.value)} />
                <button type="button" className="btn-ghost px-1.5 text-red-400 hover:text-red-600"
                  onClick={() => removeContact(i)}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Notas internas</label>
        <textarea className="textarea" rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cliente'}
        </button>
      </div>
    </form>
  )
}
