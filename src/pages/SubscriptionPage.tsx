import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Crown, 
  Check, 
  ChevronRight, 
  ArrowLeft, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  BookOpen, 
  Users, 
  PenTool, 
  CreditCard,
  AlertCircle,
  Send,
  RefreshCw,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { Subscription as SubscriptionType } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

const PackageCard = ({ type, price, duration, features, isSelected, onSelect, icon: Icon, color, isPlatinum }: any) => (
  <motion.button
    whileTap={{ scale: 0.98 }}
    onClick={onSelect}
    className={`w-full p-6 rounded-[32px] border-2 text-left transition-all relative overflow-hidden group ${
      isSelected 
        ? isPlatinum 
          ? 'bg-slate-50 border-slate-300 shadow-xl shadow-slate-200/50' 
          : `bg-${color}/5 border-${color} shadow-xl shadow-${color}/10` 
        : 'bg-theme-card border-border-main hover:border-border-main/80'
    }`}
  >
    {/* Platinum Shine Effect */}
    {isPlatinum && isSelected && (
      <motion.div 
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-20 pointer-events-none"
      />
    )}

    <div className="flex justify-between items-start mb-4 relative z-10">
      <div className={`p-3 rounded-2xl transition-colors ${
        isSelected 
          ? isPlatinum ? 'bg-slate-200 text-slate-800' : `bg-${color} text-white` 
          : 'bg-hover-bg text-text-muted'
      }`}>
        <Icon size={24} />
      </div>
      {isSelected && (
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
          isPlatinum ? 'bg-slate-800 text-slate-100' : `bg-${color} text-white`
        }`}>
          Selected
        </div>
      )}
    </div>
    
    <div className="space-y-1 mb-6 relative z-10">
      <h3 className={`text-xl font-black uppercase tracking-tighter ${isPlatinum && isSelected ? 'text-slate-900' : 'text-text-main'}`}>
        {type} Plan
      </h3>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-black ${isPlatinum && isSelected ? 'text-slate-900' : 'text-text-main'}`}>৳{price}</span>
        <span className={`text-sm font-bold tracking-tight ${isPlatinum && isSelected ? 'text-slate-600' : 'text-text-muted'}`}>/ {duration}</span>
      </div>
    </div>

    <div className="space-y-3 relative z-10">
      {features.map((feature: string, idx: number) => (
        <div key={idx} className="flex items-center gap-3">
          <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
            isSelected 
              ? isPlatinum ? 'bg-slate-200 text-slate-700' : `bg-${color}/20 text-${color}` 
              : 'bg-hover-bg text-text-muted'
          }`}>
            <Check size={12} strokeWidth={3} />
          </div>
          <span className={`text-xs font-bold ${isPlatinum && isSelected ? 'text-slate-700' : 'text-text-muted'}`}>
            {feature}
          </span>
        </div>
      ))}
    </div>
  </motion.button>
);

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [selectedPack, setSelectedPack] = useState<'monthly' | 'yearly'>('monthly');
  const [showPayment, setShowPayment] = useState(false);
  const [txId, setTxId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');
  const [submitting, setSubmitting] = useState(false);
  const [mySubs, setMySubs] = useState<SubscriptionType[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'subscriptions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setMySubs(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionType)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'subscriptions'));
  }, [user]);

  const packages = {
    monthly: {
      price: 149,
      duration: 'month',
      features: [
        '100 Credit Points',
        '5 DAO Group Access',
        '20 Course Creations',
        '10 Book Creations',
        '5 DAO Creations',
        '5 Skill Requests'
      ],
      icon: Zap,
      color: 'slate-400',
      isPlatinum: true
    },
    yearly: {
      price: 499,
      duration: 'year',
      features: [
        '1200 Credit Points',
        '60 DAO Group Access',
        '240 Course Creations',
        '120 Book Creations',
        '60 DAO Creations',
        '60 Skill Requests'
      ],
      icon: Crown,
      color: 'accent-gold'
    }
  };

  const handleSubscribe = async () => {
    if (!user || !profile || !txId) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'subscriptions'), {
        userId: user.uid,
        userName: profile.displayName,
        amount: packages[selectedPack].price,
        packageType: selectedPack,
        paymentMethod,
        transactionId: txId,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      if (profile.subscriptionStatus !== 'active') {
        await updateDoc(doc(db, 'users', user.uid), {
          subscriptionStatus: 'pending'
        });
      }
      setShowPayment(false);
      setTxId('');
    } catch (err) {
      console.error("Subscription error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const trialExpiration = profile?.trialStartedAt ? new Date(new Date(profile.trialStartedAt).getTime() + 15 * 24 * 60 * 60 * 1000) : null;
  const isTrialActive = trialExpiration && trialExpiration > new Date();
  const daysRemaining = trialExpiration ? Math.ceil((trialExpiration.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="min-h-screen bg-bg-main pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-bg-main/80 backdrop-blur-md px-4 h-16 flex items-center justify-between border-b border-border-main">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-hover-bg rounded-xl transition-colors">
          <ArrowLeft size={20} className="text-text-main" />
        </button>
        <h1 className="text-sm font-black uppercase tracking-widest text-text-main">Subscription</h1>
        <div className="w-10" />
      </div>

      <div className="max-w-md mx-auto py-8 space-y-8">
        {/* Trial Status - Wrapped in padding */}
        <div className="px-6 space-y-6">
          {isTrialActive && !profile?.isPremium && (
            <div className="p-5 bg-primary/5 border border-primary/20 rounded-3xl space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Clock size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Free Trial Active</span>
              </div>
              <p className="text-sm font-bold text-text-main">
                  You have <span className="text-primary">{daysRemaining} days</span> remaining in your free trial.
              </p>
              <p className="text-[10px] text-text-muted font-medium leading-relaxed">
                  After the trial ends, you'll need a premium subscription to continue using all features. Upgrade now to avoid interruptions!
              </p>
            </div>
          )}

          {!isTrialActive && !profile?.isPremium && (
            <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-3xl space-y-3">
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Trial Expired</span>
              </div>
              <p className="text-sm font-bold text-text-main">
                  Your free trial has ended.
              </p>
              <p className="text-[10px] text-text-muted font-medium leading-relaxed">
                  Please subscribe to one of our professional packages to unlock all features and continue your learning journey.
              </p>
            </div>
          )}

          {/* Info Hero */}
          <div className="text-center space-y-3">
            <div className="inline-flex px-4 py-1.5 bg-accent-gold/10 text-accent-gold rounded-full border border-accent-gold/20 text-[10px] font-black uppercase tracking-[0.2em] mb-2">
              Skillora Professional
            </div>
            <h2 className="text-3xl font-black text-text-main tracking-tighter leading-none">
              Unlock Your <br /> Full Potential
            </h2>
            <p className="text-xs text-text-muted font-bold tracking-tight px-8">
              Join the elite circle of learners and teachers with our premium features.
            </p>
          </div>
        </div>

        {/* Packages Horizontal Scroll */}
        {!showPayment ? (
          <div className="space-y-8">
            <div className="flex gap-4 overflow-x-auto px-6 pb-4 no-scrollbar snap-x snap-mandatory">
              <div className="flex-shrink-0 w-[280px] snap-center">
                <PackageCard 
                  type="Monthly"
                  price={149}
                  duration="month"
                  features={packages.monthly.features}
                  isSelected={selectedPack === 'monthly'}
                  onSelect={() => setSelectedPack('monthly')}
                  icon={packages.monthly.icon}
                  color={packages.monthly.color}
                  isPlatinum={true}
                />
              </div>
              <div className="flex-shrink-0 w-[280px] snap-center">
                <PackageCard 
                  type="Yearly"
                  price={499}
                  duration="year"
                  features={packages.yearly.features}
                  isSelected={selectedPack === 'yearly'}
                  onSelect={() => setSelectedPack('yearly')}
                  icon={packages.yearly.icon}
                  color={packages.yearly.color}
                />
              </div>
            </div>

            <div className="px-6">
              <button 
                onClick={() => setShowPayment(true)}
                className={`w-full h-16 rounded-[32px] font-black text-xs uppercase tracking-widest shadow-xl transition-all ${
                    selectedPack === 'monthly' 
                      ? 'bg-slate-200 text-slate-800 shadow-slate-200/20 border-2 border-slate-300' 
                      : 'bg-primary text-bg-main shadow-primary/20'
                  }`}
              >
                Continue with {selectedPack} Pack
              </button>
            </div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="p-6 bg-theme-card border-2 border-border-main rounded-[32px] space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-text-main uppercase tracking-widest">Payment Details</h4>
                  <p className="text-[10px] text-text-muted font-bold">Plan: {selectedPack.toUpperCase()}</p>
                </div>
                <div className="text-right">
                    <p className="text-lg font-black text-primary">৳{packages[selectedPack].price}</p>
                </div>
              </div>

              <div className="p-5 bg-primary/5 rounded-2xl border border-primary/10 space-y-3 text-center">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Send Money to (Personal)</p>
                <p className="text-2xl font-black text-text-main tracking-widest">01934-264301</p>
                <div className="flex justify-center gap-4 grayscale opacity-60">
                   <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR07nOshE1_P_XyZ7_d_0Z6Hq-j_3t5S4S7nA&s" className="h-5" alt="bkash" />
                   <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-Tj_uH_Jvx6Vp0Z_Y1L5Y_L8VqR6rE_rYwA&s" className="h-5" alt="nagad" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {['bKash', 'Nagad', 'Rocket'].map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method as any)}
                      className={`py-3 rounded-2xl text-[9px] font-black border transition-all ${
                        paymentMethod === method 
                          ? 'bg-primary border-primary text-bg-main' 
                          : 'bg-bg-main border-border-main text-text-muted hover:border-primary/30'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-text-muted ml-2">Transaction ID</label>
                  <input
                    type="text"
                    value={txId}
                    onChange={(e) => setTxId(e.target.value)}
                    placeholder="Enter your TxID"
                    className="w-full h-14 bg-bg-main border-2 border-border-main rounded-2xl px-5 text-sm font-bold text-text-main focus:border-primary transition-all outline-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowPayment(false)}
                    className="flex-1 py-4 bg-hover-bg text-text-main rounded-2xl font-black text-[10px] uppercase tracking-widest"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleSubscribe}
                    disabled={submitting || !txId}
                    className="flex-[2] py-4 bg-primary text-bg-main rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
                  >
                    {submitting ? <RefreshCw className="animate-spin" size={14} /> : <><Send size={14} /> Submit</>}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* History */}
        {mySubs.length > 0 && (
          <div className="space-y-4 pt-6">
            <h5 className="text-[11px] font-black uppercase tracking-widest text-text-muted px-2">Payment History</h5>
            <div className="space-y-3">
              {mySubs.map((sub) => (
                <div key={sub.id} className="p-4 bg-hover-bg/20 rounded-[24px] border border-border-main/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bg-main flex items-center justify-center text-primary font-black text-xs border border-border-main/30">
                      {sub.paymentMethod[0]}
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-text-main">{sub.packageType.toUpperCase()} PLAN</p>
                      <p className="text-[9px] text-text-muted font-bold uppercase tracking-tighter">ID: {sub.transactionId}</p>
                    </div>
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${
                    sub.status === 'approved' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                    sub.status === 'rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                    'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  }`}>
                    {sub.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Benefits Grid */}
        <div className="space-y-4 pt-4">
            <h5 className="text-[11px] font-black uppercase tracking-widest text-text-muted text-center">Exclusive Benefits</h5>
            <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-theme-card border border-border-main rounded-2xl space-y-2">
                    <BookOpen size={16} className="text-secondary" />
                    <p className="text-[10px] font-bold text-text-main leading-tight">Advanced Library Access</p>
                </div>
                <div className="p-4 bg-theme-card border border-border-main rounded-2xl space-y-2">
                    <Users size={16} className="text-accent-blue" />
                    <p className="text-[10px] font-bold text-text-main leading-tight">Priority Group Slot</p>
                </div>
                <div className="p-4 bg-theme-card border border-border-main rounded-2xl space-y-2">
                    <ShieldCheck size={16} className="text-green-500" />
                    <p className="text-[10px] font-bold text-text-main leading-tight">Verified Badge</p>
                </div>
                <div className="p-4 bg-theme-card border border-border-main rounded-2xl space-y-2">
                    <PenTool size={16} className="text-primary" />
                    <p className="text-[10px] font-bold text-text-main leading-tight">Content Creation Tools</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
