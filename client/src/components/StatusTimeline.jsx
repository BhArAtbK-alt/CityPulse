import React from "react";
import { getStatus, timeAgo } from "../utils/constants.js";
import Avatar from "./Avatar.jsx";

const STATUS_ORDER = ["pending", "verified", "in_progress", "resolved"];

export default function StatusTimeline({ history = [], currentStatus }) {
  // Merge ordering logic with actual history
  // If history is empty, show at least the current status as the first step
  
  const steps = [...history];
  
  return (
    <div className="st-container" style={{marginTop: "20px", paddingLeft: "10px"}}>
      <h4 style={{fontSize: "14px", fontWeight: "800", marginBottom: "16px", color: "var(--text2)"}}>Progress Timeline</h4>
      
      <div className="st-list" style={{display: "flex", flexDirection: "column", gap: "0"}}>
        {steps.length === 0 ? (
          <div className="st-item st-item-active" style={{display: "flex", gap: "16px", paddingBottom: "20px", position: "relative"}}>
             <div className="st-dot-wrap" style={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                <div className="st-dot" style={{width: "12px", height: "12px", borderRadius: "50%", background: getStatus(currentStatus).color, zIndex: 2}}/>
             </div>
             <div className="st-content">
                <div style={{fontSize: "13px", fontWeight: "700", color: "var(--text1)"}}>{getStatus(currentStatus).label}</div>
                <div style={{fontSize: "11px", color: "var(--text3)"}}>Report submitted</div>
             </div>
          </div>
        ) : steps.map((step, idx) => {
          const statusInfo = getStatus(step.new_status);
          const isLast = idx === steps.length - 1;
          
          return (
            <div key={step.id} className="st-item" style={{display: "flex", gap: "16px", paddingBottom: "24px", position: "relative"}}>
               {/* Connector Line */}
               {!isLast && <div className="st-line" style={{position: "absolute", left: "5px", top: "12px", bottom: "-12px", width: "2px", background: "var(--border)", zIndex: 1}}/>}
               
               <div className="st-dot-wrap" style={{display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 2}}>
                  <div className="st-dot" style={{width: "12px", height: "12px", borderRadius: "50%", background: statusInfo.color, border: "2px solid var(--bg2)", boxShadow: `0 0 0 4px ${statusInfo.color}15`}}/>
               </div>
               
               <div className="st-content" style={{flex: 1}}>
                  <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start"}}>
                    <div style={{fontSize: "13px", fontWeight: "700", color: "var(--text1)"}}>{statusInfo.label}</div>
                    <div style={{fontSize: "10px", color: "var(--text3)"}}>{timeAgo(step.created_at)}</div>
                  </div>
                  
                  {step.note && <div style={{fontSize: "12px", color: "var(--text2)", marginTop: "4px", fontStyle: "italic"}}>"{step.note}"</div>}
                  
                  {step.changed_by_name && (
                    <div style={{display: "flex", alignItems: "center", gap: "6px", marginTop: "8px"}}>
                      <Avatar user={{username: step.changed_by_name, avatar_color: step.changed_by_avatar}} size={18} />
                      <span style={{fontSize: "10px", color: "var(--text3)"}}>
                        Updated by <strong>@{step.changed_by_name}</strong> {step.changed_by_role === 'admin' ? '(Official)' : ''}
                      </span>
                    </div>
                  )}
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
