import React, { useState, useEffect } from 'react';
import { Course } from '../types';
import { Star, ShoppingCart, ExternalLink, MessageCircle, Link2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, increment, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

interface BookCardProps {
  book: Course;
}

export const BookCard = ({ book }: BookCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hasVisited, setHasVisited] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [localRating, setLocalRating] = useState(book.rating || 0);

  // Seeded random for affiliate books to keep them consistent but different
  const getSeededRating = (id: string) => {
    const seed = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rating = 3.5 + (seed % 15) / 10; // 3.5 to 5.0
    const reviews = 20 + (seed % 200);
    return { rating, reviews };
  };

  const affiliateData = book.bookOrigin === 'affiliate' ? getSeededRating(book.id) : null;

  useEffect(() => {
    if (user && book.bookOrigin === 'own' && (book as any).ratedBy?.includes(user.uid)) {
      setHasRated(true);
    }
  }, [user, book]);

  const handleAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasVisited(true);
    
    // Logic: Paid Own Book -> Inbox, else -> External Link
    if (book.bookOrigin === 'own' && book.price && book.price > 0) {
      if (!user) {
        navigate('/login');
        return;
      }
      
      try {
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

  const handleRate = async (e: React.MouseEvent, rating: number) => {
    e.stopPropagation();
    if (!user || hasRated || isRating || !hasVisited) return;

    setIsRating(true);
    try {
      const bookRef = doc(db, 'courses', book.id);
      const currentRating = book.rating || 0;
      const currentCount = book.reviewCount || 0;
      
      const newCount = currentCount + 1;
      const newRatingValue = ((currentRating * currentCount) + rating) / newCount;

      await updateDoc(bookRef, {
        rating: Number(newRatingValue.toFixed(1)),
        reviewCount: increment(1),
        ratedBy: arrayUnion(user.uid)
      });

      setLocalRating(newRatingValue);
      setHasRated(true);
    } catch (err) {
      console.error("Rating error:", err);
    } finally {
      setIsRating(false);
    }
  };

  const discount = book.originalPrice && book.price 
    ? Math.round(((book.originalPrice - book.price) / book.originalPrice) * 100) 
    : 0;

  const isPaidOwnBook = book.bookOrigin === 'own' && book.price && book.price > 0;
  const displayRating = affiliateData ? affiliateData.rating : localRating;
  const displayReviews = affiliateData ? affiliateData.reviews : book.reviewCount || 0;

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
          <>
            <div className="absolute top-2 right-2 w-7 h-7 bg-primary text-bg-main rounded-[12px] shadow-lg flex items-center justify-center backdrop-blur-sm border border-white/20 z-10">
              <Link2 size={14} />
            </div>
            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-blue-500 text-bg-main text-[7px] font-black uppercase tracking-wider rounded-md border border-white/10 z-10 shadow-sm">
                Shop
            </div>
          </>
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
        
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
                <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                        <motion.div
                          key={i}
                          whileTap={book.bookOrigin === 'own' && !hasRated && hasVisited ? { scale: 1.4 } : {}}
                          onClick={(e) => book.bookOrigin === 'own' && handleRate(e, i + 1)}
                          className={book.bookOrigin === 'own' && !hasRated && hasVisited ? "cursor-pointer" : ""}
                        >
                            <Star 
                                size={8} 
                                fill={i < Math.floor(displayRating || 4) ? "currentColor" : "none"} 
                                className={i < Math.floor(displayRating || 4) ? "text-yellow-400" : "text-border-main"}
                            />
                        </motion.div>
                    ))}
                </div>
                <span className="text-[8px] font-bold text-text-muted">({displayReviews})</span>
            </div>
            
            {book.bookOrigin === 'own' && !hasRated && hasVisited && !isRating && (
                <p className="text-[7px] text-primary font-bold animate-pulse">Rate this book!</p>
            )}
            {book.bookOrigin === 'own' && hasRated && (
                <p className="text-[7px] text-green-500 font-bold">Thanks for rating!</p>
            )}
        </div>

        <p className="text-[9px] font-bold text-green-500">Product In Stock</p>
        
        <div className="flex items-center gap-2 pt-0.5">
            <span className="text-[11px] font-black text-text-main">TK. {book.price}</span>
            {book.originalPrice && book.originalPrice > (book.price || 0) && (
                <span className="text-[9px] font-bold text-text-muted line-through">TK. {book.originalPrice}</span>
            )}
        </div>
      </div>
    </motion.div>
  );
};
