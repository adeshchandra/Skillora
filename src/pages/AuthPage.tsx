import React, { useState } from 'react';
import { useAuth } from '../App';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, Check, X, Eye, EyeOff, User } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, query, where, collection, getDocs, getDoc } from 'firebase/firestore';

const validateEmail = (email: string) => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};

const FloatingInput = ({ label, value, onChange, type = 'text', showPasswordToggle, isPasswordVisible, onTogglePassword, icon: Icon }: any) => {
  return (
    <div className="space-y-1.5 w-full mb-4">
      <label className="text-[10px] font-black text-text-muted/60 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted/40">
          {Icon && <Icon size={16} />}
        </div>
        <input
          type={showPasswordToggle ? (isPasswordVisible ? 'text' : 'password') : type}
          value={value}
          onChange={onChange}
          className={`w-full ${Icon ? 'pl-11' : 'px-4'} pr-4 py-4 bg-hover-bg/40 border border-border-main/50 rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all text-[13px] font-bold text-text-main placeholder:text-text-muted/20 shadow-sm`}
          placeholder={`Enter your ${label.toLowerCase()}...`}
        />
        {showPasswordToggle && (
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted/40 hover:text-primary transition-colors"
          >
            {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
};

export default function AuthPage() {
  const { signIn: signInWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) {
          setError("Please enter your email address.");
          return;
      }
      setLoading(true);
      setError('');
      try {
          await sendPasswordResetEmail(auth, email);
          setSuccessMsg("A secure link to reset your password has been sent to your email.");
          setShowResetForm(false);
      } catch (err: any) {
          setError(err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!isLogin && !acceptedTerms) {
        setError("You must accept the terms and conditions.");
        return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!validateEmail(email)) throw new Error('Please provide a valid email address.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        if (!displayName) throw new Error('Display name is required');

        // Check if email is already in use in Firestore
        const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
             throw new Error('This email address is already taken. Please use an original email.');
        }

        // Directly create user profile instead of OTP
        const targetUser = (await createUserWithEmailAndPassword(auth, email, password)).user;
        await updateProfile(targetUser, { displayName });
        
        // Send verification email
        sendEmailVerification(targetUser).catch(console.error);

        const userRef = doc(db, 'users', targetUser.uid);
        const userData = {
            uid: targetUser.uid,
            email: email.toLowerCase(),
            displayName: displayName || 'Learner',
            photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${displayName || 'U'}`,
            role: 'student',
            credits: 150,
            teachSkills: [],
            learnSkills: [],
            joinedGroups: [],
            rating: 5.0,
            reviewCount: 0,
            createdAt: new Date().toISOString(),
            onboardingCompleted: false
        };
        await setDoc(userRef, userData);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center pt-24 px-6 md:px-0">
      <div className="w-full max-w-[340px] flex flex-col items-center space-y-8">
        
        <div className="text-center space-y-3 w-full">
            <div className="flex items-center justify-center gap-1">
                <div className="text-2xl font-black tracking-tighter text-text-main">Skillora</div>
                <div className="w-2 h-2 rounded-full bg-primary" />
            </div>
            <p className="text-[11px] font-bold text-text-muted leading-none">
              {showResetForm ? 'Identity Recovery' : (isLogin ? 'Sign In' : 'Sign Up')}
            </p>
        </div>

        <div className="w-full">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={showResetForm ? 'reset' : (isLogin ? 'login' : 'signup')}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="w-full"
                    >
                        {showResetForm ? (
                            <form onSubmit={handlePasswordReset} className="w-full space-y-6">
                    <div className="p-4 bg-hover-bg rounded-2xl text-center space-y-2 border border-border-main/30">
                        <Lock className="w-5 h-5 text-text-muted mx-auto" />
                        <p className="text-[10px] text-text-muted font-bold leading-relaxed px-2">Enter your email to receive an automated recovery link.</p>
                    </div>
                    <FloatingInput 
                        label="Email Address" 
                        type="email"
                        icon={Mail}
                        value={email} 
                        onChange={(e: any) => setEmail(e.target.value)}
                    />
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-[10px] font-bold rounded-xl flex items-center gap-2 border border-red-100">
                            <X size={14} strokeWidth={3} />
                            {error}
                        </div>
                    )}
                    <div className="space-y-4 pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-text-main text-white font-bold text-sm rounded-2xl hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : 'Request Link'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowResetForm(false); setError(''); }}
                            className="w-full py-2 text-[10px] font-bold text-text-muted hover:text-text-main transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
                        ) : (
                            <div className="space-y-6">
                                <form onSubmit={handleEmailAuth} className="w-full space-y-1">
                    {!isLogin && (
                        <FloatingInput 
                        label="Full Name" 
                        value={displayName} 
                        icon={User}
                        onChange={(e: any) => setDisplayName(e.target.value)}
                        />
                    )}

                    <FloatingInput 
                        label="Email Address" 
                        type="email"
                        value={email} 
                        icon={Mail}
                        onChange={(e: any) => setEmail(e.target.value)}
                    />
                    <FloatingInput 
                        label="Password"
                        value={password} 
                        icon={Lock}
                        showPasswordToggle
                        isPasswordVisible={showPassword}
                        onTogglePassword={() => setShowPassword(!showPassword)}
                        onChange={(e: any) => setPassword(e.target.value)}
                    />
                                    <div className="flex justify-end px-1 -mt-2 pb-2">
                                        <button 
                                            type="button"
                                            onClick={() => { setShowResetForm(true); setError(''); setSuccessMsg(''); }}
                                            className="text-[10px] font-bold text-text-muted hover:text-primary transition-all"
                                        >
                                            Recovery?
                                        </button>
                                    </div>

                    {!isLogin && (
                        <div className="flex items-start gap-3 p-4 bg-hover-bg/30 border border-border-main/20 rounded-2xl group transition-all">
                            <div className="pt-0.5">
                                <input 
                                    type="checkbox" 
                                    id="terms-checkbox"
                                    checked={acceptedTerms}
                                    onChange={() => setAcceptedTerms(!acceptedTerms)}
                                    className="w-4 h-4 rounded-lg border-border-main text-text-main focus:ring-0 cursor-pointer transition-all grayscale"
                                />
                            </div>
                            <label htmlFor="terms-checkbox" className="text-[10px] font-bold text-text-muted leading-relaxed cursor-pointer group-hover:text-text-main">
                                Confirm <Link to="/terms" className="text-text-main underline decoration-primary/30" onClick={(e) => e.stopPropagation()}>Terms and Conditions</Link>
                            </label>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-text-main text-white font-bold text-sm rounded-2xl hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 mt-4 shadow-sm"
                    >
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div className="w-full pt-8 space-y-8">
                    <div className="flex flex-col items-center">
                        <button 
                            onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }}
                            className="text-text-muted text-[11px] font-bold hover:text-primary transition-colors"
                        >
                            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                        </button>
                    </div>

                    <div className="relative flex items-center opacity-30">
                        <div className="flex-grow border-t border-border-main"></div>
                        <span className="flex-shrink mx-4 text-[9px] font-bold text-text-muted uppercase tracking-[0.2em]">Social</span>
                        <div className="flex-grow border-t border-border-main"></div>
                    </div>

                    <button
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-4 px-6 py-4 bg-white border border-border-main text-text-main rounded-2xl font-bold text-sm hover:bg-hover-bg transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4 grayscale opacity-70" alt="G" />
                        {loading ? 'Processing...' : 'Continue with Google'}
                    </button>
                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
        </div>
      </div>
      
      <div className="mt-24 pb-12 flex flex-col items-center space-y-2 opacity-30">
         <div className="w-8 h-px bg-border-main" />
         <p className="text-[9px] text-text-muted font-black tracking-[0.5em] uppercase">
           S.BASE—26
         </p>
      </div>
    </div>
  );
}
