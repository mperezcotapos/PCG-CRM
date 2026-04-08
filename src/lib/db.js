import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch, getDocs
} from 'firebase/firestore'
import { db } from './firebase'

// ---- Generic helpers ----
const col = (name) => collection(db, name)
const ref = (name, id) => doc(db, name, id)

// ---- Clients ----
export const subscribeClients = (cb) =>
  onSnapshot(query(col('clients'), orderBy('name')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addClient = (data) =>
  addDoc(col('clients'), { ...data, createdAt: serverTimestamp() })

export const updateClient = (id, data) =>
  updateDoc(ref('clients', id), data)

export const deleteClient = (id) =>
  deleteDoc(ref('clients', id))

// ---- Projects ----
export const subscribeProjects = (cb) =>
  onSnapshot(query(col('projects'), orderBy('name')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addProject = (data) =>
  addDoc(col('projects'), { ...data, createdAt: serverTimestamp() })

export const updateProject = (id, data) =>
  updateDoc(ref('projects', id), data)

export const deleteProject = (id) =>
  deleteDoc(ref('projects', id))

// ---- Partidas ----
export const subscribePartidas = (cb) =>
  onSnapshot(query(col('partidas'), orderBy('name')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addPartida = (data) =>
  addDoc(col('partidas'), { ...data, createdAt: serverTimestamp() })

export const updatePartida = (id, data) =>
  updateDoc(ref('partidas', id), data)

export const deletePartida = (id) =>
  deleteDoc(ref('partidas', id))

// ---- Activities ----
export const subscribeActivities = (cb) =>
  onSnapshot(query(col('activities'), orderBy('date', 'desc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addActivity = (data) =>
  addDoc(col('activities'), { ...data, createdAt: serverTimestamp() })

export const updateActivity = (id, data) =>
  updateDoc(ref('activities', id), data)

export const deleteActivity = (id) =>
  deleteDoc(ref('activities', id))

// ---- Providers ----
export const subscribeProviders = (cb) =>
  onSnapshot(query(col('providers'), orderBy('name')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addProvider = (data) =>
  addDoc(col('providers'), { ...data, createdAt: serverTimestamp() })

export const updateProvider = (id, data) =>
  updateDoc(ref('providers', id), data)

export const deleteProvider = (id) =>
  deleteDoc(ref('providers', id))

// ---- Sync: repara el status de todas las partidas según su actividad más reciente ----
export const syncAllPartidaStatuses = async () => {
  const getMs = (act) => {
    const ts = act.createdAt
    if (ts === null) return Date.now() + 1e9
    if (ts == null)  return new Date(act.date || 0).getTime()
    return ts.toMillis?.() ?? ts.seconds * 1000
  }

  const snap = await getDocs(col('activities'))
  const activities = snap.docs.map(d => ({ id: d.id, ...d.data() }))

  // La actividad más reciente por partida (por createdAt)
  const latestByPartida = {}
  activities.forEach(act => {
    const prev = latestByPartida[act.partidaId]
    if (!prev || getMs(act) > getMs(prev)) {
      latestByPartida[act.partidaId] = act
    }
  })

  const entries = Object.entries(latestByPartida).filter(([, act]) => act.status)
  const CHUNK = 400
  for (let i = 0; i < entries.length; i += CHUNK) {
    const batch = writeBatch(db)
    entries.slice(i, i + CHUNK).forEach(([partidaId, act]) => {
      batch.update(ref('partidas', partidaId), { status: act.status })
    })
    await batch.commit()
  }
  return entries.length
}

// ---- Bulk import (used once to seed data from Excel) ----
export const bulkImport = async (data) => {
  const CHUNK = 400
  const batchWrite = async (items, colName, idMap = {}) => {
    const results = {}
    for (let i = 0; i < items.length; i += CHUNK) {
      const batch = writeBatch(db)
      const chunk = items.slice(i, i + CHUNK)
      chunk.forEach(item => {
        const { id: localId, ...rest } = item
        const docRef = doc(col(colName))
        batch.set(docRef, { ...rest, createdAt: serverTimestamp() })
        results[localId] = docRef.id
      })
      await batch.commit()
    }
    return results
  }

  const clientMap = await batchWrite(data.clients, 'clients')

  const projectsWithRealIds = data.projects.map(p => ({
    ...p,
    clientId: clientMap[p.clientId] || p.clientId,
  }))
  const projectMap = await batchWrite(projectsWithRealIds, 'projects')

  const partidasWithRealIds = data.partidas.map(p => ({
    ...p,
    projectId: projectMap[p.projectId] || p.projectId,
  }))
  const partidaMap = await batchWrite(partidasWithRealIds, 'partidas')

  const activitiesWithRealIds = data.activities.map(a => ({
    ...a,
    partidaId: partidaMap[a.partidaId] || a.partidaId,
  }))
  await batchWrite(activitiesWithRealIds, 'activities')

  console.log('Import complete ✓')
}
