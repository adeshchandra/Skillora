import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Handshake, BookOpen, Clock, Zap, MessageCircle, Send, Users } from 'lucide-react';
import { UserProfile } from '../types';
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../App';

interface SkillRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: { uid: string; displayName: string; photoURL?: string };
  initialLearnerSkills: string[];
  initialTeacherSkills: string[];
  conversationId?: string;
}

export const SkillRequestModal: React.FC<SkillRequestModalProps> = ({ 
  isOpen, 
  onClose, 
  targetUser,
  initialLearnerSkills,
  initialTeacherSkills,
  conversationId
}) => {
  const { user } = useAuth();
  const [requestType, setRequestType] = useState<'Exchange' | 'Learning'>('Exchange');
  const [learnSkill, setLearnSkill] = useState(initialTeacherSkills[0] || '');
  const [teachSkill, setTeachSkill] = useState(initialLearnerSkills[0] || '');
  const [duration, setDuration] = useState('1 week');
  const [credits, setCredits] = useState(50);
  const [contactMedia, setContactMedia] = useState('WhatsApp');
  const [contactInfo, setContactInfo] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    if (!learnSkill || !contactInfo || (requestType === 'Exchange' && !teachSkill)) {
      alert("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const timestamp = Date.now();
      const requestId = `${user.uid}_${targetUser.uid}_${timestamp}`;
      
      // Define activeConvId early
      let activeConvId = conversationId;
      if (!activeConvId) {
        // Fallback for when opened from Profile Page
        const participants = [user.uid, targetUser.uid].sort();
        activeConvId = participants.join('_');
      }

      const requestData = {
        senderId: user.uid,
        senderName: user.displayName || 'Someone',
        recipientId: targetUser.uid,
        recipientName: targetUser.displayName,
        learnSkill,
        teachSkill: requestType === 'Exchange' ? teachSkill : null,
        type: requestType,
        duration,
        credits: Number(credits),
        contactMedia,
        contactInfo,
        message,
        status: 'Pending',
        conversationId: activeConvId,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'learningRequests', requestId), requestData);

      // 1. Ensure conversation exists and send message
      let convExists = !!conversationId;
      if (!convExists) {
        const convRef = doc(db, 'conversations', activeConvId);
        const convSnap = await getDoc(convRef);
        
        if (!convSnap.exists()) {
          await setDoc(convRef, {
            participants: [user.uid, targetUser.uid].sort(),
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
            unreadCount: { [user.uid]: 0, [targetUser.uid]: 0 },
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp()
          });
        }
      }

      // Add special chat message
      const msgText = `${user.displayName} sent a ${requestType} request for "${learnSkill}".`;
      await addDoc(collection(db, `conversations/${activeConvId}/messages`), {
        conversationId: activeConvId,
        senderId: user.uid,
        text: msgText,
        skillRequestId: requestId,
        createdAt: serverTimestamp(),
      });

      // Update conversation metadata
      await updateDoc(doc(db, 'conversations', activeConvId), {
        lastMessage: {
          text: msgText,
          senderId: user.uid,
          createdAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
        [`unreadCount.${targetUser.uid}`]: increment(1)
      });

      // 2. Notify recipient (Standard Notification)
      await addDoc(collection(db, 'notifications'), {
        userId: targetUser.uid,
        type: 'match',
        message: msgText,
        relatedId: requestId,
        createdAt: serverTimestamp(),
        read: false
      });

      alert('Request sent successfully!');
      onClose();
    } catch (err) {
      console.error("Error sending request:", err);
      alert('Failed to send request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden border-2 border-black flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-border-main flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Handshake size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-main tracking-tight">Skill Request</h2>
                  <p className="text-[10px] font-bold text-text-muted tracking-wide">To: {targetUser.displayName}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 bg-hover-bg rounded-xl text-text-muted hover:text-text-main transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Type Selection */}
              <div className="flex gap-2 p-1 bg-hover-bg rounded-2xl">
                <button 
                  onClick={() => setRequestType('Exchange')}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${requestType === 'Exchange' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted'}`}
                >
                  <Handshake size={14} />
                  Skill Exchange
                </button>
                <button 
                  onClick={() => setRequestType('Learning')}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${requestType === 'Learning' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted'}`}
                >
                  <BookOpen size={14} />
                  Learning Only
                </button>
              </div>

              {/* Skills Fields */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted pl-1 uppercase tracking-widest text-primary">I want to learn</label>
                  <input 
                    value={learnSkill}
                    onChange={e => setLearnSkill(e.target.value)}
                    placeholder="e.g. Advanced Figma"
                    className="w-full bg-hover-bg border-none rounded-2xl px-4 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {initialTeacherSkills.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                       {Array.from(new Set(initialTeacherSkills)).map((s, idx) => (
                         <button key={`${s}-${idx}`} onClick={() => setLearnSkill(s)} className="text-[9px] font-bold px-2 py-1 bg-primary/5 text-primary rounded-md border border-primary/10">+{s}</button>
                       ))}
                    </div>
                  )}
                </div>

                {requestType === 'Exchange' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted pl-1 uppercase tracking-widest text-accent-gold">I can teach in return</label>
                    <input 
                      value={teachSkill}
                      onChange={e => setTeachSkill(e.target.value)}
                      placeholder="e.g. Next.js Basics"
                      className="w-full bg-hover-bg border-none rounded-2xl px-4 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-accent-gold/20"
                    />
                    {initialLearnerSkills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                         {Array.from(new Set(initialLearnerSkills)).map((s, idx) => (
                           <button key={`${s}-${idx}`} onClick={() => setTeachSkill(s)} className="text-[9px] font-bold px-2 py-1 bg-accent-gold/5 text-accent-gold rounded-md border border-accent-gold/10">+{s}</button>
                         ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Contract Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted pl-1 uppercase tracking-widest">Duration</label>
                  <div className="relative">
                    <Clock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                    <select 
                      value={duration}
                      onChange={e => setDuration(e.target.value)}
                      className="w-full bg-hover-bg border-none rounded-2xl pl-10 pr-4 py-4 text-sm font-semibold outline-none appearance-none"
                    >
                      <option>3 days</option>
                      <option>1 week</option>
                      <option>2 weeks</option>
                      <option>1 month</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted pl-1 uppercase tracking-widest">Credit Stake</label>
                  <div className="relative">
                    <Zap size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-gold" />
                    <input 
                      type="number"
                      value={credits}
                      onChange={e => setCredits(parseInt(e.target.value))}
                      className="w-full bg-hover-bg border-none rounded-2xl pl-10 pr-4 py-4 text-sm font-semibold outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted pl-1 uppercase tracking-widest">Preferred Contact Media</label>
                  <div className="flex gap-2">
                    {['WhatsApp', 'Telegram', 'Email', 'Discord'].map(media => (
                      <button 
                        key={media}
                        onClick={() => setContactMedia(media)}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-bold border transition-all ${contactMedia === media ? 'bg-text-main text-white border-text-main' : 'bg-white text-text-muted border-border-main hover:bg-hover-bg'}`}
                      >
                        {media}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted pl-1 uppercase tracking-widest">Contact Information</label>
                  <div className="relative">
                    <MessageCircle size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input 
                      value={contactInfo}
                      onChange={e => setContactInfo(e.target.value)}
                      placeholder={contactMedia === 'Email' ? 'your@email.com' : 'Your ID / Number'}
                      className="w-full bg-hover-bg border-none rounded-2xl pl-10 pr-4 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>

              {/* Message / Motivation */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted pl-1 uppercase tracking-widest">Why do you want to learn this skill?</label>
                <textarea 
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Tell the guru about your goals or why you're interested..."
                  rows={3}
                  className="w-full bg-hover-bg border-none rounded-2xl px-4 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border-main bg-gray-50 shrink-0">
              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Clock className="animate-spin" size={16} />
                ) : (
                  <>
                    <Send size={16} />
                    SEND SKILL REQUEST
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
