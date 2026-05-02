"use client";

import { cn } from "@/lib/utils";
import { 
  Key, 
  FileEdit, 
  BookOpen, 
  CreditCard, 
  Phone,
  ExternalLink,
  Info
} from "lucide-react";

const links = [
  { name: "Student ERP", url: "https://erp.gehu.ac.in/", icon: Key, subtext: "" },
  { name: "Exam Portal", url: "https://gehu.ac.in/dehradun/exam-portal/", icon: FileEdit, subtext: "" },
  { name: "Library Info", url: "#", icon: BookOpen, subtext: "Reading Area: 8 AM - 11 PM" },
  { name: "Fee Payment", url: "https://gehu.ac.in/", icon: CreditCard, subtext: "Online Application/Fee Portal" },
  { name: "Contact Support", url: "tel:18002701280", icon: Phone, subtext: "Toll-Free: 1800 270 1280" },
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
              <link.icon className="w-5 h-5 text-hippo-primary group-hover:scale-110 transition-transform shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white/70 group-hover:text-white leading-tight">{link.name}</span>
                {link.subtext && <span className="text-[10px] text-white/40 mt-1">{link.subtext}</span>}
              </div>
              {!link.subtext && <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />}
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
