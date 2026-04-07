import { useState } from 'react'
import { addActivity, updatePartida } from '../lib/db'
import { ESTADOS, PELOTA } from '../lib/constants'
import { useApp } from '../context/AppContext'

const today = () => new Date().toISOString().split('T')[0]

export default function ActivityForm({ partida, project, client, onSave, onCancel }) {
  // Normalize: if partida has an old/invalid status, default to first valid option
  const initialStatus = ESTADOS.find(e => e.value === partida?.status)?.value || ESTADOS[0].value

  const [form, setForm] = useState({
    date:           today(),
    responsible:    '',
    comment:        '',
    nextAction:     '',
    nextActionDate: '',
    status:         initialStatus,
    pelota:         '-',
    observations:   '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.comment.trim()) return
    setSaving(true)
    try {
      await addActivity({ ...form, partidaId: partida.id })
      // Update partida status to match latest activity
      await updatePartida(partida.id, { status: form.status })
      onSave?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Context banner */}
      {client && project && (
        <div className="bg-navy-50 border border-navy-100 rounded-xl px-4 py-3 text-sm">
          <span className="font-semibold text-navy-700">{client.name}</span>
          <span className="text-navy-400 mx-1.5">→</span>
          <span className="text-navy-700">{project.name}</span>
          <span className="text-navy-400 mx-1.5">→</span>
          <span className="text-navy-700">{partida.name}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Fecha</label>
          <input type="date" className="input" value={form.date}
            onChange={e => set('date', e.target.value)} required />
        </div>
        <div>
          <label className="label">Estado</label>
          <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Responsable / Contacto</label>
          <input type="text" className="input" placeholder="Nombre del contacto"
            value={form.responsible} onChange={e => set('responsible', e.target.value)} />
        </div>
        <div>
          <label className="label">La pelota está en</label>
          <select className="select" value={form.pelota} onChange={e => set('pelota', e.target.value)}>
            {PELOTA.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Comentario / Acción realizada <span className="text-red-500">*</span></label>
        <textarea className="textarea" rows={3}
          placeholder="¿Qué ocurrió? ¿Qué se hizo?"
          value={form.comment} onChange={e => set('comment', e.target.value)} required />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Próxima acción / Recordatorio</label>
          <input type="text" className="input" placeholder="¿Qué sigue?"
            value={form.nextAction} onChange={e => set('nextAction', e.target.value)} />
        </div>
        <div>
          <label className="label">Fecha recordatorio</label>
          <input type="date" className="input"
            value={form.nextActionDate} onChange={e => set('nextActionDate', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Observaciones internas</label>
        <textarea className="textarea" rows={2}
          placeholder="Notas internas (no se muestran al cliente)"
          value={form.observations} onChange={e => set('observations', e.target.value)} />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        )}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar registro'}
        </button>
      </div>
    </form>
  )
}
