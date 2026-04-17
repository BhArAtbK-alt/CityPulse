import React,{useState,useEffect} from "react";
import {superAdminApi} from "../../services/api.js";
import {getCat,getStatus,timeAgo} from "../../utils/constants.js";
import Avatar from "../../components/Avatar.jsx";
import "./SuperAdmin.css";

export default function SAGlobalInbox(){
  const [reports,setReports]=useState([]);
  const [areas,setAreas]=useState([]);
  const [loading,setLoading]=useState(true);
  const [reassignTarget,setReassignTarget]=useState(null);
  const [moving,setMoving]=useState(false);

  const load=()=>{
    setLoading(true);
    Promise.all([
      superAdminApi.getOrphanedZones(),
      superAdminApi.getAreas()
    ]).then(([inbox, areaList])=>{
      setReports(inbox.data||[]);
      setAreas((areaList.data||[]).filter(a => a.status === 'active'));
    }).catch(console.error).finally(()=>setLoading(false));
  };
  useEffect(()=>{load();},[]);

  const doReassign=async(areaId)=>{
    if(!areaId) return;
    setMoving(true);
    try {
      await superAdminApi.forceAssign(reassignTarget.id, areaId);
      alert(`Report moved to area successfully.`);
      setReports(p=>p.filter(r=>r.id!==reassignTarget.id));
      setReassignTarget(null);
    } catch(e) { alert(e.message); }
    finally { setMoving(false); }
  };

  return(
    <div className="sa-inbox">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h1 className="sa-page-title" style={{margin:0}}>Global Inbox</h1>
        <button onClick={load} className="sa-btn-refresh">↻ Refresh</button>
      </div>

      {loading ? <div style={{display:"flex",justifyContent:"center",padding:60}}><div className="spinner"/></div> :
        reports.length === 0 ? <div className="sa-empty-state">🎉 All reports are assigned to active jurisdictions.</div> :
        <div className="sa-feed">
          {reports.map(r=>{
            const cat=getCat(r.category);
            const status=getStatus(r.status);
            return(
              <div key={r.id} className="sa-post-card">
                <div className="sa-post-head">
                  <Avatar user={{username:r.username, avatar_color:r.avatar_color}} size={32}/>
                  <div className="sa-post-info">
                    <strong>@{r.username || "citizen"}</strong>
                    <span>{timeAgo(r.created_at)} · <span style={{color:cat.color}}>{cat.label}</span></span>
                  </div>
                  <div className={`sa-status-pill status-${r.status}`}>{status.label}</div>
                </div>

                <div className="sa-post-body">
                  <h3 className="sa-post-title">{r.title}</h3>
                  <p className="sa-post-desc">{r.description}</p>
                  {r.image_url && <img src={r.image_url} className="sa-post-img" alt=""/>}
                  <div className="sa-post-loc">📍 {r.address || "Unknown Location"}</div>
                </div>

                <div className="sa-post-footer">
                  <div className="sa-orphan-reason">
                    ⚠️ {r.area_id ? `In inactive zone: ${r.current_area_name}` : "Outside all boundaries"}
                  </div>
                  <button className="sa-btn-assign" onClick={()=>setReassignTarget(r)}>Assign Area</button>
                </div>
              </div>
            );
          })}
        </div>
      }

      {/* Reassign Modal */}
      {reassignTarget&&(
        <div className="sa-modal-overlay">
          <div className="sa-modal">
            <h3>Assign Report to Area</h3>
            <p style={{fontSize:13, color:"var(--text3)", marginBottom:16}}>Transfer this report to a verified municipal official.</p>
            <div className="sa-area-grid">
              {areas.map(a=>(
                <button key={a.id} className="sa-area-choice" onClick={()=>doReassign(a.id)} disabled={moving}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:a.color}}/>
                  <strong>{a.name}</strong>
                  <span>{a.code}</span>
                </button>
              ))}
            </div>
            <button className="sa-btn-ghost" onClick={()=>setReassignTarget(null)} style={{marginTop:16, width:"100%"}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
