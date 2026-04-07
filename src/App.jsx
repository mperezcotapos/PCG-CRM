import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Sidebar    from './components/Sidebar'
import BottomNav  from './components/BottomNav'
import Dashboard  from './views/Dashboard'
import QuickEntry from './views/QuickEntry'
import History    from './views/History'
import Clients    from './views/Clients'
import Projects   from './views/Projects'
import Providers  from './views/Providers'
import Import     from './views/Import'
import Chat       from './views/Chat'

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <div className="flex min-h-screen">
          {/* Sidebar: solo desktop */}
          <Sidebar />
          {/* Main content */}
          <main className="flex-1 md:ml-60 p-4 md:p-6 pb-20 md:pb-6 w-full">
            <Routes>
              <Route path="/"            element={<Dashboard />} />
              <Route path="/registro"    element={<QuickEntry />} />
              <Route path="/historial"   element={<History />} />
              <Route path="/clientes"    element={<Clients />} />
              <Route path="/proyectos"   element={<Projects />} />
              <Route path="/proveedores" element={<Providers />} />
              <Route path="/importar"    element={<Import />} />
              <Route path="/chat"        element={<Chat />} />
              <Route path="*"            element={<Navigate to="/" />} />
            </Routes>
          </main>
          {/* Bottom nav: solo mobile */}
          <BottomNav />
        </div>
      </AppProvider>
    </BrowserRouter>
  )
}
