import React,{useState,useEffect} from "react";
import {authApi} from "../services/api.js";
import {useAuth} from "../context/AuthContext.jsx";
import "./AuthPage.css";

export default function AuthPage({ onAuthSuccess }){
  const [mode,setMode]=useState("login"); // login | register | admin | forgot
  const [form,setForm]=useState({username:"",email:"",password:"",secret_code:""});
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [loading,setLoading]=useState(false);
  const [geoStatus,setGeoStatus]=useState("idle"); // idle, getting, ok, outside, error
  const {login}=useAuth();

  useEffect(() => {
    // Prompt for location on mount to ensure user is in service area
    setGeoStatus("getting");
    if (!navigator.geolocation) {
      setGeoStatus("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        // Check if within Mumbai-Palghar bounds (Approx)
        if (latitude >= 18.8 && latitude <= 19.9 && longitude >= 72.6 && longitude <= 73.1) {
          setGeoStatus("ok");
        } else {
          setGeoStatus("outside");
          setError("Service restricted: We only support Mumbai (Churchgate) to Palghar regions (BMC, VVMC, MBMC).");
        }
      },
      () => {
        setGeoStatus("error");
        setError("Please enable location to access CityPulse. This is for security and ward-based routing.");
      },
      { enableHighAccuracy: true }
    );
  }, []);

  const set=(k,v)=>{setForm(p=>({...p,[k]:v}));setError("");setSuccess("");};

  const submit=async e=>{
    e.preventDefault();
    if (geoStatus !== "ok" && geoStatus !== "getting") {
      setError("Please enable location within the Mumbai-Palghar service area to proceed.");
      return;
    }
    setLoading(true);setError("");setSuccess("");
    try{
      if(mode==="forgot"){
        await authApi.forgotPassword({email:form.email});
        setSuccess("Reset link sent! Check your email.");
        setLoading(false);return;
      }
      const res=mode==="login"
        ? await authApi.login({username:form.username,password:form.password})
        : mode==="admin"
        ? await authApi.adminRegister({username:form.username,email:form.email,password:form.password,secret_code:form.secret_code})
        : await authApi.register({username:form.username,email:form.email,password:form.password});
      
      login(res.token,res.user);
      if (onAuthSuccess) onAuthSuccess();
    }catch(err){setError(err.message);}
    finally{setLoading(false);}
  };

  return(
    <div className="auth-page">
      <div className="auth-glow auth-glow-1"/>
      <div className="auth-glow auth-glow-2"/>
      <div className="auth-card fade-up">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C7.03 2 3 6.03 3 11c0 6.25 9 13 9 13s9-6.75 9-13c0-4.97-4.03-9-9-9z" fill="var(--orange)" opacity=".95"/>
              <circle cx="12" cy="11" r="3.5" fill="#fff" opacity=".95"/>
            </svg>
          </div>
          <h1 className="auth-brand">CityPulse</h1>
          <p className="auth-tagline">{mode==="admin"?"Admin Portal":"Report. Verify. Fix."}</p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {(mode==="register"||mode==="admin"||mode==="login")&&(
            <div className="auth-field"><label>Username</label><input type="text" placeholder="yourname" value={form.username} onChange={e=>set("username",e.target.value)} minLength={3} required/></div>
          )}
          {mode!=="login"&&(
            <div className="auth-field"><label>Email</label><input type="email" placeholder="Email" value={form.email} onChange={e=>set("email",e.target.value)} required/></div>
          )}
          {mode!=="forgot"&&(
            <div className="auth-field"><label>Password</label><input type="password" placeholder={mode==="login"?"••••••••":"Min 6 characters"} value={form.password} onChange={e=>set("password",e.target.value)} minLength={6} required/></div>
          )}
          {mode==="admin"&&(
            <div className="auth-field">
              <label>Admin Secret Code</label>
              <input type="password" placeholder="Enter secret code" value={form.secret_code} onChange={e=>set("secret_code",e.target.value)} required/>
            </div>
          )}
          {error&&<div className="auth-error">{error}</div>}
          {success&&<div className="auth-success">{success}</div>}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading?<span className="auth-spin"/>:mode==="login"?"Sign In":mode==="forgot"?"Send Reset Link":mode==="admin"?"Create Admin Account":"Create Account"}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <div className="auth-links">
          {mode!=="login"&&<button className="auth-toggle" onClick={()=>{setMode("login");setError("");setSuccess("");}}>
            <span>Already have an account?</span><strong>Sign In</strong>
          </button>}
          {mode==="login"&&<>
            <button className="auth-toggle" onClick={()=>{setMode("register");setError("");setSuccess("");}}>
              <span>Don't have an account?</span><strong>Sign Up</strong>
            </button>
            <button className="auth-forgot" onClick={()=>{setMode("forgot");setError("");setSuccess("");}}>Forgot password?</button>
            <button className="auth-admin-link" onClick={()=>{setMode("admin");setError("");setSuccess("");}}>🛡️ Admin Registration</button>
          </>}
          {mode==="forgot"&&<button className="auth-toggle" onClick={()=>{setMode("login");setError("");setSuccess("");}}><span>Back to</span><strong>Sign In</strong></button>}
        </div>
      </div>
    </div>
  );
}
