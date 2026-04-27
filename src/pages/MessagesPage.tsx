import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../App';
import { ChatConversation, LearningRequest } from '../types';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, ChevronRight, User as UserIcon, Clock, Search, Handshake } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export default function MessagesPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [requests, setRequests] = useState<LearningRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'chats' | 'requests'>('chats');

    useEffect(() => {
        if (!user) return;

        // Conversations listener
        const qConv = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', user.uid),
            orderBy('updatedAt', 'desc')
        );

        const unsubConv = onSnapshot(qConv, (snap) => {
            setConversations(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatConversation)));
        });

        // Requests listener
        const qReq = query(
            collection(db, 'learningRequests'),
            where('recipientId', '==', user.uid),
            where('status', '==', 'Pending')
        );

        const unsubReq = onSnapshot(qReq, (snap) => {
            setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LearningRequest)));
            setLoading(false);
        }, (err) => {
            console.error("Requests sync error:", err);
            setLoading(false);
        });

        return () => {
            unsubConv();
            unsubReq();
        };
    }, [user]);

    const filteredConversations = conversations.filter(conv => {
        const otherId = conv.participants.find(p => p !== user?.uid);
        const otherInfo = otherId ? conv.participantInfo[otherId] : null;
        return otherInfo?.displayName.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const filteredRequests = requests.filter(req => 
        req.senderName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b border-border-main bg-white sticky top-0 z-10 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold text-text-main">Inbox</h1>
                    <div className="flex bg-hover-bg p-1 rounded-xl">
                        <button 
                            onClick={() => setActiveTab('chats')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'chats' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                        >
                            Chats
                            {conversations.some(c => (c.unreadCount?.[user?.uid || ''] || 0) > 0) && (
                                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                            )}
                        </button>
                        <button 
                            onClick={() => setActiveTab('requests')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all relative ${activeTab === 'requests' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                        >
                            Requests
                            {requests.length > 0 && (
                                <span className="ml-1.5 px-1.5 py-0.5 bg-primary text-white text-[8px] rounded-full">
                                    {requests.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                    <input 
                        type="text" 
                        placeholder={activeTab === 'chats' ? "Search conversations..." : "Search requests..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-hover-bg border-none rounded-xl text-sm font-medium focus:ring-1 focus:ring-primary focus:bg-white transition-all outline-none"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-20">
                <AnimatePresence mode="wait">
                    {activeTab === 'chats' ? (
                        <motion.div 
                            key="chats"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="divide-y divide-border-main/30"
                        >
                            {filteredConversations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                                    <div className="w-16 h-16 bg-hover-bg rounded-full flex items-center justify-center text-text-muted mb-4 border border-border-main/50">
                                        <MessageSquare size={32} strokeWidth={1.5} />
                                    </div>
                                    <h3 className="text-sm font-bold text-text-main">No messages yet</h3>
                                    <p className="text-xs text-text-muted font-medium mt-1">Start a conversation from a member's profile!</p>
                                </div>
                            ) : (
                                filteredConversations.map((conv) => {
                                    const otherId = conv.participants.find(p => p !== user?.uid);
                                    const otherInfo = otherId ? conv.participantInfo[otherId] : { displayName: 'Unknown', photoURL: '' };
                                    const unread = user ? conv.unreadCount?.[user.uid] || 0 : 0;
                                    const lastMsg = conv.lastMessage;

                                    return (
                                        <button
                                            key={conv.id}
                                            onClick={() => navigate(`/chat/${conv.id}`)}
                                            className="w-full flex items-center gap-4 p-4 hover:bg-hover-bg/50 transition-colors text-left group"
                                        >
                                            <div className="relative shrink-0">
                                                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-hover-bg border border-border-main/50">
                                                    {otherInfo.photoURL ? (
                                                        <img src={otherInfo.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-text-muted">
                                                            <UserIcon size={20} />
                                                        </div>
                                                    )}
                                                </div>
                                                {unread > 0 && (
                                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                                                        {unread > 9 ? '9+' : unread}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0 space-y-0.5">
                                                <div className="flex items-center justify-between">
                                                    <h4 className={`text-sm font-bold tracking-tight truncate ${unread > 0 ? 'text-text-main' : 'text-text-main/80'}`}>
                                                        {otherInfo.displayName}
                                                    </h4>
                                                    {conv.updatedAt && (
                                                        <span className="text-[10px] font-medium text-text-muted">
                                                            {formatDistanceToNow(conv.updatedAt.toDate(), { addSuffix: false })}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <p className={`text-xs truncate font-medium ${unread > 0 ? 'text-text-main font-bold' : 'text-text-muted'}`}>
                                                        {lastMsg ? (
                                                            <>
                                                                {lastMsg.senderId === user?.uid && <span className="text-[10px] uppercase tracking-wider text-primary mr-1">You:</span>}
                                                                {lastMsg.text}
                                                            </>
                                                        ) : (
                                                            'Start chatting...'
                                                        )}
                                                    </p>
                                                    <ChevronRight size={14} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="requests"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="divide-y divide-border-main/30"
                        >
                            {filteredRequests.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 px-8 text-center text-text-muted">
                                    <div className="w-16 h-16 bg-hover-bg rounded-full flex items-center justify-center mb-4">
                                        <Clock size={32} strokeWidth={1.5} />
                                    </div>
                                    <h3 className="text-sm font-bold text-text-main">No pending requests</h3>
                                    <p className="text-xs font-medium mt-1">Skill requests you receive will appear here.</p>
                                </div>
                            ) : (
                                filteredRequests.map((req) => (
                                    <button
                                        key={req.id}
                                        onClick={() => {
                                            const participants = [user?.uid, req.senderId].sort();
                                            const conversationId = participants.join('_');
                                            navigate(`/chat/${conversationId}?openRequest=${req.id}`);
                                        }}
                                        className="w-full flex items-start gap-4 p-4 hover:bg-hover-bg/50 transition-colors text-left group"
                                    >
                                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0 border border-primary/20 text-primary">
                                            <Handshake size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="text-sm font-bold text-text-main truncate">{req.senderName}</h4>
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tight ${req.type === 'Exchange' ? 'bg-accent-gold/20 text-accent-gold' : 'bg-primary/20 text-primary'}`}>
                                                    {req.type}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-text-main leading-tight mb-1">Wants to learn {req.learnSkill}</p>
                                            <p className="text-[10px] text-text-muted font-medium italic line-clamp-1">"{req.message}"</p>
                                        </div>
                                        <ChevronRight size={14} className="text-text-muted mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                ))
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
