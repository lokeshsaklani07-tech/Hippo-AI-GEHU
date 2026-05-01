"use client";

import { cn } from "@/lib/utils";
import { 
  Home, 
  BookOpen, 
  Calendar, 
  ExternalLink, 
  GraduationCap, 
  Info,
  Layers
} from "lucide-react";

const links = [
  { name: "GEHU ERP", url: "https://erp.gehu.ac.in/", icon: Layers },
  { name: "Official Website", url: "https://www.gehu.ac.in/", icon: Home },
  { name: "Examination Portal", url: "https://www.gehu.ac.in/content/gehu/en/examination.html", icon: BookOpen },
  { name: "Academic Calendar", url: "https://www.gehu.ac.in/content/gehu/en/academic-calendar.html", icon: Calendar },
  { name: "Placements", url: "https://www.gehu.ac.in/content/gehu/en/placements.html", icon: GraduationCap },
];

export function Sidebar() {
  return (
    <div className="w-72 h-screen glass-card hidden md:flex flex-col p-6 sticky top-0 overflow-y-auto z-50">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-full bg-hippo-primary shadow-neon flex items-center justify-center animate-pulse-slow">
          <span className="font-bold text-white">H</span>
        </div>
        <h1 className="text-2xl font-bold glow-text tracking-wider">HIPPO</h1>
      </div>

      <div className="flex-1">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4">GEHU Quick Links</p>
        <nav className="space-y-2">
          {links.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group"
            >
              <link.icon className="w-5 h-5 text-hippo-primary group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium text-white/70 group-hover:text-white">{link.name}</span>
              <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
        </nav>
      </div>

      <div className="mt-auto pt-6 border-t border-white/5">
        <div className="flex items-center gap-2 text-white/40 hover:text-white/60 cursor-pointer transition-colors">
          <Info className="w-4 h-4" />
          <span className="text-xs font-medium">About Hippo Assistant</span>
        </div>
      </div>
    </div>
  );
}
