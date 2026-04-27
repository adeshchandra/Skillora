export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  role: 'student' | 'tutor' | null;
  teachSkills: string[];
  learnSkills: string[];
  credits: number;
  rating: number;
  reviewCount: number;
  joinedGroups?: string[];
  privacy?: {
    hideGoals: boolean;
    hideMastery: boolean;
    hideFromSearch: boolean;
  };
  location?: string;
}

export interface Course {
  id: string;
  title: string;
  teacherId: string;
  teacherName: string;
  teacherPhoto: string;
  thumbnail: string;
  link: string;
  linkThumbnail: string;
  linkTitle: string;
  rating: number;
  reviewCount: number;
  daoGroupLink?: string;
  createdAt: any;
  tags?: string[];
}

export interface DAOGroup {
  id: string;
  name: string;
  adminId: string;
  memberLimit: number;
  joinDeadline: any;
  quizTopic: string;
  goalPeriodDays: number;
  quizTime: string;
  stakedPoints: number;
  status: 'Active' | 'Completed' | 'Cancelled';
  isPrivate?: boolean;
  meetingLink?: string;
  createdAt: any;
  membersCount?: number;
  rating?: number;
  ratingCount?: number;
  tags?: string[];
  image?: string;
}

export interface Quiz {
  id: string;
  groupId: string;
  day: number;
  questions: {
    question: string;
    options: string[];
    correctAnswerIndex: number;
  }[];
  availableFrom: string; // ISO string
  availableUntil: string; // ISO string
  durationMinutes: number; // Limit once started
  negativeMarking: boolean; // -0.25 on wrong
  createdAt: any;
}

export interface Session {
  id: string;
  teacherId: string;
  learnerId: string;
  teacherName: string;
  learnerName: string;
  date: string;
  time: string;
  duration: string; // e.g., "60 mins"
  days: number;     // e.g., 3 days of teaching
  endDate?: string;  // Calculated date when it expires automatically
  subject: string;
  credits: number;
  link?: string;
  status: 'Ready' | 'Live' | 'Completed' | 'Cancelled';
  createdAt: any;

  // Mutual Rating System
  teacherRating?: number;
  teacherReview?: string;
  teacherRatedAt?: string;
  
  learnerRating?: number;
  learnerReview?: string;
  learnerRatedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  relatedId?: string;
  read: boolean;
  createdAt: any;
}

export interface LearningRequest {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  learnSkill: string;
  teachSkill?: string; // Optional if not exchange
  type: 'Exchange' | 'Learning';
  duration: string; // e.g., "1 week", "3 days"
  credits: number;
  contactMedia: string; // "WhatsApp", "Telegram", "Email"
  contactInfo: string;
  message?: string; // Why they want to learn
  status: 'Pending' | 'Accepted' | 'Declined';
  createdAt: any;
}

export interface ChatConversation {
  id: string;
  participants: string[]; // [uid1, uid2]
  participantInfo: {
    [uid: string]: {
      displayName: string;
      photoURL: string;
    };
  };
  lastMessage?: {
    text: string;
    senderId: string;
    createdAt: any;
  };
  unreadCount?: {
    [uid: string]: number;
  };
  updatedAt: any;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text?: string;
  image?: string;
  skillRequestId?: string; // Reference to a LearningRequest
  isSystem?: boolean;
  createdAt: any;
  read?: boolean;
}

export interface UserInteraction {
  userId: string;
  itemId: string;
  itemType: 'course' | 'group';
  tags: string[];
  timestamp: any;
}

export interface UserInterest {
  tagScores: Record<string, number>;
  lastUpdated: any;
}
