import React from 'react';
import {
  Info, Landmark, Compass, Building2, Home, School, GraduationCap, HeartPulse,
  Briefcase, ShieldCheck, Users, Route, Sprout, Mountain, MapPin, Sparkles,
  Newspaper, Megaphone, CalendarDays, Image, Video, ExternalLink, HandHelping,
  Phone, Link as LinkIcon, FileText,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Info,
  Landmark,
  Compass,
  Building2,
  Home,
  School,
  GraduationCap,
  HeartPulse,
  Briefcase,
  ShieldCheck,
  Users,
  Route,
  Sprout,
  Mountain,
  MapPin,
  Sparkles,
  Newspaper,
  Megaphone,
  CalendarDays,
  Image,
  Video,
  ExternalLink,
  HandHelping,
  Phone,
  Link: LinkIcon,
  FileText,
};

export const DynamicIcon: React.FC<{ name: string; className?: string }> = ({ name, className = 'w-5 h-5' }) => {
  const IconComp = ICON_MAP[name] || FileText;
  return <IconComp className={className} />;
};
