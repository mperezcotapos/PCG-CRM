import { useState, useRef, useEffect } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import { useApp } from '../context/AppContext'
import { addActivity, updatePartida, addClient, addProject, addPartida, addReminder } from '../lib/db'
import StatusBadge from '../components/StatusBadge'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

// ── Tool definitions for Claude ───────────────────────────────────
const TOOLS = [
  {
    name: 'registrar_actividad',
    description: 'Registra una nueva novedad o actividad en una partida existente. Úsalo cuando el usuario mencione que habló con alguien, recibió cotización, envió algo, tuvo una reunión, o cualquier actualización de una partida.',
    input_schema: {
      type: 'object',
      properties: {
        partida_id:       { type: 'string',  description: 'ID exacto de la partida (del contexto CRM)' },
        comentario:       { type: 'string',  description: 'Descripción clara de lo que ocurrió' },
        estado:           { type: 'string',  enum: ['esp_antecedentes','ant_recibidos','cotizando','cot_recibida','cot_enviada','negociacion','ganado','perdido','pausado'], description: 'Nuevo estado (solo si cambió)' },
        pelota:           { type: 'string',  enum: ['-','nosotros','cliente','proveedor'], description: '¿Quién tiene la iniciativa ahora?' },
        accion_pendiente: { type: 'string',  description: 'Próxima acción concreta a tomar' },
        fecha_accion:     { type: 'string',  description: 'Fecha recordatorio YYYY-MM-DD' },
        responsable:      { type: 'string',  description: 'Quién es responsable' },
      },
      required: ['partida_id', 'comentario'],
    },
  },
  {
    name: 'cambiar_estado',
    description: 'Cambia el estado de una partida',
    input_schema: {
      type: 'object',
      properties: {
        partida_id: { type: 'string' },
        estado:     { type: 'string', enum: ['esp_antecedentes','ant_recibidos','cotizando','cot_recibida','cot_enviada','negociacion','ganado','perdido','pausado'] },
      },
      required: ['partida_id', 'estado'],
    },
  },
  {
    name: 'crear_partida',
    description: 'Crea una nueva partida para un proyecto existente',
    input_schema: {
      type: 'object',
      properties: {
        nombre:     { type: 'string',  description: 'Nombre de la partida, ej: "Puertas — Proyecto X (Proveedor)"' },
        proyecto_id:{ type: 'string',  description: 'ID del proyecto' },
        categoria:  { type: 'string',  enum: ['Puertas','Ventanas','Muebles de Cocina','Closets','Muebles de Baño','Otro'] },
        proveedor:  { type: 'string',  description: 'Proveedor chino' },
        prioridad:  { type: 'integer', minimum: 1, maximum: 30, description: 'Prioridad numérica: 1 = más urgente, 30 = menos urgente. Por defecto 15.' },
      },
      required: ['nombre', 'proyecto_id'],
    },
  },
  {
    name: 'crear_proyecto',
    description: 'Crea un nuevo proyecto para un cliente existente',
    input_schema: {
      type: 'object',
      properties: {
        nombre:     { type: 'string' },
        cliente_id: { type: 'string', description: 'ID del cliente existente' },
      },
      required: ['nombre', 'cliente_id'],
    },
  },
  {
    name: 'crear_cliente',
    description: 'Crea un nuevo cliente',
    input_schema: {
      type: 'object',
      properties: {
        nombre:   { type: 'string' },
        contacto: { type: 'string', description: 'Nombre del contacto principal (opcional)' },
        email:    { type: 'string', description: 'Email del contacto (opcional)' },
        telefono: { type: 'string', description: 'Teléfono del contacto (opcional)' },
      },
      required: ['nombre'],
    },
  },
  {
    name: 'crear_recordatorio',
    description: 'Crea un recordatorio o tarea pendiente. Úsalo cuando el usuario mencione algo que tiene que hacer, una llamada que tiene pendiente, un seguimiento, etc.',
    input_schema: {
      type: 'object',
      properties: {
        tema:        { type: 'string',  description: 'Título breve del recordatorio' },
        descripcion: { type: 'string',  description: 'Detalle opcional' },
        responsable: { type: 'string',  description: 'Persona responsable (por defecto Martín)' },
        fecha_limite:{ type: 'string',  description: 'Fecha límite YYYY-MM-DD (opcional)' },
      },
      required: ['tema'],
    },
  },
]

