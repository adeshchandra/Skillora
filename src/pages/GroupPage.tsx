import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDoc, updateDoc, increment, arrayUnion, setDoc, where, orderBy, deleteDoc, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../App';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DAOGroup, Quiz, UserProfile, UserInterest } from '../types';
import { POPULAR_SKILLS } from '../constants';
import { Shield, Users, Timer, CheckCircle, Lock, Trophy, ArrowRight, Play, Info, X, Search as SearchIcon, Bell, Target, Edit3, Trash2, Copy, Plus, ChevronDown, ChevronUp, Clock, AlertTriangle, RefreshCw, Download, Star, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getUserInterests, rankItems } from '../lib/tracking';

const FilterSystem = ({ selectedTags, setSelectedTags, searchQuery, setSearchQuery }: any) => {
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t: string) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  return (
    <div className="bg-white dark:bg-black border-b border-border-main dark:border-border-main">
      <div className="px-4 py-3 space-y-3">
        <div className="relative flex items-center">
            <SearchIcon size={16} className="absolute left-3 text-text-muted" />
            <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find a DAO goal..."
                className="w-full bg-hover-bg dark:bg-black border-none dark:border dark:border-border-main dark:text-white rounded-xl py-2 pl-10 pr-4 text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
            />
            {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 p-1 text-text-muted">
                    <X size={14} />
                </button>
            )}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button 
                onClick={() => setSelectedTags([])}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                    selectedTags.length === 0 ? 'bg-primary text-white shadow-sm shadow-primary/20' : 'bg-hover-bg text-text-main hover:bg-border-main'
                }`}
            >
                All
            </button>
            {POPULAR_SKILLS.map(skill => (
                <button 
                    key={skill}
                    onClick={() => toggleTag(skill)}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                        selectedTags.includes(skill) ? 'bg-primary text-white' : 'bg-hover-bg text-text-main hover:bg-border-main'
                    }`}
                >
                    {skill}
                </button>
            ))}
            {Array.from(new Set(selectedTags.filter((t: string) => !POPULAR_SKILLS.includes(t)))).map((tag: string) => (
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

const QuizComponent = ({ group, onComplete }: { group: DAOGroup, onComplete: () => void }) => {
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentStep, setCurrentStep] = useState<'locked' | 'active' | 'result' | 'expired'>('locked');
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isCanceled, setIsCanceled] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(true);

  useEffect(() => {
    // Fetch the most recent available quiz
    const q = query(
      collection(db, 'quizzes'), 
      where('groupId', '==', group.id),
      orderBy('availableFrom', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        // Find the first quiz that is currently within its availability window
        const now = new Date();
        const activeQuiz = snap.docs.find(d => {
            const data = d.data();
            const start = new Date(data.availableFrom);
            const end = new Date(data.availableUntil);
            return now >= start && now <= end;
        });

        if (activeQuiz) {
            setQuiz({ id: activeQuiz.id, ...activeQuiz.data() } as Quiz);
        } else {
            setQuiz(null);
            setLoadingRecord(false);
        }
      } else {
        setLoadingRecord(false);
      }
    });
    return unsubscribe;
  }, [group.id]);

  useEffect(() => {
    if (!user || !quiz) return;
    
    // Check if user already took THIS specific quiz
    const checkRecord = async () => {
        try {
            const recordRef = doc(db, `daoGroups/${group.id}/records`, `${quiz.id}_${user.uid}`);
            const snap = await getDoc(recordRef);
            if (snap.exists()) {
                const data = snap.data();
                setSelections(data.selections || {});
                setScore(data.score || 0);
                setCurrentStep('result');
            }
        } catch (err) {
            console.error("Error checking quiz record:", err);
        } finally {
            setLoadingRecord(false);
        }
    };
    checkRecord();
  }, [user, quiz, group.id]);

  useEffect(() => {
    let timer: any;
    if (currentStep === 'active' && timeLeft !== null && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (timeLeft === 0 && currentStep === 'active') {
      setIsCanceled(true);
      setCurrentStep('expired');
    }
    return () => clearInterval(timer);
  }, [currentStep, timeLeft]);

  const handleStart = () => {
    if (quiz) {
        setTimeLeft(quiz.durationMinutes * 60);
        setCurrentStep('active');
    }
  };

  const handleSelectOption = (qIdx: number, oIdx: number) => {
    if (isCanceled || !quiz || currentStep !== 'active') return;
    if (selections[qIdx] !== undefined) return; // Locked

    setSelections(prev => ({ ...prev, [qIdx]: oIdx }));
  };

  const handleSubmit = async () => {
    if (!user || !quiz || isCanceled) return;

    let calcScore = 0;
    quiz.questions.forEach((q, idx) => {
      const selected = selections[idx];
      if (selected === undefined) return;
      if (selected === q.correctAnswerIndex) {
        calcScore += 1;
      } else if (quiz.negativeMarking) {
        calcScore -= 0.25;
      }
    });

    setScore(calcScore);

    const recordRef = doc(db, `daoGroups/${group.id}/records`, `${quiz.id}_${user.uid}`);
    await setDoc(recordRef, {
      userId: user.uid,
      score: calcScore,
      total: quiz.questions.length,
      selections: selections,
      submittedAt: new Date().toISOString(),
      quizId: quiz.id
    });

    // Update global member stats for leaderboard
    const memberRef = doc(db, `daoGroups/${group.id}/members`, user.uid);
    await updateDoc(memberRef, {
        latestQuizScore: calcScore,
        totalQuizzesTaken: increment(1),
        quizzesPassed: increment(calcScore >= (quiz.questions.length / 2) ? 1 : 0) // Example pass criteria
    });

    setCurrentStep('result');
    onComplete();
  };

  if (loadingRecord) return <div className="p-10 flex justify-center"><RefreshCw className="animate-spin text-primary" /></div>;

  if (!quiz) return (
    <div className="p-6 text-center bg-hover-bg dark:bg-hover-bg/10 rounded-xl border border-border-main dark:border-border-main">
      <Timer size={24} className="mx-auto text-text-muted mb-2 opacity-40" />
      <p className="text-xs font-bold text-text-muted italic">No active goal quiz right now.</p>
      <p className="text-[10px] text-text-muted mt-1 tracking-wide font-bold">Admins release quizzes periodically</p>
    </div>
  );

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {currentStep === 'locked' && (
          <motion.div 
            key="locked"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="p-6 bg-text-main rounded-xl text-white space-y-4 shadow-xl border border-white/10"
          >
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                    <Lock size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Daily Verification Quiz</h3>
                  <p className="text-white/60 text-[11px] font-medium flex items-center gap-1.5">
                    <Clock size={10} /> {quiz.durationMinutes}m duration • {quiz.questions.length} Questions
                  </p>
                </div>
             </div>
             {quiz.negativeMarking && (
                <div className="bg-red-500/20 border border-red-500/30 p-2.5 rounded-lg flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-400" />
                    <p className="text-[10px] font-bold text-red-100 tracking-wide">Negative marking active (-0.25)</p>
                </div>
             )}
             <button 
               onClick={handleStart}
               className="w-full bg-white text-text-main py-2.5 rounded-full font-bold text-xs hover:bg-white/90 transition-all flex items-center justify-center gap-2 active:scale-95"
             >
               Start Verification Quiz
             </button>
          </motion.div>
        )}

        {(currentStep === 'active' || currentStep === 'result') && quiz && (
          <motion.div 
             key="quiz-mode"
             initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
             className="space-y-4"
          >
             {currentStep === 'result' ? (
                <div className="p-6 bg-primary rounded-xl text-white text-center space-y-4 shadow-xl mb-6">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                        <Trophy size={24} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-[16px] font-bold">Verification submitted</h3>
                        <p className="text-white/80 text-sm font-medium">Final score: <span className="font-bold text-white">{score}</span> / {quiz.questions.length}</p>
                    </div>
                    <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white transition-all duration-1000" style={{ width: `${quiz?.questions?.length ? (Math.max(0, Number(score) || 0) / quiz.questions.length) * 100 : 0}%` }} />
                    </div>
                    <p className="text-[10px] text-white/60 font-medium tracking-widest pt-2">Detailed report below</p>
                </div>
             ) : (
                <div className="p-3 bg-white border border-border-main rounded-xl flex justify-between items-center text-[10px] font-bold text-text-muted sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary text-white px-2.5 py-1 rounded-lg">Live quiz</div>
                        <span className="text-primary italic">{Object.keys(selections).length} / {quiz.questions.length} done</span>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${timeLeft && timeLeft < 30 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-hover-bg text-text-main'}`}>
                        <Clock size={12} />
                        {timeLeft !== null && Math.floor(timeLeft / 60)}:{timeLeft !== null && (timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                </div>
             )}              <div className="space-y-6 max-h-[60vh] overflow-y-auto px-1 pt-2 pb-4 scroll-smooth no-scrollbar">
                {quiz.questions.map((q, qIdx) => {
                    const selectedIdx = selections[qIdx];
                    const isAnswered = selectedIdx !== undefined;

                    return (
                        <div key={`quiz-q-${qIdx}`} className="p-5 bg-white dark:bg-black rounded-2xl border border-border-main dark:border-border-main space-y-4 shadow-sm">
                            <h3 className="text-sm font-bold text-text-main dark:text-white leading-tight">
                                <span className="text-primary mr-2">Q{qIdx + 1}.</span>
                                {q.question}
                            </h3>
                            
                            <div className="space-y-2">
                                {q.options.map((opt, oIdx) => {
                                    let variant = 'default';
                                    if (currentStep === 'result') {
                                        if (oIdx === q.correctAnswerIndex) variant = 'correct';
                                        else if (selectedIdx === oIdx && oIdx !== q.correctAnswerIndex) variant = 'wrong';
                                    } else if (selectedIdx === oIdx) {
                                        variant = 'selected';
                                    }

                                    return (
                                        <button
                                            key={`quiz-q-${qIdx}-opt-${oIdx}`}
                                            disabled={isAnswered || currentStep === 'result'}
                                            onClick={() => handleSelectOption(qIdx, oIdx)}
                                            className={`
                                                w-full text-left p-3.5 rounded-xl border transition-all font-medium text-xs flex justify-between items-center group
                                                ${variant === 'correct' ? 'bg-green-50 dark:bg-green-500/10 border-green-500 text-green-700 dark:text-green-400 shadow-sm' : ''}
                                                ${variant === 'wrong' ? 'bg-red-50 dark:bg-red-500/10 border-red-500 text-red-700 dark:text-red-400' : ''}
                                                ${variant === 'selected' ? 'bg-primary/5 border-primary text-primary' : ''}
                                                ${variant === 'default' ? 'bg-white dark:bg-black border-border-main dark:border-border-main hover:bg-hover-bg dark:hover:bg-hover-bg/10 hover:border-primary/30 text-text-main dark:text-white' : ''}
                                                ${isAnswered && variant === 'default' ? 'opacity-50' : ''}
                                            `}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black
                                                    ${variant === 'correct' ? 'bg-green-500 text-white' : ''}
                                                    ${variant === 'wrong' ? 'bg-red-500 text-white' : ''}
                                                    ${variant === 'selected' ? 'bg-primary text-white' : ''}
                                                    ${variant === 'default' ? 'bg-hover-bg dark:bg-hover-bg/20 text-text-muted' : ''}
                                                `}>
                                                    {String.fromCharCode(65 + oIdx)}
                                                </div>
                                                <span>{opt}</span>
                                            </div>
                                            {variant === 'correct' && <CheckCircle size={14} className="text-green-500" />}
                                            {variant === 'wrong' && <X size={14} className="text-red-500" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
             </div>

             {currentStep === 'active' && (
                <button 
                    onClick={handleSubmit}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-primary-dark transition-all active:scale-[0.98] mt-4"
                >
                    Submit Verification Quiz
                </button>
             )}
          </motion.div>
        )}

        {currentStep === 'expired' && (
          <motion.div 
            key="expired"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="p-8 bg-red-50 border border-red-100 rounded-xl text-center space-y-4"
          >
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                <AlertTriangle size={32} />
            </div>
            <div className="space-y-1">
                <h3 className="text-base font-bold text-red-900">Quiz Canceled</h3>
                <p className="text-xs text-red-700/70 font-medium">Time limit expired before submission.</p>
            </div>
            <p className="text-[10px] text-red-800 font-bold uppercase tracking-widest bg-red-100/50 py-1 rounded">No Points Earned</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ManageQuizzes = ({ groupId, onBack }: { groupId: string, onBack: () => void }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Partial<Quiz> | null>(null);
  
  // Quiz Form State
  const [questions, setQuestions] = useState<{question: string, options: string[], correctAnswerIndex: number}[]>([]);
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [duration, setDuration] = useState(10);
  const [negativeMarking, setNegativeMarking] = useState(false);
  
  // Question Form State
  const [qText, setQText] = useState('');
  const [opts, setOpts] = useState(['', '', '', '']);
  const [correctIdx, setCorrectIdx] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'quizzes'), where('groupId', '==', groupId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
        setQuizzes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quiz)));
    });
  }, [groupId]);

  const addQuestion = () => {
    if (!qText || opts.some(o => !o)) return;
    setQuestions([...questions, { question: qText, options: [...opts], correctAnswerIndex: correctIdx }]);
    setQText('');
    setOpts(['', '', '', '']);
    setCorrectIdx(0);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (questions.length === 0 || !availableFrom || !availableUntil) {
        alert("Please complete the quiz requirements (timing & questions).");
        return;
    }
    const quizData = {
        questions,
        availableFrom: new Date(availableFrom).toISOString(),
        availableUntil: new Date(availableUntil).toISOString(),
        durationMinutes: duration,
        negativeMarking,
        createdAt: serverTimestamp(),
        groupId
    };

    try {
        if (editingQuiz?.id) {
            await updateDoc(doc(db, 'quizzes', editingQuiz.id), quizData);
        } else {
            await addDoc(collection(db, 'quizzes'), quizData);
        }
        resetForm();
    } catch (err) {
        console.error("Save quiz error:", err);
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingQuiz(null);
    setQuestions([]);
    setAvailableFrom('');
    setAvailableUntil('');
    setDuration(10);
    setNegativeMarking(false);
  };

  const startEdit = (q: Quiz) => {
    setEditingQuiz(q);
    setQuestions(q.questions);
    setAvailableFrom(format(new Date(q.availableFrom), "yyyy-MM-dd'T'HH:mm"));
    setAvailableUntil(format(new Date(q.availableUntil), "yyyy-MM-dd'T'HH:mm"));
    setDuration(q.durationMinutes);
    setNegativeMarking(q.negativeMarking);
    setIsAdding(true);
  };

  const reuseQuiz = (q: Quiz) => {
    setQuestions(q.questions);
    setDuration(q.durationMinutes);
    setNegativeMarking(q.negativeMarking);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this quiz forever?")) {
        await deleteDoc(doc(db, 'quizzes', id));
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black animate-in slide-in-from-bottom duration-300">
      <div className="p-4 border-b border-border-main dark:border-border-main flex items-center justify-between sticky top-0 bg-white dark:bg-black z-10">
        <button onClick={onBack} className="p-2 -ml-2 text-text-muted hover:text-text-main"><ArrowRight size={22} className="rotate-180" /></button>
        <h2 className="font-bold text-sm dark:text-white">Quiz Management</h2>
        {!isAdding ? (
            <button onClick={() => setIsAdding(true)} className="p-2 bg-primary text-white rounded-lg"><Plus size={18} /></button>
        ) : (
            <button onClick={resetForm} className="p-2 text-text-muted"><X size={20} /></button>
        )}
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-6">
        {isAdding ? (
            <div className="space-y-6 pb-20">
                <div className="p-4 bg-hover-bg dark:bg-hover-bg/10 rounded-2xl border border-border-main dark:border-border-main space-y-4">
                    <h3 className="text-xs font-bold tracking-wide text-text-muted">Settings</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-text-muted px-1">Starts at</label>
                            <input 
                                type="datetime-local" 
                                value={availableFrom} 
                                onChange={e => setAvailableFrom(e.target.value)}
                                className="w-full bg-white dark:bg-black dark:text-white border border-border-main dark:border-border-main rounded-xl p-2.5 text-xs font-bold outline-none focus:ring-1 focus:ring-primary dark:[color-scheme:dark]"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-text-muted px-1">Ends at</label>
                            <input 
                                type="datetime-local" 
                                value={availableUntil} 
                                onChange={e => setAvailableUntil(e.target.value)}
                                className="w-full bg-white dark:bg-black dark:text-white border border-border-main dark:border-border-main rounded-xl p-2.5 text-xs font-bold outline-none focus:ring-1 focus:ring-primary dark:[color-scheme:dark]"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-xs font-bold text-text-main dark:text-white">Time limit (mins)</p>
                            <p className="text-[10px] text-text-muted">Once member starts quiz</p>
                        </div>
                        <input 
                            type="number" 
                            min="1" 
                            value={duration || ''} 
                            onChange={e => setDuration(parseInt(e.target.value) || 0)}
                            className="w-16 bg-white dark:bg-black dark:text-white border border-border-main dark:border-border-main rounded-lg p-2 text-xs font-bold text-center outline-none"
                        />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-black rounded-xl border border-border-main/50 dark:border-border-main">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={14} className={negativeMarking ? "text-red-500" : "text-text-muted"} />
                            <span className="text-xs font-bold text-text-main dark:text-white">Negative Marking (-0.25)</span>
                        </div>
                        <button 
                            type="button" 
                            onClick={() => setNegativeMarking(!negativeMarking)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${negativeMarking ? 'bg-red-500' : 'bg-border-main'}`}
                        >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${negativeMarking ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-text-muted px-1 flex justify-between">
                        Questions ({questions.length})
                    </h3>
                    <div className="space-y-3">
                        {questions.map((q, i) => (
                            <div key={`manage-q-${i}`} className="p-3 bg-white dark:bg-black border border-border-main dark:border-border-main rounded-xl relative group">
                                <button onClick={() => removeQuestion(i)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                                <p className="text-xs font-bold text-text-main dark:text-white mb-2">{i+1}. {q.question}</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {q.options.map((o, oi) => (
                                        <div key={`manage-q-${i}-opt-${oi}`} className={`text-[9px] font-bold px-2 py-1 rounded ${oi === q.correctAnswerIndex ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-hover-bg dark:bg-hover-bg/20 text-text-muted'}`}>
                                            {o}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 space-y-4">
                        <textarea 
                            value={qText} 
                            onChange={e => setQText(e.target.value)} 
                            placeholder="Type question here..."
                            className="w-full bg-white dark:bg-black dark:text-white border border-border-main dark:border-border-main rounded-xl p-3 text-xs font-medium outline-none focus:ring-1 focus:ring-primary min-h-[80px]"
                        />
                        <div className="space-y-2">
                            {opts.map((o, i) => (
                                <div key={`manage-q-new-opt-${i}`} className="flex gap-2">
                                    <input 
                                        value={o}
                                        onChange={e => {
                                            const newOpts = [...opts];
                                            newOpts[i] = e.target.value;
                                            setOpts(newOpts);
                                        }}
                                        placeholder={`Option ${i+1}`}
                                        className="flex-grow bg-white dark:bg-black dark:text-white border border-border-main dark:border-border-main rounded-lg px-3 py-1.5 text-xs outline-none"
                                    />
                                    <button 
                                        onClick={() => setCorrectIdx(i)}
                                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-colors ${correctIdx === i ? 'bg-green-500 border-green-500 text-white' : 'bg-white dark:bg-black border-border-main dark:border-border-main text-transparent'}`}
                                    >
                                        <CheckCircle size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button onClick={addQuestion} className="w-full py-2 bg-text-main dark:bg-white dark:text-black rounded-xl text-xs font-bold tracking-wide">+ Add question</button>
                    </div>
                </div>

                <button onClick={handleSave} className="w-full py-3.5 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl">
                    {editingQuiz ? 'Update Quiz' : 'Publish Quiz'}
                </button>
            </div>
        ) : (
            <div className="space-y-4">
                {quizzes.length === 0 ? (
                    <div className="py-20 text-center space-y-2">
                        <div className="w-12 h-12 bg-hover-bg rounded-full flex items-center justify-center mx-auto text-text-muted opacity-30"><Edit3 /></div>
                        <p className="text-xs font-bold text-text-muted">No quizzes created yet.</p>
                    </div>
                ) : (
                    quizzes.map((q, idx) => {
                        const now = new Date();
                        const start = new Date(q.availableFrom);
                        const end = new Date(q.availableUntil);
                        const isActive = now >= start && now <= end;
                        const isExpired = now > end;                         return (
                            <div key={`${q.id}-${idx}`} className="p-4 bg-white border border-border-main rounded-2xl space-y-3 shadow-sm hover:border-primary/30 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[9px] font-bold tracking-wide px-2 py-0.5 rounded ${isActive ? 'bg-green-500 text-white' : isExpired ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                                                {isActive ? 'Active' : isExpired ? 'Expired' : 'Scheduled'}
                                            </span>
                                            <span className="text-[10px] font-bold text-text-muted">{q.questions.length} Questions</span>
                                        </div>
                                        <p className="text-[10px] font-medium text-text-muted">
                                            {format(start, 'MMM d, HH:mm')} — {format(end, 'MMM d, HH:mm')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button onClick={() => reuseQuiz(q)} className="p-1.5 hover:bg-hover-bg rounded-lg text-text-muted" title="Reuse"><Copy size={14} /></button>
                                        <button onClick={() => startEdit(q)} className="p-1.5 hover:bg-hover-bg rounded-lg text-text-muted" title="Edit"><Edit3 size={14} /></button>
                                        <button onClick={() => handleDelete(q.id)} className="p-1.5 hover:bg-hover-bg rounded-lg text-red-400" title="Delete"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        )}
      </div>
    </div>
  );
};

const DAODetail = ({ groupId, onBack }: { groupId: string, onBack: () => void }) => {
  const { user, credits } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<DAOGroup | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [showManager, setShowManager] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isStartingChat, setIsStartingChat] = useState(false);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (group?.meetingLink) {
      setMeetingLink(group.meetingLink);
    }
  }, [group?.meetingLink]);

  const updateMeetingLink = async () => {
    if (!group) return;
    try {
      await updateDoc(doc(db, 'daoGroups', groupId), {
        meetingLink: meetingLink.trim()
      });
      setSuccessMsg("Meeting link updated!");
      setShowMeetingForm(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update meeting link");
    }
  };

  const handleMessageAdmin = async () => {
    if (!user || !group || isStartingChat) return;
    setIsStartingChat(true);
    try {
        const participants = [user.uid, group.adminId].sort();
        const conversationId = participants.join('_');
        const convRef = doc(db, 'conversations', conversationId);
        const convSnap = await getDoc(convRef);

        if (!convSnap.exists()) {
            // We need to fetch admin info first if we want to pre-populate names
            const adminSnap = await getDoc(doc(db, 'users', group.adminId));
            const adminData = adminSnap.data();

            await setDoc(convRef, {
                participants,
                participantInfo: {
                    [user.uid]: {
                        displayName: user.displayName || 'Learner',
                        photoURL: user.photoURL || ''
                    },
                    [group.adminId]: {
                        displayName: adminData?.displayName || 'Admin',
                        photoURL: adminData?.photoURL || ''
                    }
                },
                unreadCount: {
                    [user.uid]: 0,
                    [group.adminId]: 0
                },
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp()
            });
        }
        navigate(`/chat/${conversationId}`);
    } catch (err) {
        console.error("Error starting chat:", err);
        alert("Could not start conversation with admin.");
    } finally {
        setIsStartingChat(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    try {
      await deleteDoc(doc(db, `daoGroups/${groupId}/members`, memberId));
      await updateDoc(doc(db, 'daoGroups', groupId), {
        membersCount: increment(-1)
      });
      setSuccessMsg("Member removed successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to remove member");
    }
  };

  useEffect(() => {
    if (userSearch.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const q = query(collection(db, 'users'), where('displayName', '>=', userSearch), where('displayName', '<=', userSearch + '\uf8ff'), limit(5));
    const unsub = onSnapshot(q, (snap) => {
      setSearchResults(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
      setIsSearching(false);
    });
    return unsub;
  }, [userSearch]);

  const addMember = async (targetUser: any) => {
    if (!group) return;
    const memberRef = doc(db, `daoGroups/${groupId}/members`, targetUser.uid);
    const snap = await getDoc(memberRef);
    if (snap.exists()) {
      alert("User is already a member!");
      return;
    }

    const groupRef = doc(db, 'daoGroups', groupId);
    try {
      await setDoc(memberRef, {
        userId: targetUser.uid,
        displayName: targetUser.displayName || 'Learner',
        photoURL: targetUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${targetUser.uid}`,
        pointsStaked: 0, // Admin-added might not require stake? Or we can assume 0 or the stake.
        quizzesPassed: 0,
        joinedAt: new Date().toISOString()
      });
      await updateDoc(groupRef, { membersCount: increment(1) });
      
      setSuccessMsg(`Added ${targetUser.displayName} to the group!`);
      setUserSearch('');
      setSearchResults([]);
    } catch (err) {
      console.error(err);
      alert("Failed to add member.");
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'daoGroups', groupId), (snap) => {
      if (snap.exists()) setGroup({ id: snap.id, ...snap.data() } as DAOGroup);
    });
    
    const unsubMembers = onSnapshot(collection(db, `daoGroups/${groupId}/members`), (snap) => {
        const m = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMembers(m);
        if (user && snap.docs.find(d => d.id === user.uid)) setIsMember(true);
    });

    return () => { unsub(); unsubMembers(); };
  }, [groupId, user]);

  const downloadLeaderboardPDF = () => {
    if (!group) return;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(33, 33, 33);
    doc.text(`DAO Leaderboard Report`, 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(79, 70, 229); // Primary Color
    doc.text(group.name, 14, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Topic: ${group.quizTopic}`, 14, 38);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 44);

    // Prepare table data - Sorted from first to last
    const sortedMembers = [...members].sort((a,b) => {
        // Sort by quizzesPassed primarily, then latestQuizScore
        const passDiff = (b.quizzesPassed || 0) - (a.quizzesPassed || 0);
        if (passDiff !== 0) return passDiff;
        return (b.latestQuizScore || 0) - (a.latestQuizScore || 0);
    });

    const tableData = sortedMembers.map((m, idx) => [
        idx + 1,
        m.displayName,
        m.latestQuizScore ?? 'N/A',
        m.quizzesPassed || 0
    ]);

    // Generate Table
    autoTable(doc, {
        head: [['Rank', 'Member Name', 'Latest Score', 'Total Passed Quizzes']],
        body: tableData,
        startY: 52,
        styles: { fontSize: 10, cellPadding: 5 },
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        margin: { top: 52 }
    });

    const fileName = `${group.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.pdf`;
    doc.save(fileName);
  };

  const joinGroup = async () => {
    if (!user || !group || credits < group.stakedPoints) return;
    
    const userRef = doc(db, 'users', user.uid);
    const memberRef = doc(db, `daoGroups/${groupId}/members`, user.uid);
    const groupRef = doc(db, 'daoGroups', groupId);

    try {
        await updateDoc(userRef, { 
            credits: increment(-group.stakedPoints),
            joinedGroups: arrayUnion(groupId) 
        });
        await setDoc(memberRef, { 
            userId: user.uid, 
            displayName: user.displayName || 'Learner',
            photoURL: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.uid}`,
            pointsStaked: group.stakedPoints, 
            quizzesPassed: 0,
            joinedAt: new Date().toISOString()
        });
        await updateDoc(groupRef, { membersCount: increment(1) });
    } catch (error) {
        console.error("Join DAO Error:", error);
        alert("Failed to join DAO. Please check your permissions or credits.");
    }
  };

  if (!group) return null;
  if (showManager) return <ManageQuizzes groupId={groupId} onBack={() => setShowManager(false)} />;

  const isAdmin = user?.uid === group.adminId;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black animate-in slide-in-from-right duration-200">
      <div className="sticky top-0 bg-white dark:bg-black z-40 px-4 h-14 flex items-center gap-4 border-b border-border-main dark:border-border-main">
        <button onClick={onBack} className="p-1 -ml-1 text-text-muted hover:text-text-main">
           <ArrowRight className="rotate-180" size={24} />
        </button>
        <h2 className="font-bold text-[16px] truncate flex-grow text-text-main dark:text-white">{group.name}</h2>
        <div className="bg-hover-bg dark:bg-hover-bg/20 text-text-main dark:text-white font-bold text-[10px] px-2.5 py-1 rounded tracking-wide border border-border-main dark:border-border-main">
            {group.status}
        </div>
      </div>

      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-green-500 text-white px-6 py-2.5 rounded-full text-xs font-black shadow-xl"
          >
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 space-y-6 overflow-y-auto pb-20">
        <div className="space-y-4">
           <div className="aspect-[21/9] bg-hover-bg rounded-xl flex items-center justify-center border border-border-main/50 relative overflow-hidden group">
              {group.image ? (
                  <img src={group.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                  <Shield size={48} className="text-primary/20 group-hover:scale-110 transition-transform" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
           </div>
           
           <div className="space-y-2 px-1 pt-2">
              <div className="text-[10px] font-bold text-primary tracking-wide">
                {group.stakedPoints} POINTS STAKE REQUIRED
              </div>
              <h2 className="text-[15px] font-bold text-text-main leading-snug">
                {group.quizTopic}
              </h2>
           </div>
           
           {group.tags && group.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
              {Array.from(new Set(group.tags || [])).map((tag, tIdx) => (
                  <span key={`group-tag-${tag}-${tIdx}`} className="text-[10px] font-bold bg-hover-bg text-text-muted px-2 py-0.5 rounded border border-border-main/20">#{tag}</span>
              ))}
              </div>
           )}
        </div>

        <div className="flex gap-2">
            <div className="flex-1 p-3 bg-hover-bg rounded-xl border border-border-main/50 text-center">
                <p className="text-[10px] font-bold text-text-muted mb-1">Members</p>
                <p className="text-sm font-bold text-text-main">{members.length} / {group.memberLimit}</p>
            </div>
            <div className="flex-1 p-3 bg-hover-bg rounded-xl border border-border-main/50 text-center">
                <p className="text-[10px] font-bold text-text-muted mb-1">Period</p>
                <p className="text-sm font-bold text-text-main">{group.goalPeriodDays} days</p>
            </div>
        </div>

        {isAdmin && (
            <div className="space-y-2 mb-2">
                {group.isPrivate && (
                  <button 
                      onClick={() => setShowAddMember(!showAddMember)}
                      className="w-full py-3 bg-primary text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary-dark transition-all shadow-md shadow-primary/10 tracking-wide"
                  >
                      <Plus size={16} /> {showAddMember ? 'Close Add Member' : 'Add Member (Private Group)'}
                  </button>
                )}

                <AnimatePresence>
                  {showAddMember && group.isPrivate && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-3 p-3 bg-hover-bg dark:bg-hover-bg/10 rounded-xl border border-border-main/50 dark:border-border-main"
                    >
                      <div className="relative">
                        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input 
                          type="text"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Search user by name..."
                          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-black border border-border-main dark:border-border-main dark:text-white rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        {isSearching ? (
                          <p className="text-[10px] font-bold text-text-muted text-center py-2">Searching...</p>
                        ) : searchResults.length > 0 ? (
                          searchResults.map((u, idx) => (
                            <div key={`${u.uid}-${idx}`} className="flex items-center justify-between p-2 bg-white dark:bg-black rounded-lg border border-border-main/30 dark:border-border-main shadow-sm">
                              <div className="flex items-center gap-2">
                                <img src={u.photoURL} className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                                <span className="text-[11px] font-bold text-text-main dark:text-white">{u.displayName}</span>
                              </div>
                              <button 
                                onClick={() => addMember(u)}
                                className="px-3 py-1 bg-primary text-white rounded-md text-[10px] font-bold hover:bg-primary-dark transition-colors"
                              >
                                Add
                              </button>
                            </div>
                          ))
                        ) : userSearch.length >= 2 ? (
                          <p className="text-[10px] font-bold text-text-muted text-center py-2">No users found.</p>
                        ) : null}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button 
                    onClick={() => setShowManager(true)}
                    className="w-full py-3 bg-white text-primary rounded-xl font-bold text-xs border-2 border-primary/20 flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all shadow-sm tracking-wide"
                >
                    <Edit3 size={16} /> Manage group quizzes
                </button>
                <button 
                    onClick={downloadLeaderboardPDF}
                    className="w-full py-3 bg-hover-bg text-text-main rounded-xl font-bold text-xs border border-border-main flex items-center justify-center gap-2 hover:bg-border-main transition-all tracking-wide"
                >
                    <Download size={16} className="text-accent-gold" /> Download leaderboard PDF
                </button>
            </div>
        )}

        {isMember && (
          <div className="space-y-3">
             <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                    <Timer size={14} /> Meeting & Schedule
                  </h4>
                  {isAdmin && (
                    <button 
                      onClick={() => setShowMeetingForm(!showMeetingForm)}
                      className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>

                {group.meetingLink ? (
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-black rounded-xl border border-border-main/50 dark:border-border-main shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-hover-bg dark:bg-hover-bg/20 rounded-lg flex items-center justify-center text-primary shrink-0">
                        <Users size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-text-muted">Link to join meeting</p>
                        <p className="text-xs font-bold text-text-main dark:text-white truncate max-w-[150px]">{group.meetingLink}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(group.meetingLink || '');
                        setSuccessMsg("Link copied to clipboard!");
                      }}
                      className="p-2 hover:bg-hover-bg rounded-lg text-text-muted transition-colors"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] font-bold text-text-muted text-center py-2 italic">Meeting link not provided yet</p>
                )}

                {isAdmin && showMeetingForm && (
                  <div className="space-y-3 pt-2 border-t border-primary/10">
                    <input 
                      type="text"
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                      placeholder="Enter meeting link or ID..."
                      className="w-full bg-white dark:bg-black dark:text-white border border-border-main dark:border-border-main rounded-xl p-3 text-xs font-medium focus:ring-1 focus:ring-primary outline-none"
                    />
                    <button 
                      onClick={updateMeetingLink}
                      className="w-full py-2.5 bg-primary text-white rounded-xl font-bold text-xs"
                    >
                      Save Meeting Info
                    </button>
                  </div>
                )}
             </div>
          </div>
        )}

        {(!isMember && !isAdmin) ? (
          <div className="space-y-4 pt-2">
             <div className="p-3 bg-accent-gold/5 rounded-xl border border-accent-gold/20 flex gap-3">
                <Info size={18} className="text-accent-gold shrink-0 mt-0.5" />
                <p className="text-xs text-text-main font-medium leading-relaxed">
                    {group.isPrivate 
                        ? "This is a private group. Only the admin can add members."
                        : `Stake ${group.stakedPoints} credits to commit. Points split among winners if goal fails.`
                    }
                </p>
             </div>
             {!group.isPrivate || isAdmin ? (
                <button 
                  onClick={joinGroup}
                  disabled={credits < (group.stakedPoints || 0)}
                  className="w-full py-3 bg-primary text-white rounded-full font-bold text-sm hover:bg-primary-dark shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  Stake & Join DAO
                </button>
             ) : (
                <button 
                  onClick={handleMessageAdmin}
                  disabled={isStartingChat}
                  className="w-full py-3 bg-primary text-white rounded-full font-bold text-sm hover:bg-primary-dark shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare size={16} />
                  {isStartingChat ? 'Connecting...' : 'Message Admin to Join'}
                </button>
             )}
          </div>
        ) : (
          <div className="space-y-8">
             {isMember && <QuizComponent group={group} onComplete={() => {}} />}
             
             <div className="space-y-4">
                <h4 className="font-bold text-sm text-text-main flex items-center gap-2">
                   Leaderboard
                   <Trophy size={14} className="text-accent-gold" />
                </h4>
                <div className="space-y-1.5">
                    {members.sort((a,b) => (b.quizzesPassed || 0) - (a.quizzesPassed || 0)).map((m, idx) => (
                      <div 
                        key={m.id || m.userId || `member-${idx}`} 
                        className="flex items-center gap-3 p-3 bg-white dark:bg-black border border-border-main dark:border-border-main rounded-xl hover:bg-hover-bg dark:hover:bg-hover-bg/10 transition-colors"
                      >
                         <span className="w-4 text-center font-bold text-xs text-text-muted shrink-0">{idx + 1}</span>
                         <div 
                           className="flex-grow flex items-center gap-3 min-w-0 cursor-pointer"
                           onClick={() => navigate(`/user/${m.userId || m.id}`)}
                         >
                            <img src={m.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${m.displayName}`} className="w-8 h-8 rounded-full bg-hover-bg dark:bg-hover-bg/20 shrink-0" referrerPolicy="no-referrer" />
                            <div className="flex-grow min-w-0">
                                <p className="text-sm font-bold text-text-main dark:text-white truncate">{m.displayName}</p>
                                <p className="text-[10px] text-text-muted font-medium">Last Score: {m.latestQuizScore ?? 'N/A'}</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-3 shrink-0">
                            <div className="text-[11px] font-bold text-text-main dark:text-white">
                                {m.quizzesPassed || 0} ✓
                            </div>
                            {isAdmin && (m.id !== user?.uid && m.userId !== user?.uid) && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeMember(m.id || m.userId);
                                }}
                                className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                         </div>
                      </div>
                    ))}
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

import DAOGroupCard from '../components/DAOGroupCard';

export default function GroupPage() {
  const { user, credits } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState<DAOGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);
  const [userInterests, setUserInterests] = useState<UserInterest | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(searchParams.get('id'));
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
      setIsScrolling(true);
      clearTimeout(scrollTimeout);
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

  const fetchGroups = (isRefreshing = false) => {
    if (isRefreshing) setRefreshing(true);
    
    const q = query(collection(db, 'daoGroups'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DAOGroup));
      
      if (isRefreshing) {
        // High quality: Keep top 5 latest, shuffle the rest (11-50)
        const recent = data.slice(0, 5);
        const older = data.slice(5);
        const shuffled = [...older].sort(() => Math.random() - 0.5);
        data = [...recent, ...shuffled];
      }

      setGroups(data);
      setRefreshing(false);
    });
    return unsubscribe;
  };

  useEffect(() => {
    const unsubscribe = fetchGroups();
    return unsubscribe;
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
        const resistedDistance = Math.min(distance * 0.4, 150);
        setPullDistance(resistedDistance);
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60) {
      fetchGroups(true);
    }
    setPullDistance(0);
    setStartY(0);
  };

  const [joiningId, setJoiningId] = useState<string | null>(null);

  const handleJoin = async (group: DAOGroup) => {
    if (!user || credits < group.stakedPoints || joiningId) {
        if (!user) alert("Please sign in to join!");
        else if (credits < group.stakedPoints) alert("Not enough credits to stake!");
        return;
    }

    if ((group.isPrivate && group.adminId !== user.uid) || group.adminId === user.uid) {
        if (group.adminId === user.uid) {
            alert("As the admin, you cannot join your own group as a contributor.");
        } else {
            alert("This is a private group. Only the admin can add members.");
        }
        return;
    }
    
    setJoiningId(group.id);
    const userRef = doc(db, 'users', user.uid);
    const memberRef = doc(db, `daoGroups/${group.id}/members`, user.uid);
    const groupRef = doc(db, 'daoGroups', group.id);

    try {
        await updateDoc(userRef, { 
            credits: increment(-group.stakedPoints),
            joinedGroups: arrayUnion(group.id) 
        });
        await setDoc(memberRef, { 
            userId: user.uid, 
            displayName: user.displayName || 'Learner',
            photoURL: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.uid}`,
            pointsStaked: group.stakedPoints, 
            quizzesPassed: 0,
            joinedAt: new Date().toISOString()
        });
        await updateDoc(groupRef, { membersCount: increment(1) });
    } catch (err) {
        console.error("Join error:", err);
        alert("Failed to join DAO. Please try again.");
    } finally {
        setJoiningId(null);
    }
  };

  const filteredGroups = rankItems(
    groups.filter(group => {
      const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           group.quizTopic.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (group.tags && group.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
      
      const matchesTags = selectedTags.length === 0 || 
                         (group.tags && selectedTags.every(tag => group.tags?.includes(tag)));
      
      return matchesSearch && matchesTags;
    }),
    userInterests
  );

  if (selectedGroupId) {
    return <DAODetail groupId={selectedGroupId} onBack={() => setSelectedGroupId(null)} />;
  }

  return (
    <div 
      className="min-h-screen pb-20 relative"
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
            className={`w-8 h-8 rounded-full bg-white dark:bg-black shadow-lg border border-border-main flex items-center justify-center ${refreshing ? 'text-primary' : 'text-text-muted'}`}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </motion.div>
        </div>
      )}

      <div className="p-5 bg-white dark:bg-black border-b border-border-main dark:border-border-main">
        <h1 className="text-xl font-bold text-text-main dark:text-white tracking-tight mb-0.5">DeadlineDAO</h1>
        <p className="text-text-muted text-[10px] font-bold tracking-wide">Commit together. Earn together.</p>
      </div>

      <motion.div 
        animate={{ 
          y: isScrolling ? -200 : 0,
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

      <div className="p-4 flex flex-col">
        {filteredGroups.length > 0 && 
          filteredGroups.map((group, idx) => (
            <DAOGroupCard 
                key={`main-group-${group.id}-${idx}`} 
                group={group} 
                onJoin={handleJoin}
                onView={(id) => setSelectedGroupId(id)}
                isJoining={joiningId === group.id}
            />
          ))
        }
      </div>
    </div>
  );
}
