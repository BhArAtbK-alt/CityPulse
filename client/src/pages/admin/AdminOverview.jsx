import React,{useState,useEffect} from "react";
import {adminApi} from "../../services/api.js";
import {timeAgo} from "../../utils/constants.js";
import "./AdminDashboard.css";

export default function AdminOverview(){
  const [stats,setStats]=useState(null);
  const [activity,setActivity]=useState([]);
  const [loading,setLoading]=useState(true);
  const [statusError, setStatusError] = useState(false);

  useEffect(()=>{
    Promise.all([
      adminApi.getStats(),
      adminApi.getActivity({limit:8}),
    ]).then(([s,a])=>{
      setStats(s.data);
      setActivity(a.data||[]);
    }).catch(err => {
      if (err.message.includes("inactive") || err.message.includes("not yet confirmed")) {
        setStatusError(true);
      }
      console.error(err);
    }).finally(()=>setLoading(false));
  },[]);

  if(loading) return <div style={{display:"flex",justifyContent:"center",padding:60}}><div className="spinner"/></div>;

  if (statusError) return (
    <div className="adm-card cm-center" style={{padding:60, textAlign:"center"}}>
      <div style={{fontSize:48, marginBottom:16}}>⏳</div>
      <h2 style={{fontSize:20, fontWeight:800, marginBottom:8}}>Jurisdiction Pending</h2>
      <p style={{fontSize:14, color:"var(--text3)", maxWidth:320, margin:"0 auto 20px"}}>
        Your municipal area is awaiting Super Admin confirmation. Dashboard data will be available once approved.
      </p>
      <a href="/admin/settings" className="adm-save-btn" style={{display:"inline-flex", textDecoration:"none"}}>Check Area Status</a>
    </div>
  );

  const s=stats||{};
  const bc=s.by_category||[];
  const trend=s.trend_30d||[];

  const topCards=[
    {label:"Total Reports",   value:s.total??"-",             icon:"📋", color:"var(--orange)"},
    {label:"Pending",         value:s.pending??"-",           icon:"⏳", color:"#fbbf24"},
    {label:"Resolved",        value:s.resolved??"-",          icon:"✅", color:"var(--teal)"},
    {label:"Escalations",     value:s.escalated??"-",         icon:"🔁", color:"var(--purple)"},
  ];

  const catColors={"pothole":"#f87171","garbage":"#a78bfa","electricity":"#fbbf24","water":"#60a5fa","sewage":"#34d399","vandalism":"#fb923c","other":"#9a9a9a"};
  const maxTrend=Math.max(...trend.map(d=>parseInt(d.count)), 1);

  return(
    <div>
      <h1 className="adm-page-title">Municipal Overview</h1>

      <div className="adm-stats-grid">
        {topCards.map(c=>(
          <div key={c.label} className="adm-stat-card">
            <div className="adm-stat-icon" style={{background:`${c.color}18`,border:`1px solid ${c.color}33`}}>{c.icon}</div>
            <div className="adm-stat-val" style={{color:c.color}}>{c.value}</div>
            <div className="adm-stat-lbl">{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))",gap:16,marginBottom:16}}>
        {/* Trend Visualization */}
        <div className="adm-card">
          <div className="adm-card-title">Last 14 Days Activity</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:4,height:100,paddingTop:10}}>
            {trend.slice(-14).map((d,i)=>(
              <div key={i} title={`${d.day}: ${d.count}`} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
                <div style={{
                  width:"100%", borderRadius:4, background:"var(--teal)", 
                  height:`${Math.round((parseInt(d.count)/maxTrend)*100)}%`, minHeight:4,
                  transition:"height .5s ease"
                }}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:10,color:"var(--text3)"}}>
            <span>Earlier</span>
            <span>Today</span>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="adm-card">
          <div className="adm-card-title">Category Distribution</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {bc.length === 0 ? <p style={{fontSize:12, color:"var(--text3)"}}>No category data available.</p> : 
              bc.map(c=>(
                <div key={c.category}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12}}>
                    <strong style={{textTransform:"capitalize",color:"var(--text2)"}}>{c.category}</strong>
                    <span style={{color:"var(--text3)"}}>{c.count}</span>
                  </div>
                  <div style={{height:4,background:"var(--bg4)",borderRadius:2}}>
                    <div style={{width:`${Math.round((c.count/s.total)*100)}%`,height:"100%",background:catColors[c.category]||"var(--orange)",borderRadius:2}}/>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        {/* Performance Card */}
        <div className="adm-card">
          <div className="adm-card-title">Resolution Performance</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,color:"var(--text2)"}}>Avg. Resolution Speed</span>
              <span style={{fontSize:16,fontWeight:800,color:"var(--teal)"}}>
                {s.avg_resolve_hours ? `${s.avg_resolve_hours}h` : "—"}
              </span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,color:"var(--text2)"}}>Resolution Rate</span>
              <span style={{fontSize:16,fontWeight:800,color:"var(--teal)"}}>
                {s.total > 0 ? `${Math.round((s.resolved/s.total)*100)}%` : "0%"}
              </span>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="adm-card">
          <div className="adm-card-title">Recent Activity</div>
          {activity.length===0
            ? <p style={{fontSize:13,color:"var(--text3)"}}>No recent activity.</p>
            : <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {activity.slice(0, 4).map(a=>(
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:"var(--bg4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>
                    {a.action==="status_change"?"🔄":a.action==="area_confirm"?"🛡️":a.action==="priority_change"?"🏷️":"⚙️"}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600}}>{a.action?.replace(/_/g," ")}</div>
                    <div style={{fontSize:10,color:"var(--text3)"}}>{timeAgo(a.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
      </div>
    </div>
  );
}
