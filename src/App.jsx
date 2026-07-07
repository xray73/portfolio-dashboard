import { Routes, Route, NavLink } from 'react-router-dom'
import { Home, Globe, PieChart, LineChart, Receipt } from 'lucide-react'
import HomePage from './pages/Home.jsx'
import MacroPage from './pages/Macro.jsx'
import PortfolioPage from './pages/Portfolio.jsx'
import GraficiPage from './pages/Grafici.jsx'
import TransazioniPage from './pages/Transazioni.jsx'

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/macro', label: 'Macro', icon: Globe },
  { to: '/portfolio', label: 'Portfolio', icon: PieChart },
  { to: '/grafici', label: 'Grafici', icon: LineChart },
  { to: '/transazioni', label: 'Transazioni', icon: Receipt },
]

export default function App() {
  return (
    <div className="app-layout">
      <nav className="bottom-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
          >
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/macro" element={<MacroPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/grafici" element={<GraficiPage />} />
          <Route path="/transazioni" element={<TransazioniPage />} />
        </Routes>
      </main>
    </div>
  )
}
