import React,{useState} from "react";
import {Routes,Route,NavLink} from "react-router-dom";
import {useAuth} from "../../context/AuthContext.jsx";
import SAOverview    from "./SAOverview.jsx";
import SAMap         from "./SAMap.jsx";
import SAOfficials   from "./SAOfficials.jsx";
import SACitizens    from "./SACitizens.jsx";
import SAEscalations from "./SAEscalations.jsx";
import SAAreas       from "./SAAreas.jsx";
import SAGlobalInbox from "./SAGlobalInbox.jsx";
import "./SuperAdmin.css";

export default function SuperAdminDashboard(){
  const {user,logout}=useAuth();
  const [sidebarOpen,setSidebarOpen]=useState(false);

  const links=[
    {to:"/superadmin",           label:"Overview",     icon:"📊", end:true},
    {to:"/superadmin/map",       label:"System Map",   icon:"🌐"},
    {to:"/superadmin/officials", label:"Officials",    icon:"🏛️"},
    {to:"/superadmin/citizens",  label:"Citizens",     icon:"👥"},
    {to:"/superadmin/areas",     label:"Areas",        icon:"📐"},
    {to:"/superadmin/escalations",label:"Escalations", icon:"🔁"},
    {to:"/superadmin/inbox",      label:"Global Inbox", icon:"📥"},
  ];

  return(
    <div className="sa">
      <header className="sa-topbar">
        <div className="sa-topbar-left">
          <button className="sa-hamburger" onClick={()=>setSidebarOpen(o=>!o)}>
            <span/><span/><span/>
          </button>
          <div className="sa-brand">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C7.03 2 3 6.03 3 11c0 6.25 9 13 9 13s9-6.75 9-13c0-4.97-4.03-9-9-9z" fill="var(--teal)"/>
              <circle cx="12" cy="11" r="3.5" fill="#fff" opacity=".95"/>
            </svg>
            <span>CivicPulse <strong>Super Admin</strong></span>
          </div>
        </div>
        <div className="sa-topbar-right">
          <span className="sa-role-pill">⚡ Super Admin</span>
          <span className="sa-username">@{user?.username}</span>
          <button className="sa-logout" onClick={logout}>Sign Out</button>
        </div>
      </header>

      <div className="sa-body">
        <aside className={`sa-sidebar ${sidebarOpen?"open":""}`}>
          <nav className="sa-nav">
            {links.map(l=>(
              <NavLink key={l.to} to={l.to} end={l.end}
                className={({isActive})=>`sa-nav-item ${isActive?"active":""}`}
                onClick={()=>setSidebarOpen(false)}>
                <span className="sa-nav-icon">{l.icon}</span>
                <span>{l.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sa-sidebar-badge">
            <span>⚡</span>
            <div>
              <div className="sa-badge-title">Top Authority</div>
              <div className="sa-badge-sub">Full System Access</div>
            </div>
          </div>
        </aside>

        {sidebarOpen&&<div className="sa-overlay" onClick={()=>setSidebarOpen(false)}/>}

        <main className="sa-main">
          <Routes>
            <Route index                   element={<SAOverview/>}/>
            <Route path="map"              element={<SAMap/>}/>
            <Route path="officials"        element={<SAOfficials/>}/>
            <Route path="citizens"         element={<SACitizens/>}/>
            <Route path="areas"            element={<SAAreas/>}/>
            <Route path="escalations"      element={<SAEscalations/>}/>
            <Route path="inbox"            element={<SAGlobalInbox/>}/>
          </Routes>
        </main>
      </div>
    </div>
  );
}
