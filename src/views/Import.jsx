import { useState } from 'react'
import { bulkImport } from '../lib/db'
import initialData from '../../initial_data.json'

export default function Import() {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [error, setError] = useState('')

  const handleImport = async () => {
    if (!confirm(`¿Importar ${initialData.clients.length} clientes, ${initialData.projects.length} proyectos, ${initialData.partidas.length} partidas y ${initialData.activities.length} actividades desde el Excel original?\n\nEsta operación solo debe hacerse UNA VEZ.`)) return

    setStatus('loading')
    try {
      await bulkImport(initialData)
      setStatus('done')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Importar datos Excel</h1>
      <div className="card p-6 space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          <p className="font-semibold mb-1">⚠️ Solo usar una vez</p>
          <p>Esta importación carga todos los datos históricos del archivo Excel a Firebase. Úsalo solo al configurar el sistema por primera vez.</p>
        </div>

        <div className="text-sm text-gray-600 space-y-1">
          <p>Se importarán:</p>
          <ul className="list-disc list-inside space-y-0.5 text-gray-700 font-medium">
            <li>{initialData.clients.length} clientes</li>
            <li>{initialData.projects.length} proyectos</li>
            <li>{initialData.partidas.length} partidas</li>
            <li>{initialData.activities.length} actividades históricas</li>
          </ul>
        </div>

        {status === 'idle' && (
          <button className="btn-primary w-full" onClick={handleImport}>
            Iniciar importación desde Excel
          </button>
        )}

        {status === 'loading' && (
          <div className="flex items-center justify-center gap-3 py-4 text-gray-600">
            <div className="w-5 h-5 border-2 border-navy-500 border-t-transparent rounded-full animate-spin" />
            <span>Importando… esto puede tomar unos segundos</span>
          </div>
        )}

        {status === 'done' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 text-sm">
            <p className="font-semibold">✓ Importación completada</p>
            <p className="mt-1">Todos los datos están disponibles. Navega al Dashboard para verlos.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
            <p className="font-semibold">Error al importar</p>
            <p className="mt-1 font-mono text-xs">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
