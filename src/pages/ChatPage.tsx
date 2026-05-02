import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, doc, addDoc, serverTimestamp, updateDoc, increment, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { useAuth } from '../contexts/AuthContext';
import { ChatMessage, ChatConversation } from '../types';
import { ArrowLeft, Send, User as UserIcon, Plus, Smile, Image as ImageIcon, Handshake, Zap, Clock, MessageCircle, Shield, Edit, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { SkillRequestModal } from '../components/SkillRequestModal';
import { LearningRequest } from '../types';
import { useLocation } from 'react-router-dom';
import { ContractModal } from '../components/ContractModal';
import { enableIndexedDbPersistence } from 'firebase/firestore';

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Max resolution to stay under budget
                const MAX_DIM = 1000;
                if (width > height && width > MAX_DIM) {
                    height *= MAX_DIM / width;
                    width = MAX_DIM;
                } else if (height > MAX_DIM) {
                    width *= MAX_DIM / height;
                    height = MAX_DIM;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                // Start with high quality and dial down until < 80KB
                let quality = 0.8;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                
                // 80KB in base64 is approx 106,666 chars
                while (dataUrl.length > 100000 && quality > 0.1) {
                    quality -= 0.1;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }
                resolve(dataUrl);
            };
        };
        reader.onerror = reject;
    });
};

const PersistenceAgreement = ({ onAgree }: { onAgree: () => void }) => (
    <div className="fixed inset-0 z-[200] bg-text-main/20 backdrop-blur-sm flex items-center justify-center p-6">
        <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-theme-card rounded-[32px] p-8 max-w-sm w-full text-center space-y-6 border border-border-main shadow-2xl transition-colors"
        >
            <div className="w-16 h-16 bg-primary/10 rounded-2xl mx-auto flex items-center justify-center text-primary">
                <Shield size={32} />
            </div>
            <div className="space-y-2">
                <h3 className="text-xl font-bold text-text-main">Enable Local Sync</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                    Would you like to save chat data on your phone? This enables offline access and faster loading.
                </p>
            </div>
            <div className="flex flex-col gap-3 pt-2">
                <button 
                    onClick={onAgree}
                    className="w-full py-4 bg-primary text-bg-main rounded-2xl font-bold text-xs shadow-lg shadow-primary/20 active:scale-95 transition-all"
                >
                    I agree, Sync to my device
                </button>
                <button 
                    onClick={() => onAgree()} 
                    className="w-full py-4 bg-hover-bg text-text-muted rounded-2xl font-bold text-xs"
                >
                    Maybe later
                </button>
            </div>
        </motion.div>
    </div>
);

import Markdown from 'react-markdown';

