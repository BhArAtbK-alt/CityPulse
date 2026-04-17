import React,{useState,useEffect} from "react";
import {superAdminApi} from "../../services/api.js";
import {timeAgo} from "../../utils/constants.js";
import "./SuperAdmin.css";

export default function SAOverview(){
  const [stats,setStats]=useState(null);
  const [activity,setActivity]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    Promise.all([
      superAdminApi.getStats(),
      superAdminApi.getActivity({limit:10}),
    ]).then(([s,a])=>{
      setStats(s.data);
      setActivity(a.data||[]);
    }).catch(console.error).finally(()=>setLoading(false));
  },[]);

  if(loading) return <div style={{display:"flex",justifyContent:"center",padding:80}}><div className="spinner"/></div>;

  const s=stats||{};
  const bs=s.by_status||{};
  const bc=s.by_category||{};

  const topCards=[
    {label:"Total Reports",    value:s.total_reports??0,       icon:"📋", color:"var(--orange)"},
    {label:"Total Citizens",   value:s.total_citizens??0,      icon:"👥", color:"var(--teal)"},
    {label:"Municipal Admins", value:s.total_admins??0,        icon:"🏛️", color:"var(--purple)"},
    {label:"Active Areas",     value:s.total_areas??0,         icon:"📐", color:"#60a5fa"},
    {label:"Pending Reports",  value:s.pending_reports??0,     icon:"⏳", color:"#fbbf24"},
    {label:"Resolved Reports", value:s.resolved_reports??0,    icon:"✅", color:"#34d399"},
    {label:"Orphaned Reports", value:s.orphaned_reports??0,    icon:"📥", color:"#94a3b8"},
    {label:"Pending Escalations",value:s.escalations_pending??0,icon:"🔁",color:"#fb923c"},
  ];

  // Build trend chart data — last 14 days
  const trend=s.trend_30d||{};
  const trendDays=[];
  for(let i=13;i>=0;i--){
    const d=new Date(Date.now()-i*86400000);
    const key=d.toISOString().slice(0,10);
    trendDays.push({day:d.toLocaleDateString("en-IN",{day:"numeric",month:"short"}),count:trend[key]||0});
  }
  const maxCount=Math.max(...trendDays.map(d=>d.count),1);

  const catColors={"pothole":"#f87171","garbage":"#a78bfa","lighting":"#fbbf24","water":"#60a5fa","sewage":"#34d399","vandalism":"#fb923c","other":"#9a9a9a"};
  const totalCats=Object.values(bc).reduce((a,b)=>a+b,0)||1;

  const actActionIcons={
    status_change:"🔄",escalate:"🔁",priority_change:"🏷️",
    settings_update:"⚙️",area_create:"📐",area_update:"📐",
    role_change:"👤",geofence_update:"🗺️",
  };

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h1 className="sa-page-title" style={{margin:0}}>System Overview</h1>
        <span style={{fontSize:12,color:"var(--text3)"}}>Real-time across all municipal areas</span>
      </div>

      {/* Stat cards */}
      <div className="sa-stats-grid">
        {topCards.map(c=>(
          <div key={c.label} className="sa-stat-card">
            <div className="sa-stat-icon" style={{background:`${c.color}18`,border:`1px solid ${c.color}30`}}>{c.icon}</div>
            <div className="sa-stat-val" style={{color:c.color}}>{c.value.toLocaleString()}</div>
            <div className="sa-stat-lbl">{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        {/* 14-day trend bar chart */}
        <div className="sa-card">
          <div className="sa-card-title">Reports — Last 14 Days</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:3,height:80}}>
            {trendDays.map((d,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <div style={{
                  width:"100%",borderRadius:"3px 3px 0 0",
                  height:`${Math.round((d.count/maxCount)*72)+2}px`,
                  background:d.count>0?"var(--teal)":"var(--bg4)",
                  transition:"height .4s ease",
                  minHeight:3,
                }}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
            <span style={{fontSize:10,color:"var(--text3)"}}>{trendDays[0]?.day}</span>
            <span style={{fontSize:10,color:"var(--text3)"}}>{trendDays[trendDays.length-1]?.day}</span>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="sa-card">
          <div className="sa-card-title">Reports by Category</div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {Object.entries(bc).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([cat,count])=>(
              <div key={cat}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                  <span style={{fontSize:11,color:catColors[cat]||"#9a9a9a",fontWeight:700,textTransform:"capitalize"}}>{cat}</span>
                  <span style={{fontSize:11,color:"var(--text3)"}}>{count}</span>
                </div>
                <div style={{height:4,background:"var(--bg4)",borderRadius:2}}>
                  <div style={{width:`${Math.round((count/totalCats)*100)}%`,height:"100%",background:catColors[cat]||"#9a9a9a",borderRadius:2}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status distribution */}
      <div className="sa-card" style={{marginBottom:16}}>
        <div className="sa-card-title">Status Distribution</div>
        <div style={{display:"flex",gap:0,height:20,borderRadius:6,overflow:"hidden"}}>
          {[
            {k:"pending",    color:"#fbbf24"},
            {k:"verified",   color:"var(--teal)"},
            {k:"in_progress",color:"#60a5fa"},
            {k:"resolved",   color:"#34d399"},
          ].map(({k,color})=>{
            const val=bs[k]||0;
            const pct=s.total_reports>0?Math.round((val/s.total_reports)*100):0;
            return pct>0?(
              <div key={k} title={`${k}: ${val} (${pct}%)`}
                style={{width:`${pct}%`,background:color,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {pct>6&&<span style={{fontSize:9,fontWeight:800,color:"#0a0a0a"}}>{pct}%</span>}
              </div>
            ):null;
          })}
        </div>
        <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:8}}>
          {[
            {k:"pending",    label:"Pending",     color:"#fbbf24"},
            {k:"verified",   label:"Verified",    color:"var(--teal)"},
            {k:"in_progress",label:"In Progress", color:"#60a5fa"},
            {k:"resolved",   label:"Resolved",    color:"#34d399"},
          ].map(({k,label,color})=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:color}}/>
              <span style={{fontSize:11,color:"var(--text3)"}}>{label}: <strong style={{color:"var(--text2)"}}>{bs[k]||0}</strong></span>
            </div>
          ))}
        </div>
      </div>

      {/* Activity log */}
      <div className="sa-card">
        <div className="sa-card-title">Recent System Activity</div>
        {activity.length===0
          ? <p style={{fontSize:13,color:"var(--text3)"}}>No activity yet.</p>
          : <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {activity.map(a=>{
              const actor=a["users!actor_id"]||a.users;
              return(
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid var(--border)"}}>
                  <div style={{
                    width:32,height:32,borderRadius:"50%",background:actor?.avatar_color||"var(--bg4)",
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,
                    color:"#fff",flexShrink:0
                  }}>
                    {actor?.username?.[0]?.toUpperCase()||"?"}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13}}>
                      <strong style={{color:"var(--text1)"}}>{actor?.username||"Unknown"}</strong>
                      <span style={{color:"var(--text2)"}}> {actActionIcons[a.action]||"•"} {a.action?.replace(/_/g," ")}</span>
                      <span style={{color:actor?.role==="super_admin"?"var(--teal)":actor?.role==="admin"?"var(--orange)":"var(--text3)",fontSize:10,marginLeft:6,padding:"1px 6px",background:"var(--bg3)",borderRadius:8}}>
                        {actor?.role}
                      </span>
                    </div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>{timeAgo(a.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        }
      </div>
    </div>
  );
}
