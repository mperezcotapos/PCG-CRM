import { getDb, ALLOWED_COLLECTIONS, checkAuth, cors } from './_firebase.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { collection } = req.query
  if (!ALLOWED_COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: `Colección inválida. Opciones: ${ALLOWED_COLLECTIONS.join(', ')}` })
  }

  const db = getDb()
  const col = db.collection(collection)

  // GET /api/clients → lista todos
  if (req.method === 'GET') {
    const snap = await col.get()
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    return res.status(200).json(docs)
  }

  // POST /api/clients → crea uno nuevo
  if (req.method === 'POST') {
    const data = { ...req.body, createdAt: new Date().toISOString() }
    const docRef = await col.add(data)
    return res.status(201).json({ id: docRef.id, ...data })
  }

  return res.status(405).json({ error: 'Método no permitido' })
}
