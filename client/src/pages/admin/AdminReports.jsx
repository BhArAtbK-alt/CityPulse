import React,{useState,useEffect,useCallback} from "react";
import {adminApi} from "../../services/api.js";
import {getCat,getStatus,CATEGORIES,STATUSES,timeAgo} from "../../utils/constants.js";
import "./AdminDashboard.css";

const PRIORITIES=["low","normal","high","critical"];
const PRIORITY_COLORS={low:"#9a9a9a",normal:"#00c9a7",high:"#fbbf24",critical:"#ef4444"};
const SLA_COLORS={overdue:"var(--red)",warning:"#fbbf24",ok:"var(--teal)",met:"var(--teal)",none:"var(--text3)"};

export default function AdminReports(){
  const [reports,setReports]=useState([]);
  const [summary,setSummary]=useState({});
  const [loading,setLoading]=useState(true);
  const [filters,setFilters]=useState({status:"all",category:"all",priority:"all",sort:"newest",search:"",overdue_only:false, urgent: false});
  const [total,setTotal]=useState(0);
  
  const [resolveTarget,setResolveTarget]=useState(null);
  const [resolveImg,setResolveImg]=useState(null);
  const [resolving,setResolving]=useState(false);
  
  const [updatingId,setUpdatingId]=useState(null);

  const load=useCallback(()=>{
    setLoading(true);
    adminApi.getReports(filters).then(r=>{
      let data = r.data || [];
      if (filters.urgent) {
        data = data.filter(r => r.status !== 'resolved')
                  .sort((a, b) => {
                    if (!a.due_date) return 1;
                    if (!b.due_date) return -1;
                    return new Date(a.due_date) - new Date(b.due_date);
                  });
      }
      setReports(data);
      setSummary(r.summary||{});
      setTotal(data.length);
    }).catch(console.error).finally(()=>setLoading(false));
  },[filters]);

  useEffect(()=>{load();},[load]);

  const getTimeLeft = (dueDate) => {
    if (!dueDate) return null;
    const diff = new Date(dueDate) - new Date();
    if (diff < 0) return { label: "Overdue", color: "var(--red)", overdue: true };
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 48) return { label: `${Math.floor(h/24)} days`, color: "var(--text3)" };
    if (h < 12) return { label: `${h}h ${m}m`, color: "#ef4444", warning: true };
    return { label: `${h}h left`, color: "#fbbf24" };
  };

  const updateStatus=async(id,status)=>{
    if(status==="resolved") {
      const target = reports.find(r => r.id === id);
      setResolveTarget(target);
      return;
    }
    setUpdatingId(id);
    try{
      await adminApi.updateStatus(id, status);
      setReports(p=>p.map(r=>r.id===id?{...r,status}:r));
    }catch(e){alert(e.message);}finally{setUpdatingId(null);}
  };

  const doResolve=async()=>{
    if(!resolveImg) return alert("Please select an 'After' photo.");
    setResolving(true);
    try{
      let lat=null, lng=null;
      try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout:8000, enableHighAccuracy:true}));
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch(e) { console.warn("GPS timeout"); }

      const fd = new FormData();
      fd.append("after_image", resolveImg);
      if(lat) fd.append("lat", lat);
      if(lng) fd.append("lng", lng);

      const res = await adminApi.resolve(resolveTarget.id, fd);
      alert(res.message || "Resolved!");
      setReports(p=>p.map(r=>r.id===resolveTarget.id?{...r,status:"resolved"}:r));
      setResolveTarget(null); setResolveImg(null);
    } catch(e) { alert(e.message); }
    finally { setResolving(false); }
  };

  const exportToCSV = () => {
    if (reports.length === 0) return alert("No data to export.");
    const headers = ["ID", "Title", "Category", "Status", "Priority", "Latitude", "Longitude", "Address", "Votes", "Comments", "Created At"];
    const rows = reports.map(r => [
      r.id, 
      `"${(r.title||"").replace(/"/g, '""')}"`, 
      r.category, 
      r.status, 
      r.priority, 
      r.latitude, 
      r.longitude, 
      `"${(r.address || "").replace(/"/g, '""')}"`, 
      r.upvote_count, 
      r.comment_count, 
      r.created_at
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `reports_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const f=filters;
  const setF=k=>v=>setFilters(p=>({...p,[k]:v}));

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <h1 className="adm-page-title" style={{margin:0}}>
          Requests <span style={{fontSize:13,color:"var(--text3)",fontWeight:400}}>({total} total)</span>
        </h1>
        <div style={{display:"flex", gap:10}}>
          <button onClick={exportToCSV} style={{padding:"6px 14px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:8,fontSize:12,color:"var(--teal)",fontWeight:700,cursor:"pointer"}}>📥 Export CSV</button>
          <button onClick={load} style={{padding:"6px 14px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:8,fontSize:12,color:"var(--text2)",cursor:"pointer"}}>↻ Refresh</button>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {[
          {k:"pending",    label:`⏳ Pending ${summary.pending||0}`,    color:"#fbbf24"},
          {k:"in_progress",label:`🔧 In Progress ${summary.in_progress||0}`, color:"#60a5fa"},
          {k:"resolved",   label:`✅ Resolved ${summary.resolved||0}`,  color:"var(--teal)"},
        ].map(chip=>(
          <div key={chip.k} style={{padding:"4px 12px",background:"var(--bg3)",border:`1px solid var(--border)`,borderRadius:20,fontSize:12,color:chip.color,fontWeight:700}}>
            {chip.label}
          </div>
        ))}
        <button 
          onClick={() => setF("urgent")(!f.urgent)}
          style={{
            padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer",
            background: f.urgent ? "rgba(239,68,68,0.15)" : "var(--bg3)",
            border: `1px solid ${f.urgent ? "var(--red)" : "var(--border)"}`,
            color: f.urgent ? "var(--red)" : "var(--text3)"
          }}>
          🚨 Urgent (SLA)
        </button>
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        <input className="adm-input" style={{width:200,marginBottom:0,padding:"7px 12px",fontSize:12}}
          placeholder="Search title…" value={f.search}
          onChange={e=>setF("search")(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&load()}/>
        <select className="adm-input" style={{width:"auto",marginBottom:0,padding:"7px 10px",fontSize:12}}
          value={f.status} onChange={e=>setF("status")(e.target.value)} disabled={f.urgent}>
          <option value="all">All Statuses</option>
          {STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="adm-input" style={{width:"auto",marginBottom:0,padding:"7px 10px",fontSize:12}}
          value={f.category} onChange={e=>setF("category")(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
        </select>
      </div>

      {loading
        ? <div style={{display:"flex",justifyContent:"center",padding:60}}><div className="spinner"/></div>
        : reports.length===0
          ? <div style={{textAlign:"center",padding:60,color:"var(--text3)"}}>No reports found.</div>
          : <div className="adm-reports-list">
            {reports.map(r=>{
              const cat=getCat(r.category);
              const status=getStatus(r.status);
              const prioColor=PRIORITY_COLORS[r.priority||"normal"];
              const tl = getTimeLeft(r.due_date);
              
              return(
                <div key={r.id} className="adm-report-row" style={{borderLeft:`3px solid ${prioColor}`}}>
                  {r.image_url&&<img src={r.image_url} className="adm-report-img" alt="" onError={e=>e.target.style.display="none"}/>}
                  <div className="adm-report-info">
                    <div className="adm-report-meta">
                      <span style={{color:cat.color,fontSize:11,fontWeight:700}}>{cat.icon} {cat.label}</span>
                      <span style={{fontSize:11,padding:"2px 7px",borderRadius:10,background:`${prioColor}20`,color:prioColor,fontWeight:700,textTransform:"uppercase"}}>{r.priority}</span>
                      
                      {r.status !== 'resolved' && tl && (
                        <span style={{fontSize:11, fontWeight:800, color: tl.color}}>
                          {tl.overdue ? "⚠️ OVERDUE" : `⏳ ${tl.label}`}
                        </span>
                      )}
                      
                      <span className="adm-report-time">{timeAgo(r.created_at)}</span>
                    </div>
                    <div className="adm-report-title">{r.title}</div>
                    <div className="adm-report-desc">{r.description}</div>
                    {r.address&&<div className="adm-report-addr">📍 {r.address.split(",").slice(0,2).join(",")}</div>}
                  </div>
                  <div className="adm-report-actions">
                    <select className="adm-status-select" value={r.status}
                      disabled={updatingId===r.id || r.status==="resolved"}
                      onChange={e=>updateStatus(r.id, e.target.value)}
                      style={{color:status.color}}>
                      {["pending","verified","in_progress","resolved"].map(s=><option key={s} value={s}>{getStatus(s).label}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
      }

      {/* Resolve Modal */}
      {resolveTarget&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:20,padding:24,width:"100%",maxWidth:420}}>
            <h3 style={{fontSize:16,fontWeight:800,marginBottom:4}}>Confirm Resolution</h3>
            <p style={{fontSize:13,color:"var(--text3)",marginBottom:16}}>Upload "After" photo. 📍 GPS check enabled.</p>
            <input type="file" accept="image/*" capture="environment" 
              onChange={e=>setResolveImg(e.target.files[0])} className="adm-input" style={{marginBottom:16}}/>
            <div style={{display:"flex",gap:10}}>
              <button className="adm-save-btn" onClick={doResolve} disabled={resolving || !resolveImg} style={{flex:1, justifyContent:"center"}}>
                {resolving ? "Verifying..." : "✅ Resolve Issue"}
              </button>
              <button onClick={()=>{setResolveTarget(null); setResolveImg(null);}}
                style={{padding:"10px 18px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:12,fontSize:13,color:"var(--text2)"}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
