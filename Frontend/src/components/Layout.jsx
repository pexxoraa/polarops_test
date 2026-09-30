import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import EmergencyOverlay from './EmergencyOverlay'

export default function Layout() {
  return (
    <div className="app-shell">
      <EmergencyOverlay />
      <Sidebar />
      <div className="app-main">
        <Navbar />
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  )
}
