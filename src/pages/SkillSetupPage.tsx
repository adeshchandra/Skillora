import React, { useState } from 'react';
import { useAuth } from '../App';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, GraduationCap, ArrowRight, Check, Brain, Target, Sparkles, ChevronRight, X, Plus } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const roles = [
  {
    id: 'tutor',
    title: 'GURU',
    subtitle: 'I want to share my expertise',
    icon: GraduationCap,
    description: 'Help others master new skills and grow their potential while earning credits.',
    color: 'bg-accent-gold',
    textColor: 'text-accent-gold'
  },
  {
    id: 'student',
    title: 'SEEKER',
    subtitle: 'I want to learn new skills',
    icon: BookOpen,
    description: 'Find mentors who can guide you through your learning journey efficiently.',
    color: 'bg-primary',
    textColor: 'text-primary'
  }
];

const PRESET_SKILLS = [
  'Web Development', 'UI/UX Design', 'Digital Marketing', 'Data Science', 
  'Graphic Design', 'Photography', 'Business Strategy', 'Creative Writing',
  'Public Speaking', 'Mobile Development', 'Product Management', 'Blockchain'
];

export default function SkillSetupPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const addCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (customSkill && !selectedSkills.includes(customSkill)) {
      setSelectedSkills([...selectedSkills, customSkill]);
      setCustomSkill('');
    }
  };

  const handleComplete = async () => {
    if (!user || !role || selectedSkills.length === 0) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        role: role,
        teachSkills: role === 'tutor' ? selectedSkills : [],
        learnSkills: role === 'student' ? selectedSkills : [],
        onboardingCompleted: true
      });
      navigate('/');
    } catch (error) {
      console.error('Onboarding failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-[400px] mx-auto w-full py-20">
        
        {/* Progress Header */}
        <div className="w-full mb-12 space-y-6">
            <div className="flex items-center justify-center gap-1.5 opacity-40">
                <div className="text-xl font-black tracking-tighter text-text-main">Skillora</div>
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1" />
            </div>
            <div className="flex items-center gap-1.5 justify-center">
                <div className={`h-1 rounded-full transition-all duration-500 ${step >= 1 ? 'w-8 bg-text-main' : 'w-4 bg-text-muted/20'}`} />
                <div className={`h-1 rounded-full transition-all duration-500 ${step >= 2 ? 'w-8 bg-text-main' : 'w-4 bg-text-muted/20'}`} />
            </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-8"
            >
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-black text-text-main tracking-tight">Choose your path</h1>
                <p className="text-[12px] font-bold text-text-muted">How would you like to use Skillora?</p>
              </div>

              <div className="grid gap-4">
                {roles.map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setRole(r.id)}
                      className={`relative w-full p-6 text-left rounded-3xl border-2 transition-all ${
                        role === r.id 
                          ? `border-text-main bg-text-main text-white shadow-xl shadow-text-main/10` 
                          : 'border-border-main hover:border-text-main/20 bg-hover-bg/30'
                      }`}
                    >
                      <div className="flex gap-5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${role === r.id ? 'bg-white/10' : 'bg-white shadow-sm'}`}>
                          <Icon size={24} className={role === r.id ? 'text-white' : r.textColor} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black tracking-[0.2em]">{r.title}</span>
                          </div>
                          <h3 className="text-sm font-black">{r.subtitle}</h3>
                          <p className={`text-[10px] font-bold leading-relaxed ${role === r.id ? 'text-white/60' : 'text-text-muted'}`}>
                            {r.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                disabled={!role}
                onClick={() => setStep(2)}
                className="w-full py-4.5 bg-text-main text-white font-black text-sm rounded-2xl hover:bg-black transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                Continue
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-text-main flex items-center justify-center">
                        <Sparkles size={16} className="text-white" />
                    </div>
                </div>
                <h1 className="text-2xl font-black text-text-main tracking-tight">
                    {role === 'tutor' ? 'What do you master?' : 'What do you seek?'}
                </h1>
                <p className="text-[12px] font-bold text-text-muted">
                    {role === 'tutor' ? 'Select skills you can teach others' : 'Select skills you want to learn'}
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {PRESET_SKILLS.map((skill) => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`px-4 py-2 rounded-full text-[11px] font-bold border-2 transition-all ${
                        selectedSkills.includes(skill)
                          ? 'bg-text-main text-white border-text-main'
                          : 'bg-white text-text-muted border-border-main hover:border-text-main/20'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <form onSubmit={addCustomSkill}>
                    <input
                      type="text"
                      value={customSkill}
                      onChange={(e) => setCustomSkill(e.target.value)}
                      placeholder="Add another skill..."
                      className="w-full px-4 py-4 bg-hover-bg/30 border-2 border-dashed border-border-main rounded-2xl text-[12px] font-bold text-text-main outline-none focus:border-text-main focus:bg-white transition-all pr-12"
                    />
                    <button 
                        type="submit"
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-text-main text-white rounded-xl hover:bg-black transition-all"
                    >
                        <Plus size={16} />
                    </button>
                  </form>
                </div>

                {selectedSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-4 bg-hover-bg/20 rounded-2xl border border-dashed border-border-main">
                        {selectedSkills.map(s => (
                            <div key={s} className="px-2 py-1 bg-white border border-border-main rounded-lg flex items-center gap-1.5">
                                <span className="text-[10px] font-black text-text-main">{s}</span>
                                <button onClick={() => toggleSkill(s)} className="text-text-muted hover:text-red-500">
                                    <X size={12} strokeWidth={3} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                    onClick={() => setStep(1)}
                    className="flex-[0.4] py-4.5 border-2 border-border-main text-text-muted font-black text-sm rounded-2xl hover:border-text-main/20 transition-all active:scale-[0.98]"
                >
                    Back
                </button>
                <button
                    disabled={selectedSkills.length === 0 || loading}
                    onClick={handleComplete}
                    className={`flex-1 py-4.5 text-white font-black text-sm rounded-2xl transition-all active:scale-[0.98] disabled:opacity-30 ${role === 'tutor' ? 'bg-accent-gold' : 'bg-primary'}`}
                >
                    {loading ? 'Finalizing...' : 'Finish Setup'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
