import React,{useState,useEffect} from "react";
import {adminApi} from "../../services/api.js";
import "./AdminDashboard.css";

export default function AdminSettings(){
  const [form,setForm]=useState({
    pin_threshold:5, area_name:"", sla_hours:72, auto_escalate:false, notify_email:"", 
    area_id:null, is_confirmed:false, area_code:null,
    threshold_config: { garbage: 24, pothole: 48, water: 12, electricity: 12, sewage: 24, vandalism: 48, other: 72 }
  });
  const [availableAreas, setAvailableAreas] = useState([]);
  const [requesting, setRequesting] = useState(false);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    adminApi.getSettings().then(r=>{
      const d=r.data||{};
      setForm({
        pin_threshold: d.pin_threshold??5,
        area_name:     d.area_name||d.area_official_name||"",
        sla_hours:     d.sla_hours||72,
        auto_escalate: d.auto_escalate||false,
        notify_email:  d.notify_email||"",
        area_id:       d.area_id||null,
        is_confirmed:  d.is_confirmed||false,
        area_code:     d.area_code||null,
        threshold_config: d.threshold_config || { garbage: 24, pothole: 48, water: 12, electricity: 12, sewage: 24, vandalism: 48, other: 72 }
      });
      if(!d.area_id) loadAvailableAreas();
    }).catch(console.error).finally(()=>setLoading(false));
  },[]);

  const updateThreshold = (cat, val) => {
    setForm(p => ({ ...p, threshold_config: { ...p.threshold_config, [cat]: parseInt(val) } }));
  };

  const loadAvailableAreas = async () => {
    try {
      const res = await adminApi.getAvailableAreas();
      setAvailableAreas(res.data || []);
    } catch (e) { console.error(e); }
  };

  const requestArea = async (areaId) => {
    setRequesting(true);
    try {
      await adminApi.requestArea({ area_id: areaId });
      window.location.reload(); 
    } catch (e) { alert(e.message); }
    finally { setRequesting(false); }
  };

  const set=k=>v=>setForm(p=>({...p,[k]:v}));

  const save=async()=>{
    setSaving(true);setSaved(false);
    try{
      await adminApi.saveSettings(form);
      setSaved(true);setTimeout(()=>setSaved(false),3000);
    }catch(e){alert(e.message);}finally{setSaving(false);}
  };

  if(loading) return <div style={{display:"flex",justifyContent:"center",padding:60}}><div className="spinner"/></div>;

  return(
    <div>
      <h1 className="adm-page-title">Settings</h1>

      {/* Confirmation Status Banner */}
      {form.area_id ? (
        <div className={`adm-status-banner ${form.is_confirmed ? "confirmed" : "pending"}`}>
          <div className="adm-status-icon">{form.is_confirmed ? "🛡️" : "⏳"}</div>
          <div className="adm-status-text">
            <strong>{form.is_confirmed ? "Confirmed Official" : "Pending Confirmation"}</strong>
            <p>{form.area_name} ({form.area_code})</p>
          </div>
        </div>
      ) : (
        <div className="adm-card area-picker-card">
          <div className="adm-card-title">Select Your Municipal Area</div>
          <p className="adm-hint">You are not yet assigned to a jurisdiction. Select an available area to request management access.</p>
          <div className="area-list">
            {availableAreas.length === 0 ? <p className="adm-hint">No available areas found. Contact Super Admin.</p> : 
              availableAreas.map(a => (
                <div key={a.id} className="area-item">
                  <div className="area-item-info"><strong>{a.name}</strong> <span>{a.code}</span></div>
                  <button className="btn-request" onClick={() => requestArea(a.id)} disabled={requesting}>
                    {requesting ? "..." : "Request"}
                  </button>
                </div>
              ))
            }
          </div>
        </div>
      )}

      <div className="adm-card">
        <div className="adm-card-title">Area Name</div>
        <input className="adm-input" value={form.area_name} onChange={e=>set("area_name")(e.target.value)}
          placeholder="e.g. Nashik Zone A, Mumbai Ward 7"/>
        <p className="adm-hint">Display name for your managed municipal area</p>
      </div>

      <div className="adm-card">
        <div className="adm-card-title">Category-Specific SLA (Hours)</div>
        <p className="adm-hint" style={{marginBottom:16}}>Define resolution time per category before automatic escalation.</p>
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:12}}>
          {Object.entries(form.threshold_config).map(([cat, hours]) => (
            <div key={cat} style={{padding:12, background:"var(--bg3)", borderRadius:12, border:"1px solid var(--border)"}}>
              <div style={{fontSize:10, fontWeight:900, textTransform:"uppercase", color:"var(--text3)", marginBottom:6, letterSpacing:0.5}}>{cat}</div>
              <div style={{display:"flex", alignItems:"center", gap:10}}>
                <div style={{fontSize:16, fontWeight:800, color:"var(--teal)", minWidth:28}}>{hours}</div>
                <input type="range" min="4" max="168" step="4" value={hours} 
                  onChange={e => updateThreshold(cat, e.target.value)} className="adm-slider" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-title">Map Pin Threshold</div>
        <div className="adm-threshold-wrap">
          <div className="adm-threshold-display" style={{color:"var(--orange)"}}>{form.pin_threshold}</div>
          <input type="range" min="1" max="20" value={form.pin_threshold}
            onChange={e=>set("pin_threshold")(parseInt(e.target.value))} className="adm-slider"/>
        </div>
        <p className="adm-hint">A report needs <strong>{form.pin_threshold} unique upvote{form.pin_threshold!==1?"s":""}</strong> to appear on the public map.</p>
      </div>

      <div className="adm-card">
        <div className="adm-card-title">SLA Hours</div>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:10}}>
          <div style={{fontSize:42,fontWeight:900,color:"var(--teal)",minWidth:60,textAlign:"center"}}>{form.sla_hours}</div>
          <input type="range" min="12" max="168" step="12" value={form.sla_hours}
            onChange={e=>set("sla_hours")(parseInt(e.target.value))} className="adm-slider" style={{flex:1}}/>
        </div>
        <p className="adm-hint">Reports must be resolved within <strong>{form.sla_hours} hours</strong> ({Math.round(form.sla_hours/24)} day{Math.round(form.sla_hours/24)!==1?"s":""}). Overdue reports will be flagged.</p>
      </div>

      <div className="adm-card">
        <div className="adm-card-title">Notifications</div>
        <input className="adm-input" type="email" value={form.notify_email}
          onChange={e=>set("notify_email")(e.target.value)}
          placeholder="admin@municipality.gov.in"/>
        <p className="adm-hint">Email address for escalation and SLA breach alerts</p>
      </div>

      <div className="adm-card">
        <div className="adm-card-title">Auto-Escalate</div>
        <label style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}>
          <div
            onClick={()=>set("auto_escalate")(!form.auto_escalate)}
            style={{
              width:44,height:24,borderRadius:12,transition:"background .3s",
              background:form.auto_escalate?"var(--orange)":"var(--bg4)",
              position:"relative",cursor:"pointer",border:"1px solid var(--border)",flexShrink:0,
            }}>
            <div style={{
              position:"absolute",top:3,left:form.auto_escalate?22:3,
              width:16,height:16,borderRadius:"50%",background:"#fff",
              transition:"left .3s",boxShadow:"0 1px 4px rgba(0,0,0,.4)"
            }}/>
          </div>
          <span style={{fontSize:13,color:"var(--text2)"}}>
            Automatically escalate reports that exceed SLA without resolution
          </span>
        </label>
      </div>

      <button className="adm-save-btn" onClick={save} disabled={saving}>
        {saving?<><span className="spinner" style={{width:16,height:16,borderWidth:2}}/> Saving…</>:saved?"✅ Saved!":"Save Settings"}
      </button>
    </div>
  );
}
