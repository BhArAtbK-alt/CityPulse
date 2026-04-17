import React,{useState,useEffect} from "react";
import {adminApi} from "../../services/api.js";
import {getCat,timeAgo} from "../../utils/constants.js";
import "./AdminDashboard.css";

const STATUS_STYLES={
  pending:  {color:"#fbbf24",bg:"rgba(251,191,36,.12)",  label:"Pending"},
  accepted: {color:"var(--teal)", bg:"rgba(0,201,167,.1)",  label:"Accepted"},
  rejected: {color:"var(--red)",  bg:"rgba(239,68,68,.1)",  label:"Rejected"},
  resolved: {color:"#34d399",     bg:"rgba(52,211,153,.1)", label:"Resolved"},
};

export default function AdminEscalations(){
  const [incoming,setIncoming]=useState([]);
  const [outgoing,setOutgoing]=useState([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("incoming");
  const [resolveModal,setResolveModal]=useState(null);
  const [note,setNote]=useState("");
  const [saving,setSaving]=useState(false);

  // New escalation flow
  const [showCreate,setShowCreate]=useState(false);
  const [neighbors,setNeighbors]=useState([]);
  const [createForm,setCreateForm]=useState({report_id:"",to_area_id:"",reason:""});
  const [creating,setCreating]=useState(false);

  const load=()=>{
    setLoading(true);
    Promise.all([
      adminApi.getEscalations(),
      adminApi.getNeighboringAreas(),
    ]).then(([esc, nb])=>{
      setIncoming(esc.incoming||[]);
      setOutgoing(esc.outgoing||[]);
      setNeighbors(nb.data||[]);
    }).catch(console.error).finally(()=>setLoading(false));
  };
  useEffect(()=>{load();},[]);

  const createEscalation=async()=>{
    if(!createForm.report_id.trim()||!createForm.to_area_id||!createForm.reason.trim()){
      return alert("Report ID, destination zone, and reason are all required.");
    }
    setCreating(true);
    try{
      await adminApi.createEscalation(createForm);
      alert("Escalation sent!");
      setShowCreate(false);
      setCreateForm({report_id:"",to_area_id:"",reason:""});
      load();
    }catch(e){alert(e.message);}
    finally{setCreating(false);}
  };

  const respond=async(id,status)=>{
    if(status==="resolved"&&!note.trim()) return alert("Please provide a resolution note.");
    setSaving(true);
    try{
      await adminApi.updateEscalation(id,{status,resolution_note:note});
      setIncoming(p=>p.map(e=>e.id===id?{...e,status,resolution_note:note}:e));
      setResolveModal(null);setNote("");
    }catch(e){alert(e.message);}finally{setSaving(false);}
  };

  const items=tab==="incoming"?incoming:outgoing;

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <h1 className="adm-page-title" style={{margin:0}}>Escalations</h1>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowCreate(true)}
            style={{padding:"6px 14px",background:"rgba(255,90,31,.12)",border:"1px solid rgba(255,90,31,.3)",borderRadius:8,fontSize:12,color:"var(--orange)",fontWeight:700,cursor:"pointer"}}>
            📤 New Escalation
          </button>
          <button onClick={load} style={{padding:"6px 14px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:8,fontSize:12,color:"var(--text2)"}}>↻ Refresh</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[
          {k:"incoming",label:`Incoming (${incoming.length})`,icon:"📥"},
          {k:"outgoing",label:`Outgoing (${outgoing.length})`,icon:"📤"},
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{padding:"8px 18px",background:tab===t.k?"var(--orange-dim)":"var(--bg3)",
              border:`1px solid ${tab===t.k?"rgba(255,90,31,.4)":"var(--border)"}`,
              borderRadius:10,fontSize:13,color:tab===t.k?"var(--orange)":"var(--text2)",fontWeight:700}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading
        ? <div style={{display:"flex",justifyContent:"center",padding:60}}><div className="spinner"/></div>
        : items.length===0
          ? <div style={{textAlign:"center",padding:60,color:"var(--text3)"}}>
              {tab==="incoming"?"No escalations received.":"No escalations sent."}
            </div>
          : <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {items.map(e=>{
              const ss=STATUS_STYLES[e.status]||STATUS_STYLES.pending;
              const cat=getCat(e.category);
              const fromZone=e.from_area_name||"Unknown Zone";
              const toZone=e.to_area_name||"Super Admin";
              return(
                <div key={e.id} className="adm-card" style={{margin:0,borderLeft:`3px solid ${ss.color}`}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                        <span style={{fontSize:12,color:cat.color,fontWeight:700}}>{cat.icon} {cat.label}</span>
                        <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:ss.bg,color:ss.color,fontWeight:700}}>{ss.label}</span>
                        <span style={{fontSize:11,color:"var(--text3)",marginLeft:"auto"}}>{timeAgo(e.created_at)}</span>
                      </div>
                      <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{e.title||"Unknown Report"}</div>
                      <div style={{fontSize:13,color:"var(--text3)",marginBottom:8}}>
                        {tab==="incoming"
                          ? <>📍 From: <strong style={{color:"var(--text2)"}}>{fromZone}</strong></>
                          : <>📍 To: <strong style={{color:"var(--text2)"}}>{toZone}</strong></>
                        }
                      </div>
                      <div style={{fontSize:13,color:"var(--text2)",padding:"8px 12px",background:"var(--bg3)",borderRadius:8,marginBottom:8}}>
                        <strong>Reason:</strong> {e.reason}
                      </div>
                      {e.resolution_note&&(
                        <div style={{fontSize:12,color:"var(--teal)",padding:"6px 10px",background:"rgba(0,201,167,.08)",borderRadius:6}}>
                          <strong>Resolution:</strong> {e.resolution_note}
                        </div>
                      )}
                    </div>
                    {tab==="incoming"&&e.status==="pending"&&(
                      <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                        <button onClick={()=>respond(e.id,"accepted")}
                          style={{padding:"6px 14px",background:"rgba(0,201,167,.15)",border:"1px solid rgba(0,201,167,.3)",borderRadius:8,fontSize:12,color:"var(--teal)",fontWeight:700}}>
                          Accept
                        </button>
                        <button onClick={()=>setResolveModal(e)}
                          style={{padding:"6px 14px",background:"rgba(52,211,153,.12)",border:"1px solid rgba(52,211,153,.25)",borderRadius:8,fontSize:12,color:"#34d399",fontWeight:700}}>
                          Resolve
                        </button>
                        <button onClick={()=>respond(e.id,"rejected")}
                          style={{padding:"6px 14px",background:"var(--red-dim)",border:"1px solid rgba(239,68,68,.2)",borderRadius:8,fontSize:12,color:"var(--red)",fontWeight:700}}>
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

      {/* Resolve Modal */}
      {resolveModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:20,padding:24,width:"100%",maxWidth:400}}>
            <h3 style={{fontSize:16,fontWeight:800,marginBottom:4}}>Resolve Escalation</h3>
            <p style={{fontSize:13,color:"var(--text3)",marginBottom:16}}>{resolveModal.reports?.title}</p>
            <div className="adm-card-title" style={{marginBottom:6}}>Resolution Note *</div>
            <textarea className="adm-input" rows={3} placeholder="Describe how this was resolved…"
              value={note} onChange={e=>setNote(e.target.value)} style={{resize:"vertical"}}/>
            <div style={{display:"flex",gap:10,marginTop:16}}>
              <button className="adm-save-btn" onClick={()=>respond(resolveModal.id,"resolved")} disabled={saving}>
                {saving?"Saving…":"✅ Mark Resolved"}
              </button>
              <button onClick={()=>{setResolveModal(null);setNote("");}}
                style={{padding:"10px 18px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:12,fontSize:13,color:"var(--text2)"}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Create Escalation Modal */}
      {showCreate&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:20,padding:24,width:"100%",maxWidth:440}}>
            <h3 style={{fontSize:16,fontWeight:800,marginBottom:4}}>Escalate to Neighboring Zone</h3>
            <p style={{fontSize:13,color:"var(--text3)",marginBottom:16}}>Send a report to an adjacent municipal official for resolution.</p>
            
            <div className="adm-card-title" style={{marginBottom:6}}>Report ID *</div>
            <input className="adm-input" placeholder="Paste the Report UUID here…"
              value={createForm.report_id}
              onChange={e=>setCreateForm(p=>({...p,report_id:e.target.value.trim()}))}
              style={{marginBottom:12}}/>

            <div className="adm-card-title" style={{marginBottom:6}}>Send To (Zone) *</div>
            <select className="adm-input" value={createForm.to_area_id}
              onChange={e=>setCreateForm(p=>({...p,to_area_id:e.target.value}))}
              style={{marginBottom:12}}>
              <option value="">— Select neighboring zone —</option>
              {neighbors.map(n=>(
                <option key={n.id} value={n.id}>{n.area_name}</option>
              ))}
              <option value="super">⬆️ Super Admin (God Mode)</option>
            </select>

            <div className="adm-card-title" style={{marginBottom:6}}>Reason *</div>
            <textarea className="adm-input" rows={3}
              placeholder="Explain why this is being escalated…"
              value={createForm.reason}
              onChange={e=>setCreateForm(p=>({...p,reason:e.target.value}))}
              style={{resize:"vertical",marginBottom:16}}/>

            <div style={{display:"flex",gap:10}}>
              <button className="adm-save-btn" onClick={createEscalation} disabled={creating} style={{flex:1,justifyContent:"center"}}>
                {creating?"Sending…":"📤 Send Escalation"}
              </button>
              <button onClick={()=>{setShowCreate(false);setCreateForm({report_id:"",to_area_id:"",reason:""});}}
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
