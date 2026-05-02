import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, updateDoc, increment, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Course } from '../types';
import { Star, Play, User as UserIcon, MessageCircle, Handshake, Check, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { SkillRequestModal } from './SkillRequestModal';
import { trackInteraction } from '../lib/tracking';

interface CourseCardProps {
  course: Course;
  hideTeacher?: boolean;
}

const CourseCard = ({ course, hideTeacher = false }: CourseCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hasVisited, setHasVisited] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [hasSentRequest, setHasSentRequest] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  useEffect(() => {
    if (!user || !course?.id) return;
    const visitRef = doc(db, 'visitRecords', `${user.uid}_${course.id}`);
    getDoc(visitRef).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHasVisited(true);
        if (data.rating !== undefined) setHasRated(true);
      }
    });

    const profileRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(profileRef, (snap) => setUserProfile(snap.data()));

    // Check for existing pending request to this teacher
    const q = query(
      collection(db, 'learningRequests'),
      where('senderId', '==', user.uid),
      where('recipientId', '==', course.teacherId),
      where('status', '==', 'Pending')
    );
    const unsubRequest = onSnapshot(q, (snap) => {
      setHasSentRequest(!snap.empty);
    });

    return () => {
      unsubProfile();
      unsubRequest();
    };
  }, [user, course.id, course.teacherId]);

  const handleVisit = async (overrideLink?: string) => {
    if (!user || !userProfile || !course?.id) return;

    // Track interaction
    trackInteraction(user.uid, course.tags || []);

    if (!hasVisited && userProfile.credits < 10) {
      alert('You need at least 10 skill credits to learn this skill!');
      return;
    }
    const visitRef = doc(db, 'visitRecords', `${user.uid}_${course.id}`);
    if (!hasVisited) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { credits: increment(-10) });
    }
    await setDoc(visitRef, {
      userId: user.uid,
      courseId: course.id,
      visitedAt: new Date().toISOString(),
    });
    setHasVisited(true);
    window.open(overrideLink || course.link, '_blank');
  };

  const handleRate = async (score: number) => {
    if (!hasVisited || !user || !course?.id || isNaN(score) || hasRated) return;
    const courseRef = doc(db, 'courses', course.id);
    const visitRef = doc(db, 'visitRecords', `${user.uid}_${course.id}`);
    const currentRating = !course.rating || isNaN(course.rating) ? 0 : course.rating;
    const currentReviews = !course.reviewCount || isNaN(course.reviewCount) ? 0 : course.reviewCount;
    
    const newRating = (currentRating * currentReviews + score) / (currentReviews + 1);
    
    if (isNaN(newRating)) return;

    try {
        await updateDoc(courseRef, {
          rating: newRating,
          reviewCount: increment(1)
        });
        await updateDoc(visitRef, { rating: score });
        setHasRated(true);
        setIsRating(false);
    } catch (err) {
        console.error("Rating error:", err);
    }
  };

  const displayRating = typeof course.rating === 'number' && !isNaN(course.rating) ? course.rating : 0;

  return (
    <div className="flex flex-col bg-bg-main mb-8 border-b border-border-main last:border-0 pb-2 transition-colors">
      <div 
        className="relative aspect-video w-full cursor-pointer group overflow-hidden border-b border-border-main/20" 
        onClick={() => handleVisit()}
      >
        <img 
          src={course.thumbnail || `https://picsum.photos/seed/course-${course.id}/800/450`} 
          alt={course.title}
          className="w-full h-full object-cover bg-hover-bg transition-transform group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute bottom-3 right-3 bg-text-main/80 text-bg-main text-[10px] px-2 py-1 rounded-lg font-bold backdrop-blur-sm border border-white/10 shadow-lg">
          {hasVisited ? 'Respin' : 'Unlock'}
        </div>
      </div>

      <div className="flex gap-3 pt-4 pb-4 px-3">
        {!hideTeacher && (
            <div className="flex-shrink-0 pt-0.5 cursor-pointer" 
            onClick={() => navigate(`/user/${course.teacherId}`)}
            >
            <div className="w-10 h-10 rounded-full overflow-hidden bg-hover-bg border border-border-main/20 shadow-sm transition-colors">
                {course.teacherPhoto ? (
                <img src={course.teacherPhoto} alt={course.teacherName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted">
                    <UserIcon size={20} />
                </div>
                )}
            </div>
            </div>
        )}

        <div className="flex-grow min-w-0 pr-2">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 
              className="text-[14px] font-bold text-text-main leading-snug line-clamp-2 cursor-pointer hover:text-primary transition-colors"
              onClick={() => handleVisit()}
            >
              {course.title}
            </h3>
            <button 
              onClick={(e) => { e.stopPropagation(); handleVisit(); }}
              className="mt-0.5 p-1 text-text-muted hover:text-primary transition-colors shrink-0"
              title="Open external link"
            >
              <ExternalLink size={14} />
            </button>
          </div>
          <div className="text-[12px] text-text-muted font-medium flex flex-wrap items-center gap-x-1 gap-y-0.5 transition-colors">
            {!hideTeacher && (
                <>
                <span 
                className="hover:text-primary cursor-pointer transition-colors font-bold" 
                onClick={() => navigate(`/user/${course.teacherId}`)}
                >
                {course.teacherName}
                </span>
                <span className="text-[10px] opacity-40">•</span>
                </>
            )}
            <span>{course.reviewCount || 0} reviews</span>
            <span className="text-[10px] opacity-40">•</span>
            <span className="flex items-center gap-0.5">
              <Star size={11} fill="currentColor" className={displayRating > 0 ? 'text-accent-gold' : 'text-text-muted'} />
              <span>{displayRating.toFixed(1)}</span>
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            {!hasVisited ? (
              <>
                <button 
                  onClick={() => {
                    if (course.daoGroupLink) {
                      handleVisit(course.daoGroupLink);
                    } else {
                      setIsRequestModalOpen(true);
                    }
                  }}
                  disabled={!course.daoGroupLink && hasSentRequest}
                  className={`px-5 py-2 rounded-xl text-[10.5px] font-bold tracking-wide transition-all active:scale-95 flex items-center gap-2 shadow-sm ${
                    course.daoGroupLink 
                      ? 'bg-text-main text-bg-main hover:bg-black' 
                      : (hasSentRequest 
                          ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                          : 'bg-primary text-bg-main hover:bg-primary-dark')
                  }`}
                >
                  {!course.daoGroupLink && (hasSentRequest ? <Check size={12} /> : <MessageCircle size={12} />)}
                  {course.daoGroupLink ? 'Join DAO' : (hasSentRequest ? 'Request Sent' : 'Request for skill')}
                </button>
                <SkillRequestModal 
                  isOpen={isRequestModalOpen}
                  onClose={() => setIsRequestModalOpen(false)}
                  targetUser={{ uid: course.teacherId, displayName: course.teacherName }}
                  initialLearnerSkills={userProfile?.teachSkills || []}
                  initialTeacherSkills={[course.title, ...(course.tags || [])]}
                />
              </>
            ) : (
              <>
                {course.daoGroupLink ? (
                  <button 
                    onClick={() => window.open(course.daoGroupLink, '_blank')}
                    className="px-5 py-2 bg-text-main text-bg-main rounded-xl text-[10.5px] font-bold tracking-wide hover:bg-black transition-all active:scale-95 shadow-sm"
                  >
                    Join DAO
                  </button>
                ) : (
                  <button 
                    onClick={() => handleVisit()}
                    className="px-5 py-2 bg-hover-bg hover:bg-border-main text-text-main rounded-xl text-[10.5px] font-bold tracking-wide transition-all shadow-sm border border-border-main/50"
                  >
                    Watch again
                  </button>
                )}
                {!isRating && !hasRated && user?.uid !== course.teacherId && (
                  <button 
                    onClick={() => setIsRating(true)}
                    className="px-5 py-2 text-primary bg-primary/5 hover:bg-primary/10 rounded-xl text-[10.5px] font-bold tracking-wide transition-colors border border-primary/20"
                  >
                    Rate now
                  </button>
                )}
                {hasRated && (
                  <span className="text-[10.5px] font-bold text-text-muted bg-hover-bg px-4 py-2 rounded-xl tracking-wide border border-border-main shadow-sm transition-colors">
                    Already rated
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isRating && (
            <div className="fixed inset-0 bg-text-main/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-theme-card w-full max-w-sm rounded-[32px] p-6 border border-border-main space-y-6 shadow-2xl transition-colors"
            >
                <div className="text-center space-y-1">
                <h4 className="text-lg font-bold text-text-main tracking-tighter">Rate this resource</h4>
                <p className="text-xs text-text-muted leading-relaxed font-medium">How helpful was this link for your learning?</p>
                </div>
                <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                    <button
                        key={s}
                        onClick={() => handleRate(s)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center bg-hover-bg text-text-main hover:bg-primary hover:text-bg-main transition-all font-black text-sm border border-border-main/50"
                    >
                        {s}
                    </button>
                ))}
                </div>
                <button 
                onClick={() => setIsRating(false)}
                className="w-full py-2 text-[11px] font-bold text-text-muted hover:text-text-main transition-colors tracking-wide"
                >
                Wait, I'll rate later
                </button>
            </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CourseCard;