const SkillRequestBubble = ({ requestId, isMe, onOpenNegotiation }: { requestId: string, isMe: boolean, onOpenNegotiation: (req: LearningRequest) => void }) => {
    const { user } = useAuth();
    const [request, setRequest] = useState<LearningRequest | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRequest = async () => {
            const path = `learningRequests/${requestId}`;
            try {
                const snap = await getDoc(doc(db, 'learningRequests', requestId));
                if (snap.exists()) {
                    setRequest({ id: snap.id, ...snap.data() } as LearningRequest);
                }
            } catch (err) {
                console.error("Error fetching request for bubble:", err);
                handleFirestoreError(err, OperationType.GET, path);
            } finally {
                setLoading(false);
            }
        };
        fetchRequest();
    }, [requestId]);

    if (loading) return <div className="p-4 bg-hover-bg animate-pulse rounded-2xl w-full">Loading request...</div>;
    if (!request) return <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl text-xs border border-red-500/20">Request not found</div>;

    const isRecipient = request.recipientId === user?.uid;

    return (
        <div className={`w-full max-w-[280px] rounded-[24px] overflow-hidden border border-border-main/50 bg-theme-card shadow-xl transition-colors ${isMe ? 'ml-auto' : ''}`}>
            <div className="p-4 bg-primary/5 border-b border-primary/10 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary transition-colors">
                        <Handshake size={16} />
                    </div>
                    <span className="text-[10px] font-black text-primary transition-colors">Skill Request</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[8px] font-black ${
                    request.status === 'Accepted' ? 'bg-green-500 text-bg-main' : 
                    request.status === 'Declined' ? 'bg-red-500 text-bg-main' : 'bg-accent-gold text-bg-main'
                }`}>
                    {request.status}
                </span>
            </div>
            
            <div className="p-4 space-y-3">
                <div className="space-y-1">
                    <p className="text-[9px] font-bold text-text-muted">Learn</p>
                    <p className="text-xs font-bold text-text-main leading-tight transition-colors">{request.learnSkill}</p>
                </div>

                {request.teachSkill && (
                    <div className="space-y-1">
                        <p className="text-[9px] font-bold text-text-muted">Teach</p>
                        <p className="text-xs font-bold text-text-main leading-tight transition-colors">{request.teachSkill}</p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border-main/10 mt-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted">
                        <Clock size={12} className="text-primary" />
                        {request.duration}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted">
                        <Zap size={12} className="text-accent-gold" />
                        {request.credits} pts
                    </div>
                </div>

                {request.message && (
                    <div className="p-3 bg-hover-bg/30 rounded-xl prose-xs transition-colors">
                        <Markdown>{request.message}</Markdown>
                    </div>
                )}

                {!isMe && request.status === 'Pending' && (
                    <button 
                        onClick={() => onOpenNegotiation(request)}
                        className="w-full py-2 bg-primary text-bg-main rounded-xl text-[10px] font-bold hover:bg-primary-dark transition-all shadow-md shadow-primary/10 border border-primary active:scale-95"
                    >
                        Negotiate Contract
                    </button>
                )}
            </div>
        </div>
    );
};

export default function ChatPage() {
    const { conversationId } = useParams<{ conversationId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [conversation, setConversation] = useState<ChatConversation | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [showContract, setShowContract] = useState(false);
    const [selectedReq, setSelectedReq] = useState<LearningRequest | null>(null);
    const [showAgreement, setShowAgreement] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const agreed = localStorage.getItem('storage_agreed');
        if (!agreed) {
            setShowAgreement(true);
        } else if (agreed === 'true') {
            enablePersistence();
        }
    }, []);

    const enablePersistence = async () => {
        try {
            await enableIndexedDbPersistence(db);
        } catch (err: any) {
            if (err.code === 'failed-precondition') {
                console.log("Persistence failed: Multiple tabs open");
            } else if (err.code === 'unimplemented') {
                console.log("Persistence failed: Browser not supported");
            }
        }
    };

    const handleAgree = () => {
        localStorage.setItem('storage_agreed', 'true');
        setShowAgreement(false);
        enablePersistence();
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user || !conversationId) return;

        setIsUploading(true);
        try {
            const compressed = await compressImage(file);
            const messagesRef = collection(db, `conversations/${conversationId}/messages`);
            const convRef = doc(db, 'conversations', conversationId);

            await addDoc(messagesRef, {
                conversationId,
                senderId: user.uid,
                image: compressed,
                createdAt: serverTimestamp(),
            });

            const otherId = conversation?.participants.find(p => p !== user.uid);
            if (otherId) {
                await updateDoc(convRef, {
                    lastMessage: {
                        text: '📷 Image',
                        senderId: user.uid,
                        createdAt: serverTimestamp(),
                    },
                    updatedAt: serverTimestamp(),
                    [`unreadCount.${otherId}`]: increment(1)
                });
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert("Failed to upload image.");
        } finally {
            setIsUploading(false);
        }
    };

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const openRequest = queryParams.get('openRequest');
        if (openRequest) {
            const fetchReq = async () => {
                const snap = await getDoc(doc(db, 'learningRequests', openRequest));
                if (snap.exists()) {
                    setSelectedReq({ id: snap.id, ...snap.data() } as LearningRequest);
                    setShowContract(true);
                }
            };
            fetchReq();
        }
    }, [location.search]);

    useEffect(() => {
        if (location.state?.initialMessage) {
            setNewMessage(location.state.initialMessage);
            // Clear state so it doesn't reappear
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    useEffect(() => {
        if (!conversationId || !user) return;

        // Fetch conversation info
        const unsubConv = onSnapshot(doc(db, 'conversations', conversationId), (snap) => {
            if (snap.exists()) {
                setConversation({ id: snap.id, ...snap.data() } as ChatConversation);
            }
        });

        // Mark as read when entering
        const markAsRead = async () => {
            const convRef = doc(db, 'conversations', conversationId);
            await updateDoc(convRef, {
                [`unreadCount.${user.uid}`]: 0
            });
        };
        markAsRead();

        // Fetch messages
        const q = query(
            collection(db, `conversations/${conversationId}/messages`),
            orderBy('createdAt', 'asc')
        );

        const unsubMsgs = onSnapshot(q, (snap) => {
            const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
            setMessages(msgs);
            setLoading(false);
            
            // Auto scroll to bottom
            setTimeout(() => {
                scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }, (err) => {
            handleFirestoreError(err, OperationType.LIST, `conversations/${conversationId}/messages`);
        });

        return () => {
            unsubConv();
            unsubMsgs();
        };
    }, [conversationId, user]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user || !conversationId || !conversation) return;

        const text = newMessage.trim();
        setNewMessage('');

        try {
            const messagesRef = collection(db, `conversations/${conversationId}/messages`);
            const convRef = doc(db, 'conversations', conversationId);

            // Add message
            await addDoc(messagesRef, {
                conversationId,
                senderId: user.uid,
                text,
                createdAt: serverTimestamp(),
            });

            // Update conversation metadata
            const otherId = conversation.participants.find(p => p !== user.uid);
            if (otherId) {
                await updateDoc(convRef, {
                    lastMessage: {
                        text,
                        senderId: user.uid,
                        createdAt: serverTimestamp(),
                    },
                    updatedAt: serverTimestamp(),
                    [`unreadCount.${otherId}`]: increment(1)
                });
            }
        } catch (err) {
            console.error("Send error:", err);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-bg-main transition-colors">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const otherId = conversation?.participants.find(p => p !== user?.uid);
    const otherInfo = otherId ? conversation?.participantInfo[otherId] : null;

    return (
        <div className="flex flex-col h-[100dvh] bg-bg-main overflow-hidden fixed inset-0 transition-colors">
            {showAgreement && <PersistenceAgreement onAgree={handleAgree} />}
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageUpload} 
            />

            {/* Header */}
            <div className="h-14 bg-bg-main border-b border-border-main flex items-center px-4 shrink-0 transition-all sticky top-0 z-40 transition-colors">
                <button onClick={() => navigate('/messages')} className="p-2 -ml-2 rounded-xl hover:bg-hover-bg transition-colors mr-2">
                    <ArrowLeft size={20} className="text-text-main" />
                </button>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-hover-bg border border-border-main/50 cursor-pointer shadow-sm transition-colors" onClick={() => otherId && navigate(`/user/${otherId}`)}>
                        {otherInfo?.photoURL ? (
                            <img src={otherInfo.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-text-muted">
                                <UserIcon size={16} />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 cursor-pointer" onClick={() => otherId && navigate(`/user/${otherId}`)}>
                        <h2 className="text-sm font-bold text-text-main truncate tracking-tight transition-colors">{otherInfo?.displayName}</h2>
                        <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[9px] font-bold text-text-muted">Active Now</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 transition-colors bg-bg-main">
                <div className="py-8 text-center">
                    <div className="w-12 h-12 bg-theme-card rounded-2xl mx-auto flex items-center justify-center border border-border-main/50 mb-3 shadow-sm transition-colors">
                        <UserIcon className="text-text-muted" size={20} />
                    </div>
                    <h3 className="text-xs font-bold text-text-main leading-none transition-colors">Conversation with {otherInfo?.displayName}</h3>
                    <p className="text-[9px] text-text-muted font-medium mt-1">Secure Skill Sync Channel</p>
                </div>

                {messages.map((msg, i) => {
                    const isMe = msg.senderId === user?.uid;
                    const showTime = i === 0 || (msg.createdAt && messages[i-1].createdAt && 
                        msg.createdAt.seconds - messages[i-1].createdAt.seconds > 300);

                        return (
                            <div key={`${msg.id}-${i}`} className="space-y-1">
                                {showTime && msg.createdAt && (
                                    <div className="text-center py-2">
                                        <span className="text-[8px] font-black text-text-muted px-2 py-0.5 bg-hover-bg rounded transition-colors">
                                            {format(msg.createdAt.toDate(), 'h:mm a')}
                                        </span>
                                    </div>
                                )}
                                <div className={`flex ${msg.isSystem ? 'justify-center w-full' : (isMe ? 'justify-end' : 'justify-start')}`}>
                                        {msg.isSystem ? (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="w-full max-w-[280px] my-2"
                                            >
                                                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 text-center space-y-2 relative overflow-hidden transition-all">
                                                    <div className="absolute -right-2 -top-2 opacity-10">
                                                        <Sparkles size={48} className="text-primaryRotate" />
                                                    </div>
                                                    <div className="flex justify-center">
                                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary transition-colors">
                                                            <Sparkles size={16} />
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] font-medium text-text-main leading-relaxed transition-colors">
                                                        {msg.text}
                                                    </p>
                                                    <div className="h-[1px] w-8 bg-primary/20 mx-auto" />
                                                    <p className="text-[8px] font-black text-primary uppercase tracking-widest">Verified Skillora Suggestion</p>
                                                </div>
                                            </motion.div>
                                        ) : msg.skillRequestId ? (
                                            <SkillRequestBubble 
                                                requestId={msg.skillRequestId} 
                                                isMe={isMe} 
                                                onOpenNegotiation={(req) => {
                                                    setSelectedReq(req);
                                                    setShowContract(true);
                                                }}
                                            />
                                        ) : (
                                            <motion.div 
                                                initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                className={`max-w-[85%] ${msg.image ? 'p-1' : 'px-4 py-2.5'} rounded-[24px] text-sm font-medium shadow-sm transition-all ${
                                                    isMe 
                                                    ? 'bg-primary text-bg-main rounded-br-none' 
                                                    : 'bg-theme-card text-text-main border border-border-main/50 rounded-bl-none'
                                                }`}
                                            >
                                                {msg.image ? (
                                                    <img src={msg.image} alt="Sent" className="rounded-[20px] max-w-full h-auto" />
                                                ) : (
                                                    msg.text
                                                )}
                                            </motion.div>
                                        )}
                                </div>
                            </div>
                        );
                })}
                <div ref={scrollRef} className="h-2" />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-bg-main border-t border-border-main shrink-0 relative z-30 transition-colors">
                {isUploading && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-primary/20 animate-pulse">
                        <div className="h-full bg-primary animate-[shimmer_2s_infinite]" style={{ width: '40%' }} />
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2 max-w-lg mx-auto w-full">
                    <div className="flex items-center gap-1">
                        <button 
                            type="button" 
                            onClick={() => setIsRequestModalOpen(true)}
                            className="p-2 text-primary hover:bg-primary/5 rounded-xl transition-colors shrink-0"
                            title="Skill Request"
                        >
                            <Plus size={20} />
                        </button>
                        <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-text-muted hover:text-primary rounded-xl transition-colors shrink-0"
                            title="Send Image"
                        >
                            <ImageIcon size={20} />
                        </button>
                    </div>
                    <div className="flex-1 relative">
                        <input 
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type an idea..."
                            className="w-full px-4 py-3 bg-hover-bg/40 border-2 border-transparent rounded-2xl text-[13px] font-bold text-text-main focus:ring-2 focus:ring-primary/20 focus:bg-theme-card focus:border-primary outline-none shadow-sm transition-all pr-12"
                        />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors">
                            <Smile size={18} />
                        </button>
                    </div>
                    <button 
                        type="submit"
                        disabled={!newMessage.trim() || isUploading}
                        className="p-3 bg-primary text-bg-main rounded-2xl shadow-lg border-2 border-primary-dark disabled:opacity-50 disabled:grayscale hover:bg-primary-dark transition-all active:scale-[0.98] shrink-0"
                    >
                        <Send size={18} strokeWidth={3} />
                    </button>
                </form>
            </div>

            {conversation && otherId && (
                <SkillRequestModal 
                    isOpen={isRequestModalOpen}
                    onClose={() => setIsRequestModalOpen(false)}
                    targetUser={{ 
                        uid: otherId, 
                        displayName: otherInfo?.displayName || 'Guru',
                        photoURL: otherInfo?.photoURL || ''
                    }}
                    initialLearnerSkills={[]}
                    initialTeacherSkills={[]}
                    conversationId={conversationId}
                />
            )}
            {showContract && selectedReq && (
                <ContractModal 
                    isOpen={showContract}
                    onClose={() => { setShowContract(false); setSelectedReq(null); }}
                    selectedReq={selectedReq}
                    onContractCreated={() => {
                        setNewMessage('I have proposed a contract based on your request. Let me know if the terms work for you!');
                    }}
                />
            )}
        </div>
    );
}
