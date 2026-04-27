import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDoc, updateDoc, increment, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../App';
import { DAOGroup } from '../types';
import { Shield, Users, Star, Lock, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { trackInteraction } from '../lib/tracking';

interface DAOGroupCardProps {
  group: DAOGroup;
  onJoin: (group: DAOGroup) => void;
  onView: (id: string) => void;
  isJoining: boolean;
}

const DAOGroupCard = ({ group, onJoin, onView, isJoining }: DAOGroupCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMember, setIsMember] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [hasActiveQuiz, setHasActiveQuiz] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [isStartingChat, setIsStartingChat] = useState(false);

  useEffect(() => {
    const unsubMembers = onSnapshot(collection(db, `daoGroups/${group.id}/members`), (snap) => {
        const m = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMembers(m);
        if (user && snap.docs.find(d => d.id === user.uid)) setIsMember(true);
        else setIsMember(false);
    });

    if (user) {
        const ratingRef = doc(db, `daoGroups/${group.id}/ratings`, user.uid);
        getDoc(ratingRef).then(snap => {
            if (snap.exists()) setHasRated(true);
        });
    }

    const q = query(collection(db, 'quizzes'), where('groupId', '==', group.id));
    const unsubQuiz = onSnapshot(q, (snap) => {
        const now = new Date();
        const active = snap.docs.some(d => {
            const data = d.data();
            if (!data.availableFrom || !data.availableUntil) return false;
            const start = new Date(data.availableFrom);
            const end = new Date(data.availableUntil);
            return now >= start && now <= end;
        });
        setHasActiveQuiz(active);
    });

    return () => { unsubMembers(); unsubQuiz(); };
  }, [group.id, user]);

  const handleMessageAdmin = async () => {
    if (!user || isStartingChat) return;
    setIsStartingChat(true);
    try {
        const participants = [user.uid, group.adminId].sort();
        const conversationId = participants.join('_');
        const convRef = doc(db, 'conversations', conversationId);
        const convSnap = await getDoc(convRef);

        if (!convSnap.exists()) {
            const adminSnap = await getDoc(doc(db, 'users', group.adminId));
            const adminData = adminSnap.data();

            await setDoc(convRef, {
                participants,
                participantInfo: {
                    [user.uid]: {
                        displayName: user.displayName || 'Learner',
                        photoURL: user.photoURL || ''
                    },
                    [group.adminId]: {
                        displayName: adminData?.displayName || 'Admin',
                        photoURL: adminData?.photoURL || ''
                    }
                },
                unreadCount: {
                    [user.uid]: 0,
                    [group.adminId]: 0
                },
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp()
            });
        }
        navigate(`/chat/${conversationId}`);
    } catch (err) {
        console.error("Error starting chat:", err);
        alert("Could not start conversation with admin.");
    } finally {
        setIsStartingChat(false);
    }
  };

  const submitRating = async () => {
    if (!user) return;
    try {
        const ratingRef = doc(db, `daoGroups/${group.id}/ratings`, user.uid);
        const groupRef = doc(db, 'daoGroups', group.id);
        
        const currentCount = group.ratingCount || 0;
        const currentRating = group.rating || 0;
        const newCount = currentCount + 1;
        const newRating = ((currentRating * currentCount) + ratingValue) / newCount;

        await setDoc(ratingRef, {
            rating: ratingValue,
            userId: user.uid,
            createdAt: serverTimestamp()
        });

        await updateDoc(groupRef, {
            rating: newRating,
            ratingCount: newCount
        });

        setHasRated(true);
        setIsRating(false);
    } catch (err) {
        console.error("Rating error:", err);
    }
  };

  const displayRating = typeof group.rating === 'number' && !isNaN(group.rating) ? group.rating : 0;

  return (
    <div className="bg-white border border-border-main rounded-[24px] flex flex-col p-4 mb-4 shadow-sm relative">
      {/* Cover Image */}
      <div className="relative aspect-[21/9] w-full mb-4">
        <div className="w-full h-full rounded-[18px] overflow-hidden bg-hover-bg ring-1 ring-border-main/50">
            {group.image ? (
                <img src={group.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <Users size={32} className="text-primary opacity-10" />
                </div>
            )}
            
            <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <div className="bg-black/80 backdrop-blur-none px-2.5 py-1 rounded-md font-bold border border-white/10">
                    <span className="text-[9px] font-bold text-white tracking-wide">{group.stakedPoints} pts stake</span>
                </div>
                {group.isPrivate && (
                    <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-md font-bold border border-white/10 flex items-center gap-1.5">
                        <Lock size={10} className="text-white" />
                        <span className="text-[9px] font-bold text-white tracking-wide uppercase">Private</span>
                    </div>
                )}
                {hasActiveQuiz && (
                    <div className="bg-primary px-2.5 py-1 rounded-md font-bold border border-primary-dark shadow-lg animate-pulse flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                        <span className="text-[9px] font-bold text-white tracking-wide">Quiz active</span>
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="px-1 space-y-1 mb-4 flex items-start justify-between">
        <div className="min-w-0 flex-grow">
            <h3 className="text-sm font-bold text-text-main leading-snug line-clamp-1 tracking-tight">{group.name}</h3>
            <p className="text-[11px] font-medium text-text-muted">{group.quizTopic}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-4 py-1">
            <Star size={12} fill="currentColor" className={displayRating > 0 ? "text-accent-gold" : "text-text-muted opacity-30"} />
            <span className="text-[11px] font-bold text-text-main">{displayRating.toFixed(1)}</span>
            <span className="text-[10px] font-medium text-text-muted">({group.ratingCount || 0})</span>
        </div>
      </div>

      <div className="px-1 flex items-center justify-between mb-5">
        <div className="flex -space-x-2">
            {members.slice(0, 4).map((m, idx) => (
                <div 
                  key={`card-member-${m.userId || m.id || idx}`} 
                  className="w-8 h-8 rounded-full border-2 border-white bg-hover-bg overflow-hidden ring-1 ring-border-main/10 shadow-sm cursor-pointer"
                  onClick={() => navigate(`/user/${m.userId}`)}
                >
                    <img src={m.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${m.displayName}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
            ))}
            {members.length > 4 && (
                <div className="w-8 h-8 rounded-full border-2 border-white bg-hover-bg flex items-center justify-center text-[9px] font-bold text-text-muted ring-1 ring-border-main/10 shadow-sm">
                    +{members.length - 4}
                </div>
            )}
            {members.length === 0 && (
                <div className="w-8 h-8 rounded-full border-2 border-white bg-hover-bg flex items-center justify-center ring-1 ring-border-main/10">
                    <Users size={14} className="text-text-muted opacity-40" />
                </div>
            )}
        </div>
        <div className="text-right flex flex-col items-end">
            <span className="text-sm font-bold text-text-main leading-none">{members.length} / {group.memberLimit}</span>
            <span className="text-[9px] font-medium text-text-muted tracking-wide mt-0.5">Members</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button 
            onClick={() => {
                if (user) trackInteraction(user.uid, group.tags || []);
                if (isMember || user?.uid === group.adminId) {
                  onView(group.id);
                } else if (group.isPrivate && group.adminId !== user?.uid) {
                  handleMessageAdmin();
                } else {
                  onJoin(group);
                }
            }}
            disabled={isJoining || isStartingChat}
            className={`flex-grow py-3 rounded-xl font-bold text-xs tracking-wide transition-all active:scale-[0.97] ${
                (isMember || user?.uid === group.adminId) 
                    ? 'bg-hover-bg text-text-main hover:bg-border-main border border-border-main' 
                    : (group.isPrivate && group.adminId !== user?.uid)
                        ? 'bg-text-main text-white hover:bg-black shadow-md shadow-black/10'
                        : 'bg-primary text-white hover:bg-primary-dark shadow-md disabled:opacity-50'
            }`}
        >
            {isJoining ? 'Joining...' : isStartingChat ? 'Connecting...' : (user?.uid === group.adminId) ? 'Manage DAO' : isMember ? 'View DAO' : (group.isPrivate && group.adminId !== user?.uid) ? 'Message Admin' : 'Join DAO'}
        </button>
        <button 
            disabled={!isMember || hasRated || user?.uid === group.adminId}
            onClick={() => setIsRating(true)}
            className={`p-3 rounded-xl border border-border-main transition-all shrink-0 ${
                hasRated 
                    ? 'bg-accent-gold/10 text-accent-gold border-accent-gold/20' 
                    : (!isMember || user?.uid === group.adminId)
                        ? 'bg-hover-bg text-text-muted opacity-30 grayscale cursor-not-allowed'
                        : 'bg-hover-bg text-text-muted hover:text-text-main hover:bg-border-main'
            }`}
        >
            <Star size={18} fill={hasRated ? "currentColor" : "none"} />
        </button>
      </div>

      <AnimatePresence>
        {isRating && (
            <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white w-full max-w-sm rounded-[32px] p-6 border-2 border-black space-y-6"
                >
                    <div className="text-center space-y-1">
                        <h4 className="text-lg font-bold text-text-main tracking-tighter">Rate this DAO</h4>
                        <p className="text-xs text-text-muted font-bold leading-relaxed">How is your experience with this group so far?</p>
                    </div>

                    <div className="flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map(v => (
                            <button 
                                key={v}
                                onClick={() => setRatingValue(v)}
                                className="p-1 transition-transform active:scale-95"
                            >
                                <Star 
                                    size={36} 
                                    fill={v <= ratingValue ? "currentColor" : "none"} 
                                    className={v <= ratingValue ? "text-accent-gold" : "text-hover-bg"}
                                />
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={submitRating}
                            className="flex-grow py-4 bg-primary text-white rounded-2xl font-bold text-xs tracking-wide active:scale-[0.98] transition-all"
                        >
                            Confirm rating
                        </button>
                        <button 
                            onClick={() => setIsRating(false)}
                            className="px-6 py-4 bg-hover-bg text-text-main rounded-2xl font-bold text-xs tracking-wide active:scale-[0.98] transition-all"
                        >
                            Back
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DAOGroupCard;
