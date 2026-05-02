import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Course, UserInterest } from '../types';
import { POPULAR_SKILLS } from '../constants';
import { Star, ExternalLink, Play, User as UserIcon, X, Search as SearchIcon, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { getUserInterests, rankItems } from '../lib/tracking';

import CourseCard from '../components/CourseCard';
import { BookCard } from '../components/BookCard';

import { useScrollDirection } from '../lib/hooks';

interface FilterSystemProps {
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const FilterSystem = ({ selectedTags, setSelectedTags, searchQuery, setSearchQuery }: FilterSystemProps) => {
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  return (
    <div className="bg-theme-card border-b border-border-main">
      <div className="px-4 py-3 space-y-3">
        {/* Search Bar */}
        <div className="relative flex items-center">
            <SearchIcon size={16} className="absolute left-3 text-text-muted" />
            <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search skills, teachers, topics..."
                className="w-full bg-hover-bg border-none rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
            {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 p-1 text-text-muted hover:text-text-main transition-colors">
                    <X size={14} />
                </button>
            )}
        </div>

        {/* Categories / Tags Scroll */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button 
                onClick={() => setSelectedTags([])}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                    selectedTags.length === 0 ? 'bg-primary text-bg-main shadow-sm shadow-primary/20' : 'bg-hover-bg text-text-main group hover:bg-border-main'
                }`}
            >
                All
            </button>
            {POPULAR_SKILLS.map(skill => (
                <button 
                    key={`pop-filter-${skill}`}
                    onClick={() => toggleTag(skill)}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                        selectedTags.includes(skill) ? 'bg-primary text-bg-main border-primary' : 'bg-hover-bg text-text-main group hover:bg-border-main border border-transparent'
                    }`}
                >
                    {skill}
                </button>
            ))}
            {Array.from(new Set(selectedTags.filter(t => !POPULAR_SKILLS.includes(t)))).map(tag => (
                <button 
                    key={`filter-tag-${tag}`}
                    onClick={() => toggleTag(tag)}
                    className="flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all bg-primary text-bg-main border-primary border flex items-center gap-1.5"
                >
                    {tag}
                    <X size={10} />
                </button>
            ))}
        </div>
      </div>
    </div>
  );
};

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [userInterests, setUserInterests] = useState<UserInterest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { scrollDir, isAtTop } = useScrollDirection();

  useEffect(() => {
    if (user) {
      getUserInterests(user.uid).then(setUserInterests);
    }
  }, [user]);

  const fetchCourses = async (isRefreshing = false) => {
    if (isRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      
      if (isRefreshing) {
        // Keep top 8 most recent, shuffle the rest (9-50) to give that "YouTube" feel
        const recent = data.slice(0, 8);
        const older = data.slice(8);
        const shuffled = [...older].sort(() => Math.random() - 0.5);
        data = [...recent, ...shuffled];
      }

      setCourses(data);
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY) {
      const distance = e.touches[0].clientY - startY;
      if (distance > 0 && window.scrollY === 0) {
        // Resistance logic: pull distance grows slower as it gets larger
        const resistedDistance = Math.min(distance * 0.4, 150);
        setPullDistance(resistedDistance);
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60) {
      fetchCourses(true);
    }
    setPullDistance(0);
    setStartY(0);
  };

  const filteredCourses = rankItems(
    courses.filter(course => {
      // Don't show books in the main course feed to keep it clean
      if (course.itemType === 'book') return false;

      const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           course.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (course.tags && course.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
      
      const matchesTags = selectedTags.length === 0 || 
                         (course.tags && selectedTags.every(tag => course.tags?.includes(tag)));
      
      return matchesSearch && matchesTags;
    }),
    userInterests
  );

  const filteredBooks = courses.filter(course => {
    if (course.itemType !== 'book') return false;

    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         course.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (course.tags && course.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    
    const matchesTags = selectedTags.length === 0 || 
                       (course.tags && selectedTags.every(tag => course.tags?.includes(tag)));
    
    return matchesSearch && matchesTags;
  });

  const isVisible = scrollDir === 'up' || isAtTop;

  return (
    <div 
      className="min-h-screen relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div 
          className="absolute left-0 right-0 flex justify-center z-[60] pointer-events-none"
          style={{ top: refreshing ? '80px' : `${Math.min(pullDistance, 100)}px` }}
        >
          <motion.div 
            animate={refreshing ? { rotate: 360 } : { rotate: pullDistance * 2 }}
            transition={refreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : { duration: 0 }}
            className={`w-8 h-8 rounded-full bg-theme-card shadow-lg border border-border-main flex items-center justify-center ${refreshing ? 'text-primary' : 'text-text-muted'}`}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </motion.div>
        </div>
      )}

      <motion.div 
        initial={false}
        animate={{ 
          y: isVisible ? 0 : -200,
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? 'auto' : 'none'
        }}
        transition={{ 
          duration: 0.3,
          ease: "easeInOut"
        }}
        className="sticky top-14 z-40"
      >
        <FilterSystem 
          selectedTags={selectedTags} 
          setSelectedTags={setSelectedTags} 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </motion.div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={`skel-${i}`} className="space-y-4 animate-pulse">
              <div className="aspect-video bg-hover-bg" />
              <div className="flex gap-3 px-3">
                <div className="w-10 h-10 bg-hover-bg rounded-full" />
                <div className="space-y-2 flex-grow">
                  <div className="h-4 bg-hover-bg rounded w-3/4" />
                  <div className="h-3 bg-hover-bg rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Books Row */}
          {filteredBooks.length > 0 && (
            <div className="py-4 space-y-3 bg-hover-bg/30">
              <div className="px-4 flex items-center justify-between">
                <h3 className="text-sm font-black text-text-main uppercase tracking-wider">New Books</h3>
                <button 
                  onClick={() => navigate('/books/explore')}
                  className="text-[10px] font-black text-primary px-3 py-1 rounded-full border border-primary/30 hover:bg-primary/10 transition-colors uppercase tracking-widest active:scale-95"
                >
                  View All
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-2">
                {filteredBooks.map(book => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            </div>
          )}

          {filteredCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 px-12 text-center space-y-6">
              <div className="w-24 h-24 bg-bg-main rounded-[40px] flex items-center justify-center">
                <Play size={40} className="text-border-main" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-text-main">No results found</h3>
                <p className="text-sm text-text-muted font-medium">Try adjusting your filters or search query.</p>
              </div>
            </div>
          ) : (
            filteredCourses.map((course, idx) => (
              <CourseCard key={`${course.id}-${idx}`} course={course} />
            ))
          )}
          
          <div className="h-20" /> {/* Extra space for absolute center button */}
        </div>
      )}
    </div>
  );
}
