import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../App';
import { Course, UserInterest } from '../types';
import { POPULAR_SKILLS } from '../constants';
import { Star, ExternalLink, Play, User as UserIcon, X, Search as SearchIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { getUserInterests, rankItems } from '../lib/tracking';

import CourseCard from '../components/CourseCard';

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
    <div className="bg-white border-b border-border-main">
      <div className="px-4 py-3 space-y-3">
        {/* Search Bar */}
        <div className="relative flex items-center">
            <SearchIcon size={16} className="absolute left-3 text-text-muted" />
            <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search skills, teachers, topics..."
                className="w-full bg-hover-bg border-none rounded-xl py-2 pl-10 pr-4 text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
            />
            {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 p-1 text-text-muted">
                    <X size={14} />
                </button>
            )}
        </div>

        {/* Categories / Tags Scroll */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button 
                onClick={() => setSelectedTags([])}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                    selectedTags.length === 0 ? 'bg-text-main text-white' : 'bg-hover-bg text-text-main group hover:bg-border-main'
                }`}
            >
                All
            </button>
            {POPULAR_SKILLS.map(skill => (
                <button 
                    key={skill}
                    onClick={() => toggleTag(skill)}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                        selectedTags.includes(skill) ? 'bg-primary text-white border-primary' : 'bg-hover-bg text-text-main group hover:bg-border-main border border-transparent'
                    }`}
                >
                    {skill}
                </button>
            ))}
            {Array.from(new Set(selectedTags.filter(t => !POPULAR_SKILLS.includes(t)))).map(tag => (
                <button 
                    key={`filter-tag-${tag}`}
                    onClick={() => toggleTag(tag)}
                    className="flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all bg-primary text-white border-primary border flex items-center gap-1.5"
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
  const [courses, setCourses] = useState<Course[]>([]);
  const [userInterests, setUserInterests] = useState<UserInterest | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    if (user) {
      getUserInterests(user.uid).then(setUserInterests);
    }
  }, [user]);

  useEffect(() => {
    let scrollTimeout: any;
    const handleScroll = () => {
      // Set scrolling true as soon as we move
      setIsScrolling(true);
      
      // Clear the timeout - this prevents it from setting false while moving
      clearTimeout(scrollTimeout);
      
      // Set scrolling false after 300ms of no scroll events
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
      }, 300);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  useEffect(() => {
    // Fetch top 50 recent courses to rank locally
    const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const filteredCourses = rankItems(
    courses.filter(course => {
      const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           course.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (course.tags && course.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
      
      const matchesTags = selectedTags.length === 0 || 
                         (course.tags && selectedTags.every(tag => course.tags?.includes(tag)));
      
      return matchesSearch && matchesTags;
    }),
    userInterests
  );

  return (
    <div className="min-h-screen">
      <motion.div 
        animate={{ 
          y: isScrolling ? -200 : 0, // Push it up when scrolling
          opacity: isScrolling ? 0 : 1,
          pointerEvents: isScrolling ? 'none' : 'auto'
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
        <div className="space-y-6">
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
