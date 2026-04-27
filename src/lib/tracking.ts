import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { UserInterest } from '../types';

/**
 * Tracks a user interaction with a specific item (Course or DAO Group).
 * Updates interest tag scores in the backend to personalize the feed.
 */
export const trackInteraction = async (userId: string, tags: string[]) => {
  if (!userId || !tags || tags.length === 0) return;

  const interestRef = doc(db, 'users', userId, 'metadata', 'interests');
  
  try {
    const snap = await getDoc(interestRef);
    const updateData: any = {
      lastUpdated: serverTimestamp()
    };

    tags.forEach(tag => {
      updateData[`tagScores.${tag}`] = increment(1);
    });

    if (!snap.exists()) {
      // First interaction
      const initialScores: Record<string, number> = {};
      tags.forEach(tag => {
        initialScores[tag] = 1;
      });
      await setDoc(interestRef, {
        tagScores: initialScores,
        lastUpdated: serverTimestamp()
      });
    } else {
      await updateDoc(interestRef, updateData);
    }
  } catch (err) {
    console.error("Tracking failed:", err);
  }
};

/**
 * Fetches user interest scores.
 */
export const getUserInterests = async (userId: string): Promise<UserInterest | null> => {
  if (!userId) return null;
  const interestRef = doc(db, 'users', userId, 'metadata', 'interests');
  const snap = await getDoc(interestRef);
  if (snap.exists()) {
    return snap.data() as UserInterest;
  }
  return null;
};

/**
 * Lightweight algorithm to rank items based on interest scores.
 * Priority: 
 * 1. Matches user's top interest tags
 * 2. Recency (createdAt)
 */
export const rankItems = <T extends { tags?: string[]; createdAt: any }>(
  items: T[], 
  interests: UserInterest | null
): T[] => {
  if (!interests || !interests.tagScores) {
    // Falls back to recency only
    return [...items].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }

  return [...items].sort((a, b) => {
    const scoreA = (a.tags || []).reduce((acc, tag) => acc + (interests.tagScores[tag] || 0), 0);
    const scoreB = (b.tags || []).reduce((acc, tag) => acc + (interests.tagScores[tag] || 0), 0);

    // If scores are different, use score
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }

    // fallback to recency
    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  });
};
