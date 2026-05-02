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

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

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
    <nav className="fixed bottom-0 left-0 right-0 bg-bg-main border-t border-border-main z-50 transition-colors">
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
                  <div className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] bg-primary text-bg-main text-[8px] font-black rounded-full flex items-center justify-center border-2 border-bg-main px-0.5 transition-colors">
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-main p-10 transition-colors">
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
    <div className="min-h-screen bg-bg-main pb-16 transition-colors">
      <header className="sticky top-0 pt-[env(safe-area-inset-top)] bg-bg-main border-b border-border-main z-50 transition-colors duration-200">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-1 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="text-xl font-black tracking-tighter text-text-main">Skillora</div>
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1" />
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-hover-bg text-text-main px-3 py-1.5 rounded-full font-bold text-[11px] flex items-center gap-1.5 border border-border-main/50 transition-colors">
              <Shield size={14} className="text-primary" />
              {credits}
            </div>
            
            <div className="flex items-center gap-4 px-1">
              <Link to="/notification" className="relative text-text-muted hover:text-text-main transition-colors">
                <Bell size={20} strokeWidth={2} />
                {unreadNotifications > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-primary text-bg-main text-[8px] font-black rounded-full flex items-center justify-center border-2 border-bg-main px-0.5 transition-colors">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </div>
                )}
              </Link>
            </div>
 
            <Link to="/profile" className="w-8 h-8 rounded-full bg-hover-bg overflow-hidden border border-border-main/50 relative flex items-center justify-center shrink-0 transition-colors">
              {(profile?.photoURL || user.photoURL) ? (
                <img src={profile?.photoURL || user.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={profile?.displayName || user.displayName || 'Profile'} />
              ) : (
                <UserIcon size={16} className="text-text-muted transition-colors" />
              )}
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-lg mx-auto min-h-screen bg-bg-main transition-colors duration-200">
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
          <ThemeProvider>
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
          </ThemeProvider>
        </AuthProvider>
    </ErrorBoundary>
  );
}
