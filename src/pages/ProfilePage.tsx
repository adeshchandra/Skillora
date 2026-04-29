import React, { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot, updateDoc, collection, query, where, getDocs, setDoc, addDoc, serverTimestamp, orderBy, deleteDoc, writeBatch, increment } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../App';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { UserProfile, Session, LearningRequest, Course, DAOGroup, Quiz } from '../types';
import { useNavigate } from 'react-router-dom';
import { Settings, CreditCard, BookOpen, GraduationCap, MapPin, Layers, Check, X, RefreshCw, LogOut, ExternalLink, Calendar, Shield, Star, Plus, Users, User as UserIcon, Zap, MessageCircle, Clock, Video, Handshake, ChevronRight, AlertCircle, Sparkles, Save, Trash2, BookOpenCheck, Camera, Image as ImageIcon, Crop, MoreVertical, Share2, Edit, Menu, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Cropper from 'react-easy-crop';
import { Area } from 'react-easy-crop';

import { ContractModal } from '../components/ContractModal';
import Markdown from 'react-markdown';

const RatingModal = ({ isOpen, onClose, onRate, name }: { isOpen: boolean, onClose: () => void, onRate: (score: number, review: string) => void, name: string }) => {
    const [score, setScore] = useState(5);
    const [review, setReview] = useState('');

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-text-main/20 backdrop-blur-sm p-4 font-sans">
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-white dark:bg-card-bg w-full max-w-sm rounded-[32px] p-6 border border-border-main dark:border-border-main space-y-6 shadow-2xl"
                    >
                        <div className="text-center space-y-1">
                            <h4 className="text-lg font-bold text-text-main dark:text-white tracking-tighter">Rate {name}</h4>
                            <p className="text-xs text-text-muted leading-relaxed font-medium">Please provide your feedback on the contract/learning session.</p>
                        </div>
                        <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setScore(s)}
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all font-black text-sm border ${score === s ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-hover-bg dark:bg-hover-bg/10 text-text-muted border-border-main/50 hover:bg-border-main dark:hover:bg-hover-bg/20'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        <textarea 
                            value={review}
                            onChange={e => setReview(e.target.value)}
                            placeholder="Write your review here..."
                            className="w-full bg-hover-bg dark:bg-hover-bg/20 border-none dark:border dark:border-border-main/50 rounded-2xl px-4 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 dark:text-white resize-none min-h-[100px] transition-all"
                        />
                        <div className="flex gap-3">
                            <button onClick={onClose} className="flex-1 py-3 text-xs font-bold text-text-muted hover:text-text-main">Cancel</button>
                            <button 
                                onClick={() => onRate(score, review)}
                                className="flex-1 py-3 bg-primary text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
                            >
                                Submit Rating
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

const SessionCard: React.FC<{ 
    session: Session; 
    isTeacher: boolean; 
    onUpdateLink?: (link: string) => void; 
    onComplete?: () => void;
    onCancel?: () => void;
    onRate?: () => void;
}> = ({ session, isTeacher, onUpdateLink, onComplete, onCancel, onRate }) => {
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [meetingLink, setMeetingLink] = useState(session.link || '');
    const [copied, setCopied] = useState(false);
    const navigate = useNavigate();

    const handleCopy = () => {
        if (!session.link) return;
        navigator.clipboard.writeText(session.link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const currentStatus = () => {
        if (session.status === 'Completed') return 'Completed';
        if (session.status === 'Cancelled') return 'Cancelled';
        
        const now = new Date();
        const sessDate = new Date(session.date);
        const [hours, mins] = session.time.split(':').map(Number);
        const sessStartTime = new Date(sessDate.getFullYear(), sessDate.getMonth(), sessDate.getDate(), hours, mins);
        
        const durationMins = parseInt(session.duration) || 60;
        const sessEndTime = new Date(sessStartTime.getTime() + durationMins * 60000);

        if (now >= sessStartTime && now <= sessEndTime) return 'Live';
        if (session.link && now < sessStartTime) return 'Ready';
        return session.status || 'Scheduled';
    };

    const status = currentStatus();
    const otherUserId = isTeacher ? session.learnerId : session.teacherId;

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'Ready': return 'bg-blue-500 text-white border-blue-600';
            case 'Live': return 'bg-red-500 text-white border-red-600 animate-pulse';
            case 'Completed': return 'bg-gray-400 text-white border-gray-500';
            case 'Cancelled': return 'bg-red-100 text-red-600 border-red-200';
            default: return 'bg-primary text-white border-primary';
        }
    };

    const hasIRated = isTeacher ? !!session.teacherRatedAt : !!session.learnerRatedAt;
    const hasOtherRated = isTeacher ? !!session.learnerRatedAt : !!session.teacherRatedAt;
    const bothRated = !!session.teacherRatedAt && !!session.learnerRatedAt;

    return (
        <div 
            id={`session-${session.id}`}
            className={`p-4 bg-white dark:bg-card-bg border rounded-3xl relative overflow-hidden transition-all duration-500 scroll-mt-20 ${status === 'Live' ? 'border-primary ring-4 ring-primary/10 bg-primary/5 dark:bg-primary/5' : 'border-border-main dark:border-border-main/50 shadow-sm'}`}
        >
            {status === 'Live' && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-red-500 text-white text-[8px] font-black animate-pulse">
                    Live Session
                </div>
            )}
            
            <div className="flex items-start justify-between mb-4">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <div className={`px-2 py-0.5 rounded-full text-[8px] font-black border ${getStatusColor(status)}`}>
                            {status}
                        </div>
                        <span className="text-[10px] font-black text-text-muted">{session.subject}</span>
                    </div>
                    <h4 className="text-sm font-bold text-text-main line-clamp-1">{isTeacher ? 'Teaching' : 'Learning'} {session.subject}</h4>
                </div>
                <div className="flex items-center gap-2">
                <button 
                        onClick={() => navigate(`/user/${otherUserId}`)}
                        className="p-2 bg-hover-bg text-text-muted hover:text-primary transition-all rounded-xl border border-border-main/50 group"
                        title="View Profile"
                    >
                        <UserIcon size={18} className="group-hover:scale-110 transition-transform" />
                    </button>
                    <button 
                        onClick={onCancel}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-hover-bg rounded-2xl space-y-1 border border-border-main/30">
                    <p className="text-[10px] font-bold text-text-muted opacity-60">Contract Participant</p>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-white border border-border-main/50 flex items-center justify-center text-[10px] font-bold text-primary">
                            {(isTeacher ? session.learnerName : session.teacherName)?.[0]}
                        </div>
                        <p className="text-xs font-bold text-text-main truncate">{isTeacher ? session.learnerName : session.teacherName}</p>
                    </div>
                </div>
                <div className="p-3 bg-hover-bg rounded-2xl space-y-1 border border-border-main/30">
                    <p className="text-[10px] font-bold text-text-muted opacity-60">Temporal Specs</p>
                    <div className="flex items-center gap-2 text-xs font-bold text-text-main">
                        <Clock size={12} className="text-primary" />
                        <span className="truncate">{session.time} ({session.duration})</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                {status !== 'Completed' && status !== 'Cancelled' && (
                    <>
                        <div className="bg-white dark:bg-hover-bg/5 border-2 border-border-main dark:border-border-main/50 rounded-2xl overflow-hidden p-1.5 flex flex-col gap-1.5 transition-all">
                            {isTeacher ? (
                                <>
                                    {showLinkInput ? (
                                        <div className="flex gap-1.5">
                                            <input 
                                                value={meetingLink}
                                                onChange={e => setMeetingLink(e.target.value)}
                                                placeholder="Zoom/GMeet Link"
                                                className="flex-grow bg-hover-bg dark:bg-hover-bg/20 border-none dark:border dark:border-border-main/50 dark:text-white rounded-xl px-4 py-2 text-xs font-bold outline-none focus:bg-hover-bg/40 focus:ring-1 focus:ring-primary transition-all"
                                            />
                                            <button 
                                                onClick={() => { onUpdateLink?.(meetingLink); setShowLinkInput(false); }}
                                                className="px-4 py-2 bg-text-main dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-1.5">
                                            {session.link ? (
                                                <>
                                                    <button 
                                                        onClick={() => window.open(session.link, '_blank')}
                                                        className="flex-1 py-3 bg-primary text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
                                                    >
                                                        Launch Session
                                                    </button>
                                                    <button 
                                                        onClick={() => setShowLinkInput(true)}
                                                        className="px-3 bg-hover-bg text-text-muted rounded-xl hover:text-text-main transition-colors border border-border-main/50"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button 
                                                    onClick={() => setShowLinkInput(true)}
                                                    className="w-full py-3 bg-hover-bg text-text-main rounded-xl text-xs font-bold border border-dashed border-border-main active:scale-[0.98] transition-all"
                                                >
                                                    Attach Meeting Link
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex gap-1.5">
                                        {session.link && (
                                             <button 
                                                onClick={handleCopy}
                                                className="flex-1 py-2 bg-hover-bg text-text-muted rounded-xl text-[9px] font-bold flex items-center justify-center gap-1.5"
                                            >
                                                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                                {copied ? 'COPIED' : 'COPY URL'}
                                            </button>
                                        )}
                                        <button 
                                            onClick={onComplete}
                                            className="flex-1 py-2 bg-text-main text-white rounded-xl text-[10px] font-bold"
                                        >
                                            Finalize Session
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-1.5">
                                    <button 
                                        onClick={() => session.link && window.open(session.link, '_blank')}
                                        disabled={!session.link}
                                        className={`w-full py-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                            session.link 
                                            ? 'bg-primary text-white shadow-lg shadow-primary/20 active:scale-95' 
                                            : 'bg-hover-bg text-text-muted border border-border-main/30'
                                        }`}
                                    >
                                        <Video size={16} />
                                        {session.link ? 'Join Synchronous Session' : 'Waiting for Guru to add link'}
                                    </button>
                                    <div className="flex gap-1.5">
                                        {session.link && (
                                            <button 
                                                onClick={handleCopy}
                                                className="flex-1 py-2 bg-hover-bg text-text-muted rounded-xl text-[9px] font-bold flex items-center justify-center gap-1.5"
                                            >
                                                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                                COPY URL
                                            </button>
                                        )}
                                        <button 
                                            onClick={onComplete}
                                            className="flex-1 py-2 bg-text-main text-white rounded-xl text-[10px] font-bold"
                                        >
                                            Propose Completion
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
                {(status === 'Completed' || status === 'Cancelled') && (
                    <div className="space-y-3">
                         <div className={`p-3 rounded-2xl flex items-center gap-3 border ${status === 'Completed' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${status === 'Completed' ? 'bg-green-200' : 'bg-red-200'}`}>
                                {status === 'Completed' ? <Check size={18} /> : <X size={18} />}
                            </div>
                            <p className="text-[10px] font-bold">
                                {status === 'Completed' ? 'Goal reached: Learning mission successful' : 'Mission aborted: Contract terminated'}
                            </p>
                        </div>
                        
                        {!hasIRated && status === 'Completed' && (
                            <button 
                                onClick={onRate}
                                className="w-full py-3.5 bg-accent-gold text-white rounded-2xl text-xs font-bold shadow-xl shadow-accent-gold/20 active:scale-95 transition-all"
                            >
                                Leave Immutable Feedback
                            </button>
                        )}
                        
                        {bothRated && (
                             <div className="p-4 bg-hover-bg border border-border-main/50 rounded-2xl">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-bold text-text-muted">Mutual Verification</p>
                                    <div className="flex items-center gap-0.5">
                                        {[1,2,3,4,5].map(i => (
                                            <Star key={i} size={10} className={`${i <= (isTeacher ? session.learnerRating : session.teacherRating)! ? 'text-accent-gold fill-accent-gold' : 'text-border-main underline opacity-30'}`} />
                                        ))}
                                    </div>
                                </div>
                                <p className="text-[11px] font-medium text-text-main italic leading-relaxed">
                                    "{isTeacher ? session.learnerReview : session.teacherReview}"
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- DAO Edit Modal ---
const DAOEditModal = ({ group, onClose }: { group: DAOGroup; onClose: () => void }) => {
    const [name, setName] = useState(group.name);
    const [topic, setTopic] = useState(group.quizTopic);
    const [membersLimit, setMembersLimit] = useState(group.memberLimit);
    const [stakedPoints, setStakedPoints] = useState(group.stakedPoints);
    const [deadline, setDeadline] = useState(() => {
        try {
            const date = group.joinDeadline?.seconds ? new Date(group.joinDeadline.seconds * 1000) : new Date();
            return date.toISOString().slice(0, 16);
        } catch (e) {
            return new Date().toISOString().slice(0, 16);
        }
    });
    const [loading, setLoading] = useState(false);
    
    const handleSaveGroup = async () => {
        setLoading(true);
        try {
            await updateDoc(doc(db, 'daoGroups', group.id), {
                name,
                quizTopic: topic,
                memberLimit: membersLimit,
                stakedPoints,
                joinDeadline: new Date(deadline).toISOString()
            });
            onClose();
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-text-main/20 backdrop-blur-sm p-0 md:p-4">
            <motion.div 
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                className="w-full max-w-lg bg-white dark:bg-card-bg rounded-t-3xl md:rounded-3xl flex flex-col border border-border-main dark:border-border-main overflow-hidden shadow-2xl"
            >
                <div className="p-6 border-b border-border-main dark:border-border-main flex items-center justify-between bg-white dark:bg-black shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                            <Shield size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-text-main dark:text-white line-clamp-1">Edit {group.name}</h2>
                            <p className="text-[10px] font-bold text-text-muted">Update group properties</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-hover-bg dark:bg-hover-bg/20 rounded-xl text-text-muted hover:text-text-main transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-text-muted dark:text-text-muted pl-1">Group name</label>
                            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-none dark:border dark:border-border-main/50 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 dark:focus:bg-hover-bg/40 transition-all" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-text-muted dark:text-text-muted pl-1">Join deadline</label>
                            <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-none dark:border dark:border-border-main/50 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 dark:[color-scheme:dark] dark:focus:bg-hover-bg/40 transition-all" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-text-muted dark:text-text-muted pl-1">Topic</label>
                            <input value={topic} onChange={e => setTopic(e.target.value)} className="w-full bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-none dark:border dark:border-border-main/50 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 dark:focus:bg-hover-bg/40 transition-all" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-text-muted dark:text-text-muted pl-1">Member limit</label>
                                <input type="number" value={membersLimit} onChange={e => setMembersLimit(parseInt(e.target.value))} className="w-full bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-none dark:border dark:border-border-main/50 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 dark:focus:bg-hover-bg/40 transition-all" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-text-muted dark:text-text-muted pl-1">Stake points</label>
                                <input type="number" value={stakedPoints} onChange={e => setStakedPoints(parseInt(e.target.value))} className="w-full bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-none dark:border dark:border-border-main/50 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 dark:focus:bg-hover-bg/40 transition-all" />
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleSaveGroup} 
                        disabled={loading} 
                        className="w-full py-4 bg-text-main dark:bg-white text-white dark:text-black rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-black dark:hover:bg-white/90 transition-all active:scale-[0.98]"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />} 
                        Save changes
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

const RequestCard = ({ request, onAccept, onDecline, onMessage }: { request: LearningRequest, onAccept: () => void, onDecline: () => void, onMessage: () => void }) => {
    return (
        <div 
            id={`request-${request.id}`}
            className="p-4 bg-white dark:bg-card-bg border border-accent-gold/30 dark:border-accent-gold/20 rounded-3xl relative overflow-hidden bg-accent-gold/5 dark:bg-accent-gold/5 shadow-sm scroll-mt-20 hover:border-accent-gold/50 transition-all"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="px-2 py-0.5 rounded-full text-[8px] font-black bg-accent-gold text-white">
                            New Contract Proposal
                        </div>
                        <span className="text-[10px] font-black text-text-muted">{request.learnSkill}</span>
                    </div>
                    <h4 className="text-sm font-bold text-text-main line-clamp-1">{request.senderName} wants to collaborate</h4>
                </div>
                <button onClick={onMessage} className="p-2 bg-text-main text-white rounded-xl hover:bg-black transition-all shadow-md active:scale-95">
                    <MessageCircle size={18} />
                </button>
            </div>
            
            <div className="p-3 bg-white/60 dark:bg-black/40 rounded-2xl mb-4 border border-black/5 dark:border-white/10 prose-xs dark:prose-invert">
                <Markdown>{request.message}</Markdown>
            </div>

            <div className="flex gap-2">
                <button onClick={onDecline} className="flex-1 py-3 text-[11px] font-bold text-text-muted hover:text-red-500 transition-colors">
                    Decline proposal
                </button>
                <button onClick={onAccept} className="flex-2 py-3 bg-accent-gold text-white rounded-xl text-[11px] font-black shadow-lg shadow-accent-gold/20 active:scale-95 transition-all">
                    View Entire Form
                </button>
            </div>
        </div>
    );
};

export default function ProfilePage() {
  const { user, logout, credits, profile: authProfile } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(authProfile);
  const [matchingUsers, setMatchingUsers] = useState<UserProfile[]>([]);
  const [selectedDAOGroup, setSelectedDAOGroup] = useState<DAOGroup | null>(null);
  const [showDAOEdit, setShowDAOEdit] = useState(false);
  const [activeDAOMenu, setActiveDAOMenu] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showCourseEdit, setShowCourseEdit] = useState(false);
  const [activeCourseMenu, setActiveCourseMenu] = useState<string | null>(null);
  const [learnerSessions, setLearnerSessions] = useState<Session[]>([]);
  const [teacherSessions, setTeacherSessions] = useState<Session[]>([]);
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [myDAOGroups, setMyDAOGroups] = useState<DAOGroup[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [joinedGroupStats, setJoinedGroupStats] = useState<any[]>([]);
  const [teachSkill, setTeachSkill] = useState('');
  const [learnSkill, setLearnSkill] = useState('');
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<LearningRequest[]>([]);
  const [sessionTab, setSessionTab] = useState<'ongoing' | 'upcoming' | 'past'>('upcoming');

  const handleDeleteDAO = async (group: DAOGroup) => {
    if (!confirm(`Are you sure you want to delete "${group.name}"? This action cannot be undone.`)) return;
    try {
        await deleteDoc(doc(db, 'daoGroups', group.id));
        setActiveDAOMenu(null);
    } catch (err) {
        console.error("Delete DAO error:", err);
        alert("Failed to delete DAO group.");
    }
  };

  const handleShareDAO = (group: DAOGroup) => {
    const shareUrl = `${window.location.origin}/group?id=${group.id}`;
    if (navigator.share) {
        navigator.share({
            title: group.name,
            text: `Join my DAO: ${group.name} and let's achieve our goals together!`,
            url: shareUrl
        }).catch(err => console.log('Share failed', err));
    } else {
        navigator.clipboard.writeText(shareUrl);
        alert("DAO link copied to clipboard!");
    }
    setActiveDAOMenu(null);
  };

  const handleDeleteCourse = async (course: Course) => {
    if (!confirm(`Are you sure you want to delete "${course.title}"? This action cannot be undone.`)) return;
    try {
        await deleteDoc(doc(db, 'courses', course.id));
        setActiveCourseMenu(null);
    } catch (err) {
        console.error("Delete course error:", err);
        alert("Failed to delete course.");
    }
  };

  const handleShareCourse = (course: Course) => {
    const shareUrl = course.link; // The actual video/resource link
    if (navigator.share) {
        navigator.share({
            title: course.title,
            text: `Check out this course: ${course.title} by ${course.teacherName}`,
            url: shareUrl
        }).catch(err => console.log('Share failed', err));
    } else {
        navigator.clipboard.writeText(shareUrl);
        alert("Course link copied to clipboard!");
    }
  };

  const updateCourse = async () => {
    if (!selectedCourse) return;
    try {
        await updateDoc(doc(db, 'courses', selectedCourse.id), {
            title: selectedCourse.title,
            link: selectedCourse.link,
            thumbnail: selectedCourse.thumbnail,
            daoGroupLink: selectedCourse.daoGroupLink || ''
        });
        setShowCourseEdit(false);
        alert("Course updated successfully!");
    } catch (err) {
        console.error("Update course error:", err);
        alert("Failed to update course.");
    }
  };

  // Cropping State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = (croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const getCroppedImg = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    setUploading(true);
    try {
        const image = new Image();
        image.src = imageToCrop;
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");

        const size = 300; // Target resolution for profile pics
        canvas.width = size;
        canvas.height = size;

        ctx.drawImage(
            image,
            croppedAreaPixels.x,
            croppedAreaPixels.y,
            croppedAreaPixels.width,
            croppedAreaPixels.height,
            0,
            0,
            size,
            size
        );

        // Quality-based compression targeting <100KB
        let quality = 0.9;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // 100KB in base64 is approx 137,000 chars
        while (dataUrl.length > 130000 && quality > 0.1) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        
        setNewPhoto(dataUrl);
        setImageToCrop(null);
    } catch (e) {
        console.error("Crop error:", e);
        alert("Failed to crop image. Please try again.");
    } finally {
        setUploading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        setImageToCrop(reader.result as string);
    };
  };

  // Combined sessions sorted by date
  const allSessions = [...learnerSessions, ...teacherSessions].sort((a, b) => {
      const getTime = (val: any) => {
          if (!val) return 0;
          if (val.seconds) return val.seconds * 1000;
          if (val.toDate) return val.toDate().getTime();
          return new Date(val).getTime() || 0;
      };
      return getTime(b.createdAt) - getTime(a.createdAt);
  });

  // Contract Modal State
  const [showContract, setShowContract] = useState(false);
  const [selectedReq, setSelectedReq] = useState<LearningRequest | null>(null);
  const [contractDays, setContractDays] = useState(3);
  const [contractDuration, setContractDuration] = useState('60 mins');
  const [contractCredits, setContractCredits] = useState(50);
  const [contractTime, setContractTime] = useState('10:00');
  const [contractDate, setContractDate] = useState('');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedSessionForRating, setSelectedSessionForRating] = useState<Session | null>(null);

  useEffect(() => {
    if (authProfile) {
      setProfile(authProfile);
    }
  }, [authProfile]);

  // 1. Core Profile Listener
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setProfile({ uid: snap.id, ...snap.data() } as UserProfile);
      } else {
        // Auto-create profile if missing
        const userData = {
          uid: user.uid,
          email: user.email?.toLowerCase() || '',
          displayName: user.displayName || 'Learner',
          photoURL: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName || 'U'}`,
          role: 'student',
          credits: 150,
          teachSkills: [],
          learnSkills: [],
          joinedGroups: [],
          rating: 5.0,
          reviewCount: 0,
          createdAt: new Date().toISOString(),
          onboardingCompleted: true
        };
        setDoc(doc(db, 'users', user.uid), userData);
      }
    });
  }, [user]);

  // 2. Data Listeners (Sessions, Requests, Courses)
  useEffect(() => {
    if (!user) return;

    const unsubLearner = onSnapshot(query(
        collection(db, 'sessions'), 
        where('learnerId', '==', user.uid)
    ), (snap) => {
        setLearnerSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Session)));
    });

    const unsubTeacher = onSnapshot(query(
        collection(db, 'sessions'), 
        where('teacherId', '==', user.uid)
    ), (snap) => {
        setTeacherSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Session)));
    });

    const unsubCourses = onSnapshot(query(collection(db, 'courses'), where('teacherId', '==', user.uid)), (snap) => {
        setMyCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
    });

    const unsubDAORef = onSnapshot(query(collection(db, 'daoGroups'), where('adminId', '==', user.uid)), (snap) => {
        setMyDAOGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as DAOGroup)));
    });

    const unsubRequests = onSnapshot(query(
        collection(db, 'learningRequests'),
        where('recipientId', '==', user.uid)
    ), (snap) => {
        setPendingRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LearningRequest)));
    });

    return () => { 
        unsubLearner(); 
        unsubTeacher();
        unsubCourses();
        unsubDAORef();
        unsubRequests();
    };
  }, [user]);

  // 2.5 Fetch Stats for Joined Groups
  useEffect(() => {
    if (!user || !profile?.joinedGroups || profile.joinedGroups.length === 0) {
        setJoinedGroupStats([]);
        return;
    }

    const fetchStats = async () => {
        try {
            // Ensure unique group IDs to prevent duplicate keys and unnecessary fetches
            const uniqueGroupIds = Array.from(new Set(profile.joinedGroups));
            const stats = await Promise.all(uniqueGroupIds.map(async (groupId: string) => {
                // Get Group details
                const groupSnap = await getDoc(doc(db, 'daoGroups', groupId));
                if (!groupSnap.exists()) return null;
                const groupData = groupSnap.data() as DAOGroup;

                // Get User's specific score in this group
                const memberSnap = await getDoc(doc(db, 'daoGroups', groupId, 'members', user.uid));
                const memberData = memberSnap.exists() ? memberSnap.data() : { quizzesPassed: 0, latestQuizScore: 0 };

                return {
                    id: groupId,
                    name: groupData.name,
                    topic: groupData.quizTopic,
                    quizzesPassed: memberData.quizzesPassed || 0,
                    latestScore: memberData.latestQuizScore || 0,
                    totalDays: groupData.goalPeriodDays
                };
            }));
            setJoinedGroupStats(stats.filter(s => s !== null));
        } catch (err) {
            console.error("Fetch joined group stats error:", err);
        }
    };

    fetchStats();
  }, [user, profile?.joinedGroups]);

  // 3. Optimized Matching suggestions (Run discovery when skills change)
  useEffect(() => {
    if (!user || !profile) return;
    
    const discoverMatches = async () => {
        setLoadingMatches(true);
        try {
            const matches: UserProfile[] = [];
            const seenIds = new Set([user.uid]);

            // Strategy: Find people who teach what I want to learn
            if (profile.learnSkills.length > 0) {
                // array-contains-any limited to 10 elements
                const skillsBatch = profile.learnSkills.slice(0, 10);
                const q = query(
                    collection(db, 'users'), 
                    where('teachSkills', 'array-contains-any', skillsBatch)
                );
                const snap = await getDocs(q);
                snap.docs.forEach(d => {
                    const data = d.data() as UserProfile;
                    // Check privacy: hideFromSearch
                    if (!seenIds.has(d.id) && !data.privacy?.hideFromSearch && !data.privacy?.hideMastery) {
                        matches.push({ uid: d.id, ...data });
                        seenIds.add(d.id);
                    }
                });
            }

            // Fallback: Check teacher matches if we have space (Max 5 suggestions)
            if (matches.length < 5 && (profile.teachSkills?.length || 0) > 0) {
                const skillsBatch = profile.teachSkills.slice(0, 10);
                const q = query(
                    collection(db, 'users'), 
                    where('learnSkills', 'array-contains-any', skillsBatch)
                );
                const snap = await getDocs(q);
                snap.docs.forEach(d => {
                    const data = d.data() as UserProfile;
                    // Check privacy: hideFromSearch
                    if (!seenIds.has(d.id) && !data.privacy?.hideFromSearch && !data.privacy?.hideGoals) {
                        matches.push({ uid: d.id, ...data });
                        seenIds.add(d.id);
                    }
                });
            }

            setMatchingUsers(matches.slice(0, 8));
        } catch (err) {
            console.error("Match error:", err);
        } finally {
            setLoadingMatches(false);
        }
    };

    const timeout = setTimeout(discoverMatches, 1000); // Debounce
    return () => clearTimeout(timeout);
  }, [user?.uid, profile?.teachSkills, profile?.learnSkills]);

  // Handle Hash Scrolling & Actions
  useEffect(() => {
    if (!window.location.hash) return;
    const hash = window.location.hash.replace('#', '');
    const isRateAction = hash.endsWith('-rate');
    const isRequest = hash.startsWith('request-');
    const elementId = isRateAction ? hash.replace('-rate', '') : hash;
    
    // Auto-set tab if it's a request or session to ensure it's visible
    if (isRequest) {
        setSessionTab('upcoming');
    }

    // Wait for potential content loading
    const timeout = setTimeout(() => {
        const element = document.getElementById(elementId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Highlight
            element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
            setTimeout(() => element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 3000);

            // If it's a rating action, auto-open the modal
            if (isRateAction) {
                const sessionId = elementId.replace('session-', '');
                const sessionToRate = allSessions.find(s => s.id === sessionId);
                if (sessionToRate) {
                    setSelectedSessionForRating(sessionToRate);
                    setShowRatingModal(true);
                }
            }

            // If it's a request, auto-open the contract modal (entire form)
            if (isRequest) {
                const requestId = elementId.replace('request-', '');
                const reqToOpen = pendingRequests.find(r => r.id === requestId);
                if (reqToOpen) {
                    setSelectedReq(reqToOpen);
                    setShowContract(true);
                }
            }

            // Clear hash to prevent repeated opens on re-renders
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, 800);

    return () => clearTimeout(timeout);
  }, [window.location.hash, allSessions.length, pendingRequests.length]);

  const handleMatchDiscovery = async (u1: UserProfile, u2: UserProfile) => {
    if (!u1 || !u2) return;
    const participants = [u1.uid, u2.uid].sort();
    const conversationId = participants.join('_');
    
    try {
      const convRef = doc(db, 'conversations', conversationId);
      const convSnap = await getDoc(convRef);
      
      if (convSnap.exists()) {
          const data = convSnap.data();
          if (data.lastSuggestionAt) {
              const lastSuggested = data.lastSuggestionAt?.toDate ? data.lastSuggestionAt.toDate() : new Date(data.lastSuggestionAt);
              if (Date.now() - lastSuggested.getTime() < 24 * 60 * 60 * 1000) return;
          }
      }

      const batch = writeBatch(db);
      const notifA = doc(collection(db, 'notifications'));
      const notifB = doc(collection(db, 'notifications'));
      
      batch.set(notifA, {
          userId: u1.uid,
          type: 'match_suggestion',
          message: `Bingo! ${u2.displayName} is a skill match for you. Check your messages!`,
          relatedId: conversationId,
          createdAt: serverTimestamp(),
          read: false
      });
      
      batch.set(notifB, {
          userId: u2.uid,
          type: 'match_suggestion',
          message: `Bingo! ${u1.displayName} is a skill match for you. Check your messages!`,
          relatedId: conversationId,
          createdAt: serverTimestamp(),
          read: false
      });

      if (!convSnap.exists()) {
          batch.set(convRef, {
              participants,
              participantInfo: {
                  [u1.uid]: { displayName: u1.displayName, photoURL: u1.photoURL || '' },
                  [u2.uid]: { displayName: u2.displayName, photoURL: u2.photoURL || '' }
              },
              unreadCount: { [u1.uid]: 0, [u2.uid]: 0 },
              lastMessage: {
                  text: '🤖 Skill Match Found!',
                  senderId: u1.uid,
                  createdAt: serverTimestamp()
              },
              lastSuggestionAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp()
          });
      } else {
          batch.update(convRef, { 
              lastMessage: {
                  text: '🤖 Skill Match Found!',
                  senderId: u1.uid,
                  createdAt: serverTimestamp()
              },
              lastSuggestionAt: serverTimestamp(),
              updatedAt: serverTimestamp()
          });
      }

      const msgRef = doc(collection(db, `conversations/${conversationId}/messages`));
      batch.set(msgRef, {
          senderId: u1.uid, // Using current user as sender to pass rules
          text: `🤖 Skillora Match Suggestion! We both have reciprocal skills. I can teach ${u1.teachSkills.join(', ')} and want to learn ${u1.learnSkills.join(', ')}. You can teach ${u2.teachSkills.join(', ')} and want to learn ${u2.learnSkills.join(', ')}. Want to sync?`,
          isSystem: true,
          createdAt: serverTimestamp()
      });

      await batch.commit();
    } catch (err) {
      console.error("Match discovery loop error:", err);
    }
  };

  const checkReciprocalMatches = async (currUser: UserProfile, tSkills: string[], lSkills: string[]) => {
    if (lSkills.length === 0 || tSkills.length === 0) return;
    
    try {
        const q = query(
            collection(db, 'users'),
            where('teachSkills', 'array-contains-any', lSkills.slice(0, 10))
        );
        const snap = await getDocs(q);
        
        for (const d of snap.docs) {
            if (d.id === currUser.uid) continue;
            const other = d.data() as UserProfile;
            if (!other.learnSkills || !other.teachSkills) continue;

            const isReciprocal = other.learnSkills.some((s: string) => tSkills.includes(s));
            if (isReciprocal) {
                await handleMatchDiscovery(currUser, { uid: d.id, ...other } as UserProfile);
            }
        }
    } catch (err) {
        console.error("Match check failed:", err);
    }
  };

  const updateSkills = async () => {
    if (!user || (!teachSkill && !learnSkill && !newPhoto)) return;
    const userRef = doc(db, 'users', user.uid);
    const updates: any = {};
    let finalTeach = profile?.teachSkills || [];
    let finalLearn = profile?.learnSkills || [];

    if (teachSkill) {
      finalTeach = Array.from(new Set([...finalTeach, teachSkill.trim()]));
      updates.teachSkills = finalTeach;
    }
    if (learnSkill) {
      finalLearn = Array.from(new Set([...finalLearn, learnSkill.trim()]));
      updates.learnSkills = finalLearn;
    }
    if (newPhoto) {
        updates.photoURL = newPhoto;
    }
    
    try {
        await updateDoc(userRef, updates).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`));
        
        // Propagate changes if photoURL updated
        if (newPhoto) {
            const batch = writeBatch(db);
            
            try {
                // Update Courses
                const coursesQ = query(collection(db, 'courses'), where('teacherId', '==', user.uid));
                const coursesSnap = await getDocs(coursesQ);
                coursesSnap.docs.forEach(d => {
                    batch.update(doc(db, 'courses', d.id), { teacherPhoto: newPhoto });
                });
                
                // Update DAOs
                if (profile?.joinedGroups && profile.joinedGroups.length > 0) {
                    profile.joinedGroups.forEach(groupId => {
                        batch.update(doc(db, `daoGroups/${groupId}/members`, user.uid), { photoURL: newPhoto });
                    });
                }

                // Update Conversations
                const conversationsQ = query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid));
                const convSnap = await getDocs(conversationsQ);
                convSnap.docs.forEach(d => {
                    batch.update(doc(db, 'conversations', d.id), {
                        [`participantInfo.${user.uid}.photoURL`]: newPhoto
                    });
                });

                await batch.commit();
            } catch (e) {
                handleFirestoreError(e, OperationType.WRITE, 'profile-propagation');
            }
        }

        // Trigger Match Discovery
        if (teachSkill || learnSkill) {
            checkReciprocalMatches(profile!, finalTeach, finalLearn);
        }
    } catch (err) {
        console.error("Update error:", err);
    }

    setTeachSkill('');
    setLearnSkill('');
    setNewPhoto(null);
    setIsEditing(false);
  };

  const removeSkill = async (skill: string, type: 'teach' | 'learn') => {
    if (!user || !profile) return;
    const userRef = doc(db, 'users', user.uid);
    const updated = type === 'teach' 
      ? profile.teachSkills.filter(s => s !== skill)
      : profile.learnSkills.filter(s => s !== skill);
    await updateDoc(userRef, {
      [type === 'teach' ? 'teachSkills' : 'learnSkills']: updated
    });
  };

  const sendRequest = async (targetUser: UserProfile) => {
    if (!user || !profile) return;
    try {
      const participants = [user.uid, targetUser.uid].sort();
      const conversationId = participants.join('_');
      
      const requestId = `${user.uid}_${targetUser.uid}_${Date.now()}`;
      await setDoc(doc(db, 'learningRequests', requestId), {
        senderId: user.uid,
        senderName: user.displayName || 'Someone',
        recipientId: targetUser.uid,
        recipientName: targetUser.displayName || 'Learner',
        learnSkill: profile.learnSkills[0] || 'Skill',
        teachSkill: profile.teachSkills[0] || 'Knowledge',
        status: 'Pending',
        credits: 50, // Default credits
        conversationId,
        createdAt: serverTimestamp()
      });
      
      await addDoc(collection(db, 'notifications'), {
          userId: targetUser.uid,
          type: 'match',
          message: `${user.displayName} suggested a skill match! I want to learn ${profile.learnSkills[0]} and can teach ${profile.teachSkills[0]}.`,
          relatedId: requestId,
          createdAt: serverTimestamp(),
          read: false
      });

      // Show in Chat Field (Conversation)
      const convRef = doc(db, 'conversations', conversationId);
      const convSnap = await getDoc(convRef);

      if (!convSnap.exists()) {
          await setDoc(convRef, {
              participants,
              participantInfo: {
                  [user.uid]: {
                      displayName: user.displayName || 'Learner',
                      photoURL: user.photoURL || ''
                  },
                  [targetUser.uid]: {
                      displayName: targetUser.displayName || 'Guru',
                      photoURL: targetUser.photoURL || ''
                  }
              },
              unreadCount: {
                  [user.uid]: 0,
                  [targetUser.uid]: 0
              },
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp()
          });
      }

      // Add actual message bubble with link
      await addDoc(collection(db, `conversations/${conversationId}/messages`), {
          senderId: user.uid,
          text: `Skill Sync Request: I'd like to exchange ${profile.teachSkills[0]} for your ${profile.learnSkills[0]}!`,
          skillRequestId: requestId,
          createdAt: serverTimestamp()
      });

      // Navigate to chat instead of alert
      navigate(`/chat/${conversationId}`);
    } catch (err) {
      console.error(err);
      alert('Failed to send request.');
    }
  };

  const handleRequestAction = async (request: LearningRequest, action: 'Accept' | 'Decline') => {
    if (action === 'Decline') {
        await deleteDoc(doc(db, 'learningRequests', request.id));
        return;
    }
    setSelectedReq(request);
    setContractCredits(request.credits || 50);
    // Rough mapping for duration to days if needed, otherwise just keep default
    if (request.duration === '3 days') setContractDays(3);
    else if (request.duration === '1 week') setContractDays(7);
    else if (request.duration === '2 weeks') setContractDays(14);
    else if (request.duration === '1 month') setContractDays(30);
    
    setShowContract(true);
  };

  const createContract = async () => {
    if (!user || !selectedReq || !profile) return;
    const startDate = contractDate || new Date().toISOString().split('T')[0];
    const end = new Date(startDate);
    end.setDate(end.getDate() + (contractDays || 7));
    const endDate = end.toISOString().split('T')[0];

    try {
        const sessionRef = await addDoc(collection(db, 'sessions'), {
            teacherId: user.uid,
            teacherName: user.displayName,
            learnerId: selectedReq.senderId,
            learnerName: selectedReq.senderName,
            date: startDate,
            endDate: endDate,
            time: contractTime,
            duration: contractDuration,
            days: contractDays,
            subject: selectedReq.learnSkill,
            credits: contractCredits,
            status: 'Ready',
            createdAt: serverTimestamp()
        });

        // Notify learner
        await addDoc(collection(db, 'notifications'), {
            userId: selectedReq.senderId,
            type: 'contract',
            message: `${user.displayName} accepted your match and set a contract for ${selectedReq.learnSkill}!`,
            relatedId: sessionRef.id,
            createdAt: serverTimestamp(),
            read: false
        });

        await deleteDoc(doc(db, 'learningRequests', selectedReq.id));
        setShowContract(false);
        setSelectedReq(null);
    } catch (err) {
        console.error(err);
    }
  };

  const cancelSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to cancel this contract?')) return;
    await updateDoc(doc(db, 'sessions', sessionId), { status: 'Cancelled' });
  };

  const rateSession = async (session: Session, score: number, review: string) => {
    if (!user) return;
    const sessionRef = doc(db, 'sessions', session.id);
    const isTeacher = session.teacherId === user.uid;
    
    const updateData: any = isTeacher ? {
        teacherRating: score,
        teacherReview: review,
        teacherRatedAt: new Date().toISOString()
    } : {
        learnerRating: score,
        learnerReview: review,
        learnerRatedAt: new Date().toISOString()
    };

    // Auto-mark as completed if rating
    if (session.status !== 'Completed' && session.status !== 'Cancelled') {
        updateData.status = 'Completed';
    }

    await updateDoc(sessionRef, updateData);

    // Notify other party
    const recipientId = isTeacher ? session.learnerId : session.teacherId;
    await addDoc(collection(db, 'notifications'), {
        userId: recipientId,
        type: 'rating',
        message: `${user.displayName} has left a review for your mutual contract. Rate back to see the feedback!`,
        relatedId: session.id,
        createdAt: serverTimestamp(),
        read: false
    });

    // Check if both rated to update profile rating
    const updatedSessSnap = await getDoc(sessionRef);
    const updatedSess = updatedSessSnap.data() as Session;
    
    if (updatedSess.teacherRatedAt && updatedSess.learnerRatedAt) {
        // Update profile ratings of both users
        const parties = [
            { id: session.teacherId, rating: updatedSess.learnerRating },
            { id: session.learnerId, rating: updatedSess.teacherRating }
        ];

        for (const p of parties) {
            const userRef = doc(db, 'users', p.id);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const currentRating = userData.rating || 0;
                const currentCount = userData.reviewCount || 0;
                const newRating = (currentRating * currentCount + (p.rating || 0)) / (currentCount + 1);
                await updateDoc(userRef, {
                    rating: newRating,
                    reviewCount: increment(1)
                });
            }
        }
    }
    
    setShowRatingModal(false);
    setSelectedSessionForRating(null);
  };

  const updateSessionLink = async (sessionId: string, link: string) => {
    await updateDoc(doc(db, 'sessions', sessionId), { 
        link,
        status: 'Ready'
    });
  };

  const completeSession = async (sessionId: string) => {
    await updateDoc(doc(db, 'sessions', sessionId), { status: 'Completed' });
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-10">
        <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex items-center justify-center gap-2">
                <span className="text-4xl font-black tracking-tighter text-text-main">Skillora</span>
                <div className="w-3 h-3 rounded-full bg-primary animate-logo-blink" />
            </div>
            <div className="space-y-1">
                <p className="text-xs font-bold text-text-muted/40">Identity Verification</p>
            </div>
        </div>
      </div>
    );
  }

  // Calculate dynamic reputation
  const allRatings = [...myCourses.map(c => c.rating || 0), ...myDAOGroups.map(d => d.rating || 0)];
  const avgRating = allRatings.length > 0 ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 0;

  const getReputation = (rating: number) => {
      if (rating >= 4.5) return { label: "Visionary Elite", color: "text-accent-gold bg-accent-gold/5 border-accent-gold/20" };
      if (rating >= 4.0) return { label: "Trusted Mentor", color: "text-primary bg-primary/5 border-primary/20" };
      if (rating >= 3.5) return { label: "Rising Expert", color: "text-green-600 bg-green-50 border-green-200" };
      return { label: "Skill Seeker", color: "text-text-muted bg-hover-bg border-border-main" };
  };

  const reputation = getReputation(avgRating);

  return (
    <div className="min-h-screen relative">
      {/* Profile Header */}
      <div className="bg-white dark:bg-black p-4 space-y-4 border-b border-border-main dark:border-border-main/50 sticky top-0 z-10">
        <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-border-main/50 dark:border-border-main ring-2 ring-primary/5 bg-hover-bg flex items-center justify-center">
                {profile.photoURL ? (
                    <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover shadow-sm" referrerPolicy="no-referrer" />
                ) : (
                    <UserIcon size={24} className="text-text-muted" />
                )}
            </div>
            <div className="flex-grow">
                <div className="flex items-center gap-1.5">
                    <h1 className="text-xl font-bold text-text-main dark:text-white tracking-tight">{profile.displayName}</h1>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-hover-bg dark:bg-hover-bg/20 border border-border-main/50 dark:border-border-main text-[10px] font-bold text-text-muted">
                        {profile.role === 'tutor' ? 'GURU' : 'LEARNER'}
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                </div>
                <div className={`mt-1 inline-flex px-2 py-0.5 rounded-lg border text-[8px] font-bold ${reputation.color}`}>
                    {reputation.label}
                </div>
                <div className="flex items-center gap-2 text-xs text-text-muted font-bold mt-1">
                    <span className="flex items-center gap-1"><Zap size={10} className="text-accent-gold fill-accent-gold" /> {credits} credits</span>
                    <span className="w-0.5 h-0.5 rounded-full bg-border-main dark:bg-border-main" />
                    <span className="flex items-center gap-1 text-primary"><Star size={10} className="fill-primary" /> {avgRating.toFixed(1)}</span>
                </div>
            </div>
            <button onClick={() => navigate('/settings')} className="p-2 text-text-muted hover:text-text-main transition-colors">
                <Menu size={24} />
            </button>
        </div>

        <div className="flex gap-2">
            <button 
                onClick={() => setIsEditing(!isEditing)}
                className="flex-1 py-2 bg-text-main dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold active:scale-[0.98] transition-all"
            >
                Edit Profile
            </button>
            <button 
                onClick={() => { setLoadingMatches(true); setTimeout(() => setLoadingMatches(false), 800); }}
                className="px-4 py-2 bg-hover-bg dark:bg-hover-bg/20 text-text-main dark:text-white rounded-xl text-xs font-bold border border-border-main/50 dark:border-border-main"
            >
                <RefreshCw size={14} className={loadingMatches ? 'animate-spin' : ''} />
            </button>
        </div>
      </div>

      <div className="p-4 space-y-8 pb-24">
        <AnimatePresence>
            {isEditing && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4 bg-white dark:bg-black p-4 rounded-2xl border border-border-main dark:border-border-main/50"
                >
                    <div className="flex items-center gap-4 pb-2">
                        <div className="relative group">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-primary/20 bg-hover-bg">
                                <img 
                                    src={newPhoto || profile.photoURL} 
                                    className={`w-full h-full object-cover ${uploading ? 'opacity-50' : 'opacity-100'} transition-opacity`} 
                                    referrerPolicy="no-referrer" 
                                />
                            </div>
                            <label className="absolute inset-0 flex items-center justify-center cursor-pointer bg-text-main/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                                <Camera size={18} className="text-white" />
                                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                            </label>
                            {uploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white rounded-2xl">
                                    <RefreshCw size={16} className="text-primary animate-spin" />
                                </div>
                            )}
                        </div>
                        <div className="flex-grow">
                             <p className="text-[10px] font-bold text-text-main mb-1">Update avatar</p>
                             <p className="text-[9px] text-text-muted font-bold leading-tight">Recommended: Square, under 100KB. Click to upload.</p>
                        </div>
                    </div>

                    <div className="space-y-1">
                         <label className="text-xs font-bold text-text-muted ml-1">Primary Role</label>
                         <div className="flex gap-2 p-1 bg-hover-bg dark:bg-hover-bg/10 rounded-xl border border-border-main/50 dark:border-border-main/30">
                            {[
                                { id: 'student', label: 'Learner Seeker', icon: BookOpen },
                                { id: 'tutor', label: 'Knowledge Guru', icon: Sparkles }
                            ].map((r) => {
                                const isSelected = (profile.role || 'student') === r.id;
                                return (
                                    <button
                                        key={r.id}
                                        onClick={async () => {
                                            await updateDoc(doc(db, 'users', profile.uid), { role: r.id });
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-1 rounded-lg text-[10px] font-bold transition-all ${
                                            isSelected ? 'bg-white dark:bg-white text-primary dark:text-black shadow-sm ring-1 ring-primary/10' : 'text-text-muted hover:text-text-main'
                                        }`}
                                    >
                                        <r.icon size={12} />
                                        {r.label}
                                    </button>
                                );
                            })}
                         </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-accent-gold ml-1">Guru (Teach)</label>
                        <div className="relative group">
                            <input 
                              value={teachSkill} 
                              onChange={e => setTeachSkill(e.target.value)} 
                              className="w-full bg-hover-bg dark:bg-hover-bg/20 dark:text-white border border-border-main/50 dark:border-border-main/50 rounded-xl text-sm px-4 py-3 outline-none focus:ring-1 focus:ring-accent-gold transition-all" 
                              placeholder="e.g. Figma, Swift" 
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-primary ml-1">Seeker (Learn)</label>
                        <input 
                          value={learnSkill} 
                          onChange={e => setLearnSkill(e.target.value)} 
                          className="w-full bg-hover-bg dark:bg-hover-bg/20 dark:text-white border border-border-main/50 dark:border-border-main/50 rounded-xl text-sm px-4 py-3 outline-none focus:ring-1 focus:ring-primary transition-all" 
                          placeholder="e.g. Cooking, piano" 
                        />
                    </div>
                    <button onClick={updateSkills} className="w-full bg-text-main text-white py-3.5 rounded-xl font-bold text-xs active:scale-[0.98] transition-all">Save changes</button>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Skills Quick Grid */}
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-black p-4 rounded-2xl border border-border-main dark:border-border-main/50 space-y-3 shadow-sm">
                <div className="flex items-center gap-2">
                    <GraduationCap size={14} className="text-accent-gold" />
                    <h3 className="text-[10px] font-bold text-text-muted">Mastery</h3>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[40px]">
                    {(profile.teachSkills || []).map((s, idx) => (
                        <div key={`teach-${s}-${idx}`} className="bg-accent-gold/5 dark:bg-accent-gold/10 px-2 py-1 rounded-lg text-[10px] font-bold text-accent-gold border border-accent-gold/10 dark:border-accent-gold/20 flex items-center gap-1 transition-colors">
                            {s}
                            <button onClick={() => removeSkill(s, 'teach')} className="hover:text-red-500"><X size={10} /></button>
                        </div>
                    ))}
                    {(profile.teachSkills || []).length === 0 && <p className="text-[10px] text-text-muted italic">No skills listed</p>}
                </div>
            </div>
            <div className="bg-white dark:bg-black p-4 rounded-2xl border border-border-main dark:border-border-main/50 space-y-3 shadow-sm">
                <div className="flex items-center gap-2">
                    <BookOpen size={14} className="text-primary" />
                    <h3 className="text-[10px] font-bold text-text-muted">Goals</h3>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[40px]">
                    {(profile.learnSkills || []).map((s, idx) => (
                        <div key={`learn-${s}-${idx}`} className="bg-primary/5 px-2 py-1 rounded-lg text-[10px] font-bold text-primary border border-primary/10 flex items-center gap-1">
                            {s}
                            <button onClick={() => removeSkill(s, 'learn')} className="hover:text-red-500"><X size={10} /></button>
                        </div>
                    ))}
                    {(profile.learnSkills || []).length === 0 && <p className="text-[10px] text-text-muted italic">No goals listed</p>}
                </div>
            </div>
        </div>

        {/* My Courses */}
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-text-main dark:text-white flex items-center gap-2">
                <Layers size={18} className="text-text-main dark:text-white" />
                My Published Courses
            </h3>
            {myCourses.length === 0 ? (
                <div className="py-10 bg-hover-bg/30 dark:bg-hover-bg/5 border-2 border-dashed border-border-main dark:border-border-main/30 rounded-2xl text-center">
                    <p className="text-[11px] text-text-muted font-bold px-12">You haven't published any courses yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {myCourses.map((course, idx) => (
                        <div key={`my-course-${course.id}-${idx}`} className="bg-white dark:bg-card-bg rounded-2xl border border-border-main dark:border-border-main/50 overflow-hidden group/card relative shadow-sm hover:border-primary/20 transition-all">
                            <div className="aspect-video relative overflow-hidden">
                                <img src={course.thumbnail} className="w-full h-full object-cover transition-transform group-hover/card:scale-105" referrerPolicy="no-referrer" />
                                <div className="absolute top-2 right-2 bg-black px-1.5 py-0.5 rounded text-[9px] font-bold text-white flex items-center gap-1">
                                    <Star size={8} fill="currentColor" /> {course.rating?.toFixed(1) || '0.0'}
                                </div>
                            </div>
                            <div className="p-2.5 space-y-1 relative">
                                <h4 className="text-[11px] font-bold text-text-main line-clamp-1 pr-4">{course.title}</h4>
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold text-text-muted">{course.reviewCount} reviews</p>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setActiveCourseMenu(activeCourseMenu === course.id ? null : course.id); }}
                                        className="p-1 hover:bg-hover-bg rounded-lg text-text-muted transition-colors"
                                    >
                                        <MoreVertical size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Course Dropdown */}
                            <AnimatePresence>
                                {activeCourseMenu === course.id && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setActiveCourseMenu(null)} />
                                        <motion.div 
                                            initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, y: 5 }}
                                            className="absolute right-2 bottom-10 w-32 bg-white border-2 border-black rounded-xl shadow-2xl z-20 overflow-hidden"
                                        >
                                            <button 
                                                onClick={() => { setSelectedCourse(course); setShowCourseEdit(true); setActiveCourseMenu(null); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-text-main hover:bg-hover-bg transition-colors border-b border-border-main"
                                            >
                                                <Edit size={12} className="text-primary" /> Edit
                                            </button>
                                            <button 
                                                onClick={() => handleShareCourse(course)}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-text-main hover:bg-hover-bg transition-colors border-b border-border-main"
                                            >
                                                <Share2 size={12} className="text-accent-gold" /> Share
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteCourse(course)}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 size={12} /> Delete
                                            </button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* My DAOs */}
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-text-main dark:text-white flex items-center gap-2">
                <Shield size={18} className="text-primary" />
                My Created DAOs
            </h3>
            {myDAOGroups.length === 0 ? (
                <div className="py-10 bg-hover-bg/30 dark:bg-hover-bg/5 border-2 border-dashed border-border-main dark:border-border-main/30 rounded-2xl text-center">
                    <p className="text-[11px] text-text-muted font-bold px-12">You haven't initiated any DAO groups yet.</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {myDAOGroups.map((group, idx) => (
                        <div key={`my-dao-${group.id}-${idx}`} className="relative">
                            <div 
                                onClick={() => navigate(`/group?id=${group.id}`)}
                                className="p-4 bg-white dark:bg-card-bg rounded-2xl border border-border-main dark:border-border-main/50 flex items-center justify-between group cursor-pointer hover:border-primary/30 transition-all active:scale-[0.99] shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-hover-bg rounded-xl flex items-center justify-center relative overflow-hidden shrink-0 border border-border-main/50">
                                        {group.image ? (
                                            <img src={group.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                            <Users className="text-primary opacity-40" size={24} />
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-text-main">{group.name}</h4>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-text-muted tracking-tight">
                                            <span>{group.membersCount || 0} Members</span>
                                            <span className="opacity-40">•</span>
                                            <span>{group.stakedPoints} points stake</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setActiveDAOMenu(activeDAOMenu === group.id ? null : group.id); }}
                                        className="p-2 bg-hover-bg text-text-muted rounded-xl hover:text-text-main transition-all"
                                    >
                                        <MoreVertical size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Dropdown Menu */}
                            <AnimatePresence>
                                {activeDAOMenu === group.id && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setActiveDAOMenu(null)} />
                                        <motion.div 
                                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                            className="absolute right-0 top-14 w-44 bg-white dark:bg-card-bg border border-border-main dark:border-border-main rounded-2xl shadow-2xl z-20 overflow-hidden"
                                        >
                                            <button 
                                                onClick={() => { setSelectedDAOGroup(group); setShowDAOEdit(true); setActiveDAOMenu(null); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-text-main hover:bg-hover-bg transition-colors border-b border-border-main"
                                            >
                                                <Edit size={14} className="text-primary" /> Edit DAO Group
                                            </button>
                                            <button 
                                                onClick={() => handleShareDAO(group)}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-text-main hover:bg-hover-bg transition-colors border-b border-border-main"
                                            >
                                                <Share2 size={14} className="text-accent-gold" /> Share DAO Group
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteDAO(group)}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 size={14} /> Delete DAO Group
                                            </button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Sessions Section */}
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-text-main dark:text-white flex items-center gap-2">
                    <Calendar size={18} className="text-accent-gold" />
                    Protocol Sessions
                </h3>
                <div className="flex bg-hover-bg/50 dark:bg-hover-bg/10 p-1 rounded-xl border border-border-main/30 dark:border-border-main/20">
                    {(['ongoing', 'upcoming', 'past'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setSessionTab(tab)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                                sessionTab === tab 
                                ? 'bg-white dark:bg-white text-primary dark:text-black shadow-sm ring-1 ring-primary/5' 
                                : 'text-text-muted hover:text-text-main'
                            }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid gap-3">
                {(() => {
                    const filteredSessions = allSessions.filter(s => {
                        const sessDate = new Date(s.date);
                        const [h, m] = s.time.split(':').map(Number);
                        const start = new Date(sessDate.getFullYear(), sessDate.getMonth(), sessDate.getDate(), h, m);
                        const dur = parseInt(s.duration) || 60;
                        const end = new Date(start.getTime() + dur * 60000);
                        const now = new Date();
                        
                        const isLive = now >= start && now <= end && s.status !== 'Completed' && s.status !== 'Cancelled';
                        const isUpcoming = now < start && s.status !== 'Completed' && s.status !== 'Cancelled';
                        const isPast = now > end || s.status === 'Completed' || s.status === 'Cancelled';

                        if (sessionTab === 'ongoing') return isLive || s.status === 'Started';
                        if (sessionTab === 'upcoming') return isUpcoming && s.status !== 'Started';
                        if (sessionTab === 'past') return isPast;
                        return false;
                    });

                    if (filteredSessions.length === 0 && (sessionTab !== 'upcoming' || pendingRequests.length === 0)) {
                        return (
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }}
                                className="py-12 bg-hover-bg/20 dark:bg-hover-bg/5 border-2 border-dashed border-border-main/50 dark:border-border-main/30 rounded-3xl text-center space-y-3"
                            >
                                <div className="w-12 h-12 bg-white dark:bg-card-bg rounded-2xl mx-auto flex items-center justify-center text-text-muted border border-border-main/30 dark:border-border-main/20 shadow-sm">
                                    <Clock size={20} className="opacity-40" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[11px] text-text-main font-black">No {sessionTab} sessions</p>
                                    <p className="text-[10px] text-text-muted font-bold px-12">System check: No records found for this category.</p>
                                </div>
                            </motion.div>
                        );
                    }

                    return (
                        <>
                            {sessionTab === 'upcoming' && pendingRequests.map((req, idx) => (
                                <motion.div
                                    key={`req-${req.id}-${idx}`}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <RequestCard 
                                        request={req} 
                                        onAccept={() => {
                                            setSelectedReq(req);
                                            setShowContract(true);
                                        }}
                                        onDecline={() => handleRequestAction(req, 'Decline')}
                                        onMessage={() => {
                                            const parts = [user.uid, req.senderId].sort();
                                            navigate(`/chat/${parts.join('_')}`);
                                        }}
                                    />
                                </motion.div>
                            ))}
                            {filteredSessions.map((sess, idx) => (
                                <motion.div
                                    key={`${sessionTab}-${sess.id}-${idx}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: (sessionTab === 'upcoming' ? pendingRequests.length : 0 + idx) * 0.05 }}
                                >
                                    <SessionCard 
                                        session={sess} 
                                        isTeacher={sess.teacherId === user.uid}
                                        onUpdateLink={(link) => updateSessionLink(sess.id, link)}
                                        onComplete={() => completeSession(sess.id)}
                                        onCancel={() => cancelSession(sess.id)}
                                        onRate={() => {
                                            setSelectedSessionForRating(sess);
                                            setShowRatingModal(true);
                                        }}
                                    />
                                </motion.div>
                            ))}
                        </>
                    );
                })()}
            </div>
        </div>

        {/* Matches (The "Suggestion" system) */}
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-text-main dark:text-white flex items-center gap-2">
                <Sparkles size={18} className="text-accent-gold" />
                Algorithm's Matches
            </h3>
            {matchingUsers.length === 0 ? (
                <div className="py-12 bg-hover-bg dark:bg-hover-bg/5 border-2 border-dashed border-border-main dark:border-border-main/30 rounded-2xl text-center space-y-3">
                    <div className="w-12 h-12 bg-white dark:bg-card-bg rounded-full mx-auto flex items-center justify-center text-accent-gold border border-border-main/20 shadow-sm">
                        <MapPin size={24} />
                    </div>
                    <p className="text-xs text-text-muted font-bold px-12 leading-relaxed">The algorithm is looking for partners with overlapping skills. Try adding more skills to find them.</p>
                </div>
            ) : (
                <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar">
                    {matchingUsers.map(u => (
                        <div key={u.uid} className="flex-shrink-0 w-48 p-4 bg-white dark:bg-card-bg border border-border-main dark:border-border-main/50 rounded-2xl space-y-3 hover:bg-hover-bg dark:hover:bg-hover-bg/20 transition-all shadow-sm">
                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/user/${u.uid}`)}>
                                <div className="relative">
                                    <img src={u.photoURL} alt={u.displayName} className="w-11 h-11 rounded-full bg-hover-bg dark:bg-black border border-border-main/50 dark:border-border-main/30" referrerPolicy="no-referrer" />
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white dark:bg-black rounded-full flex items-center justify-center border border-border-main dark:border-border-main/50">
                                        <Zap size={10} className="text-accent-gold" />
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-text-main dark:text-white truncate">{u.displayName}</p>
                                    <p className="text-xs text-text-muted font-bold">Expert</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 bg-hover-bg dark:bg-hover-bg/20 p-2 rounded-lg border border-border-main/30 dark:border-border-main/20">
                                <div className="text-center">
                                    <p className="text-[10px] font-bold text-text-muted">Teach</p>
                                    <p className="text-[10px] font-bold text-text-main truncate">{u.teachSkills[0]}</p>
                                </div>
                                <div className="text-center border-l border-border-main/50">
                                    <p className="text-[10px] font-bold text-text-muted">Learn</p>
                                    <p className="text-[10px] font-bold text-text-main truncate">{u.learnSkills[0]}</p>
                                </div>
                            </div>
                             <button 
                                 onClick={() => sendRequest(u)}
                                 className="w-full py-2 bg-primary text-white rounded-xl text-xs font-bold transition-all hover:bg-primary-dark active:scale-[0.98] shadow-lg shadow-primary/10"
                             >
                                 Initiate Match
                             </button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Quiz Performance Section */}
        {joinedGroupStats.length > 0 && (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-text-main dark:text-white flex items-center gap-2">
                        <BookOpenCheck size={18} className="text-primary" />
                        Quiz Performance
                    </h3>
                    <span className="text-[10px] font-bold text-text-muted bg-hover-bg dark:bg-hover-bg/20 px-2 py-0.5 rounded-full">{joinedGroupStats.length} DAOs</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                    {joinedGroupStats.map((stat) => (
                        <div key={stat.id} className="p-4 bg-white dark:bg-card-bg border border-border-main dark:border-border-main/50 rounded-2xl flex items-center gap-4 hover:border-primary/20 transition-all group shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-hover-bg dark:bg-black flex flex-col items-center justify-center border border-border-main/50 dark:border-border-main/30 shrink-0">
                                <p className="text-[10px] font-bold text-primary leading-none">{stat.quizzesPassed}</p>
                                <p className="text-[7px] font-bold text-text-muted mt-0.5">Passed</p>
                            </div>
                            <div className="flex-grow min-w-0">
                                <h4 className="text-sm font-bold text-text-main dark:text-white truncate">{stat.name}</h4>
                                <p className="text-[10px] text-text-muted font-medium truncate">{stat.topic}</p>
                            </div>
                            <div className="text-right shrink-0 px-3 border-l border-border-main/50 dark:border-border-main/30">
                                <p className="text-[8px] font-bold text-text-muted mb-0.5">Latest score</p>
                                <div className="flex items-center justify-end gap-1">
                                    <div className="h-1 w-1 rounded-full bg-accent-gold" />
                                    <p className="text-sm font-bold text-text-main dark:text-white">{stat.latestScore}<span className="text-[10px] text-text-muted font-bold ml-0.5">/100</span></p>
                                </div>
                            </div>
                            <button 
                                onClick={() => navigate(`/group?id=${stat.id}`)}
                                className="p-2 text-text-muted hover:text-primary transition-colors"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* Contract Modal */}
      <AnimatePresence>
        {imageToCrop && (
            <div className="fixed inset-0 z-[110] bg-black/95 flex flex-col items-center justify-center p-4">
                <div className="relative w-full max-w-lg aspect-square bg-hover-bg rounded-2xl overflow-hidden mb-8">
                    <Cropper
                        image={imageToCrop}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                    />
                </div>
                <div className="w-full max-w-lg space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white opacity-50 block text-center">Zoom Level</label>
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-full h-1.5 bg-border-main rounded-full appearance-none cursor-pointer accent-primary"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setImageToCrop(null)}
                            className="flex-1 py-4 bg-hover-bg text-white rounded-2xl text-xs font-bold border border-border-main hover:bg-border-main transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={getCroppedImg}
                            className="flex-1 py-4 bg-primary text-white rounded-2xl text-xs font-bold hover:bg-primary-dark transition-all scale-[0.98] active:scale-95"
                        >
                            Apply Crop
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showDAOEdit && selectedDAOGroup && (
           <DAOEditModal 
                group={selectedDAOGroup} 
                onClose={() => { setShowDAOEdit(false); setSelectedDAOGroup(null); }} 
           />
        )}
        {showContract && selectedReq && (
            <ContractModal 
                isOpen={showContract}
                onClose={() => { setShowContract(false); setSelectedReq(null); }}
                selectedReq={selectedReq}
                onContractCreated={() => {
                    // Update any local state if needed
                }}
            />
        )}
        {selectedSessionForRating && (
            <RatingModal 
                isOpen={showRatingModal}
                onClose={() => { setShowRatingModal(false); setSelectedSessionForRating(null); }}
                onRate={(score, review) => rateSession(selectedSessionForRating, score, review)}
                name={selectedSessionForRating.teacherId === user.uid ? selectedSessionForRating.learnerName : selectedSessionForRating.teacherName}
            />
        )}
      </AnimatePresence>

      {/* Course Edit Modal */}
      <AnimatePresence>
        {showCourseEdit && selectedCourse && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-text-main/20 backdrop-blur-sm p-4">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} 
                    animate={{ scale: 1, opacity: 1 }} 
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-sm bg-white dark:bg-card-bg rounded-[2.5rem] p-8 space-y-6 border border-border-main dark:border-border-main relative overflow-hidden shadow-2xl"
                >
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-text-main dark:text-white tracking-tight">Edit course</h2>
                        <button onClick={() => setShowCourseEdit(false)} className="p-2 bg-hover-bg dark:bg-hover-bg/20 rounded-xl text-text-muted hover:text-text-main">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-text-muted dark:text-text-muted ml-1">Course title</label>
                            <input 
                                value={selectedCourse.title} 
                                onChange={e => setSelectedCourse({...selectedCourse, title: e.target.value})}
                                className="w-full bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-2 border-transparent dark:border dark:border-border-main/50 focus:border-primary/20 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:bg-hover-bg/40 transition-all"
                                placeholder="Enter title"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-text-muted dark:text-text-muted ml-1">Video/Resource URL</label>
                            <input 
                                value={selectedCourse.link} 
                                onChange={e => setSelectedCourse({...selectedCourse, link: e.target.value})}
                                className="w-full bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-2 border-transparent dark:border dark:border-border-main/50 focus:border-primary/20 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:bg-hover-bg/40 transition-all"
                                placeholder="e.g. YouTube link"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-text-muted dark:text-text-muted ml-1">Thumbnail URL</label>
                            <input 
                                value={selectedCourse.thumbnail} 
                                onChange={e => setSelectedCourse({...selectedCourse, thumbnail: e.target.value})}
                                className="w-full bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-2 border-transparent dark:border dark:border-border-main/50 focus:border-primary/20 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:bg-hover-bg/40 transition-all"
                                placeholder="Image URL"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-text-muted dark:text-text-muted ml-1">DAO Group Link (Optional)</label>
                            <input 
                                value={selectedCourse.daoGroupLink || ''} 
                                onChange={e => setSelectedCourse({...selectedCourse, daoGroupLink: e.target.value})}
                                className="w-full bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-2 border-transparent dark:border dark:border-border-main/50 focus:border-primary/20 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:bg-hover-bg/40 transition-all"
                                placeholder="DAO Link"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={updateCourse}
                        className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-xs shadow-xl shadow-primary/20 active:scale-[0.98] transition-all"
                    >
                        Update course
                    </button>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      <div className="h-24" />
    </div>
  );
}
