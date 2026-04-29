import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../App';
import { Notification } from '../types';
import { Bell, Heart, Users, MessageCircle, AlertCircle, ShoppingBag, CheckCircle2, Handshake, Star, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface NotificationItemProps {
  notification: Notification;
  key?: React.Key;
}

const NotificationItem = ({ notification }: NotificationItemProps) => {
  const navigate = useNavigate();
  
  const getIcon = () => {
    switch (notification.type) {
      case 'match': return <Heart className="text-primary" size={18} fill="currentColor" />;
      case 'match_suggestion': return <Sparkles className="text-primary" size={18} fill="currentColor" />;
      case 'dao': return <Users className="text-secondary" size={18} />;
      case 'contract': return <Handshake className="text-accent-gold" size={18} />;
      case 'rating': return <Star className="text-accent-gold" size={18} fill="currentColor" />;
      case 'alert': return <AlertCircle className="text-orange-500" size={18} />;
      case 'success': return <CheckCircle2 className="text-green-500" size={18} />;
      default: return <Bell className="text-text-muted" size={18} />;
    }
  };

  const handleNotificationClick = async () => {
    // 1. Mark as read
    if (!notification.read) {
      await updateDoc(doc(db, 'notifications', notification.id), { read: true });
    }

    // 2. Navigate based on type
    if (notification.relatedId) {
        if (notification.type === 'match' || notification.type === 'match_suggestion') {
            if (notification.type === 'match_suggestion') {
                navigate(`/chat/${notification.relatedId}`);
                return;
            }
            // Navigate to Profile Upcoming sub-menu to see the request form
            navigate(`/profile#request-${notification.relatedId}`);
        } else if (notification.type === 'dao') {
            // Related ID for DAO is the groupId
            navigate(`/group?id=${notification.relatedId}`);
        } else if (notification.type === 'contract') {
            // Sessions/Contracts are on the profile page
            navigate(`/profile#session-${notification.relatedId}`);
        } else if (notification.type === 'rating') {
            // Take them to the profile to rate the session
            navigate(`/profile#session-${notification.relatedId}-rate`);
        }
    }
  };

  return (
    <div 
      onClick={handleNotificationClick}
      className={`p-4 flex gap-4 transition-colors cursor-pointer hover:bg-hover-bg bg-white border-b border-border-main/50 relative ${!notification.read ? '' : 'opacity-70'}`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-hover-bg`}>
        {getIcon()}
      </div>
      <div className="flex-grow pt-0.5 pr-4">
        <p className={`text-[13px] leading-snug mb-1 ${!notification.read ? 'font-bold text-text-main' : 'font-medium text-text-muted'}`}>
            {notification.message}
        </p>
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            {notification.createdAt ? format(new Date(notification.createdAt.toDate()), 'MMM d, HH:mm') : 'Just now'}
        </p>
      </div>
      {!notification.read && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary" />
      )}
    </div>
  );
};

export default function NotificationPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 bg-white z-40 px-4 h-14 border-b border-border-main flex items-center justify-between">
         <h1 className="text-xl font-bold text-text-main">Notifications</h1>
      </header>

      {loading ? (
        <div className="p-4 space-y-4">
           {[1, 2, 3, 4, 5].map(i => (
             <div key={`skel-${i}`} className="flex gap-4 animate-pulse">
                <div className="w-10 h-10 bg-hover-bg rounded-full" />
                <div className="flex-grow space-y-2 pt-1">
                    <div className="h-3.5 bg-hover-bg rounded w-3/4" />
                    <div className="h-2 bg-hover-bg rounded w-1/4" />
                </div>
             </div>
           ))}
        </div>
      ) : (
        <div className="flex flex-col">
          {notifications.length === 0 ? (
            <div className="py-24 text-center px-10 space-y-4">
                <div className="w-16 h-16 bg-hover-bg rounded-full flex items-center justify-center mx-auto text-text-muted">
                    <Bell size={24} className="opacity-40" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-base font-bold text-text-main">No notifications yet</h3>
                    <p className="text-xs text-text-muted font-medium">Updates and activity will appear here.</p>
                </div>
            </div>
          ) : (
            notifications.map((n, idx) => <NotificationItem key={`${n.id}-${idx}`} notification={n} />)
          )}
        </div>
      )}
      
      <div className="h-24" />
    </div>
  );
}
