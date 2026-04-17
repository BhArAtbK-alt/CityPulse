import React,{createContext,useContext,useState,useEffect} from "react";
import axios from "axios";
const Ctx = createContext(null);
export function AuthProvider({children}){
  const [user,setUser]=useState(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const token=localStorage.getItem("cp_token");
    if(!token){setLoading(false);return;}
    axios.defaults.headers.common["Authorization"]=`Bearer ${token}`;
    axios.get("/api/auth/me")
      .then(res=>setUser(res.data.user))
      .catch(()=>{localStorage.removeItem("cp_token");delete axios.defaults.headers.common["Authorization"];})
      .finally(()=>setLoading(false));
  },[]);
  const login=(token,userData)=>{
    localStorage.setItem("cp_token",token);
    axios.defaults.headers.common["Authorization"]=`Bearer ${token}`;
    setUser(userData);
  };
  const logout=()=>{
    localStorage.removeItem("cp_token");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
  };
  return <Ctx.Provider value={{user,loading,login,logout,setUser}}>{children}</Ctx.Provider>;
}
export const useAuth=()=>useContext(Ctx);
