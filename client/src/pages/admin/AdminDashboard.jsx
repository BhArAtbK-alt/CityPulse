import React,{useState,useEffect} from "react";
import {Routes,Route,NavLink,useNavigate,useLocation} from "react-router-dom";
import {useAuth}  from "../../context/AuthContext.jsx";
import {adminApi} from "../../services/api.js";
import AdminOverview   from "./AdminOverview.jsx";
import AdminGeofence   from "./AdminGeofence.jsx";
import AdminReports    from "./AdminReports.jsx";
import AdminMapView    from "./AdminMapView.jsx";
import AdminEscalations from "./AdminEscalations.jsx";
import AdminSettings   from "./AdminSettings.jsx";
import "./AdminDashboard.css";

export default function AdminDashboard(){
  const {user,logout}=useAuth();
  const location=useLocation();
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [status, setStatus] = useState("loading"); // loading | active | pending

  useEffect(() => {
    adminApi.getSettings().then(r => {
      setStatus(r.data?.status || "none");
    }).catch(() => setStatus("none"));
  }, []);

  const links=[
    {to:"/admin",              label:"Overview",     icon:"📊", end:true},
    {to:"/admin/map",          label:"Zone Map",     icon:"🗺️"},
    {to:"/admin/reports",      label:"Requests",     icon:"📋"},
    {to:"/admin/escalations",  label:"Escalations",  icon:"🔁"},
    {to:"/admin/geofence",     label:"Boundaries",   icon:"📐"},
    {to:"/admin/settings",     label:"Settings",     icon:"⚙️"},
  ];

  const isSetupPath = location.pathname.includes("settings") || location.pathname.includes("geofence");

  if (status === "loading") return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0a0a0a"}}>
      <div className="spinner"/>
    </div>
  );

  return(
    <div className="adm">
      <header className="adm-topbar">
        <div className="adm-topbar-left">
          <button className="adm-hamburger" onClick={()=>setSidebarOpen(o=>!o)}>
            <span/><span/><span/>
          </button>
          <div className="adm-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C7.03 2 3 6.03 3 11c0 6.25 9 13 9 13s9-6.75 9-13c0-4.97-4.03-9-9-9z" fill="var(--orange)"/>
              <circle cx="12" cy="11" r="3" fill="#fff" opacity=".9"/>
            </svg>
            <span>CivicPulse <strong>Municipal</strong></span>
          </div>
        </div>
        <div className="adm-topbar-right">
          <span className="adm-role-badge">🏛️ Admin</span>
          <span className="adm-username">@{user?.username}</span>
          <button className="adm-logout" onClick={logout}>Sign Out</button>
        </div>
      </header>

      <div className="adm-body">
        <aside className={`adm-sidebar ${sidebarOpen?"open":""}`}>
          <nav className="adm-nav">
            {links.map(l=>(
              <NavLink key={l.to} to={l.to} end={l.end}
                className={({isActive})=>`adm-nav-item ${isActive?"active":""}`}
                onClick={()=>setSidebarOpen(false)}>
                <span className="adm-nav-icon">{l.icon}</span>
                <span>{l.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="adm-sidebar-badge">
            <span>🛡️</span>
            <div>
              <div className="adm-badge-title">Municipal Admin</div>
              <div className="adm-badge-sub">CivicPulse v4</div>
            </div>
          </div>
        </aside>

        {sidebarOpen&&<div className="adm-overlay" onClick={()=>setSidebarOpen(false)}/>}

        <main className="adm-main">
          {status === "none" && !isSetupPath ? (
            <div className="adm-card cm-center" style={{padding:60, textAlign:"center"}}>
              <div style={{fontSize:48, marginBottom:16}}>🏛️</div>
              <h2 style={{fontSize:20, fontWeight:800, marginBottom:8}}>Welcome, Ward Manager!</h2>
              <p style={{fontSize:14, color:"var(--text3)", maxWidth:320, margin:"0 auto 20px"}}>
                To activate your dashboard, you first need to define your municipal jurisdiction and request area registration.
              </p>
              <div style={{display:"flex", gap:10, justifyContent:"center"}}>
                <NavLink to="/admin/geofence" className="adm-save-btn" style={{textDecoration:"none"}}>Setup My Ward</NavLink>
              </div>
            </div>
          ) : status === "pending" && !isSetupPath ? (
            <div className="adm-card cm-center" style={{padding:60, textAlign:"center"}}>
              <div style={{fontSize:48, marginBottom:16}}>⏳</div>
              <h2 style={{fontSize:20, fontWeight:800, marginBottom:8}}>Jurisdiction Pending</h2>
              <p style={{fontSize:14, color:"var(--text3)", maxWidth:320, margin:"0 auto 20px"}}>
                Your municipal area is awaiting Super Admin confirmation. Please ensure your boundary is drawn and area is requested.
              </p>
              <div style={{display:"flex", gap:10, justifyContent:"center"}}>
                <NavLink to="/admin/settings" className="adm-save-btn" style={{textDecoration:"none"}}>Go to Settings</NavLink>
                <NavLink to="/admin/geofence" className="adm-clear-btn" style={{textDecoration:"none"}}>Check Boundaries</NavLink>
              </div>
            </div>
          ) : (
            <Routes>
              <Route index                 element={<AdminOverview/>}/>
              <Route path="map"            element={<AdminMapView/>}/>
              <Route path="reports"        element={<AdminReports/>}/>
              <Route path="escalations"    element={<AdminEscalations/>}/>
              <Route path="geofence"       element={<AdminGeofence/>}/>
              <Route path="settings"       element={<AdminSettings/>}/>
            </Routes>
          )}
        </main>
      </div>
    </div>
  );
}
