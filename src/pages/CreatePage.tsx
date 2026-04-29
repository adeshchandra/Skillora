import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { POPULAR_SKILLS } from '../constants';
import { Video, Users, CheckCircle2, Image as ImageIcon, Link as LinkIcon, Send, X, Plus, Info, Sparkles, Wand2, ArrowRight, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import imageCompression from 'browser-image-compression';

const SuggestionBox = ({ title, icon: Icon, description, steps, onDismiss, type }: any) => {
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-primary/5 dark:bg-card-bg rounded-2xl border border-primary/10 dark:border-border-main space-y-3 relative overflow-hidden shadow-sm"
        >
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                    <Icon size={18} />
                </div>
                <h3 className="text-sm font-bold text-text-main">{title}</h3>
                <button onClick={onDismiss} className="ml-auto text-text-muted hover:text-text-main">
                    <X size={16} />
                </button>
            </div>
            <p className="text-xs text-text-muted font-medium leading-relaxed">{description}</p>
            {steps && (
                <div className="space-y-1.5 pt-1">
                    {steps.map((step: string, i: number) => (
                        <div key={i} className="flex gap-2 items-start text-[11px] font-medium text-text-main">
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
  const { user, credits } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'course' | 'dao'>('course');
  const [loading, setLoading] = useState(false);

  // Suggestions state
  const [showImgSuggestion, setShowImgSuggestion] = useState(() => !localStorage.getItem('hideImgSuggestion'));
  const [showDaoSuggestion, setShowDaoSuggestion] = useState(() => !localStorage.getItem('hideDaoSuggestion'));

  // Forms...
  const [courseTitle, setCourseTitle] = useState('');
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
        link: courseLink,
        daoGroupLink: daoGroupLink,
        thumbnail: courseThumb || `https://picsum.photos/seed/${Math.random()}/800/450`,
        teacherId: user.uid,
        teacherName: user.displayName,
        teacherPhoto: user.photoURL,
        rating: 0,
        reviewCount: 0,
        tags: selectedTags,
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
        credits: increment(0) // No longer adding to joinedGroups
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
    <div className="flex flex-col h-full bg-white dark:bg-black transition-colors">
      <div className="p-4 border-b border-border-main dark:border-border-main/50 flex items-center gap-4 bg-white dark:bg-black sticky top-0 z-10 transition-colors">
         <h1 className="text-xl font-bold text-text-main dark:text-white">Create</h1>
         <div className="flex items-center gap-1.5 ml-auto">
            <button 
                onClick={() => setActiveTab('course')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    activeTab === 'course' ? 'bg-text-main dark:bg-white text-white dark:text-black' : 'bg-hover-bg dark:bg-hover-bg/10 text-text-main dark:text-text-muted group hover:bg-border-main dark:hover:bg-hover-bg/20'
                }`}
            >
                Course
            </button>
            <button 
                onClick={() => setActiveTab('dao')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    activeTab === 'dao' ? 'bg-text-main dark:bg-white text-white dark:text-black' : 'bg-hover-bg dark:bg-hover-bg/10 text-text-main dark:text-text-muted group hover:bg-border-main dark:hover:bg-hover-bg/20'
                }`}
            >
                DAO Group
            </button>
         </div>
      </div>

      <div className="p-4 overflow-y-auto pb-20 space-y-6">
        {/* Onboarding Suggestions */}
        <AnimatePresence>
            {showImgSuggestion && (
                <SuggestionBox 
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
                        <label className="text-xs font-bold text-text-main dark:text-white pl-1 uppercase tracking-wider">Course Thumbnail</label>
                        <div className="relative group">
                            <label className="cursor-pointer block">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => handleImageSelect(e, 'course')}
                                />
                                <div className="aspect-video w-full bg-hover-bg dark:bg-hover-bg/10 rounded-2xl border-2 border-dashed border-border-main/50 dark:border-border-main/30 flex flex-col items-center justify-center gap-2 overflow-hidden hover:border-primary/50 dark:hover:border-primary transition-all">
                                    {courseThumb ? (
                                        <img src={courseThumb} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                        <>
                                            <div className="w-10 h-10 bg-white dark:bg-hover-bg/20 rounded-xl flex items-center justify-center text-text-muted shadow-sm transition-colors">
                                                <ImageIcon size={20} />
                                            </div>
                                            <p className="text-[11px] font-bold text-text-muted">{uploading ? 'Compressing...' : 'Tap to upload cover (16:9)'}</p>
                                        </>
                                    )}
                                </div>
                            </label>
                            {courseThumb && (
                                <button type="button" onClick={() => setCourseThumb('')} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black transition-colors">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main dark:text-white pl-1 uppercase tracking-wider">Course Title</label>
                        <input
                          required type="text" value={courseTitle}
                          onChange={(e) => setCourseTitle(e.target.value)}
                          placeholder="e.g. Master React in 10 mins"
                          className="w-full px-4 py-3 bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-2 border-transparent dark:border dark:border-border-main/50 rounded-xl focus:bg-white dark:focus:bg-hover-bg/40 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main dark:text-white pl-1 uppercase tracking-wider">Link URL</label>
                        <div className="relative">
                            <input
                              required type="url" value={courseLink}
                              onChange={(e) => setCourseLink(e.target.value)}
                              placeholder="YouTube, Facebook, etc."
                              className="w-full px-4 py-3 bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-2 border-transparent dark:border dark:border-border-main/50 rounded-xl focus:bg-white dark:focus:bg-hover-bg/40 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold pr-10"
                            />
                            {courseLink && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[10px] bg-white dark:bg-black px-2 py-0.5 rounded border border-border-main/20 shadow-sm transition-colors">
                                    <LinkIcon size={10} className="text-primary" />
                                    <span className="font-bold text-text-muted dark:text-text-muted">{reduceURL(courseLink)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main dark:text-white pl-1 tracking-wide">DAO Group Link (Optional)</label>
                        <input
                          type="url" value={daoGroupLink}
                          onChange={(e) => setDaoGroupLink(e.target.value)}
                          placeholder="Link to your DAO group"
                          className="w-full px-4 py-3 bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-2 border-transparent dark:border dark:border-border-main/50 rounded-xl focus:bg-white dark:focus:bg-hover-bg/40 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-bold text-text-main dark:text-white pl-1 uppercase tracking-wider">Target Skills</label>
                    <div className="flex gap-2">
                        <input 
                            type="text"
                            value={customTag}
                            onChange={(e) => setCustomTag(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                            placeholder="Add custom skill..."
                            className="flex-grow px-4 py-2 bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-2 border-transparent dark:border dark:border-border-main/50 rounded-xl focus:bg-white dark:focus:bg-hover-bg/40 focus:ring-2 focus:ring-primary/20 outline-none text-xs font-bold transition-all"
                        />
                        <button 
                            type="button" 
                            onClick={addCustomTag}
                            className="px-4 py-2 bg-text-main dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold hover:bg-black dark:hover:bg-white/90 transition-colors shadow-sm"
                        >
                            Add
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {/* Selected Custom Tags first */}
                        {Array.from(new Set(selectedTags.filter(t => !POPULAR_SKILLS.includes(t)))).map(tag => (
                            <button
                                key={`course-tag-${tag}`}
                                type="button"
                                onClick={() => toggleTag(tag)}
                                className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-primary text-white border border-primary shadow-sm flex items-center gap-1.5 group transition-all active:scale-95"
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
                                    key={skill}
                                    type="button"
                                    onClick={() => toggleTag(skill)}
                                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 border active:scale-95 ${
                                        isSelected 
                                            ? 'bg-primary text-white border-primary shadow-sm' 
                                            : 'bg-hover-bg dark:bg-hover-bg/10 text-text-main dark:text-white border-border-main/50 dark:border-border-main/30'
                                    }`}
                                >
                                    {isSelected ? <CheckCircle2 size={12} /> : <Plus size={12} />}
                                    {skill}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="p-4 bg-primary/5 dark:bg-hover-bg/10 rounded-2xl border border-primary/10 dark:border-border-main/50 flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xs">+10</div>
                    <p className="text-[13px] font-bold text-text-main dark:text-white tracking-tight">Post & earn 10 skill credits.</p>
                </div>

                <button
                  disabled={loading || uploading}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm hover:bg-primary-dark transition-all disabled:opacity-50 border-2 border-primary-dark active:scale-[0.98]"
                >
                  {loading ? 'Publishing...' : 'Publish Course'}
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
                        <label className="text-xs font-bold text-text-main dark:text-white pl-1 uppercase tracking-wider">DAO Cover Image</label>
                        <div className="relative group">
                            <label className="cursor-pointer block">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => handleImageSelect(e, 'dao')}
                                />
                                <div className="aspect-[21/9] w-full bg-hover-bg dark:bg-hover-bg/10 rounded-2xl border-2 border-dashed border-border-main/50 dark:border-border-main/30 flex flex-col items-center justify-center gap-2 overflow-hidden hover:border-primary/50 dark:hover:border-primary transition-all">
                                    {daoImage ? (
                                        <img src={daoImage} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                        <>
                                            <div className="w-10 h-10 bg-white dark:bg-hover-bg/20 rounded-xl flex items-center justify-center text-text-muted shadow-sm transition-colors">
                                                <Sparkles size={20} className="text-primary" />
                                            </div>
                                            <p className="text-[11px] font-bold text-text-muted">{uploading ? 'Compressing...' : 'Tap to upload DAO cover (21:9)'}</p>
                                        </>
                                    )}
                                </div>
                            </label>
                            {daoImage && (
                                <button type="button" onClick={() => setDaoImage('')} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black transition-colors">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main dark:text-white pl-1 uppercase tracking-wider">DAO Group Name</label>
                        <input
                          required type="text" value={daoName}
                          onChange={(e) => setDaoName(e.target.value)}
                          placeholder="e.g. Python Warriors"
                          className="w-full px-4 py-3 bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-2 border-transparent dark:border dark:border-border-main/50 rounded-xl focus:bg-white dark:focus:bg-hover-bg/40 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-text-main dark:text-white pl-1 uppercase tracking-wider">Member Limit</label>
                            <input
                              required type="number" min="3" value={daoLimit || ''}
                              onChange={(e) => setDaoLimit(parseInt(e.target.value) || 0)}
                              className="w-full px-4 py-3 bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-2 border-transparent dark:border dark:border-border-main/50 rounded-xl focus:bg-white dark:focus:bg-hover-bg/40 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-text-main dark:text-white pl-1 uppercase tracking-wider">Stake (Pts)</label>
                            <input
                              required type="number" min="1" value={daoStake || ''}
                              onChange={(e) => setDaoStake(parseInt(e.target.value) || 0)}
                              className="w-full px-4 py-3 bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-2 border-transparent dark:border dark:border-border-main/50 rounded-xl focus:bg-white dark:focus:bg-hover-bg/40 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main dark:text-white pl-1 uppercase tracking-wider">Join Deadline</label>
                        <input
                          required type="datetime-local" value={daoDeadline}
                          onChange={(e) => setDaoDeadline(e.target.value)}
                          className="w-full px-4 py-3 bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-2 border-transparent dark:border dark:border-border-main/50 rounded-xl focus:bg-white dark:focus:bg-hover-bg/40 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold dark:[color-scheme:dark]"
                        />
                    </div>
                    
                    <div className="p-4 bg-hover-bg dark:bg-hover-bg/10 rounded-2xl flex items-center justify-between border border-border-main/20 dark:border-border-main/50 transition-all">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${daoIsPrivate ? 'bg-primary/20 text-primary' : 'bg-white dark:bg-hover-bg/20 text-text-muted border border-border-main/50 dark:border-border-main/30 shadow-sm'}`}>
                                <Lock size={20} />
                            </div>
                            <div className="space-y-0.5">
                                <h4 className="text-sm font-bold text-text-main dark:text-white">Private Group</h4>
                                <p className="text-[10px] font-medium text-text-muted tracking-tight">Only you can add members to this group.</p>
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={() => setDaoIsPrivate(!daoIsPrivate)}
                            className={`w-12 h-6 rounded-full relative transition-all shadow-inner ${daoIsPrivate ? 'bg-primary' : 'bg-border-main dark:bg-hover-bg/40'}`}
                        >
                            <motion.div 
                                animate={{ x: daoIsPrivate ? 26 : 2 }}
                                className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-md"
                            />
                        </button>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-text-main dark:text-white pl-1 uppercase tracking-wider">Learning Topic</label>
                        <input
                          required type="text" value={daoTopic}
                          onChange={(e) => setDaoTopic(e.target.value)}
                          placeholder="e.g. Design Systems"
                          className="w-full px-4 py-3 bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-2 border-transparent dark:border dark:border-border-main/50 rounded-xl focus:bg-white dark:focus:bg-hover-bg/40 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-semibold"
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
                            className="flex-grow px-4 py-2 bg-hover-bg dark:bg-hover-bg/20 dark:text-white border-none rounded-xl focus:bg-white dark:focus:bg-hover-bg/40 focus:ring-1 focus:ring-primary outline-none text-xs font-bold transition-all"
                        />
                        <button 
                            type="button" 
                            onClick={addCustomTag}
                            className="px-4 py-2 bg-text-main text-white rounded-xl text-xs font-bold hover:bg-black transition-colors"
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
                                className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-primary text-white border border-primary shadow-sm flex items-center gap-1.5 group"
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
                                    key={skill}
                                    type="button"
                                    onClick={() => toggleTag(skill)}
                                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 border ${
                                        isSelected 
                                            ? 'bg-primary text-white border-primary shadow-sm' 
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
                  disabled={loading || uploading}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm hover:bg-primary-dark transition-all disabled:opacity-50 border-2 border-primary-dark active:scale-[0.98]"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>{loading ? 'Creating...' : 'Initiate DAO Group'}</span>
                    {!loading && <ArrowRight size={18} />}
                  </div>
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
                className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-white/90 dark:bg-black/90 backdrop-blur-md transition-colors"
            >
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    className="w-full max-w-sm bg-white dark:bg-card-bg border border-border-main dark:border-border-main rounded-[32px] p-8 shadow-2xl flex flex-col items-center text-center gap-6 transition-all"
                >
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary border border-primary/20">
                        <CheckCircle2 size={40} className="animate-in zoom-in duration-500" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-black text-text-main dark:text-white tracking-tight">Success!</h2>
                        <p className="text-sm font-medium text-text-muted leading-relaxed">
                            {successMsg}
                        </p>
                    </div>
                    <div className="w-full h-1.5 bg-hover-bg dark:bg-hover-bg/20 rounded-full overflow-hidden">
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
