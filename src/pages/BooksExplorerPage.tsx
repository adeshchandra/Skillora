import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Course } from '../types';
import { BookCard } from '../components/BookCard';
import { Search, ChevronLeft, Filter, BookOpen, Sparkles, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export const BooksExplorerPage = () => {
    const navigate = useNavigate();
    const [books, setBooks] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    useEffect(() => {
        const q = query(
            collection(db, 'courses'),
            where('itemType', '==', 'book'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setBooks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const toggleOrigin = (origin: string) => {
        setSelectedOrigins(prev => 
            prev.includes(origin) ? prev.filter(o => o !== origin) : [...prev, origin]
        );
    };

    const toggleType = (type: string) => {
        setSelectedTypes(prev => 
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const toggleTag = (tag: string) => {
        setSelectedTags(prev => 
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const resetFilters = () => {
        setSelectedOrigins([]);
        setSelectedTypes([]);
        setSelectedTags([]);
        setSearchQuery('');
    };

    const filteredBooks = books.filter(book => {
        const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             book.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             (book.tags && book.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
        
        const matchesOrigin = selectedOrigins.length === 0 || selectedOrigins.includes(book.bookOrigin || '');
        
        const isPaid = (book.price || 0) > 0;
        const bookType = isPaid ? 'paid' : 'free';
        const matchesType = selectedTypes.length === 0 || selectedTypes.includes(bookType);

        const matchesTags = selectedTags.length === 0 || (book.tags && selectedTags.every(t => book.tags?.includes(t)));

        return matchesSearch && matchesOrigin && matchesType && matchesTags;
    });

    const allTags = Array.from(new Set(books.flatMap(b => b.tags || []))).sort();

    return (
        <div className="min-h-screen bg-bg-main pb-24">
            {/* Header */}
            <div className="sticky top-0 bg-bg-main/80 backdrop-blur-xl z-30 border-b border-border-main/50">
                <div className="px-4 h-16 flex items-center justify-between gap-4">
                    <button 
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-hover-bg transition-colors"
                    >
                        <ChevronLeft size={24} className="text-text-main" />
                    </button>
                    
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search books, authors..."
                            className="w-full bg-hover-bg rounded-xl py-2 pl-10 pr-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-transparent focus:border-primary/30"
                        />
                    </div>
                </div>

                {/* Filters */}
                <div className="px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
                    <FilterButton 
                        active={selectedOrigins.length === 0 && selectedTypes.length === 0 && selectedTags.length === 0} 
                        onClick={resetFilters} 
                        label="All Books" 
                    />
                    <FilterButton 
                        active={selectedOrigins.includes('affiliate')} 
                        onClick={() => toggleOrigin('affiliate')} 
                        label="Marketplace" 
                        icon={<Link2 size={12} />}
                    />
                    <FilterButton 
                        active={selectedOrigins.includes('own')} 
                        onClick={() => toggleOrigin('own')} 
                        label="Own Works" 
                        icon={<Sparkles size={12} />}
                    />
                    <div className="w-[1px] h-6 bg-border-main self-center mx-1" />
                    <FilterButton 
                        active={selectedTypes.includes('free')} 
                        onClick={() => toggleType('free')} 
                        label="Free" 
                    />
                    <FilterButton 
                        active={selectedTypes.includes('paid')} 
                        onClick={() => toggleType('paid')} 
                        label="Paid" 
                    />
                    
                    {allTags.length > 0 && (
                        <>
                            <div className="w-[1px] h-6 bg-border-main self-center mx-1" />
                            {allTags.map(tag => (
                                <FilterButton 
                                    key={tag}
                                    active={selectedTags.includes(tag)} 
                                    onClick={() => toggleTag(tag)} 
                                    label={tag} 
                                />
                            ))}
                        </>
                    )}
                </div>
            </div>

            <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-xl font-black text-text-main uppercase tracking-tighter">Newest Library</h1>
                        <p className="text-xs font-bold text-text-muted italic">{filteredBooks.length} titles discovered</p>
                    </div>
                    <BookOpen size={24} className="text-primary opacity-20" />
                </div>

                {loading ? (
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="aspect-[3/4] bg-hover-bg animate-pulse rounded-2xl" />
                        ))}
                    </div>
                ) : filteredBooks.length > 0 ? (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
                    >
                        {filteredBooks.map(book => (
                            <BookCard key={book.id} book={book} />
                        ))}
                    </motion.div>
                ) : (
                    <div className="py-20 flex flex-col items-center justify-center text-center px-10">
                        <div className="w-16 h-16 bg-hover-bg rounded-3xl flex items-center justify-center mb-4 text-text-muted">
                            <BookOpen size={32} />
                        </div>
                        <h3 className="font-bold text-text-main mb-1 tracking-tight">No books matching filters</h3>
                        <p className="text-xs font-medium text-text-muted leading-relaxed mb-6">
                            Try adjusting your search or filters to find what you're looking for.
                        </p>
                        <button 
                            onClick={resetFilters}
                            className="px-6 py-2 bg-primary text-bg-main rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                        >
                            Clear All Filters
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const FilterButton = ({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon?: React.ReactNode }) => (
    <button 
        onClick={onClick}
        className={`flex-shrink-0 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 border ${
            active 
                ? 'bg-primary text-bg-main border-primary shadow-lg shadow-primary/20 scale-105 active:scale-95' 
                : 'bg-hover-bg text-text-muted border-transparent hover:border-border-main'
        }`}
    >
        {icon}
        {label}
    </button>
);
