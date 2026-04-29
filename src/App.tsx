import React, { Component, createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc, setDoc, getDocFromServer, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { Home, Users, PlusCircle, Bell, User as UserIcon, LogIn, Shield, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import HomePage from './pages/HomePage';
import GroupPage from './pages/GroupPage';
import CreatePage from './pages/CreatePage';
import NotificationPage from './pages/NotificationPage';
import ProfilePage from './pages/ProfilePage';
import MessagesPage from './pages/MessagesPage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import TermsPage from './pages/TermsPage';
import AboutPage from './pages/AboutPage';
import PolicyPage from './pages/PolicyPage';
import UserViewPage from './pages/UserViewPage';
import AuthPage from './pages/AuthPage';
import SkillSetupPage from './pages/SkillSetupPage';
import { ErrorBoundary } from './components/ErrorBoundary';

// --- Auth Context ---
interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  credits: number;
  unreadNotifications: number;
  unreadMessages: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubNotif: (() => void) | null = null;
    let unsubMsg: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      // Clean up previous snapshots if any
      unsubProfile?.();
      unsubNotif?.();
      unsubMsg?.();

      if (u) {
        setUser(u);
        const userDocRef = doc(db, 'users', u.uid);
        
        unsubProfile = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setProfile({ ...data, uid: u.uid }); // Ensure UID is always present
            const val = data.credits;
            setCredits(typeof val === 'number' && !isNaN(val) ? val : 0);
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile sync error:", error);
          setLoading(false);
        });

        const qNotif = query(collection(db, 'notifications'), where('userId', '==', u.uid), where('read', '==', false));
        unsubNotif = onSnapshot(qNotif, (snap) => setUnreadNotifications(snap.size));

        const qMsg = query(collection(db, 'conversations'), where('participants', 'array-contains', u.uid));
        unsubMsg = onSnapshot(qMsg, (snap) => {
          let total = 0;
          snap.docs.forEach(doc => {
            const data = doc.data();
            if (data.unreadCount && data.unreadCount[u.uid]) {
              total += data.unreadCount[u.uid];
            }
          });
          setUnreadMessages(total);
        });
      } else {
        setUser(null);
        setProfile(null);
        setCredits(0);
        setUnreadNotifications(0);
        setUnreadMessages(0);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      unsubProfile?.();
      unsubNotif?.();
      unsubMsg?.();
    };
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const u = result.user;
    
    // Check if profile exists, if not create it
    const userDocRef = doc(db, 'users', u.uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      // Check if email already exists in Firestore for a different UID
      if (u.email) {
        const q = query(collection(db, 'users'), where('email', '==', u.email.toLowerCase()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            // Email already in use by another account
            // In a real app we might link them, but per "must be original" we'll throw
            await signOut(auth);
            throw new Error('This email is already registered with another sign-in method. Please use your original account.');
        }
      }

      await setDoc(userDocRef, {
        uid: u.uid,
        email: u.email,
        displayName: u.displayName || 'Learner',
        photoURL: u.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${u.displayName || 'U'}`,
        role: 'student',
        credits: 150,
        teachSkills: [],
        learnSkills: [],
        joinedGroups: [],
        rating: 5.0,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
        onboardingCompleted: false
      });
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout, credits, unreadNotifications, unreadMessages }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Components ---

const Navigation = () => {
  const { user, unreadMessages } = useAuth();
  const location = useLocation();

  const isChatPage = location.pathname.startsWith('/chat/');
  if (isChatPage) return null;

  const navItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Group', path: '/group', icon: Users },
    { name: 'Create', path: '/create', icon: PlusCircle },
    { name: 'Chats', path: '/messages', icon: MessageSquare, badge: unreadMessages },
    { name: 'Profile', path: '/profile', icon: UserIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border-main pb-safe z-50">
      <div className="flex justify-around items-center h-14 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center space-y-0.5 w-full h-full transition-all relative ${
                isActive ? 'text-text-main' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <div className="relative">
                <Icon 
                  size={22} 
                  strokeWidth={isActive ? 2 : 1.5} 
                  fill={isActive && item.name !== 'Create' ? 'currentColor' : 'none'} 
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <div className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] bg-primary text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white px-0.5">
                    {item.badge > 9 ? '9+' : item.badge}
                  </div>
                )}
              </div>
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading, credits, unreadNotifications, unreadMessages } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(pre-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-main p-10">
        <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex items-center justify-center gap-2">
                <span className="text-4xl font-black tracking-tighter text-text-main">Skillora</span>
                <div className="w-3 h-3 rounded-full bg-primary animate-logo-blink" />
            </div>
            <div className="space-y-1">
                <p className="text-[10px] font-black text-text-muted/40 uppercase tracking-[0.3em]">Skill Syncing</p>
            </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  // Handle onboarding
  if (profile && profile.onboardingCompleted === false && location.pathname !== '/skill-setup') {
    return <SkillSetupPage />;
  }

  return (
    <div className="min-h-screen bg-bg-main pb-16">
      <header className="sticky top-0 h-14 bg-white border-b border-border-main z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-1 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="text-xl font-black tracking-tighter text-text-main">Skillora</div>
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1" />
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-hover-bg text-text-main px-3 py-1.5 rounded-full font-bold text-[11px] flex items-center gap-1.5 border border-border-main/50">
            <Shield size={14} className="text-primary" />
            {credits}
          </div>
          
          <div className="flex items-center gap-4 px-1">
            <Link to="/notification" className="relative text-text-muted hover:text-text-main transition-colors">
              <Bell size={20} strokeWidth={2} />
              {unreadNotifications > 0 && (
                <div className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-primary text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white px-0.5">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </div>
              )}
            </Link>
          </div>

          <Link to="/profile" className="w-8 h-8 rounded-full bg-hover-bg overflow-hidden border border-border-main relative flex items-center justify-center shrink-0">
            {user.photoURL ? (
              <img src={user.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={user.displayName || 'Profile'} />
            ) : (
              <UserIcon size={16} className="text-text-muted" />
            )}
          </Link>
        </div>
      </header>
      <main className="max-w-lg mx-auto min-h-screen bg-white">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      {location.pathname !== '/skill-setup' && <Navigation />}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/group" element={<GroupPage />} />
              <Route path="/create" element={<CreatePage />} />
              <Route path="/notification" element={<NotificationPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/chat/:conversationId" element={<ChatPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/policy" element={<PolicyPage />} />
              <Route path="/user/:userId" element={<UserViewPage />} />
              <Route path="/skill-setup" element={<SkillSetupPage />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
