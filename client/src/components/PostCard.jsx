import React,{useState} from "react";
import {useNavigate} from "react-router-dom";
import {reportsApi} from "../services/api.js";
import {useAuth}    from "../context/AuthContext.jsx";
import {getCat,getStatus,timeAgo} from "../utils/constants.js";
import Avatar from "./Avatar.jsx";
import "./PostCard.css";
export default function PostCard({report:init,isNew=false,onClick,threshold=5}){
  const [r,setR]=useState(init);
  const [busy,setBusy]=useState(false);
  const {user}=useAuth();
  const navigate=useNavigate();
  const cat=getCat(r.category);
  const status=getStatus(r.status);
  const isOwn=user?.id===r.user_id;
  const isAnon = !!r.is_anonymous;
  const isPinned=r.pinned_to_map===true||r.pinned_to_map===1;
  const isEscalated = r.is_escalated === 1 || r.is_escalated === true;
  const progress=Math.min(((r.unique_upvoters||0)/threshold)*100,100);

  const shareReport = async () => {
    const text = isEscalated 
      ? `🚨 SLA BREACHED in ${r.ward_name}! Help me escalate this ${r.category} issue to @mybmc.`
      : `📢 I reported a ${r.category} in ${r.ward_name}. Let's get this fixed!`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: "CityPulse Mumbai", text, url: window.location.origin + `?id=${r.id}` });
      } catch {}
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(`${text} ${window.location.origin}/?id=${r.id}`);
      alert("Link copied to clipboard! Share it on X/WhatsApp.");
    }
  };

  const vote=async(e,type)=>{
    e.stopPropagation();
    if(!user) {
      alert("Please sign in to vote and participate!");
      return;
    }
    if(busy||isOwn)return;
    setBusy(true);
    try{const res=await reportsApi.vote(r.id,type);setR(p=>({...p,...res}));}catch{}
    finally{setBusy(false);}
  };
  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this report? This cannot be undone.")) return;
    setBusy(true);
    try {
      await reportsApi.delete(r.id);
      window.location.reload(); // Refresh to remove deleted item
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  return(
    <article className={`pc ${isNew?"pc-new":""}`}>
      {isNew&&<div className="pc-new-tag">NEW</div>}
      <div className="pc-head" onClick={()=>{
        if (isAnon) return;
        user ? navigate(`/profile/${r.user_id}`) : alert("Sign in to view profiles");
      }}>
        <Avatar user={isAnon ? { username: "Citizen", avatar_color: "#64748b" } : r.author} size={38}/>
        <div className="pc-head-info">
          <div className="pc-username">@{isAnon ? "concerned_citizen" : r.author?.username || "unknown"}{!isAnon && r.author?.badge && <span className="pc-badge">{r.author.badge}</span>}</div>
          <div className="pc-meta">
            <span className="pc-cat" style={{color:cat.color}}>{cat.icon} {cat.label}</span>
            <span className="pc-dot">·</span>
            <span className="pc-time">{timeAgo(r.created_at)}</span>
            {isEscalated && status.value !== "resolved" && (
              <>
                <span className="pc-dot">·</span>
                <span className="pc-sla-tag">🚨 SLA BREACHED</span>
              </>
            )}
          </div>
        </div>
        <div className="pc-head-actions">
          {(isOwn || user?.role === "super_admin") && (
            <button className="pc-del-btn" onClick={handleDelete} title="Delete Report" disabled={busy}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
            </button>
          )}
          <button className="pc-share-btn" onClick={(e) => { e.stopPropagation(); shareReport(); }} title="Share / Escalate">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </button>
        </div>
      </div>
      {r.image_url&&<div className="pc-img-wrap" onClick={()=>onClick?.(r.id)}><img src={r.image_url} alt={r.title} className="pc-img" loading="lazy" onError={e=>e.target.parentElement.style.display="none"}/><div className="pc-img-status"><span className="pc-status-chip" style={{color:status.color,background:`${status.color}22`,border:`1px solid ${status.color}44`}}>{status.label}</span></div></div>}
      <div className="pc-body" onClick={()=>onClick?.(r.id)}>
        {isPinned && <div className="pc-pinned"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7.03 2 3 6.03 3 11c0 6.25 9 13 9 13s9-6.75 9-13c0-4.97-4.03-9-9-9z"/></svg>Verified & Pinned</div>}
        {!r.image_url&&<span className="pc-status-chip pc-status-inline" style={{color:status.color,background:`${status.color}22`,border:`1px solid ${status.color}44`}}>{status.label}</span>}
        <h3 className="pc-title">{r.title}</h3>
        <p className="pc-desc">{r.description}</p>
        {r.address&&<div className="pc-loc"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 8 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8z"/></svg>{r.address.split(",").slice(0,2).join(",")}</div>}
      </div>
      {!isPinned&&<div className="pc-progress-wrap"><div className="pc-progress-track"><div className="pc-progress-fill" style={{width:`${progress}%`}}/></div><span className="pc-progress-label">{r.unique_upvoters||0}/{threshold} unique upvotes to pin on map</span></div>}
      <div className="pc-actions">
        <div className="pc-votes">
          <button className={`vote-btn up ${r.userVote==="up"?"voted":""} ${isOwn?"own":""} ${!user?"guest":""}`} onClick={e=>vote(e,"up")} disabled={busy||isOwn} title={!user ? "Sign in to upvote" : isOwn?"Can't vote your own":"Upvote"}><svg width="16" height="16" viewBox="0 0 24 24" fill={r.userVote==="up"?"currentColor":"none"} stroke="currentColor" strokeWidth="2.2"><polyline points="18 15 12 9 6 15"/></svg><span>{r.upvote_count||0}</span></button>
          <div className={`net-score ${(r.net_votes||0)>0?"pos":(r.net_votes||0)<0?"neg":""}`}>{r.net_votes||0}</div>
          <button className={`vote-btn dn ${r.userVote==="down"?"voted":""} ${isOwn?"own":""} ${!user?"guest":""}`} onClick={e=>vote(e,"down")} disabled={busy||isOwn} title={!user ? "Sign in to downvote" : isOwn?"Can't vote your own":"Downvote"}><svg width="16" height="16" viewBox="0 0 24 24" fill={r.userVote==="down"?"currentColor":"none"} stroke="currentColor" strokeWidth="2.2"><polyline points="6 9 12 15 18 9"/></svg><span>{r.downvote_count||0}</span></button>
        </div>
        <button className="comment-btn" onClick={() => user ? onClick?.(r.id) : alert("Sign in to view comments and participate")}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><span>{r.comment_count||0}</span></button>
      </div>
    </article>
  );
}
