import { getDb, ALLOWED_COLLECTIONS, checkAuth, cors } from '../_firebase.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { collection, id } = req.query
  if (!ALLOWED_COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: `Colección inválida. Opciones: ${ALLOWED_COLLECTIONS.join(', ')}` })
  }

  const db = getDb()
  const docRef = db.collection(collection).doc(id)

  // GET /api/clients/123 → trae uno
  if (req.method === 'GET') {
    const snap = await docRef.get()
    if (!snap.exists) return res.status(404).json({ error: 'No encontrado' })
    return res.status(200).json({ id: snap.id, ...snap.data() })
  }

  // PUT /api/clients/123 → actualiza campos
  if (req.method === 'PUT') {
    const snap = await docRef.get()
    if (!snap.exists) return res.status(404).json({ error: 'No encontrado' })
    const data = { ...req.body, updatedAt: new Date().toISOString() }
    await docRef.update(data)
    return res.status(200).json({ id, ...snap.data(), ...data })
  }

  // DELETE /api/clients/123 → elimina
  if (req.method === 'DELETE') {
    const snap = await docRef.get()
    if (!snap.exists) return res.status(404).json({ error: 'No encontrado' })
    await docRef.delete()
    return res.status(200).json({ message: `${collection}/${id} eliminado` })
  }

  return res.status(405).json({ error: 'Método no permitido' })
}
