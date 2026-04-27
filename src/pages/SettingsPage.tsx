import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { auth } from '../lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Lock, 
  FileText, 
  LogOut, 
  Moon, 
  Sun, 
  Info, 
  ChevronRight, 
  ShieldCheck, 
  Eye, 
  UserCircle,
  RefreshCw
} from 'lucide-react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const MenuItem = ({ icon: Icon, label, onClick, rightElement, description }: any) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center gap-4 p-4 hover:bg-hover-bg transition-all active:bg-border-main border-b border-border-main/50 last:border-0"
  >
    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
      <Icon size={20} />
    </div>
    <div className="flex-grow text-left">
      <p className="text-sm font-bold text-text-main leading-tight">{label}</p>
      {description && <p className="text-[10px] text-text-muted font-medium mt-0.5">{description}</p>}
    </div>
    {rightElement || <ChevronRight size={16} className="text-text-muted opacity-50" />}
  </button>
);

const Section = ({ title, children }: any) => (
  <div className="space-y-2">
    <h3 className="px-4 text-[11px] font-black uppercase tracking-widest text-text-muted">{title}</h3>
    <div className="bg-white border-y border-border-main overflow-hidden">
      {children}
    </div>
  </div>
);

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();

  const handlePrivacyToggle = async (key: string) => {
    if (!user) return;
    const currentPrivacy = profile?.privacy || { hideGoals: false, hideMastery: false, hideFromSearch: false };
    const updatedPrivacy = { ...currentPrivacy, [key]: !((currentPrivacy as any)[key]) };
    
    try {
        await updateDoc(doc(db, 'users', user.uid), { privacy: updatedPrivacy });
    } catch (err) {
        console.error("Privacy update error:", err);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
        await sendPasswordResetEmail(auth, user.email);
        setResetSent(true);
    } catch (err) {
        console.error("Password reset error:", err);
        alert("Failed to send reset email. Please try again.");
    } finally {
        setLoading(false);
    }
  };

  // Sync theme with local storage or profile if implemented
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);

    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const menuItems = [
    {
      section: "Account Security",
      items: [
        { 
          icon: Lock, 
          label: "Change Password", 
          description: "Update your login security credentials",
          onClick: () => {
            setResetSent(false);
            setShowPasswordModal(true);
          } 
        },
        { 
          icon: UserCircle, 
          label: "Privacy Controls", 
          description: "Manage who can see your learning goals",
          onClick: () => setShowPrivacyModal(true) 
        }
      ]
    },
    {
      section: "Preferences",
      items: [
        { 
          icon: darkMode ? Sun : Moon, 
          label: "Dark Mode", 
          description: `Switch to ${darkMode ? 'light' : 'dark'} theme`,
          onClick: toggleDarkMode,
          rightElement: (
            <div className={`w-12 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-primary' : 'bg-border-main'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'left-7' : 'left-1'}`} />
            </div>
          )
        }
      ]
    },
    {
      section: "Legal & Info",
      items: [
        { 
          icon: FileText, 
          label: "Terms & Conditions", 
          description: "Our platform rules and guidelines",
          onClick: () => navigate('/terms') 
        },
        { 
          icon: ShieldCheck, 
          label: "Privacy Policy", 
          description: "How we protect your learning data",
          onClick: () => navigate('/policy') 
        },
        { 
          icon: Info, 
          label: "About Skillora", 
          description: "Learn more about our mission",
          onClick: () => navigate('/about') 
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-bg-main flex flex-col pb-20">
      {/* Header */}
      <div className="bg-white border-b border-border-main p-4 flex items-center gap-4 sticky top-0 z-50">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 -ml-2 rounded-xl hover:bg-hover-bg transition-colors"
        >
          <ArrowLeft size={22} className="text-text-main" />
        </button>
        <h1 className="text-lg font-black text-text-main tracking-tighter uppercase">Settings</h1>
      </div>

      {/* Content */}
      <div className="flex-grow py-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {menuItems.map((sec, i) => (
          <Section key={i} title={sec.section}>
            {sec.items.map((item, j) => (
              <MenuItem key={j} {...item} />
            ))}
          </Section>
        ))}

        <div className="px-4 pt-4">
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-xs uppercase tracking-widest border border-red-100 hover:bg-red-100 transition-all active:scale-[0.98]"
          >
            <LogOut size={16} />
            Logout from Session
          </button>
        </div>

        <div className="text-center space-y-1 py-8">
            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em]">Skillora v1.0.4</p>
            <p className="text-[9px] text-text-muted font-bold">Bridging Knowledge Gaps Together</p>
        </div>
      </div>

      {/* Logout Confirmation */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowLogoutConfirm(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-xs rounded-[32px] p-6 border-2 border-black relative z-10 space-y-6 text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500 mb-2">
                <LogOut size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-text-main">Are you sure?</h4>
                <p className="text-xs text-text-muted">You will need to login again to access your learning sessions.</p>
              </div>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={logout}
                  className="w-full py-3 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200"
                >
                  Yes, Logout
                </button>
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full py-3 text-text-muted font-bold text-xs"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowPasswordModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-xs rounded-[32px] p-8 border-2 border-black relative z-10 space-y-6 text-center"
            >
              {resetSent ? (
                <>
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-500">
                    <ShieldCheck size={32} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-lg font-black text-text-main uppercase tracking-tight">Email Sent</h4>
                    <p className="text-xs text-text-muted leading-relaxed">
                        A secure link to reset your password has been sent to <span className="font-bold text-text-main">{user?.email}</span>.
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowPasswordModal(false)}
                    className="w-full py-3.5 bg-text-main text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-[0.98]"
                  >
                    Got it
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                    <Lock size={32} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-lg font-black text-text-main uppercase tracking-tight">Security Update</h4>
                    <p className="text-xs text-text-muted leading-relaxed">
                        For your protection, we'll send a secure password reset link to your registered email address.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={handlePasswordReset}
                      disabled={loading}
                      className="w-full py-3.5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {loading ? <RefreshCw className="animate-spin" size={14} /> : "Send Reset Link"}
                    </button>
                    <button 
                      onClick={() => setShowPasswordModal(false)}
                      className="w-full py-2 text-text-muted font-bold text-xs"
                    >
                      Maybe later
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy Modal */}
      <AnimatePresence>
        {showPrivacyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowPrivacyModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-6 border-2 border-black relative z-10 space-y-6"
            >
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary mb-2">
                  <UserCircle size={24} />
                </div>
                <h4 className="text-lg font-black text-text-main uppercase tracking-tight">Privacy Center</h4>
                <p className="text-xs text-text-muted">Control your visibility on Skillora</p>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'hideGoals', label: 'Hide Learning Goals', icon: Eye },
                  { key: 'hideMastery', label: 'Hide Mastery Skills', icon: ShieldCheck },
                  { key: 'hideFromSearch', label: 'Incognito Mode', icon: Moon }
                ].map((item) => {
                  const isActive = profile?.privacy?.[(item.key as any)] || false;
                  return (
                    <button 
                      key={item.key}
                      onClick={() => handlePrivacyToggle(item.key)}
                      className="w-full flex items-center justify-between p-4 bg-hover-bg rounded-2xl border border-border-main/50 hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={18} className="text-text-muted" />
                        <span className="text-sm font-bold text-text-main">{item.label}</span>
                      </div>
                      <div className={`w-10 h-5 rounded-full relative transition-colors ${isActive ? 'bg-primary' : 'bg-border-main'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isActive ? 'left-5.5' : 'left-0.5'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="w-full py-4 bg-text-main text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.98]"
              >
                Close & Save
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