const ESTADO_LABELS = {
  esp_antecedentes: 'Esperando Antecedentes',
  ant_recibidos:    'Antecedentes Recibidos',
  cotizando: 'Cotizando a China', cot_recibida: 'Cotización recibida',
  cot_enviada: 'Cotización enviada', negociacion: 'Negociación',
  ganado: 'Ganado', perdido: 'Perdido', pausado: 'Pausado',
}

const QUICK_PROMPTS = [
  '¿Qué partidas llevan más de 7 días sin actividad?',
  'Resume el estado de todas las partidas activas',
  '¿Qué tengo pendiente esta semana?',
  'Muestra las partidas en negociación',
]

// ── Simple markdown renderer ──────────────────────────────────────
function MdText({ text }) {
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul class="list-disc list-inside space-y-0.5 my-1">$1</ul>')
    .replace(/\n/g, '<br/>')
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

// ── Tool action card ──────────────────────────────────────────────
function ToolCard({ action }) {
  const labels = {
    registrar_actividad: '📝 Actividad registrada',
    cambiar_estado:      '🔄 Estado actualizado',
    crear_partida:       '➕ Partida creada',
    crear_proyecto:      '➕ Proyecto creado',
    crear_cliente:       '➕ Cliente creado',
    crear_recordatorio:  '🔔 Recordatorio creado',
  }
  return (
    <div className="flex items-start gap-2 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2.5 text-xs text-teal-800 my-1">
      <span className="mt-0.5">✓</span>
      <div>
        <p className="font-semibold">{labels[action.name] || action.name}</p>
        <p className="text-teal-600 mt-0.5">{action.result?.mensaje || ''}</p>
      </div>
    </div>
  )
}

// ── Chat view ─────────────────────────────────────────────────────
export default function Chat() {
  const { clients, projects, partidas, activities, getClient, getProject, getPartidaActivities, loading } = useApp()
  const [apiKey] = useState(() => import.meta.env.VITE_ANTHROPIC_API_KEY || '')
  const [apiMessages, setApiMessages]     = useState([])
  const [displayMessages, setDisplayMessages] = useState([])
  const [input, setInput]   = useState('')
  const [busy, setBusy]     = useState(false)
  const [recording, setRecording] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const recognitionRef = useRef(null)

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'es-CL'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    recognition.onstart  = () => setRecording(true)
    recognition.onend    = () => setRecording(false)
    recognition.onerror  = () => setRecording(false) // si niega, el botón queda disponible para volver a tocar
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      sendMessage(transcript)
    }
    recognition.start()
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMessages, busy])

  // ── Build compact CRM context for the system prompt ──────────────
  const buildContext = () => {
    const today = new Date().toISOString().split('T')[0]
    const rows = partidas.map(p => {
      const proj   = getProject(p.projectId)
      const client = getClient(proj?.clientId)
      const acts   = getPartidaActivities(p.id)
      const latest = acts[0]
      return {
        id:              p.id,
        nombre:          p.name,
        pcgId:           p.pcgId || '',
        cliente:         client?.name || '',
        proyecto:        proj?.name || '',
        proveedor:       p.provider || '',
        estado:          ESTADO_LABELS[p.status] || p.status || '',
        prioridad:       p.priority || '',
        ultimaNovedad:   latest?.comment || 'Sin registros',
        accionPendiente: latest?.nextAction || '',
        fechaAccion:     latest?.nextActionDate || '',
        pelota:          latest?.pelota || '',
        diasSinAct:      latest?.date ? Math.floor((new Date() - new Date(latest.date)) / 86400000) : null,
      }
    })
    return { hoy: today, partidas: rows, clientes: clients, proyectos: projects }
  }

  // ── Execute a tool call from Claude ──────────────────────────────
  const executeTool = async (name, inp) => {
    const today = new Date().toISOString().split('T')[0]
    try {
      switch (name) {
        case 'registrar_actividad': {
          const partida = partidas.find(p => p.id === inp.partida_id)
          const newStatus = inp.estado || partida?.status || 'cotizando'
          await addActivity({
            partidaId:      inp.partida_id,
            comment:        inp.comentario,
            status:         newStatus,
            pelota:         inp.pelota || '-',
            nextAction:     inp.accion_pendiente || '',
            nextActionDate: inp.fecha_accion || '',
            responsible:    inp.responsable || 'Martín',
            date:           today,
            observations:   '',
          })
          if (inp.estado) await updatePartida(inp.partida_id, { status: inp.estado })
          return { ok: true, mensaje: `Registrado en "${partida?.name || inp.partida_id}"` }
        }
        case 'cambiar_estado': {
          const partida = partidas.find(p => p.id === inp.partida_id)
          await updatePartida(inp.partida_id, { status: inp.estado })
          return { ok: true, mensaje: `"${partida?.name}" → ${ESTADO_LABELS[inp.estado]}` }
        }
        case 'crear_partida': {
          await addPartida({
            name:      inp.nombre,
            projectId: inp.proyecto_id,
            category:  inp.categoria || 'Otro',
            provider:  inp.proveedor || '',
            priority:  inp.prioridad || 15,
            status:    'cotizando',
          })
          return { ok: true, mensaje: `Partida "${inp.nombre}" creada` }
        }
        case 'crear_proyecto': {
          await addProject({ name: inp.nombre, clientId: inp.cliente_id, status: 'activo' })
          return { ok: true, mensaje: `Proyecto "${inp.nombre}" creado` }
        }
        case 'crear_cliente': {
          await addClient({
            name: inp.nombre,
            contacts: inp.contacto ? [{ name: inp.contacto, email: inp.email || '', phone: inp.telefono || '', role: '' }] : [],
            notes: '',
          })
          return { ok: true, mensaje: `Cliente "${inp.nombre}" creado` }
        }
        case 'crear_recordatorio': {
          await addReminder({
            tema:        inp.tema,
            descripcion: inp.descripcion || '',
            responsable: inp.responsable || 'Martín',
            fechaLimite: inp.fecha_limite || '',
            estado:      'pendiente',
          })
          return { ok: true, mensaje: `Recordatorio "${inp.tema}" creado` }
        }
        default:
          return { ok: false, mensaje: `Herramienta ${name} no conocida` }
      }
    } catch (e) {
      return { ok: false, mensaje: `Error: ${e.message}` }
    }
  }

  // ── Send a message ────────────────────────────────────────────────
  const sendMessage = async (text) => {
    if (!text.trim() || busy) return
    setInput('')
    setBusy(true)

    const ctx = buildContext()

    const systemPrompt = `Eres el asistente de CRM de PCG Group, empresa chilena que importa y vende productos de construcción desde China (muebles de cocina, puertas, ventanas, closets) a constructoras.

Ayudas a Martín a mantener el CRM actualizado. Cuando te cuente novedades, usa las herramientas disponibles para registrarlas de inmediato sin pedir confirmación, salvo que la información sea ambigua.

Sé conciso y directo. Habla en español informal chileno. Después de usar una herramienta, confirma brevemente lo que hiciste.

═══ ESTADO DEL CRM — ${ctx.hoy} ═══
${ctx.partidas.map(p =>
  `[${p.id}] ${p.nombre} | ${p.cliente} | ${p.estado} | Proveedor: ${p.proveedor || '—'} | ${p.diasSinAct != null ? `${p.diasSinAct}d sin act.` : 'sin registros'} | Novedad: ${p.ultimaNovedad} | Pendiente: ${p.accionPendiente || '—'}`
).join('\n')}

═══ CLIENTES ═══
${ctx.clientes.map(c => `[${c.id}] ${c.name}`).join('\n')}

═══ PROYECTOS ═══
${ctx.proyectos.map(p => `[${p.id}] ${p.name}`).join('\n')}`

    const userMsg = { role: 'user', content: text }
    const newApiMessages = [...apiMessages, userMsg]
    setDisplayMessages(prev => [...prev, { type: 'user', text }])

    try {
      const anthropic = new Anthropic({ apiKey: apiKey, dangerouslyAllowBrowser: true })
      let currentApiMessages = newApiMessages

      // Loop to handle tool use
      while (true) {
        const response = await anthropic.messages.create({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system:     systemPrompt,
          messages:   currentApiMessages,
          tools:      TOOLS,
        })

        if (response.stop_reason === 'tool_use') {
          const toolResults = []
          const actions     = []

          for (const block of response.content) {
            if (block.type === 'tool_use') {
              const result = await executeTool(block.name, block.input)
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
              actions.push({ name: block.name, input: block.input, result })
            }
          }

          if (actions.length > 0) {
            setDisplayMessages(prev => [...prev, { type: 'tools', actions }])
          }

          currentApiMessages = [
            ...currentApiMessages,
            { role: 'assistant', content: response.content },
            { role: 'user',      content: toolResults },
          ]
        } else {
          // Final text response
          const finalText = response.content.find(b => b.type === 'text')?.text || ''
          setDisplayMessages(prev => [...prev, { type: 'assistant', text: finalText }])
          setApiMessages([...currentApiMessages, { role: 'assistant', content: response.content }])
          break
        }
      }
    } catch (e) {
      setDisplayMessages(prev => [...prev, { type: 'error', text: e.message }])
    }

    setBusy(false)
    textareaRef.current?.focus()
  }

  // ── Render ────────────────────────────────────────────────────────
  if (!apiKey) {
    return (
      <div className="max-w-lg mx-auto mt-12 space-y-4">
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-600 flex items-center justify-center">
              <SparkleIcon />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Asistente Claude</h2>
              <p className="text-sm text-gray-500">Falta configurar la API key</p>
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 space-y-2">
            <p className="font-semibold">Para activar el asistente:</p>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Agrega tu API key de Anthropic al archivo <code className="bg-yellow-100 px-1 rounded">.env</code>:</li>
            </ol>
            <pre className="bg-white border border-yellow-200 rounded-lg p-3 text-xs font-mono mt-2">
              VITE_ANTHROPIC_API_KEY=sk-ant-...
            </pre>
            <p className="text-xs mt-2">Obtén tu API key en <strong>console.anthropic.com</strong> → API Keys</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 5rem)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-navy-600 flex items-center justify-center shadow-sm">
          <SparkleIcon />
        </div>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-lg leading-tight">Asistente CRM</h1>
          <p className="text-xs text-gray-500">{partidas.length} partidas cargadas</p>
        </div>
        <button
          className="btn-ghost text-xs text-gray-400"
          onClick={() => { setDisplayMessages([]); setApiMessages([]) }}
          title="Limpiar conversación"
        >
          Limpiar
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 pb-2">
        {displayMessages.length === 0 && !busy && (
          <div className="pt-4 space-y-4">
            <p className="text-center text-sm text-gray-500">
              Hola Martín 👋 Cuéntame novedades o pregúntame sobre el CRM.
            </p>
            <div className="grid gap-2">
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="text-left card px-4 py-3 text-sm text-gray-700 hover:shadow-md transition-shadow"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {displayMessages.map((msg, i) => {
          if (msg.type === 'user') return (
            <div key={i} className="flex justify-end">
              <div className="bg-navy-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm leading-relaxed">
                {msg.text}
              </div>
            </div>
          )
          if (msg.type === 'assistant') return (
            <div key={i} className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[88%] text-sm text-gray-800 shadow-sm leading-relaxed">
                <MdText text={msg.text} />
              </div>
            </div>
          )
          if (msg.type === 'tools') return (
            <div key={i} className="space-y-1 px-1">
              {msg.actions.map((a, j) => <ToolCard key={j} action={a} />)}
            </div>
          )
          if (msg.type === 'error') return (
            <div key={i} className="flex justify-start">
              <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-2.5 max-w-[88%] text-sm text-red-700">
                ⚠️ {msg.text}
              </div>
            </div>
          )
          return null
        })}

        {busy && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex gap-1.5 items-center">
                {[0, 150, 300].map(d => (
                  <div key={d} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                    style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 flex gap-2 pt-3 border-t border-gray-100">
        <textarea
          ref={textareaRef}
          className="input flex-1 resize-none text-sm"
          rows={2}
          placeholder='Ej: "Hablé con DLP, les gustó la cotización de puertas de Talca"'
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
          }}
          disabled={busy}
        />
        <div className="flex flex-col gap-2 self-end">
          {/* Botón micrófono */}
          <button
            className={`px-3 py-2 rounded-xl border transition-colors ${
              recording
                ? 'bg-red-500 border-red-500 text-white animate-pulse'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
            onClick={recording ? stopRecording : startRecording}
            disabled={busy}
            title={recording ? 'Detener grabación' : 'Hablar'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          {/* Botón enviar */}
          <button
            className="btn-primary px-3 py-2"
            onClick={() => sendMessage(input)}
            disabled={busy || !input.trim()}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function SparkleIcon() {
  return (
    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  )
}
