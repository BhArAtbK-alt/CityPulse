import React,{useState,useEffect} from "react";
import {adminApi} from "../../services/api.js";
import GeofenceMap from "../../components/GeofenceMap.jsx";
import "./AdminDashboard.css";
import "./AdminGeofence.css";

export default function AdminGeofence(){
  const [settings,setSettings]=useState(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState("");
  const [pendingGeo,setPendingGeo]=useState(undefined);
  const [areaName,setAreaName]=useState("");
  const [areaCode,setAreaCode]=useState("");
  const [neighborZones,setNeighborZones]=useState([]);

  useEffect(()=>{
    Promise.all([
      adminApi.getSettings(),
      adminApi.getNeighboringAreas(),
    ]).then(([s,n])=>{
      setSettings(s.data);
      setAreaName(s.data?.area_name||"");
      setNeighborZones(n.data||[]);
    }).catch(console.error).finally(()=>setLoading(false));
  },[]);

  const saveGeofence=async()=>{
    setSaving(true);setSaved(false);setError("");
    try{
      const geoToSave=pendingGeo===undefined?settings?.geofence:pendingGeo;
      if (!geoToSave) throw new Error("Please draw a boundary on the map.");

      if (settings?.status === "none") {
        if (!areaCode) throw new Error("Please provide a Ward Code (e.g. MH-01).");
        await adminApi.requestArea({
          name: areaName,
          code: areaCode,
          geofence: geoToSave
        });
        setSettings(p=>({...p, status: "pending", area_name: areaName, geofence: geoToSave}));
        setSaved("✅ Area request submitted! Awaiting Super Admin confirmation.");
      } else {
        const res=await adminApi.saveSettings({
          geofence:geoToSave,area_name:areaName,
          pin_threshold:settings?.pin_threshold??5,
          sla_hours:settings?.sla_hours??72,
        });
        setSettings(p=>({...p,geofence:geoToSave,area_name:areaName, status: res.status}));
        if(res.status === "pending"){
          setSaved("✅ Boundary submitted! Awaiting Super Admin confirmation.");
        } else {
          setSaved("✅ Boundary updated!");
        }
      }
      setTimeout(()=>setSaved(""),6000);
    }catch(e){
      setError(e.message);
    }finally{setSaving(false);}
  };

  const clearGeofence=async()=>{
    if(!confirm("Clear the geofence? Reports will no longer be filtered by zone."))return;
    setPendingGeo(null);setSaving(true);setError("");
    try{
      await adminApi.saveSettings({geofence:null,area_name:areaName,pin_threshold:settings?.pin_threshold??5});
      setSettings(p=>({...p,geofence:null}));
      setSaved("✅ Zone cleared.");
      setTimeout(()=>setSaved(""),3000);
    }catch(e){setError(e.message);}finally{setSaving(false);}
  };

  const currentGeo=pendingGeo!==undefined?pendingGeo:settings?.geofence;

  return(
    <div>
      <h1 className="adm-page-title">Zone Boundaries</h1>

      <div className="adm-card">
        <div className="adm-card-title">Zone Identification</div>
        <div style={{display:"grid", gridTemplateColumns: settings?.status === 'none' ? "1fr 1fr" : "1fr", gap:12}}>
          <div>
            <label style={{fontSize:11, color:"var(--text3)", display:"block", marginBottom:4}}>Ward Name</label>
            <input className="adm-input" value={areaName} onChange={e=>setAreaName(e.target.value)}
              placeholder="e.g. Nashik Municipal Zone A"/>
          </div>
          {settings?.status === 'none' && (
            <div>
              <label style={{fontSize:11, color:"var(--text3)", display:"block", marginBottom:4}}>Ward Code</label>
              <input className="adm-input" value={areaCode} onChange={e=>setAreaCode(e.target.value.toUpperCase())}
                placeholder="e.g. NSK-A"/>
            </div>
          )}
        </div>
        <p className="adm-hint">This name identifies your zone across the system and on the Super Admin map.</p>
      </div>

      <div className="adm-card adm-map-card">
        <div className="adm-card-title">Draw Your Boundary</div>

        {/* Status Indicator */}
        {settings?.status === "pending" && (
          <div style={{background:"rgba(251,191,36,.1)", padding:"10px 14px", borderRadius:12, border:"1px solid rgba(251,191,36,.2)", marginBottom:14, display:"flex", alignItems:"center", gap:10}}>
            <span style={{fontSize:20}}>⏳</span>
            <div style={{fontSize:13, color:"#fbbf24"}}>
              <strong>Pending Confirmation</strong>
              <p style={{margin:0, fontSize:11, opacity:.8}}>Draw your boundary below and save. Super Admin must verify this area before reports appear.</p>
            </div>
          </div>
        )}

        <p className="adm-hint" style={{marginBottom:12}}>
          Draw a polygon around your jurisdiction. <strong style={{color:"var(--text2)"}}>Gray dashed zones</strong> are neighboring municipal areas — your boundary must not overlap them.
        </p>
        {loading
          ? <div style={{height:420,display:"flex",alignItems:"center",justifyContent:"center"}}><div className="spinner"/></div>
          : <GeofenceMap
              initialGeofence={settings?.geofence}
              onSave={setPendingGeo}
              neighborZones={neighborZones}
              height="420px"
            />
        }

        <div className="adm-geo-status">
          {currentGeo
            ? <div className="adm-geo-active">
                <span>✅</span>
                <div>
                  <strong>Zone active</strong>
                  <p>Reports within this boundary are visible in your Requests tab and Zone Map.</p>
                </div>
              </div>
            : <div className="adm-geo-empty">
                <span>⚪</span>
                <div><strong>No zone set</strong><p>All reports are visible in your requests view.</p></div>
              </div>
          }
        </div>
      </div>

      {error&&(
        <div style={{padding:"12px 16px",background:"var(--red-dim)",border:"1px solid rgba(239,68,68,.25)",borderRadius:12,fontSize:13,color:"var(--red)",marginBottom:12}}>
          ⚠️ {error}
        </div>
      )}

      {saved&&(
        <div style={{padding:"12px 16px",background:"rgba(0,201,167,.1)",border:"1px solid rgba(0,201,167,.25)",borderRadius:12,fontSize:13,color:"var(--teal)",marginBottom:12}}>
          {saved}
        </div>
      )}

      <div className="adm-geo-btns">
        <button className="adm-save-btn" onClick={saveGeofence} disabled={saving}>
          {saving?<><span className="spinner" style={{width:16,height:16,borderWidth:2}}/> Saving…</>:"Save Zone"}
        </button>
        {currentGeo&&(
          <button className="adm-clear-btn" onClick={clearGeofence} disabled={saving}>Clear Zone</button>
        )}
      </div>

      <div className="adm-card" style={{marginTop:16}}>
        <div className="adm-card-title">Boundary Integrity Rules</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[
            {icon:"🚫",text:"Your zone must not overlap neighboring municipal zones — the server enforces this automatically."},
            {icon:"🗺️",text:"Gray dashed outlines on the map show current neighboring zones for your reference."},
            {icon:"🔁",text:"Existing reports within your drawn boundary will be automatically assigned to your zone when you save."},
            {icon:"⚡",text:"Zone changes are reflected in the Super Admin system map immediately."},
          ].map((item,i)=>(
            <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <span style={{fontSize:16,flexShrink:0}}>{item.icon}</span>
              <span style={{fontSize:13,color:"var(--text2)",lineHeight:1.5}}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
