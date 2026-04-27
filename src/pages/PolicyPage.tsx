import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Eye, Shield, Globe, Bell } from 'lucide-react';
import { motion } from 'motion/react';

export default function PolicyPage() {
  const navigate = useNavigate();

  const sections = [
    {
      title: "Data Collection",
      icon: Eye,
      content: "We collect information essential for your learning journey, including your profile data, skills you master, and your participation in DAO groups. We do not sell your personal data to third parties."
    },
    {
      title: "Learning Visibility",
      icon: Globe,
      content: "Your learning progress, completed quizzes, and DAO participation are visible to other members by default to foster community trust. You can adjust these settings in the Privacy Center."
    },
    {
      title: "Credit Privacy",
      icon: Lock,
      content: "Transaction history of your credits is kept private and secure. However, staking amounts in public DAO groups are visible to ensure transparency within the collective learning unit."
    },
    {
      title: "Communication",
      icon: Bell,
      content: "We send notifications related to your learning sessions, DAO updates, and peer matching requests. You can opt-out of non-essential communications at any time."
    },
    {
      title: "Account Security",
      icon: Shield,
      content: "We implement industry-standard security measures to protect your account. Users are responsible for maintaining the confidentiality of their login credentials."
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
        <h1 className="text-lg font-black text-text-main tracking-tighter uppercase">Privacy Policy</h1>
      </div>

      <div className="max-w-lg mx-auto w-full px-4 pt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-3 pb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto text-primary border border-primary/20">
                <Lock size={32} />
            </div>
            <h2 className="text-2xl font-black text-text-main tracking-tight uppercase">Privacy at Skillora</h2>
            <p className="text-xs text-text-muted font-bold tracking-widest uppercase">Version 1.1 • Effective April 2026</p>
        </div>

        <div className="space-y-4">
            {sections.map((sec, i) => (
                <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white p-6 rounded-3xl border border-border-main shadow-sm flex gap-4"
                >
                    <div className="w-10 h-10 bg-hover-bg rounded-2xl flex items-center justify-center text-primary shrink-0">
                        <sec.icon size={20} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-sm font-black text-text-main uppercase tracking-tight">{sec.title}</h3>
                        <p className="text-xs text-text-muted font-medium leading-relaxed">
                            {sec.content}
                        </p>
                    </div>
                </motion.div>
            ))}
        </div>

        <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 text-center space-y-3 mt-4">
            <p className="text-xs font-bold text-text-main leading-relaxed">
                By using Skillora, you agree to our data practices as outlined in this policy. We evolve our features frequently and will notify you of any major policy shifts.
            </p>
            <div className="pt-2 border-t border-primary/10">
                <p className="text-[10px] text-text-muted font-medium uppercase tracking-widest">Skillora Privacy Initiative</p>
            </div>
        </div>
      </div>
    </div>
  );
}
