import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
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
  authError: string | null;
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
  const [hasApprovedSub, setHasApprovedSub] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubNotif: (() => void) | null = null;
    let unsubMsg: (() => void) | null = null;
    let unsubSubs: (() => void) | null = null;

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
            // Source of truth for premium is the 'active' string in subscriptionStatus
            const isPremiumStatus = data.subscriptionStatus === 'active';
            setProfile({ 
              ...data, 
              uid: u.uid,
              isPremium: data.isPremium || isPremiumStatus || hasApprovedSub
            });
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

        // Listen for approved subscriptions to enable real-time activation from console
        const qSubs = query(collection(db, 'subscriptions'), where('userId', '==', u.uid), where('status', '==', 'approved'));
        unsubSubs = onSnapshot(qSubs, (snap) => {
          const approved = !snap.empty;
          setHasApprovedSub(approved);
          if (approved) {
            // Auto-sync back to profile for consistency if needed
            setDoc(userDocRef, { subscriptionStatus: 'active', isPremium: true }, { merge: true });
          }
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
      unsubSubs?.();
    };
  }, []);

  const signIn = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    // Force account selection to avoid stale sessions or cached errors
    provider.setCustomParameters({ prompt: 'select_account' });
    
    try {
      // Explicitly set persistence to ensure token is stored correctly
      await setPersistence(auth, browserLocalPersistence);
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
          darkMode: false,
          isPremium: false,
          premiumExpiresAt: null,
          subscriptionStatus: 'none',
          trialStartedAt: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error("Sign-in error:", error);
      let message = error.message;
      
      if (error.code === 'auth/operation-not-allowed') {
        message = "Google Sign-in is not enabled. Please enable it in the Firebase Console.";
      } else if (error.code === 'auth/popup-blocked') {
        message = "The sign-in popup was blocked by your browser. Please allow popups for this site.";
      } else if (error.code === 'auth/popup-closed-by-user') {
        message = "Sign-in was cancelled.";
      } else if (error.code === 'auth/unauthorized-domain') {
        message = "This domain is not authorized for Firebase Authentication. Please add it to the 'Authorized domains' in the Firebase Console.";
      } else if (message.includes('The requested action is invalid')) {
        message = "The authentication request was rejected by Firebase. This often happens if the domain is not authorized or second sign-in attempt is made while one is pending. Please try again or open the app in a new tab.";
      }
      
      setAuthError(message);
      throw new Error(message);
    }
  };

  const logout = async () => {
    setAuthError(null);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout, credits, unreadNotifications, unreadMessages, authError }}>
      {children}
    </AuthContext.Provider>
  );
};
