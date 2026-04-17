import React,{useState,useEffect} from "react";
import {superAdminApi} from "../../services/api.js";
import {getCat,timeAgo} from "../../utils/constants.js";
import "./SuperAdmin.css";

const STATUS_STYLES={
  pending:  {color:"#fbbf24",bg:"rgba(251,191,36,.12)",  label:"Pending"},
  accepted: {color:"var(--teal)",bg:"rgba(0,201,167,.1)",label:"Accepted"},
  rejected: {color:"var(--red)", bg:"rgba(239,68,68,.1)",label:"Rejected"},
  resolved: {color:"#34d399",    bg:"rgba(52,211,153,.1)",label:"Resolved"},
};

export default function SAEscalations(){
  const [escalations,setEscalations]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filterStatus,setFilterStatus]=useState("all");
  const [resolveModal,setResolveModal]=useState(null);
  const [note,setNote]=useState("");
  const [saving,setSaving]=useState(false);

  const load=()=>{
    setLoading(true);
    superAdminApi.getEscalations({status:filterStatus==="all"?undefined:filterStatus})
      .then(r=>setEscalations(r.data||[])).catch(console.error).finally(()=>setLoading(false));
  };
  useEffect(()=>{load();},[filterStatus]);

  const resolve=async(id,status)=>{
    if(status==="resolved"&&!note.trim()) return alert("Please provide a resolution note.");
    setSaving(true);
    try{
      await superAdminApi.updateEscalation(id,{status,resolution_note:note});
      setEscalations(p=>p.map(e=>e.id===id?{...e,status,resolution_note:note}:e));
      setResolveModal(null);setNote("");
    }catch(e){alert(e.message);}finally{setSaving(false);}
  };

  const summary={pending:0,accepted:0,rejected:0,resolved:0};
  escalations.forEach(e=>{if(summary[e.status]!==undefined) summary[e.status]++;});

  const filtered=filterStatus==="all"?escalations:escalations.filter(e=>e.status===filterStatus);

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <h1 className="sa-page-title" style={{margin:0}}>All Escalations</h1>
        <button onClick={load} style={{padding:"6px 14px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:8,fontSize:12,color:"var(--text2)"}}>↻ Refresh</button>
      </div>

      {/* Summary */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {Object.entries(STATUS_STYLES).map(([k,v])=>(
          <button key={k}
            onClick={()=>setFilterStatus(filterStatus===k?"all":k)}
            style={{padding:"5px 14px",background:filterStatus===k?v.bg:"var(--bg3)",
              border:`1px solid ${filterStatus===k?v.color:"var(--border)"}`,
              borderRadius:20,fontSize:12,fontWeight:700,color:filterStatus===k?v.color:"var(--text2)"}}>
            {v.label}: {summary[k]}
          </button>
        ))}
      </div>

      {loading
        ? <div style={{display:"flex",justifyContent:"center",padding:60}}><div className="spinner"/></div>
        : filtered.length===0
          ? <div style={{textAlign:"center",padding:60,color:"var(--text3)"}}>No escalations found.</div>
          : <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {filtered.map(e=>{
              const ss=STATUS_STYLES[e.status]||STATUS_STYLES.pending;
              const cat=getCat(e.reports?.category);
              const fromZone=e["municipal_areas!from_area_id"]?.name||"Unknown";
              const toZone=e["municipal_areas!to_area_id"]?.name||"Super Admin";
              const by=e["users!escalated_by"];
              return(
                <div key={e.id} className="sa-card" style={{margin:0,borderLeft:`3px solid ${ss.color}`}}>
                  <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
                        <span style={{fontSize:12,color:cat.color,fontWeight:700}}>{cat.icon} {cat.label}</span>
                        <span className="sa-badge" style={{background:ss.bg,color:ss.color}}>{ss.label}</span>
                        <span style={{fontSize:11,color:"var(--text3)",marginLeft:"auto"}}>{timeAgo(e.created_at)}</span>
                      </div>
                      <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{e.reports?.title||"Unknown Report"}</div>
                      <div style={{display:"flex",gap:16,fontSize:12,color:"var(--text3)",marginBottom:8}}>
                        <span>📤 From: <strong style={{color:"var(--text2)"}}>{fromZone}</strong></span>
                        <span>📥 To: <strong style={{color:"var(--text2)"}}>{toZone}</strong></span>
                        {by&&<span>👤 By: <strong style={{color:"var(--text2)"}}>{by.username}</strong></span>}
                      </div>
                      <div style={{fontSize:13,color:"var(--text2)",padding:"8px 12px",background:"var(--bg3)",borderRadius:8,marginBottom:6}}>
                        <strong>Reason:</strong> {e.reason}
                      </div>
                      {e.resolution_note&&(
                        <div style={{fontSize:12,color:"var(--teal)",padding:"6px 10px",background:"rgba(0,201,167,.08)",borderRadius:6}}>
                          <strong>Resolution:</strong> {e.resolution_note}
                        </div>
                      )}
                    </div>
                    {e.status==="pending"&&(
                      <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                        <button onClick={()=>resolve(e.id,"accepted")}
                          style={{padding:"6px 12px",background:"rgba(0,201,167,.12)",border:"1px solid rgba(0,201,167,.25)",borderRadius:8,fontSize:11,color:"var(--teal)",fontWeight:700}}>
                          Accept
                        </button>
                        <button onClick={()=>setResolveModal(e)}
                          style={{padding:"6px 12px",background:"rgba(52,211,153,.1)",border:"1px solid rgba(52,211,153,.2)",borderRadius:8,fontSize:11,color:"#34d399",fontWeight:700}}>
                          Resolve
                        </button>
                        <button onClick={()=>resolve(e.id,"rejected")}
                          style={{padding:"6px 12px",background:"var(--red-dim)",border:"1px solid rgba(239,68,68,.2)",borderRadius:8,fontSize:11,color:"var(--red)",fontWeight:700}}>
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
      }

      {resolveModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:20,padding:24,width:"100%",maxWidth:400}}>
            <h3 style={{fontSize:16,fontWeight:800,marginBottom:4}}>Force Resolve Escalation</h3>
            <p style={{fontSize:13,color:"var(--text3)",marginBottom:16}}>{resolveModal.reports?.title}</p>
            <div className="sa-card-title" style={{marginBottom:6}}>Resolution Note *</div>
            <textarea className="sa-input" rows={3} value={note} onChange={e=>setNote(e.target.value)}
              placeholder="Describe resolution action taken…" style={{resize:"vertical"}}/>
            <div style={{display:"flex",gap:10,marginTop:16}}>
              <button className="sa-btn" onClick={()=>resolve(resolveModal.id,"resolved")} disabled={saving}
                style={{flex:1,justifyContent:"center"}}>
                {saving?"Saving…":"✅ Force Resolve"}
              </button>
              <button onClick={()=>{setResolveModal(null);setNote("");}}
                style={{padding:"9px 18px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:10,fontSize:13,color:"var(--text2)"}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
