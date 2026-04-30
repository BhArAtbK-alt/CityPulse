import React,{useState,useRef,useCallback,useEffect} from "react";
import {reportsApi} from "../services/api.js";
import {CATEGORIES}  from "../utils/constants.js";
import "./CreateModal.css";

export default function CreateModal({onClose}){
  const [step,setStep]=useState(1);
  const [form,setForm]=useState({title:"",description:"",category:"pothole"});
  const [image,setImage]=useState(null);
  const [preview,setPreview]=useState(null);
  const [loc,setLoc]=useState(null);
  const [locBusy,setLocBusy]=useState(false);
  const [locErr,setLocErr]=useState("");
  const [errors,setErrors]=useState({});
  const [subErr,setSubErr]=useState("");
  const camRef=useRef();

  // AI State
  const [aiEnabled, setAiEnabled] = useState(null); // null = unknown, true/false after probe
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [tempPath, setTempPath] = useState("");
  const [reviewStatus, setReviewStatus] = useState("idle");
  const [reviewFeedback, setReviewFeedback] = useState("");

  // Probe AI availability on mount (503 = disabled, 401 = need auth but AI is there)
  useEffect(() => {
    // We detect AI by checking if analyzeAI returns 503. 
    // Since we can't call it without a file, we assume AI is available and handle 503 at runtime.
    setAiEnabled(true); // Optimistic — will fallback to manual if 503 on first use
  }, []);

  const getGPS=useCallback(()=>{
    return new Promise((resolve)=>{
      if(!navigator.geolocation){resolve(null);return;}
      navigator.geolocation.getCurrentPosition(
        async pos=>{
          const {latitude:lat,longitude:lng}=pos.coords;
          let address=`${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          try{
            const d=await(await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)).json();
            if(d.display_name)address=d.display_name;
          }catch{}
          resolve({lat,lng,address});
        },
        ()=>resolve(null),
        {enableHighAccuracy:true,timeout:10000}
      );
    });
  },[]);

  const runAIClassification = async (file) => {
    setAiAnalyzing(true);
    setAiMessage("🤖 AI is analyzing image for civic issues...");
    setReviewStatus("idle");
    setReviewFeedback("");
    
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await reportsApi.analyzeAI(fd);

      if (!res.is_valid) {
        setAiMessage(`❌ AI Rejection: ${res.rejection_reason}`);
        setAiAnalyzing(false);
        return false;
      }

      setForm(p => ({
        ...p,
        category: res.category || "other",
        title: res.title || "Civic Issue",
      }));
      setTempPath(res.temp_path);

      setAiMessage(`✅ AI detected ${res.category}! Title locked.`);
      setAiAnalyzing(false);
      return true;
    } catch (err) {
      // If 503 — AI not configured, fall back to manual mode
      if (err.message?.includes("AI features are not configured") || err.message?.includes("503")) {
        setAiEnabled(false);
        setAiMessage("");
        setAiAnalyzing(false);
        return "manual"; // Signal to use manual flow
      }
      console.error("AI Analysis Error:", err);
      setAiMessage("⚠️ AI Service unavailable. Please try again.");
      setAiAnalyzing(false);
      return false;
    }
  };

  const handleCapture=async e=>{
    const file=e.target.files[0];
    if(!file)return;
    if(file.size>10*1024*1024){setErrors(p=>({...p,img:"Max 10MB"}));return;}
    
    setImage(file);
    const r=new FileReader();r.onload=e=>setPreview(e.target.result);r.readAsDataURL(file);

    if (aiEnabled) {
      const result = await runAIClassification(file);
      if (result === false) {
        setImage(null);
        setPreview(null);
        return;
      }
      // If result === "manual", AI is disabled — continue with manual flow
    }

    setErrors(p=>({...p,img:""}));
    setLocBusy(true);setLocErr("");
    const gps=await getGPS();
    if(gps)setLoc(gps);
    else setLocErr("Could not get location automatically.");
    setLocBusy(false);
  };

  const runReviewMatch = async () => {
    if (!form.description.trim() || form.description.length < 15) {
      setErrors(p => ({ ...p, desc: "At least 15 characters" }));
      return;
    }
    setReviewStatus("reviewing");
    try {
      const res = await reportsApi.validateMatch({ temp_path: tempPath, description: form.description });
      if (res.is_match) {
        setReviewStatus("ok");
        setStep(2);
      } else {
        setReviewStatus("fail");
        setReviewFeedback(res.feedback || "The description does not match the photo.");
      }
    } catch (e) {
      // If 503, just proceed (AI not available)
      if (e.message?.includes("AI features are not configured")) {
        setReviewStatus("ok");
        setStep(2);
        return;
      }
      setReviewStatus("fail");
      setReviewFeedback("Review failed. Please check your internet.");
    }
  };

  const validate=()=>{
    const e={};
    if(!form.title.trim()||form.title.length<5)e.title="At least 5 characters";
    if(!form.description.trim()||form.description.length<15)e.desc="At least 15 characters";
    if(!image) e.img = "Photo required";
    setErrors(e);return!Object.keys(e).length;
  };

  const retryLoc=useCallback(async()=>{
    setLocBusy(true);setLocErr("");
    const gps=await getGPS();
    if(gps)setLoc(gps);
    else setLocErr("Could not get location.");
    setLocBusy(false);
  },[getGPS]);

  const submit=async()=>{
    setStep(3);setSubErr("");
    try{
      const fd=new FormData();
      fd.append("title",form.title);
      fd.append("description",form.description);
      fd.append("category",form.category);
      if(loc){fd.append("latitude",loc.lat);fd.append("longitude",loc.lng);fd.append("address",loc.address);}
      if(image)fd.append("image",image);
      await reportsApi.create(fd);
      setStep(4);setTimeout(onClose,2200);
    }catch(e){setSubErr(e.message);setStep(2);}
  };

  // Determine if we're in AI mode (AI available AND has processed an image)
  const isAIMode = aiEnabled && tempPath;

  return(
    <div className="cm-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="cm-sheet fade-up">
        <div className="cm-hdr">
          <h2>{step===4?"Posted!":"Report an Issue"}</h2>
          <div className="cm-steps">{[1,2].map(n=><span key={n} className={`cm-step ${step>=n?"on":""}`}/>)}</div>
          <button className="cm-x" onClick={onClose}>✕</button>
        </div>

        {step===1&&(
          <div className="cm-body">
            <div className="cf-grp">
              <label className="cf-lbl">
                Category {isAIMode && <span className="locked-tag">(AI Locked)</span>}
              </label>
              <div className={`cat-grid ${isAIMode ? "disabled" : ""}`}>
                {CATEGORIES.map(c=>(
                  <button key={c.value} type="button" className={`cat-chip ${form.category===c.value?"sel":""}`} style={{"--cc":c.color}} 
                    onClick={()=>!isAIMode && setForm(p=>({...p,category:c.value}))} disabled={isAIMode}>
                    <span className="cc-ico">{c.icon}</span><span className="cc-lbl">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="cf-grp">
              <label className="cf-lbl">
                Title {isAIMode ? <span className="locked-tag">(AI Generated)</span> : <span className="req">*</span>}
              </label>
              <input className={`cf-in ${isAIMode?"locked":""} ${errors.title?"err":""}`} 
                value={form.title} 
                onChange={e=>{if(!isAIMode){setForm(p=>({...p,title:e.target.value}));setErrors(p=>({...p,title:""}));}}} 
                readOnly={isAIMode}
                placeholder={isAIMode ? "Title will appear after AI analysis" : "Short title of the issue"} 
                maxLength={100}/>
              {errors.title&&<span className="cf-err">{errors.title}</span>}
            </div>
            <div className="cf-grp">
              <label className="cf-lbl">Description <span className="req">*</span></label>
              <textarea className={`cf-ta ${errors.desc?"err":""}`} value={form.description} onChange={e=>{setForm(p=>({...p,description:e.target.value}));setErrors(p=>({...p,desc:""}));setReviewStatus("idle");}} placeholder="Describe the issue in detail…" rows={4} maxLength={1000}/>
              <div className="cf-cnt">{form.description.length}/1000</div>
              {errors.desc&&<span className="cf-err">{errors.desc}</span>}
              {reviewStatus==="fail" && <span className="cf-err review-fail">⚠️ AI Feedback: {reviewFeedback}</span>}
            </div>

            {/* AI Status Message */}
            {aiMessage && (
              <div className={`ai-badge ${aiMessage.includes("❌") ? "ai-error" : "ai-success"}`}>
                {aiAnalyzing ? <div className="spinner sm"/> : "🤖"} {aiMessage}
              </div>
            )}

            <div className="cf-grp">
              <label className="cf-lbl">Photo <span className="req">*</span></label>
              {preview?(
                <div className="cf-prev-wrap">
                  <img src={preview} className="cf-prev" alt="preview"/>
                  <button className="cf-remove" onClick={async ()=>{
                    if(tempPath) await reportsApi.deleteTemp(tempPath).catch(()=>{});
                    setImage(null);setPreview(null);setLoc(null);setAiMessage("");setReviewStatus("idle");setTempPath("");
                  }}>✕ Retake</button>
                  {locBusy&&<div className="cf-loc-overlay"><div className="spinner" style={{width:20,height:20,borderWidth:2}}/><span>Getting location…</span></div>}
                  {loc&&<div className="cf-loc-badge">📍 Location captured</div>}
                </div>
              ):(
                <button className="cf-cam-big" onClick={()=>camRef.current?.click()} disabled={aiAnalyzing}>
                  {aiAnalyzing ? (
                    <div className="spinner"/>
                  ) : (
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  )}
                  <span>{aiAnalyzing ? "AI Processing..." : "Take Photo"}</span>
                  {aiEnabled && <p>📍 AI will lock category & title from photo</p>}
                </button>
              )}
              <input ref={camRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleCapture}/>
              {errors.img&&<span className="cf-err">{errors.img}</span>}
              {locErr&&<div className="loc-warn">⚠️ {locErr} <button onClick={retryLoc}>Retry GPS</button></div>}
            </div>

            <div className="cm-footer">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              {isAIMode ? (
                <button className="btn-primary" onClick={runReviewMatch} disabled={!image||locBusy||aiAnalyzing||reviewStatus==="reviewing"}>
                  {reviewStatus==="reviewing"?"AI Reviewing...":"Review Report →"}
                </button>
              ) : (
                <button className="btn-primary" onClick={()=>validate()&&setStep(2)}>Review Report →</button>
              )}
            </div>
          </div>
        )}

        {step===2&&(
          <div className="cm-body">
            <div className="review-box">
              <h3 className="review-h">Review Your Report</h3>
              {preview&&<img src={preview} className="review-img" alt="preview"/>}
              <div className="review-fields">
                <div className="review-row"><span>Category</span><strong>{CATEGORIES.find(c=>c.value===form.category)?.label}</strong></div>
                <div className="review-row"><span>Title</span><strong>{form.title}</strong></div>
                <div className="review-row"><span>Description</span><strong>{form.description}</strong></div>
                {loc&&<div className="review-row"><span>Location</span><strong className="review-addr">{loc.address?.split(",").slice(0,3).join(",")}</strong></div>}
                {!loc&&<div className="review-row review-no-loc"><span>⚠️</span><strong>No location — report will not appear on map</strong></div>}
              </div>
            </div>
            {subErr&&<div className="loc-err"><span>❌ {subErr}</span></div>}
            <div className="cm-footer">
              <button className="btn-ghost" onClick={()=>setStep(1)}>← Edit</button>
              <button className="btn-primary" onClick={submit}>🚨 Submit Report</button>
            </div>
          </div>
        )}

        {step===3&&(<div className="cm-body cm-center"><div className="spinner"/><h3>Submitting…</h3><p>Uploading your report</p></div>)}
        {step===4&&(<div className="cm-body cm-center"><div style={{fontSize:56}}>✅</div><h3>Report Submitted!</h3><p>Get community upvotes to pin it on the map.</p></div>)}
      </div>
    </div>
  );
}
