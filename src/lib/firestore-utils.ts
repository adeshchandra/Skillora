
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

import { auth, db } from './firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';

export async function getUserContentCounts(userId: string) {
  const coursesQuery = query(collection(db, 'courses'), where('teacherId', '==', userId), where('itemType', '!=', 'book'));
  const booksQuery = query(collection(db, 'courses'), where('teacherId', '==', userId), where('itemType', '==', 'book'));
  const daoQuery = query(collection(db, 'daoGroups'), where('adminId', '==', userId));
  const requestsQuery = query(collection(db, 'skillRequests'), where('userId', '==', userId));

  const [coursesSnap, booksSnap, daoSnap, requestsSnap] = await Promise.all([
    getCountFromServer(coursesQuery),
    getCountFromServer(booksQuery),
    getCountFromServer(daoQuery),
    getCountFromServer(requestsQuery)
  ]);

  return {
    courses: coursesSnap.data().count,
    books: booksSnap.data().count,
    daos: daoSnap.data().count,
    requests: requestsSnap.data().count
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  const jsonError = JSON.stringify(errInfo);
  console.error('Firestore Error: ', jsonError);
  throw new Error(jsonError);
}

export const LIMITS = {
  FREE_TRIAL_DAYS: 15,
  MONTHLY: {
    CREDITS: 100,
    DAO_GROUPS: 5,
    COURSES: 20,
    BOOKS: 10,
    SKILL_REQUESTS: 5
  },
  YEARLY: {
    CREDITS: 1200,
    DAO_GROUPS: 60, // 5 * 12
    COURSES: 240, 
    BOOKS: 120,
    SKILL_REQUESTS: 60
  }
};

export function checkSubscriptionAccess(profile: any) {
  if (!profile) return { allowed: false, reason: 'unauthenticated' };
  
  // Premium if isPremium boolean is true OR status is 'active' string
  if (profile.isPremium || profile.subscriptionStatus === 'active') return { allowed: true };

  // Check Trial
  if (profile.trialStartedAt) {
    const trialExp = new Date(new Date(profile.trialStartedAt).getTime() + LIMITS.FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000);
    if (trialExp > new Date()) {
      return { allowed: true, isTrial: true };
    }
  }

  return { allowed: false, reason: 'subscription_required' };
}
