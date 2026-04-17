import React,{useState,useEffect} from "react";
import {useNavigate,useLocation} from "react-router-dom";
import {authApi} from "../services/api.js";
import "./AuthPage.css";
export default function ResetPasswordPage(){
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [loading,setLoading]=useState(false);
  const [token,setToken]=useState("");
  const navigate=useNavigate();
  const {hash}=useLocation();
  useEffect(()=>{
    // Supabase puts access_token in URL hash
    const params=new URLSearchParams(hash.replace("#","?").slice(1));
    const t=params.get("access_token");
    if(t)setToken(t);
    else setError("Invalid or expired reset link.");
  },[hash]);
  const submit=async e=>{
    e.preventDefault();
    if(password!==confirm){setError("Passwords do not match.");return;}
    if(password.length<6){setError("Min 6 characters.");return;}
    setLoading(true);setError("");
    try{
      await authApi.resetPassword({access_token:token,new_password:password});
      setSuccess("Password updated! Redirecting to login…");
      setTimeout(()=>navigate("/"),2500);
    }catch(err){setError(err.message);}
    finally{setLoading(false);}
  };
  return(
    <div className="auth-page">
      <div className="auth-card fade-up">
        <div className="auth-logo">
          <div className="auth-logo-icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M12 2C7.03 2 3 6.03 3 11c0 6.25 9 13 9 13s9-6.75 9-13c0-4.97-4.03-9-9-9z" fill="var(--orange)" opacity=".95"/><circle cx="12" cy="11" r="3.5" fill="#fff" opacity=".95"/></svg></div>
          <h1 className="auth-brand">Reset Password</h1>
          <p className="auth-tagline">Enter your new password</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-field"><label>New Password</label><input type="password" placeholder="Min 6 characters" value={password} onChange={e=>setPassword(e.target.value)} required/></div>
          <div className="auth-field"><label>Confirm Password</label><input type="password" placeholder="Repeat password" value={confirm} onChange={e=>setConfirm(e.target.value)} required/></div>
          {error&&<div className="auth-error">{error}</div>}
          {success&&<div className="auth-success">{success}</div>}
          <button className="auth-submit" type="submit" disabled={loading||!token}>
            {loading?<span className="auth-spin"/>:"Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
