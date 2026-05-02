import React from 'react';
import { Course } from '../types';
import { Star, ShoppingCart, ExternalLink, MessageCircle, Link2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

interface BookCardProps {
  book: Course;
}

export const BookCard = ({ book }: BookCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Logic: Paid Own Book -> Inbox, else -> External Link
    if (book.bookOrigin === 'own' && book.price && book.price > 0) {
      if (!user) {
        navigate('/login');
        return;
      }
      
      try {
        // Find existing conversation or start new one
        const chatsRef = collection(db, 'conversations');
        const q = query(chatsRef, where('participants', 'array-contains', user.uid));
        const querySnapshot = await getDocs(q);
        
        let existingChat = null;
        querySnapshot.forEach(doc => {
          const data = doc.data();
          if (data.participants.includes(book.teacherId)) {
            existingChat = { id: doc.id, ...data };
          }
        });

        if (existingChat) {
          navigate(`/chat/${(existingChat as any).id}`, { 
            state: { 
              initialMessage: `I'm interested in your book: ${book.title}. How can I pay?`
            } 
          });
        } else {
          const newChat = await addDoc(collection(db, 'conversations'), {
            participants: [user.uid, book.teacherId],
            participantInfo: {
              [user.uid]: {
                displayName: user.displayName || 'Learner',
                photoURL: user.photoURL || ''
              },
              [book.teacherId]: {
                displayName: book.teacherName,
                photoURL: book.teacherPhoto || ''
              }
            },
            lastMessage: {
              text: `I'm interested in your book: ${book.title}`,
              senderId: user.uid,
              createdAt: serverTimestamp()
            },
            updatedAt: serverTimestamp(),
            unreadCount: {
              [book.teacherId]: 1
            }
          });
          navigate(`/chat/${newChat.id}`, {
            state: {
                initialMessage: `I'm interested in your book: ${book.title}. How can I pay?`
            }
          });
        }
      } catch (err) {
        console.error("Chat error:", err);
      }
    } else {
      window.open(book.link, '_blank');
    }
  };

  const discount = book.originalPrice && book.price 
    ? Math.round(((book.originalPrice - book.price) / book.originalPrice) * 100) 
    : 0;

  const isPaidOwnBook = book.bookOrigin === 'own' && book.price && book.price > 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={handleAction}
      className="flex-shrink-0 w-[160px] bg-bg-main rounded-2xl overflow-hidden cursor-pointer group"
    >
      <div className="relative aspect-[3/4] bg-hover-bg overflow-hidden rounded-2xl shadow-sm border border-border-main/50">
        <img 
          src={book.thumbnail} 
          alt={book.title}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        
        {/* Affiliate Icon */}
        {book.bookOrigin === 'affiliate' && (
          <div className="absolute top-2 right-2 w-7 h-7 bg-primary text-bg-main rounded-full shadow-lg flex items-center justify-center backdrop-blur-sm border border-white/20 z-10">
            <Link2 size={14} />
          </div>
        )}

        {discount > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-bg-main text-[9px] font-black px-1.5 py-1 rounded-full shadow-lg flex items-center justify-center min-w-[32px] aspect-square flex-col leading-none z-10">
            <span>{discount}%</span>
            <span>OFF</span>
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-primary text-bg-main flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 shadow-xl">
                {isPaidOwnBook ? <MessageCircle size={18} /> : <ExternalLink size={18} />}
            </div>
        </div>
      </div>

      <div className="p-2 space-y-1">
        <h3 className="text-[11px] font-bold text-text-main line-clamp-2 leading-tight group-hover:text-primary transition-colors">
          {book.title}
        </h3>
        {book.description && (
          <p className="text-[9px] text-text-muted line-clamp-2 leading-tight opacity-80">
            {book.description}
          </p>
        )}
        <p className="text-[9px] font-medium text-text-muted line-clamp-1 italic">
          {book.teacherName}
        </p>
        
        <div className="flex items-center gap-1">
            <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                    <Star 
                        key={i} 
                        size={8} 
                        fill={i < Math.floor(book.rating || 4.5) ? "currentColor" : "none"} 
                        className={i < Math.floor(book.rating || 4.5) ? "text-yellow-400" : "text-border-main"}
                    />
                ))}
            </div>
            <span className="text-[8px] font-bold text-text-muted">({book.reviewCount || 42})</span>
        </div>

        <p className="text-[9px] font-bold text-green-500">Product In Stock</p>
        
        <div className="flex items-center gap-2 pt-0.5">
            <span className="text-[11px] font-black text-text-main">TK. {book.price}</span>
            {book.originalPrice && (
                <span className="text-[9px] font-bold text-text-muted line-through">TK. {book.originalPrice}</span>
            )}
        </div>
      </div>
    </motion.div>
  );
};
