import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
      unsubProfile?.();
      unsubNotif?.();
      unsubMsg?.();

      if (u) {
        setUser(u);
        const userDocRef = doc(db, 'users', u.uid);
        
        unsubProfile = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setProfile({ ...data, uid: u.uid });
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
    
    const userDocRef = doc(db, 'users', u.uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      if (u.email) {
        const q = query(collection(db, 'users'), where('email', '==', u.email.toLowerCase()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
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
        onboardingCompleted: false,
        darkMode: false
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
