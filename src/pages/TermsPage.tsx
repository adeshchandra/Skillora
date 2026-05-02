import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export default function TermsPage() {
  const navigate = useNavigate();

  const sections = [
    {
      title: "1. Acceptance of Terms",
      content: "Skillora is a decentralized learning ecosystem. By using the platform, you agree to participate in peer-to-peer credit exchanges and DAO-based accountability structures. If you disagree with our 'Skin in the Game' philosophy, please do not use the service."
    },
    {
      title: "2. Peer Accountability & DAO Rules",
      content: "When joining a DAO group, you agree to its specific rules, including quiz schedules and staking requirements. Member progress is verified by peers. Dishonesty or 'gaming' the system will lead to community-driven expulsion."
    },
    {
      title: "3. Credit Staking & Forfeiture",
      content: "Credits represent learning potential. Staked credits in DAO groups are locked until goal completion. Failure to pass group quizzes or attend scheduled sessions results in credit distribution to successful participants. Forfeited credits are non-refundable."
    },
    {
      title: "4. Professional Conduct",
      content: "Mastery sessions are professional environments. Harassment, discrimination, or sharing inappropriate content during 1-on-1 sessions or group chats is strictly prohibited and results in permanent account termination."
    },
    {
      title: "5. Peer Generated Content",
      content: "Skillora facilitates connections but does not guarantee teaching quality. Users are responsible for verifying the expertise of their masters through reviews and sample content. We do not provide academic degrees."
    },
    {
      title: "6. Data & Integrity",
      content: "We use your data to provide matching suggestions and track progress. You agree to maintain the integrity of our leaderboard system. Any manipulation of quiz results or credit balances will lead to immediate legal assessment and platform ban."
    }
  ];

  return (
    <div className="min-h-screen bg-bg-main flex flex-col pb-10">
      {/* Header */}
      <div className="bg-bg-main border-b border-border-main p-4 flex items-center gap-4 sticky top-0 z-50 transition-colors">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 -ml-2 rounded-xl hover:bg-hover-bg transition-colors"
        >
          <ArrowLeft size={22} className="text-text-main" />
        </button>
        <h1 className="text-lg font-black text-text-main tracking-tighter uppercase">Terms & Conditions</h1>
      </div>

      <div className="max-w-lg mx-auto w-full px-4 pt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-3 pb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto text-primary border border-primary/20">
                <ShieldCheck size={32} />
            </div>
            <h2 className="text-2xl font-black text-text-main tracking-tight uppercase">Platform Guidelines</h2>
            <p className="text-xs text-text-muted font-bold tracking-widest uppercase">Last Updated: April 20, 2026</p>
        </div>

        <div className="space-y-6">
            {sections.map((sec, i) => (
                <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-theme-card p-6 rounded-3xl border border-border-main shadow-sm space-y-3 transition-colors"
                >
                    <h3 className="text-sm font-black text-text-main uppercase tracking-wider">{sec.title}</h3>
                    <p className="text-xs text-text-muted font-medium leading-relaxed">
                        {sec.content}
                    </p>
                </motion.div>
            ))}
        </div>

        <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 text-center space-y-2">
            <p className="text-xs font-bold text-primary">Need more clarification?</p>
            <p className="text-[10px] text-text-muted font-medium">Contact our support team at support@skillora.app</p>
        </div>

        <div className="text-center pt-4 opacity-30">
             <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.4em]">Skillora Legal Branch</p>
        </div>
      </div>
    </div>
  );
}
