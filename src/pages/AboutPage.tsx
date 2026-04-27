import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Target, Zap, Users, Shield, GraduationCap, Heart } from 'lucide-react';
import { motion } from 'motion/react';

export default function AboutPage() {
  const navigate = useNavigate();

  const highlights = [
    {
      icon: Zap,
      title: "Knowledge Exchange",
      desc: "Skillora is built on reciprocal learning. Trade your mastery for credits, and use those credits to unlock wisdom from others. No money, just mastery."
    },
    {
      icon: Target,
      title: "Stake to Commit",
      desc: "We solve the 'unopened course' problem. By staking credits in DAO groups, you're investing in your own discipline. Success is the only way to earn back."
    },
    {
      icon: Users,
      title: "Decentralized Peer Education",
      desc: "No corporate curriculum. Learn directly from people who have done the work. Every group is a self-governing DAO where peers verify peers."
    }
  ];

  return (
    <div className="min-h-screen bg-bg-main flex flex-col pb-10">
      {/* Header */}
      <div className="bg-white border-b border-border-main p-4 flex items-center gap-4 sticky top-0 z-50">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 -ml-2 rounded-xl hover:bg-hover-bg transition-colors"
        >
          <ArrowLeft size={22} className="text-text-main" />
        </button>
        <h1 className="text-lg font-black text-text-main tracking-tighter uppercase">About Skillora</h1>
      </div>

      <div className="max-w-lg mx-auto w-full px-4 pt-8 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Intro */}
        <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-primary rounded-[2.5rem] flex items-center justify-center mx-auto text-white shadow-2xl shadow-primary/20 relative group">
                <Sparkles size={40} className="group-hover:rotate-12 transition-transform" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-accent-gold rounded-full border-4 border-white dark:border-card-bg" />
            </div>
            <div className="space-y-1">
                <h2 className="text-3xl font-black text-text-main tracking-tight uppercase">Skillora</h2>
                <p className="text-xs text-primary font-black uppercase tracking-[0.3em]">Knowledge Without Boundaries</p>
            </div>
            <p className="text-sm text-text-muted font-medium leading-relaxed px-4">
                Skillora is a decentralized peer-to-peer learning ecosystem designed to bridge the global knowledge gap through authentic human connection and skins-in-the-game commitment.
            </p>
        </div>

        {/* Highlights */}
        <div className="grid grid-cols-1 gap-4">
            {highlights.map((h, i) => (
                <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white p-6 rounded-3xl border border-border-main flex gap-4 items-start"
                >
                    <div className="w-12 h-12 rounded-2xl bg-hover-bg flex items-center justify-center text-primary shrink-0">
                        <h.icon size={24} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-sm font-black text-text-main uppercase tracking-tight">{h.title}</h3>
                        <p className="text-xs text-text-muted font-medium leading-relaxed">{h.desc}</p>
                    </div>
                </motion.div>
            ))}
        </div>

        {/* Importance Section */}
        <div className="bg-text-main text-white p-8 rounded-[2.5rem] space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Shield size={120} />
            </div>
            
            <div className="space-y-2 relative">
                <div className="flex items-center gap-2 text-accent-gold">
                    <Heart size={16} fill="currentColor" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Our Importance</span>
                </div>
                <h3 className="text-2xl font-black tracking-tight leading-tight uppercase">Why Skillora Rules?</h3>
            </div>

            <div className="space-y-4 relative">
                <div className="space-y-1.5 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <h4 className="text-xs font-black text-accent-gold uppercase tracking-widest">Eliminating Cost Barriers</h4>
                    <p className="text-[11px] text-white/70 font-medium leading-relaxed">
                        Traditional education is expensive. Skillora uses a credits-based exchange where your value is determined by your knowledge, not your bank balance.
                    </p>
                </div>
                
                <div className="space-y-1.5 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <h4 className="text-xs font-black text-accent-gold uppercase tracking-widest">Incentivized Mastery</h4>
                    <p className="text-[11px] text-white/70 font-medium leading-relaxed">
                        By staking credits in DAO groups, we solve the "procrastination problem." You're financially and socially motivated to pass your daily quizzes and meet your goals.
                    </p>
                </div>

                <div className="space-y-1.5 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <h4 className="text-xs font-black text-accent-gold uppercase tracking-widest">Verified Communities</h4>
                    <p className="text-[11px] text-white/70 font-medium leading-relaxed">
                        Experience is better than credentials. Our rating system and shared goal structure create high-trust environments for rapid skill acquisition.
                    </p>
                </div>
            </div>
        </div>

        {/* Footer Mission */}
        <div className="text-center space-y-4 py-6">
            <div className="flex justify-center -space-x-2">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-card-bg bg-hover-bg overflow-hidden flex items-center justify-center">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i * 123}`} alt="User" />
                    </div>
                ))}
                <div className="w-8 h-8 rounded-full border-2 border-white dark:border-card-bg bg-primary flex items-center justify-center text-[10px] font-bold text-white">
                    +1k
                </div>
            </div>
            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] leading-relaxed">
                Join thousands of learners building <br/> the future of education together.
            </p>
            <div className="flex justify-center gap-4 text-text-muted pt-2 opacity-50">
                <Shield size={16} />
                <GraduationCap size={16} />
                <Zap size={16} />
            </div>
        </div>
      </div>
    </div>
  );
}
