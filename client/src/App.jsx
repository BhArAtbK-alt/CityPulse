import React,{useState,useEffect} from "react";
import {BrowserRouter,Routes,Route,Navigate} from "react-router-dom";
import {AuthProvider,useAuth}   from "./context/AuthContext.jsx";
import {SocketProvider,useSocket} from "./context/SocketContext.jsx";
import {Toaster, toast}          from "react-hot-toast";
import TopBar      from "./components/TopBar.jsx";
import BottomNav   from "./components/BottomNav.jsx";
import CreateModal from "./components/CreateModal.jsx";
import AuthPage          from "./pages/AuthPage.jsx";
import FeedPage          from "./pages/FeedPage.jsx";
import MapPage           from "./pages/MapPage.jsx";
import LeaderboardPage   from "./pages/LeaderboardPage.jsx";
import ProfilePage       from "./pages/ProfilePage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import AdminDashboard    from "./pages/admin/AdminDashboard.jsx";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard.jsx";

function Shell(){
  const {user,loading}=useAuth();
  const {socket}=useSocket();
  const [showCreate,setShowCreate]=useState(false);
  const [showAuth,setShowAuth]=useState(false);

  // Status Notification Listener
  useEffect(()=>{
    if(!socket || !user) return;
    const h=({report, status})=>{
      if(report.user_id === user.id) {
        toast.success(`Report "${report.title}" is now ${status.toUpperCase()}!`, { duration: 5000, icon: '🔔' });
      }
    };
    socket.on("status_update", h);
    return ()=>socket.off("status_update", h);
  },[socket, user]);

  // Close modal when user is logged in
  useEffect(() => {
    if (user) {
      setShowAuth(false);
    }
  }, [user]);

  if(loading) return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0a0a0a"}}>
      <div className="spinner"/>
    </div>
  );

  // Handle successful login from AuthPage by refreshing to clear stale state
  const handleAuthSuccess = () => {
    setShowAuth(false);
    // Hard refresh to reset all contexts/states for the new user
    window.location.reload();
  };

  // ── Public/User View Mode ────────────────────────────────────
  const mainContent = (
    <div className="app-shell">
      <TopBar onCreateClick={() => user ? setShowCreate(true) : setShowAuth(true)}/>
      <main className="app-main">
        <Routes>
          <Route path="/"             element={<FeedPage/>}/>
          <Route path="/map"          element={<MapPage/>}/>
          <Route path="/leaderboard"  element={user ? <LeaderboardPage/> : <Navigate to="/" replace/>}/>
          <Route path="/profile"      element={user ? <ProfilePage/> : <Navigate to="/" replace/>}/>
          <Route path="/profile/:uid" element={<ProfilePage/>}/>
          <Route path="*"             element={<Navigate to="/" replace/>}/>
        </Routes>
      </main>
      <BottomNav onCreateClick={() => user ? setShowCreate(true) : setShowAuth(true)}/>
      
      {showCreate && <CreateModal onClose={()=>setShowCreate(false)}/>}
      
      {showAuth && !user && (
        <div className="auth-modal-overlay">
          <div className="auth-modal-content">
            <button className="auth-close-btn" onClick={() => setShowAuth(false)}>✕</button>
            <AuthPage onAuthSuccess={handleAuthSuccess} />
          </div>
        </div>
      )}
    </div>
  );

  // ── Admin/SuperAdmin layout ──────────────────────────────────
  if(user?.role==="super_admin") return(
    <Routes>
      <Route path="/superadmin/*" element={<SuperAdminDashboard/>}/>
      <Route path="*"             element={<Navigate to="/superadmin" replace/>}/>
    </Routes>
  );

  if(user?.role==="admin") return(
    <Routes>
      <Route path="/admin/*" element={<AdminDashboard/>}/>
      <Route path="*"        element={<Navigate to="/admin" replace/>}/>
    </Routes>
  );

  return mainContent;
}

export default function App(){
  return(
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Toaster position="top-center" toastOptions={{style:{background:'#1a1a1a',color:'#fff',border:'1px solid #333'}}} />
          <Routes>
            <Route path="/reset-password" element={<ResetPasswordPage/>}/>
            <Route path="*"               element={<Shell/>}/>
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
