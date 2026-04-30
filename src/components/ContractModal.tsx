import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Handshake, AlertCircle } from 'lucide-react';
import { LearningRequest } from '../types';
import { collection, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../App';

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedReq: LearningRequest;
  onContractCreated?: () => void;
}

export const ContractModal: React.FC<ContractModalProps> = ({ 
  isOpen, 
  onClose, 
  selectedReq,
  onContractCreated
}) => {
  const { user } = useAuth();
  const [contractDays, setContractDays] = useState(
    selectedReq?.duration === '3 days' ? 3 : 
    selectedReq?.duration === '1 week' ? 7 : 
    selectedReq?.duration === '2 weeks' ? 14 : 
    selectedReq?.duration === '1 month' ? 30 : 7
  );
  const [contractTime, setContractTime] = useState('10:00');
  const [contractDate, setContractDate] = useState(new Date().toISOString().split('T')[0]);
  const [contractDuration, setContractDuration] = useState('60 mins');
  const [contractCredits, setContractCredits] = useState(selectedReq?.credits || 50);
  const [loading, setLoading] = useState(false);

  const createContract = async () => {
    if (!user || !selectedReq) return;
    setLoading(true);
    const startDate = contractDate || new Date().toISOString().split('T')[0];
    const end = new Date(startDate);
    end.setDate(end.getDate() + (contractDays || 7));
    const endDate = end.toISOString().split('T')[0];

    try {
        const sessionRef = await addDoc(collection(db, 'sessions'), {
            teacherId: user.uid,
            teacherName: user.displayName,
            learnerId: selectedReq.senderId,
            learnerName: selectedReq.senderName,
            date: startDate,
            endDate: endDate,
            time: contractTime,
            duration: contractDuration,
            days: contractDays,
            subject: selectedReq.learnSkill,
            credits: contractCredits,
            status: 'Ready',
            createdAt: serverTimestamp()
        });

        // Notify learner
        await addDoc(collection(db, 'notifications'), {
            userId: selectedReq.senderId,
            type: 'contract',
            message: `${user.displayName} accepted your match and set a contract for ${selectedReq.learnSkill}!`,
            relatedId: sessionRef.id,
            createdAt: serverTimestamp(),
            read: false
        });

        await deleteDoc(doc(db, 'learningRequests', selectedReq.id));
        if (onContractCreated) onContractCreated();
        onClose();
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-text-main/20 backdrop-blur-sm p-0 md:p-4">
            <motion.div 
                initial={{ y: "100%" }} 
                animate={{ y: 0 }} 
                exit={{ y: "100%" }}
                className="w-full max-w-lg bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-6 border border-border-main relative overflow-hidden shadow-2xl"
            >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-accent-gold to-primary opacity-20" />
                
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                        <Handshake className="text-primary" />
                        Negotiate Contract
                    </h2>
                    <button onClick={onClose} className="p-2 bg-hover-bg rounded-full text-text-muted hover:text-text-main">
                        <X size={20} />
                    </button>
                </div>

                <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="text-primary" size={16} />
                    <div className="space-y-0.5">
                        <p className="text-xs font-bold text-text-main">Finalizing agreement with {selectedReq.senderName}</p>
                        <p className="text-[11px] text-text-muted font-medium">Agreement for learning {selectedReq.learnSkill}.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-text-muted pl-1 tracking-wide">Days of teaching</label>
                            <input 
                                type="number" min="1" max="30" value={contractDays || ''}
                                onChange={e => setContractDays(parseInt(e.target.value) || 0)}
                                className="w-full bg-hover-bg border-none rounded-xl px-4 py-3 text-sm font-bold outline-none ring-primary/20 focus:ring-2 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-text-muted pl-1 tracking-wide">Session length</label>
                            <select 
                                value={contractDuration}
                                onChange={e => setContractDuration(e.target.value)}
                                className="w-full bg-hover-bg border-none rounded-xl px-4 py-3 text-sm font-bold outline-none ring-primary/20 focus:ring-2 appearance-none transition-all"
                            >
                                <option>30 mins</option>
                                <option>45 mins</option>
                                <option>60 mins</option>
                                <option>90 mins</option>
                                <option>120 mins</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-text-muted pl-1 tracking-wide">Skill credits exchange</label>
                            <input 
                                type="number" step="10" min="0" value={contractCredits || ''}
                                onChange={e => setContractCredits(parseInt(e.target.value) || 0)}
                                className="w-full bg-hover-bg border-none rounded-xl px-4 py-3 text-sm font-bold outline-none ring-primary/20 focus:ring-2 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-text-muted pl-1 tracking-wide">Daily start time</label>
                            <input 
                                type="time" value={contractTime}
                                onChange={e => setContractTime(e.target.value)}
                                className="w-full bg-hover-bg border-none rounded-xl px-4 py-3 text-sm font-bold outline-none ring-primary/20 focus:ring-2 [color-scheme:light] transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted pl-1 tracking-wide">Starting date</label>
                        <input 
                            type="date" value={contractDate}
                            onChange={e => setContractDate(e.target.value)}
                            className="w-full bg-hover-bg border-none rounded-xl px-4 py-3 text-sm font-bold outline-none ring-primary/20 focus:ring-2 [color-scheme:light] transition-all"
                        />
                    </div>
                </div>

                <button 
                    disabled={loading}
                    onClick={createContract}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-xs tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-primary/20"
                >
                    {loading ? 'Finalizing...' : 'Sign & finalize agreement'}
                </button>
            </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
