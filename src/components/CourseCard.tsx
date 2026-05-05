import React, { useEffect, useState, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc, increment, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Course } from '../types';
import { Star, Play, User as UserIcon, MessageCircle, Handshake, Check, ExternalLink, X, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { SkillRequestModal } from './SkillRequestModal';
import { trackInteraction } from '../lib/tracking';
import { parseVideoUrl } from '../lib/video-utils';
import { useVideoPlayer } from '../contexts/VideoPlayerContext';

import { analyzeUrl } from '../lib/video-utils';

interface CourseCardProps {
  course: Course;
  hideTeacher?: boolean;
}

const CourseCard = ({ course, hideTeacher = false }: CourseCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeVideoId, autoplayId, toggleVideo, registerVisible, unregisterVisible } = useVideoPlayer();
  const [hasVisited, setHasVisited] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [hasSentRequest, setHasSentRequest] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isPlaying = activeVideoId === course.id;
  const isAutoPlaying = autoplayId === course.id;
  const videoInfo = parseVideoUrl(course.link);
  const resourceInfo = analyzeUrl(course.link);

  // Intersection Observer for autoplay
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          registerVisible(course.id, entry.boundingClientRect.top);
        } else {
          unregisterVisible(course.id);
        }
      },
      { threshold: 0.6 } // Play when 60% visible
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      observer.disconnect();
      unregisterVisible(course.id);
    };
  }, [course.id, registerVisible, unregisterVisible]);

  useEffect(() => {
    if (!user || !course?.id) return;
    const visitRef = doc(db, 'visitRecords', `${user.uid}_${course.id}`);
    getDoc(visitRef).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHasVisited(true);
        if (data.rating !== undefined) setHasRated(true);
        // REMOVED: Auto-play on mount to prevent multiple videos
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
      
      await setDoc(visitRef, {
        userId: user.uid,
        courseId: course.id,
        visitedAt: new Date().toISOString(),
      });
      setHasVisited(true);
    }
    
    // Only open external link if it's a DAO link or not a video we can preview
    if (overrideLink || !videoInfo) {
      window.open(overrideLink || course.link, '_blank');
    } else {
      toggleVideo(course.id);
    }
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

  const getAutoplayUrl = () => {
    if (!videoInfo) return '';
    const base = videoInfo.embedUrl;
    if (videoInfo.type === 'youtube') {
      return `${base}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&loop=1&playlist=${base.split('/').pop()}`;
    }
    if (videoInfo.type === 'facebook') {
      return `${base}&autoplay=true&muted=true`;
    }
    return base;
  };

  return (
    <div ref={cardRef} className="flex flex-col bg-bg-main mb-2 last:border-0 transition-colors">
      <div 
        className="relative aspect-video w-full cursor-pointer group overflow-hidden" 
        onClick={() => {
          if (!hasVisited) {
            handleVisit();
          } else if (videoInfo) {
            toggleVideo(course.id);
          } else {
            handleVisit();
          }
        }}
      >
        <AnimatePresence mode="wait">
          {isPlaying && videoInfo ? (
            <motion.div 
              key="player"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={videoInfo.embedUrl + (videoInfo.type === 'youtube' ? '?autoplay=1&rel=0' : '')}
                title={course.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVideo(course.id);
                }}
                className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black transition-colors backdrop-blur-sm border border-white/20 z-20"
              >
                <X size={16} />
              </button>
            </motion.div>
          ) : (isAutoPlaying && videoInfo && !isPlaying) ? (
            <motion.div
                key="autoplay-preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black z-[5] pointer-events-none"
            >
                <iframe
                    src={getAutoplayUrl()}
                    title={course.title + " preview"}
                    className="w-full h-full scale-[1.01]"
                    allow="autoplay; encrypted-media"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </motion.div>
          ) : (
            <motion.div
              key="thumbnail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full"
            >
              <img 
                src={course.thumbnail || `https://picsum.photos/seed/course-${course.id}/800/450`} 
                alt={course.title}
                className="w-full h-full object-cover bg-hover-bg transition-transform group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              {!isPlaying && videoInfo && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-primary/80 text-bg-main flex items-center justify-center shadow-2xl backdrop-blur-sm transition-transform group-hover:scale-110 active:scale-95">
                    <Play size={28} className="ml-1" fill="currentColor" />
                  </div>
                </div>
              )}
              {resourceInfo?.isAffiliate && (
                <div className="absolute top-3 left-3 bg-blue-500 text-bg-main text-[8px] px-2 py-1 rounded-lg font-black uppercase tracking-[0.2em] shadow-lg border border-white/20 z-10">
                  Marketplace
                </div>
              )}
              <div className="absolute bottom-3 right-3 bg-text-main/80 text-bg-main text-[10px] px-2.5 py-1.5 rounded-lg font-bold backdrop-blur-sm border border-white/10 shadow-lg flex items-center gap-1.5 uppercase tracking-wider">
                {videoInfo ? (
                  <>
                    <Play size={10} fill="currentColor" className={!hasVisited ? 'text-primary' : ''} />
                    <span>{hasVisited ? 'Watch Now' : 'Unlock & Play'}</span>
                  </>
                ) : (
                  <span>{hasVisited ? 'Respin' : 'Unlock Now'}</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-3 pt-3 pb-3 px-3">
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
              onClick={() => {
                if (hasVisited && videoInfo) toggleVideo(course.id);
                else handleVisit();
              }}
            >
              {course.title}
            </h3>
            <div className="relative group/menu">
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  // Simple copy to clipboard fallack instead of menu for now, or just open link
                  navigator.clipboard.writeText(course.link);
                }}
                className="mt-0.5 p-1 text-text-muted hover:text-primary transition-colors shrink-0"
                title="Copy Link"
              >
                <MoreVertical size={16} />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-bg-main border border-border-main rounded-lg shadow-xl py-1 z-[60] opacity-0 group-hover/menu:opacity-100 pointer-events-none group-hover/menu:pointer-events-auto transition-opacity min-w-[120px]">
                <button 
                  onClick={(e) => { e.stopPropagation(); window.open(course.link, '_blank'); }}
                  className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-text-main hover:bg-hover-bg flex items-center gap-2"
                >
                  <ExternalLink size={10} />
                  Open Link
                </button>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    navigator.clipboard.writeText(window.location.origin + `/user/${course.teacherId}`);
                  }}
                  className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-text-main hover:bg-hover-bg flex items-center gap-2"
                >
                  <UserIcon size={10} />
                  View Teacher
                </button>
              </div>
            </div>
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
          {course.description && (
            <p className="mt-2 text-[12px] text-text-muted leading-snug line-clamp-2 italic pr-4">
              {course.description}
            </p>
          )}
          
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
                {!hasVisited ? (
              <>
                <button 
                  onClick={() => handleVisit()}
                  className="px-5 py-2 bg-primary text-bg-main rounded-xl text-[10.5px] font-bold tracking-wide hover:bg-primary-dark transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                >
                  <ExternalLink size={12} />
                  Visit
                </button>
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
                          : 'bg-hover-bg text-text-main hover:bg-border-main border border-border-main/50')
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
              <div className="flex items-center gap-2">
                {course.daoGroupLink ? (
                  <button 
                    onClick={() => window.open(course.daoGroupLink, '_blank')}
                    className="px-5 py-2 bg-text-main text-bg-main rounded-xl text-[10.5px] font-bold tracking-wide hover:bg-black transition-all active:scale-95 shadow-sm"
                  >
                    Join DAO
                  </button>
                ) : (
                  <button 
                    onClick={() => window.open(course.link, '_blank')}
                    className="px-5 py-2 bg-hover-bg hover:bg-border-main text-text-main rounded-xl text-[10.5px] font-bold tracking-wide transition-all shadow-sm border border-border-main/50"
                  >
                    Visit
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
              </div>
            )}
            </div>

            {course.price ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 rounded-xl border border-green-500/20">
                    <span className="text-[11px] font-black text-green-600">TK {course.price}</span>
                </div>
            ) : null}
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
