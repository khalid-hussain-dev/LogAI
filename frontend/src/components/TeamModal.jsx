import { useState, useEffect } from 'react'
import { X, Linkedin, Github, Mail, ShoppingBag, ExternalLink } from 'lucide-react'
import khalidPic from '../assets/khalid-hussain-pic.jpg'

const MEMBERS = [
  {
    name: 'Khalid Hussain',
    role: 'Backend Engineer',
    email: 'sheikhkhalidhussain1234@gmail.com',
    linkedin: 'https://www.linkedin.com/in/khalid-hussain-dev/',
    github: 'https://github.com/khalid-hussain-dev',
    playstore: 'https://play.google.com/store/apps/developer?id=13+Dimensions+Studio',
    initials: 'KH',
    image: khalidPic,
    gradient: 'from-cyan-500 to-blue-600',
    accentColor: '#22D3EE',
  },
  {
    name: 'Nauman Khalid',
    role: 'AI/ML Engineer',
    email: 'nauman1331@gmail.com',
    linkedin: 'https://www.linkedin.com/in/nauman-khalid-58a2692a0/',
    github: null,
    initials: 'NK',
    gradient: 'from-violet-500 to-purple-600',
    accentColor: '#A78BFA',
  },
  {
    name: 'Nauroz Salim',
    role: 'Frontend Engineer',
    email: 'navrozsalim@gmail.com',
    linkedin: 'https://www.linkedin.com/in/navrozsalim/',
    github: null,
    initials: 'NS',
    gradient: 'from-emerald-500 to-teal-600',
    accentColor: '#10B981',
  },
  {
    name: 'Muhammad Ahmad',
    role: 'Deployment & DevOps Engineer',
    email: 'ahmadsertaj876@gmail.com',
    linkedin: 'https://www.linkedin.com/in/muhammad-ahmed-b77b3625a/',
    github: null,
    initials: 'MA',
    gradient: 'from-orange-500 to-rose-600',
    accentColor: '#F59E0B',
  },
]

function SocialLink({ href, icon: Icon, label, color }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 hover:scale-105"
      style={{
        borderColor: `${color}30`,
        color: color,
        backgroundColor: `${color}10`,
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${color}20`; e.currentTarget.style.borderColor = `${color}60` }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = `${color}10`; e.currentTarget.style.borderColor = `${color}30` }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </a>
  )
}

function MemberCard({ member, index }) {
  return (
    <div
      className="relative rounded-2xl p-5 border flex flex-col items-center text-center transition-all duration-300"
      style={{
        backgroundColor: '#0B1628',
        borderColor: `${member.accentColor}18`,
        boxShadow: `0 0 30px ${member.accentColor}08`,
      }}
    >
      {/* Role badge */}
      <div
        className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
        style={{ backgroundColor: `${member.accentColor}15`, color: member.accentColor }}
      >
        {index === 0 ? 'Team Lead' : 'Member'}
      </div>

      {/* Avatar */}
      {member.image ? (
        <img
          src={member.image}
          alt={member.name}
          className="w-20 h-20 rounded-2xl object-cover shadow-xl mb-4 border-4"
          style={{ borderColor: `${member.accentColor}30` }}
        />
      ) : (
        <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${member.gradient} flex items-center justify-center text-2xl font-black text-white shadow-xl mb-4 border-4`}
          style={{ borderColor: `${member.accentColor}30` }}
        >
          {member.initials}
        </div>
      )}

      {/* Name + Role */}
      <h3 className="text-white font-bold text-base mb-0.5">{member.name}</h3>
      <p className="text-xs font-semibold mb-4" style={{ color: member.accentColor }}>{member.role}</p>

      {/* Divider */}
      <div className="w-full border-t mb-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* Social Links */}
      <div className="flex flex-wrap gap-2 justify-center">
        <SocialLink href={`mailto:${member.email}`} icon={Mail} label="Email" color={member.accentColor} />
        <SocialLink href={member.linkedin} icon={Linkedin} label="LinkedIn" color={member.accentColor} />
        {member.github && <SocialLink href={member.github} icon={Github} label="GitHub" color={member.accentColor} />}
        {member.playstore && <SocialLink href={member.playstore} icon={ShoppingBag} label="Play Store" color={member.accentColor} />}
      </div>
    </div>
  )
}

export default function TeamModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2,6,18,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-3xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#07101F', borderColor: 'rgba(34,211,238,0.14)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b flex items-center justify-between" style={{ borderColor: 'rgba(34,211,238,0.1)', background: 'linear-gradient(90deg,#0B1628 0%,#07101F 100%)' }}>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Meet the Team</h2>
            <p className="text-sm text-slate-400 mt-1">The engineers behind LogAI — your intelligent log monitoring platform.</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Members Grid */}
        <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {MEMBERS.map((member, i) => (
            <MemberCard key={member.name} member={member} index={i} />
          ))}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t flex items-center justify-center" style={{ borderColor: 'rgba(34,211,238,0.08)', backgroundColor: '#050914' }}>
          <p className="text-xs text-slate-500 font-medium">Built with ❤️ for Advanced Software Engineering — 2025</p>
        </div>
      </div>
    </div>
  )
}
