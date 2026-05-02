import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { POPULAR_SKILLS } from '../constants';
import { Video, Users, CheckCircle2, Image as ImageIcon, Link as LinkIcon, Send, X, Plus, Info, Sparkles, Wand2, ArrowRight, Lock, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import imageCompression from 'browser-image-compression';
import { checkSubscriptionAccess, LIMITS, getUserContentCounts } from '../lib/firestore-utils';

const SuggestionBox = ({ title, icon: Icon, description, steps, onDismiss, type }: any) => {
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-3 relative overflow-hidden shadow-sm transition-colors"
        >
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                    <Icon size={18} />
                </div>
                <h3 className="text-sm font-bold text-text-main transition-colors">{title}</h3>
                <button onClick={onDismiss} className="ml-auto text-text-muted hover:text-text-main scale-90">
                    <X size={16} />
                </button>
            </div>
            <p className="text-xs text-text-muted font-medium leading-relaxed transition-colors">{description}</p>
            {steps && (
                <div className="space-y-1.5 pt-1">
                    {steps.map((step: string, i: number) => (
                        <div key={i} className="flex gap-2 items-start text-[11px] font-medium text-text-main transition-colors">
                            <span className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary text-[10px]">{i + 1}</span>
                            <span>{step}</span>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
};

export default function CreatePage() {
  const { user, profile, credits } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'course' | 'dao' | 'book'>('course');
  const [counts, setCounts] = useState({ courses: 0, books: 0, daos: 0, requests: 0 });

  useEffect(() => {
    if (user) {
      getUserContentCounts(user.uid).then(setCounts);
    }
  }, [user]);
  
  const subStatus = checkSubscriptionAccess(profile);

  const getLimitExceeded = () => {
    if (!profile?.isPremium) return false; // Trial users have no specific limit besides trial duration? 
    // Actually, Trial users should probably have the base limit or none? 
    // The prompt implies "after 15 days, the user will have to take the premium package".
    // It also says "monthly package, the user will be able to get 100 credit points, 5 DAO group access...".
    // If they are on a trial, they can use "all features".
    
    if (profile.isPremium) {
        const pkgLimits = profile.currentPackage === 'yearly' ? LIMITS.YEARLY : LIMITS.MONTHLY;
        if (activeTab === 'course' && counts.courses >= pkgLimits.COURSES) return true;
        if (activeTab === 'book' && counts.books >= pkgLimits.BOOKS) return true;
        if (activeTab === 'dao' && counts.daos >= pkgLimits.DAO_GROUPS) return true;
    }
    return false;
  };

  const limitExceeded = getLimitExceeded();

  if (!subStatus.allowed && subStatus.reason === 'subscription_required') {
    return (
      <div className="flex-grow flex items-center justify-center p-6 bg-bg-main">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-sm w-full bg-theme-card rounded-[40px] border-2 border-black p-8 text-center space-y-6 shadow-2xl"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-[32px] flex items-center justify-center mx-auto text-primary">
            <Crown size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-text-main tracking-tight uppercase">Premium Required</h2>
            <p className="text-sm text-text-muted font-bold leading-relaxed px-4">
              Your free trial has expired. To continue creating courses, books, and DAO groups, please upgrade to a Premium package.
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/subscription')}
            className="w-full py-5 bg-primary text-bg-main rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20"
          >
            Go Premium Now
          </motion.button>
        </motion.div>
      </div>
    );
  }

  const [bookOrigin, setBookOrigin] = useState<'affiliate' | 'own'>('affiliate');
  const [bookType, setBookType] = useState<'free' | 'paid'>('paid');
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<{ title: string; image: string; description?: string } | null>(null);

  // Suggestions state
  const [showImgSuggestion, setShowImgSuggestion] = useState(() => !localStorage.getItem('hideImgSuggestion'));
  const [showDaoSuggestion, setShowDaoSuggestion] = useState(() => !localStorage.getItem('hideDaoSuggestion'));

  // Forms...
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [coursePrice, setCoursePrice] = useState<number | undefined>();
  const [courseLink, setCourseLink] = useState('');
  const [courseThumb, setCourseThumb] = useState('');
  const [daoGroupLink, setDaoGroupLink] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const [daoName, setDaoName] = useState('');
  const [daoLimit, setDaoLimit] = useState(10);
  const [daoDeadline, setDaoDeadline] = useState('');
  const [daoTopic, setDaoTopic] = useState('');
  const [daoStake, setDaoStake] = useState(10);
  const [daoImage, setDaoImage] = useState('');
  const [daoIsPrivate, setDaoIsPrivate] = useState(false);
  const [customTag, setCustomTag] = useState('');

  const [uploading, setUploading] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [targetPath, setTargetPath] = useState('');

  const addCustomTag = () => {
    if (customTag.trim() && !selectedTags.includes(customTag.trim())) {
        setSelectedTags([...selectedTags, customTag.trim()]);
        setCustomTag('');
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
        setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
        setSelectedTags([...selectedTags, tag]);
    }
  };

  const reduceURL = (url: string) => {
    if (!url) return '';
    if (url.length > 50) {
        // Simple internal "shortener" logic or just truncation
        // For this app, we'll store the full URL but show a "cleaned" version
        return url.substring(0, 47) + '...';
    }
    return url;
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>, target: 'course' | 'dao') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
        const options = {
            maxSizeMB: 0.1, // Keep under 100KB
            maxWidthOrHeight: 1280,
            useWebWorker: true,
            initialQuality: 0.8
        };
        const compressedFile = await imageCompression(file, options);
        
        // Convert to Base64 for simplicity in this demo environment
        const reader = new FileReader();
        reader.readAsDataURL(compressedFile);
        reader.onloadend = () => {
            const base64data = reader.result as string;
            if (target === 'course') setCourseThumb(base64data);
            else setDaoImage(base64data);
            setUploading(false);
        };
    } catch (error) {
        console.error('Compression error:', error);
        setUploading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || loading) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'courses'), {
        title: courseTitle,
        description: courseDescription,
        link: courseLink,
        daoGroupLink: daoGroupLink,
        thumbnail: courseThumb || `https://picsum.photos/seed/${Math.random()}/800/450`,
        teacherId: user.uid,
        teacherName: user.displayName,
        teacherPhoto: user.photoURL,
        rating: 0,
        reviewCount: 0,
        tags: selectedTags,
        price: coursePrice || 0,
        createdAt: serverTimestamp(),
      });
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { credits: increment(10) });
      
      setSuccessMsg('Course published successfully! You earned 10 credits.');
      setTargetPath('/');
      setShowSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) { 
      console.error(err); 
      setLoading(false);
    }
  };

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || loading) return;
    setLoading(true);
    try {
      const finalPrice = bookOrigin === 'own' && bookType === 'free' ? 0 : coursePrice;
      
      await addDoc(collection(db, 'courses'), {
        title: courseTitle || previewData?.title || 'Untitled Book',
        description: courseDescription || previewData?.description || '',
        link: courseLink,
        thumbnail: courseThumb || previewData?.image || `https://picsum.photos/seed/book-${Math.random()}/400/600`,
        teacherId: user.uid,
        teacherName: user.displayName,
        teacherPhoto: user.photoURL,
        rating: 0,
        reviewCount: 0,
        tags: selectedTags,
        itemType: 'book',
        bookOrigin,
        price: finalPrice || (bookOrigin === 'affiliate' ? Math.floor(Math.random() * 500) + 100 : 0), 
        originalPrice: (finalPrice ? Math.floor(finalPrice * 1.5) : (bookOrigin === 'affiliate' ? Math.floor(Math.random() * 1000) + 500 : 0)),
        createdAt: serverTimestamp(),
      });
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { credits: increment(5) });
      
      setSuccessMsg('Book listed successfully!');
      setTargetPath('/');
      setShowSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) { 
      console.error(err); 
      setLoading(false);
    }
  };

  const fetchLinkPreview = async (url: string) => {
    if (!url || !url.startsWith('http')) return;
    setPreviewing(true);
    setPreviewData(null);
    try {
      // Try Microlink API for real rich preview data
      const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          const info = data.data;
          const refinedData = {
            title: info.title || 'Untitled Resource',
            image: info.image?.url || info.logo?.url || `https://picsum.photos/seed/${Math.random()}/800/450`,
            description: info.description || 'No description available for this link.',
          };

          setPreviewData(refinedData);
          setCourseTitle(refinedData.title);
          setCourseDescription(refinedData.description);
          setCourseThumb(refinedData.image);
          setPreviewing(false);
          return;
        }
      }

      // Fallback if API fails
      let domain = 'Website';
      try { domain = new URL(url).hostname; } catch(e){}
      
      const genericData = { 
          title: 'Instant Preview', 
          image: `https://picsum.photos/seed/${domain}/800/450`,
          description: `Fetched content from ${domain}. You can edit the details below.`
      };
      setPreviewData(genericData);
      setCourseTitle(genericData.title);
      setCourseDescription(genericData.description);
      setCourseThumb(genericData.image);
    } catch (err) {
      console.error("Preview error:", err);
    } finally {
      setPreviewing(false);
    }
  };

  const handleCreateDAO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || loading) return;
    setLoading(true);
    try {
      const daoRef = await addDoc(collection(db, 'daoGroups'), {
        name: daoName,
        adminId: user.uid,
        memberLimit: daoLimit,
        joinDeadline: new Date(daoDeadline).toISOString(),
        quizTopic: daoTopic,
        stakedPoints: daoStake,
        goalPeriodDays: 7,
        quizTime: '22:00',
        status: 'Active',
        tags: selectedTags,
        image: daoImage,
        isPrivate: daoIsPrivate,
        createdAt: serverTimestamp(),
        membersCount: 0,
      });

      // Update user profile
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { 
        credits: increment(0)
      });

      setSuccessMsg(`DAO Group "${daoName}" created successfully!`);
      setTargetPath('/group?id=' + daoRef.id);
      setShowSuccess(true);
      setTimeout(() => navigate('/group?id=' + daoRef.id), 2000);
    } catch (err) { 
      console.error(err); 
      setLoading(false);
    }
  };

  const dismissSuggestion = (key: string) => {
    localStorage.setItem(key, 'true');
    if (key === 'hideImgSuggestion') setShowImgSuggestion(false);
    if (key === 'hideDaoSuggestion') setShowDaoSuggestion(false);
  };

  return (
    <div className="flex flex-col h-full bg-bg-main transition-colors">
      <div className="p-4 border-b border-border-main flex items-center gap-4 sticky top-0 z-10 bg-bg-main transition-colors">
         <h1 className="text-xl font-bold text-text-main">Create</h1>
         <div className="flex items-center gap-1.5 ml-auto">
            <button 
                onClick={() => setActiveTab('course')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    activeTab === 'course' ? 'bg-text-main text-bg-main' : 'bg-hover-bg text-text-main group hover:bg-border-main'
                }`}
            >
                Course
            </button>
            <button 
                onClick={() => setActiveTab('book')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    activeTab === 'book' ? 'bg-text-main text-bg-main' : 'bg-hover-bg text-text-main group hover:bg-border-main'
                }`}
            >
                Book
            </button>
            <button 
                onClick={() => setActiveTab('dao')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    activeTab === 'dao' ? 'bg-text-main text-bg-main' : 'bg-hover-bg text-text-main group hover:bg-border-main'
                }`}
            >
                DAO Group
            </button>
         </div>
      </div>

      <div className="p-4 overflow-y-auto pb-20 space-y-6">
        {/* Onboarding Suggestions */}
        <AnimatePresence>
            {activeTab === 'book' ? (
                <SuggestionBox 
                    key="suggest-book"
                    title={bookOrigin === 'affiliate' ? "Affiliate Link Guide" : "Own Book Listing Guide"}
                    icon={bookOrigin === 'affiliate' ? LinkIcon : Wand2}
                    description={bookOrigin === 'affiliate' 
                        ? "Listing a book from a marketplace. We'll try to fetch details automatically."
                        : "Listing your own published book. Higher quality assets convert better."
                    }
                    steps={bookOrigin === 'affiliate' ? [
                        "Paste link from Amazon, Rokomari, etc.",
                        "We'll fetch title, image & description.",
                        "You can still manually upload a better cover if needed."
                    ] : [
                        "Upload high-res front cover (3:4 aspect).",
                        "Provide direct drive or shop link.",
                        "Add detailed summary to attract learners."
                    ]}
                    onDismiss={() => dismissSuggestion('hideImgSuggestion')}
                />
            ) : showImgSuggestion && (
                <SuggestionBox 
                    key="suggest-course"
                    title="Optimized Uploads"
                    icon={Wand2}
                    description="Upload high-quality covers. We'll automatically compress them to keep Skillora fast."
                    steps={[
                        "Course: Use 16:9 ratio (e.g. 1280x720px) for standard feed.",
                        "DAO: Use 21:9 wide ratio (e.g. 1260x540px) for banners.",
                        "Magic Compressor auto-shrinks all uploads to <100KB."
                    ]}
                    onDismiss={() => dismissSuggestion('hideImgSuggestion')}
                />
            )}
            {activeTab === 'dao' && showDaoSuggestion && (
                <SuggestionBox 
                    key="suggest-dao"
                    title="How to run a DAO Goal"
                    icon={Users}
                    description="Commit to a group goal. Members stake points to ensure participation."
                    steps={[
                        "Set a clear learning topic.",
                        "Choose a stake amount (Risk vs Reward).",
                        "Winners who complete quizzes share the DAO points."
                    ]}
                    onDismiss={() => dismissSuggestion('hideDaoSuggestion')}
                />
            )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
            {activeTab === 'course' ? (
                  <motion.form 
                key="course"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onSubmit={handleCreateCourse} 
                className="space-y-6"
              >
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Thumbnail</label>
                        <div className="relative group">
                            <label className="cursor-pointer block">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => handleImageSelect(e, 'course')}
                                />
                                <div className="aspect-video w-full bg-hover-bg rounded-2xl border-2 border-dashed border-border-main/50 flex flex-col items-center justify-center gap-2 overflow-hidden hover:border-primary/50 transition-all">
                                    {courseThumb ? (
                                        <img src={courseThumb} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                        <>
                                            <div className="w-10 h-10 bg-theme-card rounded-xl flex items-center justify-center text-text-muted shadow-sm transition-colors">
                                                <ImageIcon size={20} />
                                            </div>
                                            <p className="text-[11px] font-bold text-text-muted">{uploading ? 'Compressing...' : 'Tap to upload cover (16:9)'}</p>
                                        </>
                                    )}
                                </div>
                            </label>
                            {courseThumb && (
                                <button type="button" onClick={() => setCourseThumb('')} className="absolute top-2 right-2 p-1.5 bg-black/50 text-bg-main rounded-full hover:bg-black transition-colors">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Link URL</label>
                        <div className="relative">
                            <input
                              required type="url" value={courseLink}
                              onChange={(e) => {
                                setCourseLink(e.target.value);
                                fetchLinkPreview(e.target.value);
                              }}
                              placeholder="YouTube, Facebook, etc."
                              className="w-full px-4 py-3 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold pr-10"
                            />
                            {courseLink && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                                    <LinkIcon size={18} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Title</label>
                        <input
                          required type="text" value={courseTitle}
                          onChange={(e) => setCourseTitle(e.target.value)}
                          placeholder="e.g. Master React in 10 mins"
                          className="w-full px-4 py-3 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Description</label>
                        <textarea
                          value={courseDescription}
                          onChange={(e) => setCourseDescription(e.target.value)}
                          placeholder="What will students learn?"
                          rows={3}
                          className="w-full px-4 py-3 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold resize-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Price (TK) - Optional</label>
                        <input
                          type="number" value={coursePrice || ''}
                          onChange={(e) => setCoursePrice(parseFloat(e.target.value) || undefined)}
                          placeholder="e.g. 500 (Leave empty for free)"
                          className="w-full px-4 py-3 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main pl-1 tracking-wide">DAO Group Link (Optional)</label>
                        <input
                          type="url" value={daoGroupLink}
                          onChange={(e) => setDaoGroupLink(e.target.value)}
                          placeholder="Link to your DAO group"
                          className="w-full px-4 py-3 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Target Skills</label>
                    <div className="flex gap-2">
                        <input 
                            type="text"
                            value={customTag}
                            onChange={(e) => setCustomTag(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                            placeholder="Add custom skill..."
                            className="flex-grow px-4 py-2 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none text-xs font-bold transition-all"
                        />
                        <button 
                            type="button" 
                            onClick={addCustomTag}
                            className="px-4 py-2 bg-text-main text-bg-main rounded-xl text-xs font-bold hover:bg-black transition-colors shadow-sm"
                        >
                            Add
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {Array.from(new Set(selectedTags.filter(t => !POPULAR_SKILLS.includes(t)))).map(tag => (
                            <button
                                key={`course-tag-${tag}`}
                                type="button"
                                onClick={() => toggleTag(tag)}
                                className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-primary text-bg-main border border-primary shadow-sm flex items-center gap-1.5 group transition-all active:scale-95"
                            >
                                <CheckCircle2 size={12} />
                                {tag}
                                <X size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))}
                        {POPULAR_SKILLS.map(skill => {
                            const isSelected = selectedTags.includes(skill);
                            return (
                                <button
                                    key={`course-pop-${skill}`}
                                    type="button"
                                    onClick={() => toggleTag(skill)}
                                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 border active:scale-95 ${
                                        isSelected 
                                            ? 'bg-primary text-bg-main border-primary shadow-sm' 
                                            : 'bg-hover-bg text-text-main border-border-main/50'
                                    }`}
                                >
                                    {isSelected ? <CheckCircle2 size={12} /> : <Plus size={12} />}
                                    {skill}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-bg-main font-bold text-xs">+10</div>
                    <p className="text-[13px] font-bold text-text-main tracking-tight">Post & earn 10 skill credits.</p>
                </div>

                <button
                  disabled={loading || uploading || limitExceeded}
                  className="w-full py-4 bg-primary text-bg-main rounded-2xl font-black text-sm hover:bg-primary-dark transition-all disabled:opacity-50 border-2 border-primary-dark active:scale-[0.98] shadow-lg flex flex-col items-center justify-center p-4 px-6 gap-0.5"
                >
                  {loading ? 'Publishing...' : limitExceeded ? 'Limit Reached' : 'Publish Course'}
                  {limitExceeded && (
                    <span className="text-[9px] font-bold uppercase opacity-80">Upgrade to increase limit</span>
                  )}
                </button>
              </motion.form>
            ) : activeTab === 'book' ? (
              <motion.form 
                key="book"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onSubmit={handleCreateBook} 
                className="space-y-6"
              >
                <div className="space-y-4">
        {/* Origin Selection */}
                    <div className="flex flex-col gap-3">
                        <div className="p-1 bg-hover-bg rounded-xl flex gap-1">
                            <button 
                                type="button"
                                onClick={() => setBookOrigin('affiliate')}
                                className={`flex-1 py-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${
                                    bookOrigin === 'affiliate' ? 'bg-bg-main text-primary shadow-sm' : 'text-text-muted hover:text-text-main'
                                }`}
                            >
                                <LinkIcon size={12} />
                                Affiliate Link
                            </button>
                            <button 
                                type="button"
                                onClick={() => setBookOrigin('own')}
                                className={`flex-1 py-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${
                                    bookOrigin === 'own' ? 'bg-bg-main text-primary shadow-sm' : 'text-text-muted hover:text-text-main'
                                }`}
                            >
                                <Sparkles size={12} />
                                My Own Book
                            </button>
                        </div>

                        {bookOrigin === 'own' && (
                            <div className="flex gap-2 p-1 bg-hover-bg/50 rounded-xl">
                                <button 
                                    type="button"
                                    onClick={() => setBookType('free')}
                                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${
                                        bookType === 'free' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted'
                                    }`}
                                >
                                    Free Book
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setBookType('paid')}
                                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${
                                        bookType === 'paid' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted'
                                    }`}
                                >
                                    Paid (In-Inbox)
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Book Preview</label>
                        <div className="relative group/book">
                            <label className="cursor-pointer block">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => handleImageSelect(e, 'course')}
                                />
                                <div className="aspect-[3/4] max-w-[200px] mx-auto bg-hover-bg rounded-2xl border-2 border-dashed border-border-main/50 flex flex-col items-center justify-center gap-2 overflow-hidden hover:border-primary/50 transition-all shadow-sm">
                                    {courseThumb ? (
                                        <img src={courseThumb} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                        <>
                                            <div className="w-10 h-10 bg-theme-card rounded-xl flex items-center justify-center text-text-muted">
                                                <ImageIcon size={20} />
                                            </div>
                                            <p className="text-[11px] font-bold text-text-muted px-4 text-center">
                                                {bookOrigin === 'affiliate' 
                                                    ? 'Thumbnail will fetch from link or tap to upload' 
                                                    : 'Tap to upload high-res front cover (3:4)'}
                                            </p>
                                        </>
                                    )}
                                    {previewing && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Shop Link</label>
                        <div className="relative">
                            <input
                              required type="url" value={courseLink}
                              onChange={(e) => {
                                setCourseLink(e.target.value);
                                fetchLinkPreview(e.target.value);
                              }}
                              placeholder="Paste Amazon, Rokomari or PDF link..."
                              className="w-full px-4 py-3 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold pr-12"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                                <LinkIcon size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Book Title</label>
                        <input
                          required type="text" value={courseTitle}
                          onChange={(e) => setCourseTitle(e.target.value)}
                          placeholder="e.g. Clean Code"
                          className="w-full px-4 py-3 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Description</label>
                        <textarea
                          value={courseDescription}
                          onChange={(e) => setCourseDescription(e.target.value)}
                          placeholder="Short summary of the book..."
                          rows={3}
                          className="w-full px-4 py-3 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold resize-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Price (TK)</label>
                        <input
                          type="number" value={coursePrice || ''}
                          onChange={(e) => setCoursePrice(parseFloat(e.target.value))}
                          placeholder="0.00"
                          className="w-full px-4 py-3 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold"
                        />
                    </div>

                    <div className="space-y-3 pt-2">
                        <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Target Skills</label>
                        <div className="flex flex-wrap gap-2">
                            {POPULAR_SKILLS.slice(0, 8).map(skill => {
                                const isSelected = selectedTags.includes(skill);
                                return (
                                    <button
                                        key={`book-${skill}`}
                                        type="button"
                                        onClick={() => toggleTag(skill)}
                                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border active:scale-95 ${
                                            isSelected 
                                                ? 'bg-primary text-bg-main border-primary shadow-sm' 
                                                : 'bg-hover-bg text-text-main border-border-main/50'
                                        }`}
                                    >
                                        {skill}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                        <Sparkles size={18} />
                    </div>
                    <p className="text-[13px] font-bold text-text-main tracking-tight">Listing a book helps others learn shared skills.</p>
                </div>

                <button
                  disabled={loading || previewing || limitExceeded}
                  className="w-full py-4 bg-primary text-bg-main rounded-2xl font-black text-sm hover:bg-primary-dark transition-all disabled:opacity-50 border-2 border-primary-dark active:scale-[0.98] shadow-lg flex flex-col items-center justify-center p-4 px-6 gap-0.5"
                >
                  {loading ? 'Publishing...' : limitExceeded ? (
                    'Limit Reached'
                  ) : (
                    <>
                        <Send size={18} />
                        <span>List Book Now</span>
                    </>
                  )}
                  {limitExceeded && (
                    <span className="text-[9px] font-bold uppercase opacity-80">Upgrade to increase limit</span>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form 
                key="dao"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onSubmit={handleCreateDAO} 
                className="space-y-6"
              >
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">DAO Cover Image</label>
                        <div className="relative group">
                            <label className="cursor-pointer block">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => handleImageSelect(e, 'dao')}
                                />
                                <div className="aspect-[21/9] w-full bg-hover-bg rounded-2xl border-2 border-dashed border-border-main/50 flex flex-col items-center justify-center gap-2 overflow-hidden hover:border-primary/50 transition-all">
                                    {daoImage ? (
                                        <img src={daoImage} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                        <>
                                            <div className="w-10 h-10 bg-theme-card rounded-xl flex items-center justify-center text-text-muted shadow-sm transition-colors">
                                                <Sparkles size={20} className="text-primary" />
                                            </div>
                                            <p className="text-[11px] font-bold text-text-muted">{uploading ? 'Compressing...' : 'Tap to upload DAO cover (21:9)'}</p>
                                        </>
                                    )}
                                </div>
                            </label>
                            {daoImage && (
                                <button type="button" onClick={() => setDaoImage('')} className="absolute top-2 right-2 p-1.5 bg-black/50 text-bg-main rounded-full hover:bg-black transition-colors">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">DAO Group Name</label>
                        <input
                          required type="text" value={daoName}
                          onChange={(e) => setDaoName(e.target.value)}
                          placeholder="e.g. Python Warriors"
                          className="w-full px-4 py-3 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Member Limit</label>
                            <input
                              required type="number" min="3" value={daoLimit || ''}
                              onChange={(e) => setDaoLimit(parseInt(e.target.value) || 0)}
                              className="w-full px-4 py-3 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Stake (Pts)</label>
                            <input
                              required type="number" min="1" value={daoStake || ''}
                              onChange={(e) => setDaoStake(parseInt(e.target.value) || 0)}
                              className="w-full px-4 py-3 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Join Deadline</label>
                        <input
                          required type="datetime-local" value={daoDeadline}
                          onChange={(e) => setDaoDeadline(e.target.value)}
                          className="w-full px-4 py-3 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold [color-scheme:light]"
                        />
                    </div>
                    
                    <div className="p-4 bg-hover-bg rounded-2xl flex items-center justify-between border border-border-main/20 transition-all">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${daoIsPrivate ? 'bg-primary/20 text-primary' : 'bg-theme-card text-text-muted border border-border-main/50 shadow-sm'}`}>
                                <Lock size={20} />
                            </div>
                            <div className="space-y-0.5">
                                <h4 className="text-sm font-bold text-text-main">Private Group</h4>
                                <p className="text-[10px] font-medium text-text-muted tracking-tight">Only you can add members to this group.</p>
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={() => setDaoIsPrivate(!daoIsPrivate)}
                            className={`w-12 h-6 rounded-full relative transition-all shadow-inner ${daoIsPrivate ? 'bg-primary' : 'bg-border-main'}`}
                        >
                            <motion.div 
                                animate={{ x: daoIsPrivate ? 26 : 2 }}
                                className="absolute top-1 left-0 w-4 h-4 bg-bg-main rounded-full shadow-md transition-colors"
                            />
                        </button>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Learning Topic</label>
                        <input
                          required type="text" value={daoTopic}
                          onChange={(e) => setDaoTopic(e.target.value)}
                          placeholder="e.g. Design Systems"
                          className="w-full px-4 py-3 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-bold text-text-main pl-1 uppercase tracking-wider">Target Skills</label>
                    <div className="flex gap-2">
                        <input 
                            type="text"
                            value={customTag}
                            onChange={(e) => setCustomTag(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                            placeholder="Add custom skill..."
                            className="flex-grow px-4 py-2 bg-hover-bg border-2 border-transparent rounded-xl focus:bg-theme-card focus:ring-2 focus:ring-primary/20 outline-none text-xs font-bold transition-all"
                        />
                        <button 
                            type="button" 
                            onClick={addCustomTag}
                            className="px-4 py-2 bg-text-main text-bg-main rounded-xl text-xs font-bold hover:bg-black transition-colors shadow-sm"
                        >
                            Add
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {/* Selected Custom Tags first */}
                        {Array.from(new Set(selectedTags.filter(t => !POPULAR_SKILLS.includes(t)))).map(tag => (
                            <button
                                key={`dao-tag-${tag}`}
                                type="button"
                                onClick={() => toggleTag(tag)}
                                className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-primary text-bg-main border border-primary shadow-sm flex items-center gap-1.5 group"
                            >
                                <CheckCircle2 size={12} />
                                {tag}
                                <X size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))}
                        {POPULAR_SKILLS.map(skill => {
                            const isSelected = selectedTags.includes(skill);
                            return (
                                <button
                                    key={`dao-pop-${skill}`}
                                    type="button"
                                    onClick={() => toggleTag(skill)}
                                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 border active:scale-95 ${
                                        isSelected 
                                            ? 'bg-primary text-bg-main border-primary shadow-sm' 
                                            : 'bg-hover-bg text-text-main border-border-main/50'
                                    }`}
                                >
                                    {isSelected ? <CheckCircle2 size={12} /> : <Plus size={12} />}
                                    {skill}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <button
                  disabled={loading || uploading || limitExceeded}
                  className="w-full py-4 bg-primary text-bg-main rounded-2xl font-black text-sm hover:bg-primary-dark transition-all disabled:opacity-50 border-2 border-primary-dark active:scale-[0.98] shadow-lg flex flex-col items-center justify-center p-4 px-6 gap-0.5"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>{loading ? 'Creating...' : limitExceeded ? 'Limit Reached' : 'Initiate DAO Group'}</span>
                    {!loading && !limitExceeded && <ArrowRight size={18} />}
                  </div>
                  {limitExceeded && (
                    <span className="text-[9px] font-bold uppercase opacity-80">Upgrade to increase limit</span>
                  )}
                </button>
              </motion.form>
            )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showSuccess && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-bg-main/90 backdrop-blur-md transition-colors"
            >
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    className="w-full max-w-sm bg-theme-card border border-border-main rounded-[32px] p-8 shadow-2xl flex flex-col items-center text-center gap-6 transition-all"
                >
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary border border-primary/20">
                        <CheckCircle2 size={40} className="animate-in zoom-in duration-500" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-black text-text-main tracking-tight">Success!</h2>
                        <p className="text-sm font-medium text-text-muted leading-relaxed">
                            {successMsg}
                        </p>
                    </div>
                    <div className="w-full h-1.5 bg-hover-bg rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 2, ease: "linear" }}
                            className="h-full bg-primary"
                        />
                    </div>
                    <p className="text-[10px] font-bold text-text-muted/50 uppercase tracking-widest">Redirecting...</p>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
