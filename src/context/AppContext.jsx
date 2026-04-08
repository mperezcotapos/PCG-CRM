import { createContext, useContext, useEffect, useState } from 'react'
import {
  subscribeClients, subscribeProjects, subscribePartidas,
  subscribeActivities, subscribeProviders
} from '../lib/db'

const AppContext = createContext(null)

// Timestamp efectivo de una actividad: createdAt si existe, sino date, sino 0
// null = escritura pendiente en Firestore → se trata como la más reciente
export const getActivityMs = (act) => {
  const ts = act.createdAt
  if (ts === null) return Date.now() + 1e9
  if (ts == null)  return new Date(act.date || 0).getTime()
  return ts.toMillis?.() ?? ts.seconds * 1000
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

export function AppProvider({ children }) {
  const [clients,    setClients]    = useState([])
  const [projects,   setProjects]   = useState([])
  const [partidas,   setPartidas]   = useState([])
  const [activities, setActivities] = useState([])
  const [providers,  setProviders]  = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    let loaded = 0
    const check = () => { loaded++; if (loaded >= 5) setLoading(false) }

    const unsubs = [
      subscribeClients(d    => { setClients(d);    check() }),
      subscribeProjects(d   => { setProjects(d);   check() }),
      subscribePartidas(d   => { setPartidas(d);   check() }),
      subscribeActivities(d => { setActivities(d); check() }),
      subscribeProviders(d  => { setProviders(d);  check() }),
    ]
    return () => unsubs.forEach(u => u())
  }, [])

  // ---- Derived helpers ----
  const getClient  = (id) => clients.find(c => c.id === id)
  const getProject = (id) => projects.find(p => p.id === id)
  const getPartida = (id) => partidas.find(p => p.id === id)

  const getProjectPartidas = (projectId) =>
    partidas.filter(p => p.projectId === projectId)

  const getClientProjects = (clientId) =>
    projects.filter(p => p.clientId === clientId)

  const getPartidaActivities = (partidaId) =>
    activities
      .filter(a => a.partidaId === partidaId)
      .sort((a, b) => getActivityMs(b) - getActivityMs(a))

  const getLatestActivity = (partidaId) =>
    getPartidaActivities(partidaId)[0] || null

  // Dashboard rows: one per partida, enriched
  const getDashboardRows = () =>
    partidas.map(partida => {
      const project = getProject(partida.projectId)
      const client  = project ? getClient(project.clientId) : null
      const acts    = getPartidaActivities(partida.id)
      const rawLatest = acts[0] || null
      // Siempre usar partida.status como fuente de verdad del estado
      const latest  = rawLatest
        ? { ...rawLatest, status: partida.status || rawLatest.status }
        : null
      const daysSince = latest
        ? Math.floor((new Date() - new Date(latest.date)) / 86400000)
        : null
      return { partida, project, client, latest, acts, daysSince }
    })

  return (
    <AppContext.Provider value={{
      clients, projects, partidas, activities, providers, loading,
      getClient, getProject, getPartida,
      getProjectPartidas, getClientProjects,
      getPartidaActivities, getLatestActivity,
      getDashboardRows,
    }}>
      {children}
    </AppContext.Provider>
  )
}
