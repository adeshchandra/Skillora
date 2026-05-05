import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Save, Image as ImageIcon, Link as LinkIcon, Monitor, ShoppingBag, ExternalLink, RefreshCw, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import imageCompression from 'browser-image-compression';
import { analyzeUrl } from '../lib/video-utils';

export default function EditCoursePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    const [title, setTitle] = useState('');
    const [link, setLink] = useState('');
    const [thumbnail, setThumbnail] = useState('');
    const [daoLink, setDaoLink] = useState('');
    const [itemType, setItemType] = useState<'course' | 'book'>('course');

    useEffect(() => {
        if (!id) return;
        
        const fetchItem = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'courses', id));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.teacherId !== user?.uid) {
                        navigate('/');
                        return;
                    }
                    setTitle(data.title || '');
                    setLink(data.link || '');
                    setThumbnail(data.thumbnail || '');
                    setDaoLink(data.daoGroupLink || '');
                    setItemType(data.itemType || 'course');
                } else {
                    navigate('/');
                }
            } catch (err) {
                console.error("Fetch error:", err);
                navigate('/');
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchItem();
    }, [id, user, navigate]);

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const options = {
                maxSizeMB: 0.1, // Keep under 100KB
                maxWidthOrHeight: 1280,
                useWebWorker: true,
                initialQuality: 0.7
            };
            const compressedFile = await imageCompression(file, options);
            
            const reader = new FileReader();
            reader.readAsDataURL(compressedFile);
            reader.onloadend = () => {
                setThumbnail(reader.result as string);
                setUploading(false);
            };
        } catch (error) {
            console.error('Compression error:', error);
            setUploading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || saving) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'courses', id), {
                title,
                link,
                thumbnail,
                daoGroupLink: daoLink,
                updatedAt: serverTimestamp()
            });
            navigate('/profile');
        } catch (err) {
            console.error("Update error:", err);
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-grow flex items-center justify-center bg-bg-main">
                <RefreshCw className="text-primary animate-spin" size={32} />
            </div>
        );
    }

    const info = analyzeUrl(link);
    const isVideo = info?.type === 'youtube' || info?.type === 'facebook';

    return (
        <div className="flex flex-col h-full bg-bg-main font-sans overflow-y-auto">
            <div className="p-4 border-b border-border-main flex items-center gap-4 sticky top-0 z-20 bg-bg-main backdrop-blur-md">
                <button 
                  onClick={() => navigate(-1)}
                  className="p-2 -ml-2 text-text-muted hover:text-text-main transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-lg font-bold text-text-main tracking-tight uppercase">Edit {itemType}</h1>
            </div>

            <div className="p-6 max-w-lg mx-auto w-full pb-24">
                <form onSubmit={handleSave} className="space-y-8">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest pl-1">Thumbnail / Cover</label>
                        <div className="relative group">
                            <label className="cursor-pointer block">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={handleImageSelect}
                                />
                                <div className={`aspect-[3/4] w-full max-w-[240px] mx-auto bg-hover-bg rounded-[32px] border-2 border-dashed border-border-main/50 flex flex-col items-center justify-center gap-3 overflow-hidden hover:border-primary/50 transition-all shadow-sm ${uploading ? 'animate-pulse' : ''}`}>
                                    {thumbnail ? (
                                        <div className="relative w-full h-full">
                                            <img src={thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            {uploading && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                                                    <RefreshCw className="text-white animate-spin" size={24} />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="w-12 h-12 bg-theme-card rounded-2xl flex items-center justify-center text-text-muted shadow-sm shadow-black/5">
                                                <ImageIcon size={24} />
                                            </div>
                                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest px-4 text-center leading-relaxed">
                                                {uploading ? 'Compressing...' : 'Tap to upload (3:4 Ratio)'}
                                            </p>
                                        </>
                                    )}
                                </div>
                            </label>
                            {thumbnail && (
                                <button 
                                    type="button" 
                                    onClick={() => setThumbnail('')} 
                                    className="absolute -top-2 right-[calc(50%-130px)] p-2 bg-red-500 text-bg-main rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all z-10"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-2">
                            <div className="px-2 py-1 bg-primary/10 rounded-lg text-[8px] font-black text-primary uppercase tracking-widest">Auto-Compress Enabled</div>
                            <div className="px-2 py-1 bg-green-500/10 rounded-lg text-[8px] font-black text-green-500 uppercase tracking-widest">&lt; 100 KB Guaranteed</div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest pl-1">Course Title</label>
                        <input
                          required type="text" value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g. Master React in 10 mins"
                          className="w-full px-5 py-4 bg-hover-bg border-2 border-transparent rounded-[20px] focus:bg-theme-card focus:border-primary/20 outline-none transition-all text-[13px] font-bold text-text-main shadow-inner"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between pl-1">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Video/Resource URL</label>
                            {info && (
                                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                                    isVideo ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                                }`}>
                                    {isVideo ? <Monitor size={10} /> : <ShoppingBag size={10} />}
                                    {info.platform || 'Verified'}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <input
                              required type="url" value={link}
                              onChange={(e) => setLink(e.target.value)}
                              placeholder="YouTube, Facebook, Rokomari, etc."
                              className="w-full px-5 py-4 bg-hover-bg border-2 border-transparent rounded-[20px] focus:bg-theme-card focus:border-primary/20 outline-none transition-all text-[13px] font-bold text-text-main pr-12 shadow-inner"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary">
                                <LinkIcon size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest pl-1">DAO Group Link (Optional)</label>
                        <input
                          type="url" value={daoLink}
                          onChange={(e) => setDaoLink(e.target.value)}
                          placeholder="Paste DAO Group Link"
                          className="w-full px-5 py-4 bg-hover-bg border-2 border-transparent rounded-[20px] focus:bg-theme-card focus:border-primary/20 outline-none transition-all text-[13px] font-bold text-text-main shadow-inner"
                        />
                    </div>

                    <div className="pt-4 sticky bottom-6">
                        <button
                          disabled={saving || uploading}
                          className="w-full py-5 bg-text-main text-bg-main rounded-[24px] font-black text-xs uppercase tracking-[0.2em] hover:bg-black transition-all disabled:opacity-50 active:scale-[0.98] shadow-2xl flex items-center justify-center gap-3"
                        >
                          {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                          {saving ? 'Saving...' : 'Update content'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
