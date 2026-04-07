import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { addProvider, updateProvider, deleteProvider } from '../lib/db'
import Modal from '../components/Modal'
import { CATEGORIAS } from '../lib/constants'

export default function Providers() {
  const { providers } = useApp()
  const [creating, setCreating] = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [search,   setSearch]   = useState('')

  const filtered = providers.filter(p =>
    [p.name, p.category, p.contact].join(' ').toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este proveedor?')) return
    await deleteProvider(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-sm text-gray-500 mt-0.5">{providers.length} proveedores registrados</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Nuevo proveedor</button>
      </div>

      <div className="card px-4 py-3">
        <input className="input w-64" placeholder="Buscar proveedor…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80">
              {['Proveedor', 'Categoría', 'Contacto', 'Email', 'Teléfono', 'Notas', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                {providers.length === 0 ? 'No hay proveedores. Agrega uno.' : 'Sin resultados.'}
              </td></tr>
            )}
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3 text-gray-600">{p.category || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{p.contact || '—'}</td>
                <td className="px-4 py-3">
                  {p.email ? <a href={`mailto:${p.email}`} className="text-navy-600 hover:underline">{p.email}</a> : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">{p.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{p.notes || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button className="btn-ghost text-xs" onClick={() => setEditing(p)}>Editar</button>
                    <button className="btn-ghost text-xs hover:text-red-500" onClick={() => handleDelete(p.id)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <Modal title="Nuevo proveedor" onClose={() => setCreating(false)}>
          <ProviderForm
            initial={{ name: '', category: '', contact: '', email: '', phone: '', notes: '' }}
            onSave={async (data) => { await addProvider(data); setCreating(false) }}
            onCancel={() => setCreating(false)}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={`Editar · ${editing.name}`} onClose={() => setEditing(null)}>
          <ProviderForm
            initial={editing}
            onSave={async (data) => { await updateProvider(editing.id, data); setEditing(null) }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  )
}

function ProviderForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave(form) }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Nombre <span className="text-red-500">*</span></label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div>
          <label className="label">Categoría</label>
          <select className="select" value={form.category} onChange={e => set('category', e.target.value)}>
            <option value="">Seleccionar…</option>
            {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Persona de contacto</label>
          <input className="input" value={form.contact || ''} onChange={e => set('contact', e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email || ''} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Teléfono</label>
          <input className="input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Notas</label>
        <textarea className="textarea" rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}
