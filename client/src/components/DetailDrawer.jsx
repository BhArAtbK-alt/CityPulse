import React,{useState,useEffect} from "react";
import {reportsApi, superAdminApi} from "../services/api.js";
import {useAuth}    from "../context/AuthContext.jsx";
import {getCat,getStatus,timeAgo} from "../utils/constants.js";
import Avatar from "./Avatar.jsx";
import StatusTimeline from "./StatusTimeline.jsx";
import "./DetailDrawer.css";

export default function DetailDrawer({reportId,onClose,threshold=5}){
  const [report,setReport]=useState(null);
  const [loading,setLoading]=useState(true);
  const [comment,setComment]=useState("");
  const [posting,setPosting]=useState(false);
  const [togglingHold, setTogglingHold] = useState(false);
  const {user}=useAuth();

  useEffect(()=>{
    if(!reportId)return;
    setLoading(true);
    reportsApi.getById(reportId).then(r=>setReport(r.data)).catch(console.error).finally(()=>setLoading(false));
  },[reportId]);

  const postComment=async()=>{
    if(!user) {
      alert("Please sign in to comment!");
      return;
    }
    if(!comment.trim()||posting)return;
    setPosting(true);
    try{const res=await reportsApi.comment(report.id,comment.trim());setReport(p=>({...p,comments:[...(p.comments||[]),res.data],comment_count:(p.comment_count||0)+1}));setComment("");}catch(e){console.error(e);}finally{setPosting(false);}
  };

  const toggleLegalHold = async () => {
    if(!user || user.role !== 'super_admin') return;
    setTogglingHold(true);
    try {
      const newVal = !report.is_legal_hold;
      await superAdminApi.toggleLegalHold(report.id, newVal);
      setReport(p => ({...p, is_legal_hold: newVal}));
    } catch (e) { alert(e.message); }
    finally { setTogglingHold(false); }
  };

  const cat=report?getCat(report.category):null;
  const status=report?getStatus(report.status):null;

  return(
    <div className="dd-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="dd-panel">
        <div className="dd-handle"/>
        <div className="dd-header"><h3>Issue Detail</h3><button className="dd-close" onClick={onClose}>✕</button></div>
        {loading?(
          <div className="dd-skel">
            <div className="skeleton" style={{height:210,borderRadius:0}}/>
            <div style={{padding:"14px",display:"flex",flexDirection:"column",gap:9}}>
              <div className="skeleton" style={{height:20,width:"60%"}}/>
              <div className="skeleton" style={{height:14,width:"85%"}}/>
            </div>
          </div>
        ):report?(
          <div className="dd-content">
            {report.image_url&&<img src={report.image_url} alt={report.title} className="dd-img" onError={e=>e.target.style.display="none"}/>}
            <div className="dd-body">
              <div className="dd-tags">
                <span className="dd-tag" style={{color:cat.color,background:`${cat.color}18`,border:`1px solid ${cat.color}33`}}>{cat.icon} {cat.label}</span>
                <span className="dd-tag" style={{color:status.color,background:`${status.color}18`,border:`1px solid ${status.color}33`}}>{status.label}</span>
                {(report.pinned_to_map===true||report.pinned_to_map===1)&&<span className="dd-tag" style={{color:"var(--teal)",background:"var(--teal-dim)",border:"1px solid rgba(0,201,167,.3)"}}>📍 Map Pinned</span>}
                {report.is_legal_hold && <span className="dd-tag" style={{color:"var(--orange)",background:"rgba(255,90,31,0.1)",border:"1px solid rgba(255,90,31,0.3)"}}>⚖️ Legal Hold</span>}
              </div>
              
              {user?.role === 'super_admin' && (
                <div style={{marginBottom: 16, padding: '12px', background: 'var(--bg3)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                  <div>
                    <div style={{fontSize: '13px', fontWeight: '800', color: 'var(--text1)'}}>Legal Compliance</div>
                    <div style={{fontSize: '11px', color: 'var(--text3)'}}>Prevent deletion of this evidence.</div>
                  </div>
                  <button 
                    onClick={toggleLegalHold}
                    disabled={togglingHold}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', border: 'none', cursor: 'pointer',
                      background: report.is_legal_hold ? 'var(--red)' : 'var(--teal)',
                      color: '#000'
                    }}
                  >
                    {togglingHold ? '…' : report.is_legal_hold ? 'Release Hold' : 'Place Hold'}
                  </button>
                </div>
              )}

              <h2 className="dd-title">{report.title}</h2>
              <p className="dd-desc">{report.description}</p>

              {report.after_image_url && (
                <div style={{marginTop: "20px", background: "var(--bg3)", padding: "14px", borderRadius: "16px", border: "1.5px solid var(--teal)"}}>
                   <div style={{fontSize: "12px", fontWeight: "800", color: "var(--teal)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px"}}>
                      <span>✅</span> RESOLUTION PROOF
                   </div>
                   <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
                      <div style={{position: "relative"}}>
                        <img src={report.image_url} style={{width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "8px"}} alt="Before" />
                        <span style={{position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "10px", padding: "2px 6px", borderRadius: "4px"}}>BEFORE</span>
                      </div>
                      <div style={{position: "relative"}}>
                        <img src={report.after_image_url} style={{width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "8px"}} alt="After" />
                        <span style={{position: "absolute", bottom: 4, left: 4, background: "var(--teal)", color: "#000", fontSize: "10px", fontWeight: "800", padding: "2px 6px", borderRadius: "4px"}}>AFTER</span>
                      </div>
                   </div>
                </div>
              )}

              <StatusTimeline history={report.history} currentStatus={report.status} />

              {report.address&&<div className="dd-loc" style={{marginTop: "20px"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 8 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8z"/></svg>{report.address}</div>}
              <div className="dd-stats"><span>▲ {report.upvote_count||0}</span><span>▼ {report.downvote_count||0}</span><span>👥 {report.unique_upvoters||0}/{threshold} unique</span><span>🕐 {timeAgo(report.created_at)}</span></div>
              <div className="dd-author"><Avatar user={report.author} size={34}/><div><div className="dd-author-name">@{report.author?.username} {report.author?.badge}</div><div className="dd-author-sub">Reporter</div></div></div>
              <div className="dd-comments">
                <h4 className="dd-comments-h">Comments ({report.comment_count||0})</h4>
                <div className="dd-comment-row">
                  <input 
                    className="dd-comment-input" 
                    placeholder={user ? "Add a comment…" : "Sign in to join the conversation…"} 
                    value={comment} 
                    onChange={e=>setComment(e.target.value)} 
                    onKeyDown={e=>e.key==="Enter"&&postComment()} 
                    maxLength={500}
                    disabled={!user}
                  />
                  <button className="dd-comment-post" onClick={postComment} disabled={!comment.trim()||posting}>{posting?"…": user ? "Post" : "🔒"}</button>
                </div>
                <div className="dd-comment-list">
                  {(report.comments||[]).length===0?<p className="dd-no-comments">No comments yet</p>:[...(report.comments||[])].reverse().map(c=>(
                    <div key={c.id} className={`dd-comment ${c.is_official ? "dd-comment-official" : ""}`}>
                      <Avatar user={{username:c.username,avatar_color:c.avatar_color}} size={28}/>
                      <div className="dd-comment-body">
                        <div className="dd-comment-who">
                          @{c.username} {c.badge}
                          {c.is_official && <span className="official-tag">🛡️ OFFICIAL</span>}
                        </div>
                        <p className="dd-comment-text">{c.content}</p>
                        <span className="dd-comment-time">{timeAgo(c.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ):<div className="dd-err">Report not found.</div>}
      </div>
    </div>
  );
}
