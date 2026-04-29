import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc, increment, setDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Course, DAOGroup, Session } from '../types';
import { useAuth } from '../App';
import { ArrowLeft, BookOpen, GraduationCap, Layers, Shield, MessageCircle, Star, ChevronRight, MapPin, Zap, User as UserIcon, Users, Clock, Check, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CourseCard from '../components/CourseCard';
import DAOGroupCard from '../components/DAOGroupCard';
import { SkillRequestModal } from '../components/SkillRequestModal';

export default function UserViewPage() {
    const { user, credits } = useAuth();
    const { userId } = useParams<{ userId: string }>();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [courses, setCourses] = useState<Course[]>([]);
    const [daos, setDaos] = useState<DAOGroup[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [hasSentRequest, setHasSentRequest] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'courses' | 'daos' | 'experience'>('courses');
    const [joiningId, setJoiningId] = useState<string | null>(null);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [isStartingChat, setIsStartingChat] = useState(false);
    const [liveSession, setLiveSession] = useState<Session | null>(null);

    useEffect(() => {
        if (!userId) return;
        const qLive = query(collection(db, 'sessions'), where('teacherId', '==', userId), where('status', '==', 'Scheduled'));
        const unsubscribe = onSnapshot(qLive, (snap) => {
            const now = new Date();
            const live = snap.docs.find(doc => {
                const data = doc.data();
                const start = new Date(data.date);
                const [h, m] = data.time.split(':').map(Number);
                start.setHours(h, m, 0, 0);
                const dur = parseInt(data.duration) || 60;
                const end = new Date(start.getTime() + dur * 60000);
                return now >= start && now <= end;
            });
            if (live) setLiveSession({ id: live.id, ...live.data() } as Session);
            else setLiveSession(null);
        });
        return unsubscribe;
    }, [userId]);

    const handleStartChat = async () => {
        if (!user || !profile || isStartingChat) return;
        setIsStartingChat(true);
        try {
            // Generate a consistent ID for the conversation between these two users
            const participants = [user.uid, profile.uid].sort();
            const conversationId = participants.join('_');
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
                        [profile.uid]: {
                            displayName: profile.displayName || 'Guru',
                            photoURL: profile.photoURL || ''
                        }
                    },
                    unreadCount: {
                        [user.uid]: 0,
                        [profile.uid]: 0
                    },
                    updatedAt: serverTimestamp(),
                    createdAt: serverTimestamp()
                });
            }
            navigate(`/chat/${conversationId}`);
        } catch (err) {
            console.error("Error starting chat:", err);
            alert("Could not start conversation.");
        } finally {
            setIsStartingChat(false);
        }
    };

    useEffect(() => {
        if (!userId) return;

        let coursesUnsub = () => {};
        let daosUnsub = () => {};
        let sessionsUnsubT = () => {};
        let sessionsUnsubL = () => {};
        let requestsUnsub = () => {};

        const fetchUser = async () => {
            setLoading(true);
            try {
                const userSnap = await getDoc(doc(db, 'users', userId));
                if (userSnap.exists()) {
                    setProfile({ uid: userSnap.id, ...userSnap.data() } as UserProfile);
                }

                // Fetch published courses
                coursesUnsub = onSnapshot(query(collection(db, 'courses'), where('teacherId', '==', userId)), (snap) => {
                    setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
                });

                // Fetch created DAOs
                daosUnsub = onSnapshot(query(collection(db, 'daoGroups'), where('adminId', '==', userId)), (snap) => {
                    setDaos(snap.docs.map(d => ({ id: d.id, ...d.data() } as DAOGroup)));
                });

                // Fetch Public Sessions (Only Completed/Rated for portfolio)
                sessionsUnsubT = onSnapshot(query(
                    collection(db, 'sessions'), 
                    where('teacherId', '==', userId),
                    where('status', '==', 'Completed')
                ), (snap1) => {
                    const sess1 = snap1.docs.map(d => ({ id: d.id, ...d.data() } as Session));
                    setSessions(prev => {
                        const others = prev.filter(s => s.teacherId !== userId);
                        return [...sess1, ...others];
                    });
                });

                sessionsUnsubL = onSnapshot(query(
                    collection(db, 'sessions'), 
                    where('learnerId', '==', userId),
                    where('status', '==', 'Completed')
                ), (snap2) => {
                    const sess2 = snap2.docs.map(d => ({ id: d.id, ...d.data() } as Session));
                    setSessions(prev => {
                        const others = prev.filter(s => s.learnerId !== userId);
                        return [...sess2, ...others];
                    });
                });

                // Check for sent requests
                if (user) {
                    requestsUnsub = onSnapshot(query(
                        collection(db, 'learningRequests'),
                        where('senderId', '==', user.uid),
                        where('recipientId', '==', userId),
                        where('status', '==', 'Pending')
                    ), (snap) => {
                        setHasSentRequest(!snap.empty);
                    });
                }

                setLoading(false);
            } catch (err) {
                console.error("Error fetching user profile:", err);
                setLoading(false);
            }
        };

        fetchUser();
        return () => {
            coursesUnsub();
            daosUnsub();
            sessionsUnsubT();
            sessionsUnsubL();
            requestsUnsub();
        };
    }, [userId, user?.uid]);

    const handleJoinDAO = async (group: DAOGroup) => {
        if (!user || credits < group.stakedPoints || joiningId) {
            if (!user) alert("Please sign in to join!");
            else if (credits < group.stakedPoints) alert("Not enough credits to stake!");
            return;
        }
        
        setJoiningId(group.id);
        const userRef = doc(db, 'users', user.uid);
        const memberRef = doc(db, `daoGroups/${group.id}/members`, user.uid);
        const groupRef = doc(db, 'daoGroups', group.id);

        try {
            await updateDoc(userRef, { 
                credits: increment(-group.stakedPoints),
                joinedGroups: arrayUnion(group.id) 
            });
            await setDoc(memberRef, { 
                userId: user.uid, 
                displayName: user.displayName || 'Learner',
                photoURL: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.uid}`,
                pointsStaked: group.stakedPoints, 
                quizzesPassed: 0,
                joinedAt: new Date().toISOString()
            });
            await updateDoc(groupRef, { membersCount: increment(1) });
        } catch (err) {
            console.error("Join error:", err);
            alert("Failed to join DAO. Please try again.");
        } finally {
            setJoiningId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen space-y-4 px-10 text-center">
                <h2 className="text-xl font-bold text-text-main tracking-tighter">User not found</h2>
                <button onClick={() => navigate(-1)} className="px-8 py-3 bg-text-main text-white rounded-2xl font-bold text-xs tracking-wide">Go back</button>
            </div>
        );
    }

    const totalStudents = courses.reduce((acc, c) => acc + (c.reviewCount || 0), 0);
    
    // Calculate aggregate rating for the "Idea" section
    const allRatings = [...courses.map(c => c.rating || 0), ...daos.map(d => d.rating || 0)];
    const avgRating = allRatings.length > 0 ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 0;

    const getReputation = (rating: number) => {
        if (rating >= 4.5) return { label: "Visionary Elite", color: "text-accent-gold bg-accent-gold/5 border-accent-gold/20" };
        if (rating >= 4.0) return { label: "Trusted Mentor", color: "text-primary bg-primary/5 border-primary/20" };
        if (rating >= 3.5) return { label: "Rising Expert", color: "text-green-600 bg-green-50 border-green-200" };
        return { label: "Skill Seeker", color: "text-text-muted bg-hover-bg border-border-main" };
    };

    const reputation = getReputation(avgRating);

    return (
        <div className="min-h-screen bg-bg-main dark:bg-black pb-24 transition-colors">
            {/* Header */}
            <div className="bg-white dark:bg-black border-b border-border-main dark:border-border-main/50 p-4 flex items-center justify-between sticky top-0 z-50 transition-colors">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-hover-bg dark:hover:bg-hover-bg/20 transition-colors">
                    <ArrowLeft size={22} className="text-text-main dark:text-white" />
                </button>
                <h1 className="text-sm font-bold text-text-main dark:text-white tracking-tight">Member profile</h1>
                <div className="w-10" /> {/* Spacer */}
            </div>

            <div className="p-4 space-y-6">
                {/* Minimal Professional Profile Section */}
                <div className="bg-white dark:bg-card-bg rounded-[2rem] border border-border-main dark:border-border-main/50 p-6 shadow-sm shadow-black/5 dark:shadow-none transition-all">
                    <div className="flex flex-col items-center text-center">
                        <div className="relative mb-6">
                            <div className="w-24 h-24 rounded-[32px] overflow-hidden bg-hover-bg dark:bg-black border-2 border-border-main dark:border-border-main/50 shadow-lg">
                                <img 
                                    src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`} 
                                    alt={profile.displayName} 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-text-main dark:bg-white w-8 h-8 rounded-xl flex items-center justify-center text-white dark:text-black border-4 border-white dark:border-black shadow-sm transition-colors">
                                <Shield size={14} fill="currentColor" />
                            </div>
                        </div>

                        <div className="space-y-1.5 mb-6">
                            <div className="flex flex-col items-center gap-1.5">
                                <h2 className="text-xl font-bold text-text-main dark:text-white tracking-tight flex items-center gap-2">
                                    {profile.displayName}
                                    {liveSession && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500 rounded-lg text-[8px] font-bold text-white animate-pulse">
                                            <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                                            Live Teaching
                                        </div>
                                    )}
                                </h2>
                                <div className="px-1.5 py-0.5 rounded-md bg-hover-bg dark:bg-hover-bg/20 border border-border-main/50 dark:border-border-main/30 text-[10px] font-bold text-text-muted">
                                    {profile.role === 'tutor' ? 'Guru' : 'Learner'}
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-bold transition-colors ${reputation.color}`}>
                                    {reputation.label}
                                </div>
                                <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-text-muted">
                                    <MapPin size={10} className="text-primary" />
                                    {profile.location || 'Distributed Node'}
                                </div>
                                {user?.uid !== profile.uid && (
                                    <div className="mt-4 flex items-center justify-center gap-3">
                                        <button 
                                            onClick={handleStartChat}
                                            disabled={isStartingChat}
                                            className="px-4 py-2 rounded-xl text-[10px] font-bold bg-text-main dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-white/90 transition-all active:scale-[0.98] flex items-center gap-2 shadow-sm"
                                        >
                                            <MessageSquare size={14} />
                                            {isStartingChat ? 'Connecting...' : 'Message'}
                                        </button>
                                        <button 
                                            onClick={() => setIsRequestModalOpen(true)}
                                            disabled={hasSentRequest}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all active:scale-[0.98] flex items-center gap-2 shadow-sm ${
                                                hasSentRequest 
                                                ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                                                : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                                            }`}
                                        >
                                            {hasSentRequest ? (
                                                <>
                                                    <Check size={12} />
                                                    Sent
                                                </>
                                            ) : (
                                                <>
                                                    <MessageCircle size={12} />
                                                    Request
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                                <SkillRequestModal 
                                    isOpen={isRequestModalOpen}
                                    onClose={() => setIsRequestModalOpen(false)}
                                    targetUser={{ uid: profile.uid, displayName: profile.displayName }}
                                    initialLearnerSkills={profile.role === 'student' ? profile.teachSkills : []} 
                                    initialTeacherSkills={profile.teachSkills}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 w-full">
                            <div className="bg-hover-bg/50 dark:bg-hover-bg/10 rounded-2xl p-4 border border-border-main/20 dark:border-border-main/10 transition-colors">
                                <p className="text-[9px] font-bold text-text-muted mb-1">Knowledge</p>
                                <div className="flex items-center justify-center gap-1.5">
                                    <Zap size={14} className="text-accent-gold" fill="currentColor" />
                                    <span className="text-lg font-bold text-text-main dark:text-white">{profile.credits || 0}</span>
                                </div>
                            </div>
                            <div className="bg-hover-bg/50 dark:bg-hover-bg/10 rounded-2xl p-4 border border-border-main/20 dark:border-border-main/10 transition-colors">
                                <p className="text-[9px] font-bold text-text-muted mb-1">Impact</p>
                                <div className="flex items-center justify-center gap-1.5">
                                    <Users size={14} className="text-primary" fill="currentColor" />
                                    <span className="text-lg font-bold text-text-main dark:text-white">{totalStudents}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Chips */}
                <div className="flex gap-2 p-1 bg-white dark:bg-card-bg border border-border-main dark:border-border-main/50 rounded-2xl shadow-sm transition-colors">
                    <div className="flex-1 p-3 flex flex-col gap-2 border-r border-border-main/50 dark:border-border-main/30">
                        <span className="text-[9px] font-bold text-text-muted">Expertise</span>
                        <div className="flex flex-wrap gap-1">
                            {(profile.teachSkills || []).slice(0, 2).map((s, idx) => (
                                <span key={`teach-${s}-${idx}`} className="text-[9px] font-medium bg-primary/5 dark:bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/10 dark:border-primary/20">{s}</span>
                            ))}
                            {(profile.teachSkills || []).length === 0 && <span className="text-[9px] font-medium text-text-muted italic">Private</span>}
                        </div>
                    </div>
                    <div className="flex-1 p-3 flex flex-col gap-2">
                        <span className="text-[9px] font-bold text-text-muted">Learning</span>
                        <div className="flex flex-wrap gap-1">
                            {(profile.learnSkills || []).slice(0, 2).map((s, idx) => (
                                <span key={`learn-${s}-${idx}`} className="text-[9px] font-medium bg-accent-gold/5 dark:bg-accent-gold/10 text-accent-gold px-2 py-0.5 rounded border border-accent-gold/10 dark:border-accent-gold/20">{s}</span>
                            ))}
                            {(profile.learnSkills || []).length === 0 && <span className="text-[9px] font-medium text-text-muted italic">Focusing...</span>}
                        </div>
                    </div>
                </div>

                {/* Tabs Area */}
                <div className="space-y-4">
                    <div className="flex gap-2 p-1 bg-white dark:bg-card-bg border border-border-main dark:border-border-main/50 rounded-2xl shadow-sm transition-colors">
                        <button 
                            onClick={() => setActiveTab('courses')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-bold transition-all ${activeTab === 'courses' ? 'bg-text-main dark:bg-white text-white dark:text-black shadow-lg' : 'text-text-muted hover:bg-hover-bg dark:hover:bg-hover-bg/30'}`}
                        >
                            Published ({courses.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('daos')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-bold transition-all ${activeTab === 'daos' ? 'bg-text-main dark:bg-white text-white dark:text-black shadow-lg' : 'text-text-muted hover:bg-hover-bg dark:hover:bg-hover-bg/30'}`}
                        >
                            DAOs ({daos.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('experience')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-bold transition-all ${activeTab === 'experience' ? 'bg-text-main dark:bg-white text-white dark:text-black shadow-lg' : 'text-text-muted hover:bg-hover-bg dark:hover:bg-hover-bg/30'}`}
                        >
                            History ({sessions.length})
                        </button>
                    </div>

                    <div className="space-y-4 min-h-[300px]">
                        {activeTab === 'courses' ? (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {courses.length === 0 ? (
                                    <div className="py-20 text-center space-y-3 bg-white dark:bg-card-bg rounded-[2rem] border border-dashed border-border-main dark:border-border-main/30 shadow-sm transition-colors">
                                        <BookOpen size={24} className="mx-auto text-text-muted opacity-30" />
                                        <p className="text-xs font-bold text-text-muted">No published content (yet).</p>
                                    </div>
                                ) : (
                                    courses.map((course, idx) => (
                                        <CourseCard key={`${course.id}-${idx}`} course={course} hideTeacher={true} />
                                    ))
                                )}
                            </div>
                        ) : activeTab === 'daos' ? (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {daos.length === 0 ? (
                                    <div className="py-20 text-center space-y-3 bg-white dark:bg-card-bg rounded-[2rem] border border-dashed border-border-main dark:border-border-main/30 shadow-sm transition-colors">
                                        <Shield size={24} className="mx-auto text-text-muted opacity-30" />
                                        <p className="text-xs font-bold text-text-muted">No managed DAO groups.</p>
                                    </div>
                                ) : (
                                    daos.map(dao => (
                                        <DAOGroupCard 
                                            key={dao.id} 
                                            group={dao} 
                                            onJoin={handleJoinDAO}
                                            onView={(id) => navigate(`/groups?id=${id}`)}
                                            isJoining={joiningId === dao.id}
                                        />
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                                {sessions.length === 0 ? (
                                    <div className="py-20 text-center space-y-3 bg-white dark:bg-card-bg rounded-[2rem] border border-dashed border-border-main dark:border-border-main/30 shadow-sm transition-colors">
                                        <Clock size={24} className="mx-auto text-text-muted opacity-30" />
                                        <p className="text-xs font-bold text-text-muted">No ongoing or past agreements.</p>
                                    </div>
                                ) : (
                                    sessions.map((sess, idx) => {
                                        const bothRated = sess.teacherRatedAt && sess.learnerRatedAt;
                                        const isTeacher = sess.teacherId === userId;
                                        return (
                                            <div key={`${sess.id}-${idx}`} className="bg-white dark:bg-card-bg rounded-2xl border border-border-main dark:border-border-main/50 p-4 space-y-3 shadow-sm border-l-4 border-l-primary transition-all">
                                                <div className="flex items-center justify-between">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sess.status === 'Completed' ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-500' : 'bg-primary/10 text-primary'}`}>
                                                        {sess.status}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-text-muted">{sess.date}</span>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-text-main dark:text-white line-clamp-1">{sess.subject}</h4>
                                                    <p className="text-[10px] text-text-muted font-medium mb-2">
                                                        {isTeacher ? 'Expert Guru' : 'Collaborator'} • {isTeacher ? sess.learnerName : sess.teacherName}
                                                    </p>
                                                </div>
                                                
                                                {bothRated ? (
                                                    <div className="bg-hover-bg/40 dark:bg-hover-bg/10 border border-border-main/30 dark:border-border-main/20 rounded-xl p-3 space-y-2 transition-colors">
                                                        <div className="flex items-center gap-1">
                                                            {[1,2,3,4,5].map(s => (
                                                                <Star 
                                                                    key={`star-${sess.id}-${s}`} size={10} 
                                                                    className={s <= (isTeacher ? (sess.learnerRating || 0) : (sess.teacherRating || 0)) ? "text-accent-gold fill-accent-gold" : "text-border-main dark:text-border-main/50"} 
                                                                />
                                                            ))}
                                                        </div>
                                                        <p className="text-[10px] text-text-main dark:text-text-muted font-medium italic leading-relaxed">
                                                            "{isTeacher ? sess.learnerReview : sess.teacherReview}"
                                                        </p>
                                                    </div>
                                                ) : sess.status === 'Completed' && (
                                                    <div className="py-2 text-center bg-hover-bg/30 dark:bg-hover-bg/10 rounded-lg text-[9px] text-text-muted font-bold tracking-tight">
                                                        Mutual rating pending for feedback visibility
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
