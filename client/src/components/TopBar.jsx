import React from "react";
import {useLocation,useNavigate} from "react-router-dom";
import {useSocket} from "../context/SocketContext.jsx";
import "./TopBar.css";
const TITLES={"/":"CityPulse","/map":"Live Map","/leaderboard":"Leaderboard","/profile":"My Profile"};
export default function TopBar({onCreateClick}){
  const {pathname}=useLocation();
  const {connected}=useSocket();
  const navigate=useNavigate();
  return(
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-logo" onClick={()=>navigate("/")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C7.03 2 3 6.03 3 11c0 6.25 9 13 9 13s9-6.75 9-13c0-4.97-4.03-9-9-9z" fill="var(--orange)"/>
            <circle cx="12" cy="11" r="3" fill="#fff" opacity=".9"/>
          </svg>
        </div>
        <span className="topbar-title">{TITLES[pathname]||"CityPulse"}</span>
      </div>
      <div className="topbar-right">
        <div className={`live-chip ${connected?"on":"off"}`}><span className="live-dot"/><span>{connected?"Live":"Off"}</span></div>
        {pathname==="/" && <button className="topbar-add" onClick={onCreateClick}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>}
      </div>
    </header>
  );
}
