import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar, MapPin, Phone, Mail, Search, ChevronLeft, ChevronRight,
  ChevronDown, ArrowRight, Play, Pause, Eye, Landmark, ExternalLink, Menu, X,
  Globe, Compass, Plus, Minus, Sparkles, Radio, Video, BellRing, Clock,
} from 'lucide-react';
import type {
  ContentItem, ContentSection, EventItem, HomepageBanner,
  HomepagePopup, HomepageQuickCard, HomepageSectionConfig, Language,
} from '../../types/cms';
import { bi, extractDateBadge, formatDateTime } from '../../lib/i18n';
import { SmartImage } from '../SmartImage';
import { DynamicIcon } from '../DynamicIcon';

export interface PublicBootstrapData {
  banners: HomepageBanner[];
  homepageSections: HomepageSectionConfig[];
  quickCards: HomepageQuickCard[];
  sections: ContentSection[];
  latestNews: ContentItem[];
  notices: ContentItem[];
  upcomingEvents: EventItem[];
  aboutSummary: ContentItem | null;
  photoGallery: ContentItem[];
  videoGallery: ContentItem[];
  popup?: HomepagePopup | null;
}

interface PublicLayoutProps {
  lang: Language;
  setLang: (l: Language) => void;
  fontScale: number;
  setFontScale: React.Dispatch<React.SetStateAction<number>>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onNavigate: (route: string) => void;
  onOpenAdmin: () => void;
  currentRoute: string;
  children: React.ReactNode;
}

const NAV_GROUPS = [
  { label_en: 'Home', label_bn: 'হোম', route: '/' },
  {
    label_en: 'About Balagarh',
    label_bn: 'বলাগড় সম্পর্কে',
    children: [
      { label_en: 'About Balagarh', label_bn: 'বলাগড় পরিচিতি', route: '/section/about-balagarh' },
      { label_en: 'Block Information', label_bn: 'ব্লক তথ্য', route: '/section/block-information' },
      { label_en: 'History & Geography', label_bn: 'ইতিহাস ও ভূগোল', route: '/section/history-geography' },
      { label_en: 'Public Representatives', label_bn: 'জনপ্রতিনিধি', route: '/section/public-representatives' },
    ],
  },
  {
    label_en: 'Panchayats',
    label_bn: 'পঞ্চায়েত',
    children: [
      { label_en: 'Gram Panchayats', label_bn: 'গ্রাম পঞ্চায়েত', route: '/section/gram-panchayats' },
      { label_en: 'Villages', label_bn: 'গ্রাম সমূহ', route: '/section/villages' },
      { label_en: 'Government Offices', label_bn: 'সরকারি দপ্তর', route: '/section/government-offices' },
    ],
  },
  {
    label_en: 'Education',
    label_bn: 'শিক্ষা',
    children: [
      { label_en: 'Schools', label_bn: 'বিদ্যালয়', route: '/section/schools' },
      { label_en: 'Colleges', label_bn: 'মহাবিদ্যালয়', route: '/section/colleges' },
    ],
  },
  {
    label_en: 'Health',
    label_bn: 'স্বাস্থ্য',
    children: [
      { label_en: 'Hospitals & Healthcare', label_bn: 'হাসপাতাল ও স্বাস্থ্যকেন্দ্র', route: '/section/hospitals' },
    ],
  },
  {
    label_en: 'Police & Safety',
    label_bn: 'পুলিশ ও নিরাপত্তা',
    children: [
      { label_en: 'Police Stations', label_bn: 'পুলিশ স্টেশন', route: '/section/police-stations' },
      { label_en: 'Emergency & Helplines', label_bn: 'যোগাযোগ ও হেল্পলাইন', route: '/section/contact-information' },
    ],
  },
  {
    label_en: 'Tourism',
    label_bn: 'পর্যটন',
    children: [
      { label_en: 'Tourism', label_bn: 'পর্যটন', route: '/section/tourism' },
      { label_en: 'Tourist Attractions', label_bn: 'দর্শনীয় স্থান', route: '/section/tourist-attractions' },
      { label_en: 'Agriculture & Boat Craft', label_bn: 'কৃষি ও নৌকা শিল্প', route: '/section/agriculture' },
      { label_en: 'Roads & Transport', label_bn: 'সড়ক ও পরিবহন', route: '/section/roads-infrastructure' },
    ],
  },
  {
    label_en: 'Heritage',
    label_bn: 'ঐতিহ্য',
    children: [
      { label_en: 'Culture & Heritage', label_bn: 'সংস্কৃতি ও ঐতিহ্য', route: '/section/culture-heritage' },
    ],
  },
  {
    label_en: 'News',
    label_bn: 'খবর',
    children: [
      { label_en: 'Latest News', label_bn: 'সংবাদ ও ঘোষণা', route: '/section/news-announcements' },
      { label_en: 'Notices & Circulars', label_bn: 'বিজ্ঞপ্তি ও সার্কুলার', route: '/section/notices-circulars' },
    ],
  },
  {
    label_en: 'Events',
    label_bn: 'ইভেন্ট',
    route: '/events',
  },
  {
    label_en: 'Gallery',
    label_bn: 'গ্যালারি',
    children: [
      { label_en: 'Photo Gallery', label_bn: 'ছবি গ্যালারি', route: '/section/photo-gallery' },
      { label_en: 'Video Gallery', label_bn: 'ভিডিও গ্যালারি', route: '/section/video-gallery' },
    ],
  },
  {
    label_en: 'Downloads',
    label_bn: 'ডাউনলোড',
    children: [
      { label_en: 'Public Services & Schemes', label_bn: 'জনপরিষেবা ও প্রকল্প', route: '/section/public-services' },
      { label_en: 'Important Links', label_bn: 'গুরুত্বপূর্ণ লিঙ্ক', route: '/section/important-links' },
    ],
  },
  {
    label_en: 'Contact',
    label_bn: 'যোগাযোগ',
    route: '/section/contact-information',
  },
];

export const PublicLayout: React.FC<PublicLayoutProps> = ({
  lang,
  setLang,
  fontScale,
  setFontScale,
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  onNavigate,
  onOpenAdmin,
  currentRoute,
  children,
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedMobileGroup, setExpandedMobileGroup] = useState<string | null>('About Balagarh');

  const todayLabel = new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="min-h-screen flex flex-col bg-[#eef4fb] text-slate-900 overflow-x-clip" style={{ fontSize: `${fontScale}%` }}>
      {/* Top Civic Utility Strip */}
      <div className="bg-[#071D3B] text-slate-200 text-[11px] sm:text-xs border-b border-amber-400/25">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3.5 min-w-0">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-100 truncate">
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{lang === 'bn' ? 'বলাগড় ব্লক, হুগলি, পশ্চিমবঙ্গ – ৭১২৫০১' : 'Balagarh Block, Hooghly, WB – 712501'}</span>
            </span>
            <span className="hidden sm:inline text-slate-500" aria-hidden="true">·</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 tabular-nums text-slate-200">
              <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>+91 33-2636-XXXX</span>
            </span>
            <span className="hidden md:inline text-slate-500" aria-hidden="true">·</span>
            <span className="hidden md:inline-flex items-center gap-1.5 text-slate-200">
              <Mail className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              <span>info@ourbalagarh.in</span>
            </span>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="hidden lg:inline-flex items-center gap-1.5 text-slate-300 tabular-nums pr-2.5 border-r border-white/15">
              <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>{todayLabel}</span>
            </span>

            {/* Accessibility Font Scaler */}
            <div className="flex items-center gap-0.5 pr-2 border-r border-white/15 font-semibold">
              <button
                type="button"
                onClick={() => setFontScale((s) => Math.max(90, s - 5))}
                className="px-1.5 py-0.5 rounded hover:bg-white/15 text-slate-200 transition-colors"
                title="Decrease font size"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setFontScale(100)}
                className="px-1.5 py-0.5 rounded hover:bg-white/15 font-bold text-amber-300 transition-colors"
                title="Reset font size"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontScale((s) => Math.min(115, s + 5))}
                className="px-1.5 py-0.5 rounded hover:bg-white/15 text-slate-200 transition-colors"
                title="Increase font size"
              >
                A+
              </button>
            </div>

            {/* Compact Bilingual Toggle */}
            <div className="inline-flex items-center gap-1 bg-white/10 p-0.5 rounded-lg border border-white/15 shrink-0">
              <Globe className="w-3.5 h-3.5 text-sky-300 ml-1" />
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-colors whitespace-nowrap ${
                  lang === 'en'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang('bn')}
                className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-colors whitespace-nowrap ${
                  lang === 'bn'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                বাংলা
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Architectural Civic Brand & Search Header */}
      <header className="relative bg-gradient-to-r from-[#FFFFFF] via-[#F6FAFF] to-[#EDF4FF] border-b border-slate-200/90 overflow-hidden">
        {/* Subtle Hooghly River Wave & Heritage Arch Accent */}
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.07] text-[#0A2F66]"
        >
          <path
            fill="currentColor"
            d="M0,128 C240,80 480,152 720,112 C960,72 1200,136 1440,96 L1440,160 L0,160 Z"
          />
          <path
            fill="currentColor"
            opacity="0.6"
            d="M0,144 C320,104 640,160 960,120 C1160,96 1320,128 1440,112 L1440,160 L0,160 Z"
          />
        </svg>

        <div className="relative max-w-[1280px] mx-auto px-3 sm:px-4 py-3.5 sm:py-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5 lg:gap-6">
          {/* Left Zone: Civic Crest & Wordmark */}
          <div className="flex items-center justify-between gap-3 w-full lg:w-auto min-w-0">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="flex items-center gap-3.5 text-left group min-w-0"
            >
              <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#0A2F66] via-[#1D4ED8] to-[#0D9488] p-[2.5px] shadow-md shrink-0 group-hover:scale-[1.02] transition-transform">
                <div className="w-full h-full rounded-[13px] bg-white p-0.5 overflow-hidden">
                  <img
                    src="/uploads/guptipara_terracotta_temple.jpg"
                    alt="Our Balagarh Crest"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-[10px]"
                  />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <span className="font-display text-2xl sm:text-[32px] font-extrabold tracking-tight leading-none text-[#0A2B5C]">
                    {lang === 'bn' ? 'আমাদের বলাগড়' : 'Our Balagarh'}
                  </span>
                  <span className="hidden sm:inline text-xs font-semibold text-[#0F766E] tracking-wide">
                    {lang === 'bn' ? 'হুগলি · পশ্চিমবঙ্গ' : 'Hooghly · West Bengal'}
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-medium text-slate-600 mt-1.5 line-clamp-1">
                  {lang === 'bn'
                    ? 'বলাগড় ব্লকের সরকারি, শিক্ষা, স্বাস্থ্য ও নাগরিক তথ্যের পোর্টাল'
                    : 'Official Civic, Heritage & Public Information Portal of Balagarh Block'}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="lg:hidden p-2.5 rounded-xl border border-slate-200 bg-white text-[#0A2B5C] hover:bg-slate-50 shadow-xs shrink-0"
              aria-label="Toggle Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Right Zone: Spacious Search + Primary Civic Notices Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 w-full lg:w-auto shrink-0">
            <form
              onSubmit={onSearchSubmit}
              className="flex items-center border border-slate-300/90 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 w-full sm:w-80 lg:w-[340px] shadow-sm min-w-0 transition-shadow"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'bn' ? 'স্কুল, পঞ্চায়েত, হাসপাতাল বা খবর খুঁজুন...' : 'Search schools, panchayats, notices...'}
                className="w-full min-w-0 px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-gradient-to-r from-[#0A2F66] to-[#1D4ED8] text-white hover:brightness-110 transition-all shrink-0 inline-flex items-center gap-1.5 text-xs font-bold"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">{lang === 'bn' ? 'খুঁজুন' : 'Search'}</span>
              </button>
            </form>

            <button
              type="button"
              onClick={() => onNavigate('/section/public-services')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F766E] hover:bg-[#0D625B] text-white text-xs sm:text-[13px] font-bold shadow-sm transition-colors whitespace-nowrap shrink-0"
            >
              <Landmark className="w-4 h-4 text-amber-300 shrink-0" />
              <span>{lang === 'bn' ? 'নাগরিক পরিষেবা' : 'Citizen Services'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Primary Royal Civic Navigation Bar */}
      <nav className="bg-gradient-to-r from-[#0A2F66] via-[#124694] to-[#0D57A1] text-white sticky top-0 z-30 shadow-md border-b-2 border-amber-400/80">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-4">
          {/* Mobile Sticky Bar */}
          <div className="flex lg:hidden items-center justify-between gap-2 py-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-extrabold whitespace-nowrap shrink-0"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              <span>{lang === 'bn' ? 'মেনু' : 'Menu'}</span>
            </button>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {[
                { label: lang === 'bn' ? 'হোম' : 'Home', route: '/' },
                { label: lang === 'bn' ? 'বিজ্ঞপ্তি' : 'Notices', route: '/section/notices-circulars' },
                { label: lang === 'bn' ? 'খবর' : 'News', route: '/section/news-announcements' },
                { label: lang === 'bn' ? 'ইভেন্ট' : 'Events', route: '/events' },
                { label: lang === 'bn' ? 'যোগাযোগ' : 'Contact', route: '/section/contact-information' },
              ].map((quick) => (
                <button
                  key={quick.route}
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); onNavigate(quick.route); }}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                    currentRoute === quick.route ? 'bg-amber-400 text-slate-950' : 'text-white/95 hover:bg-white/15'
                  }`}
                >
                  {quick.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden lg:flex items-center justify-between gap-0.5">
            {NAV_GROUPS.map((group, idx) => {
              const hasChildren = Boolean(group.children && group.children.length > 0);
              const isActive = group.route === currentRoute || group.children?.some((c) => c.route === currentRoute);
              const alignRight = idx >= NAV_GROUPS.length - 3;
              return (
                <div
                  key={group.label_en}
                  className="relative"
                  onMouseEnter={() => hasChildren && setOpenDropdown(group.label_en)}
                  onMouseLeave={() => hasChildren && setOpenDropdown(null)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (group.route) {
                        onNavigate(group.route);
                      } else if (group.children?.[0]) {
                        onNavigate(group.children[0].route);
                      }
                    }}
                    className={`flex items-center gap-1 px-2 xl:px-2.5 py-3 text-xs xl:text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                      isActive
                        ? 'bg-white/12 text-amber-300 border-amber-400'
                        : 'border-transparent hover:bg-white/10 hover:text-amber-200 text-white'
                    }`}
                  >
                    <span>{lang === 'bn' ? group.label_bn : group.label_en}</span>
                    {hasChildren && <ChevronDown className="w-3.5 h-3.5 opacity-75" />}
                  </button>

                  {hasChildren && openDropdown === group.label_en && (
                    <div className={`absolute ${alignRight ? 'right-0' : 'left-0'} top-full w-60 bg-white text-slate-800 shadow-xl rounded-b-xl border border-slate-200 py-1.5 z-50`}>
                      {group.children!.map((item) => (
                        <button
                          key={item.route}
                          type="button"
                          onClick={() => {
                            setOpenDropdown(null);
                            onNavigate(item.route);
                          }}
                          className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center justify-between ${
                            currentRoute === item.route ? 'bg-blue-50 text-blue-700' : ''
                          }`}
                        >
                          <span>{lang === 'bn' ? item.label_bn : item.label_en}</span>
                          <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden py-2.5 space-y-1 border-t border-white/20 max-h-[70vh] overflow-y-auto">
              {NAV_GROUPS.map((group) => {
                const isExpanded = expandedMobileGroup === group.label_en;
                return (
                  <div key={group.label_en} className="rounded-lg overflow-hidden bg-white/5">
                    {group.route ? (
                      <button
                        type="button"
                        onClick={() => { setMobileMenuOpen(false); onNavigate(group.route!); }}
                        className={`block w-full text-left px-3 py-2 text-sm font-bold hover:bg-white/15 ${
                          currentRoute === group.route ? 'text-amber-300 bg-white/10' : 'text-white'
                        }`}
                      >
                        {lang === 'bn' ? group.label_bn : group.label_en}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setExpandedMobileGroup(isExpanded ? null : group.label_en)}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold text-amber-300 hover:bg-white/10"
                        >
                          <span>{lang === 'bn' ? group.label_bn : group.label_en}</span>
                          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isExpanded && (
                          <div className="bg-black/15 py-1">
                            {group.children?.map((item) => (
                              <button
                                key={item.route}
                                type="button"
                                onClick={() => { setMobileMenuOpen(false); onNavigate(item.route); }}
                                className={`block w-full text-left px-5 py-1.5 text-xs sm:text-sm hover:bg-white/15 ${
                                  currentRoute === item.route ? 'text-amber-300 font-bold' : 'text-white/95'
                                }`}
                              >
                                • {lang === 'bn' ? item.label_bn : item.label_en}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Rich Royal Blue Multi-Column Footer */}
      <footer className="bg-gradient-to-b from-[#0C2D6B] to-[#081E4A] text-slate-100 mt-10">
        <div className="h-1.5 w-full grid grid-cols-7">
          <div className="bg-emerald-500" />
          <div className="bg-sky-400" />
          <div className="bg-violet-500" />
          <div className="bg-rose-500" />
          <div className="bg-amber-400" />
          <div className="bg-teal-400" />
          <div className="bg-orange-500" />
        </div>
        <div className="max-w-[1280px] mx-auto px-4 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-1 space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-amber-400 shrink-0">
                <img src="/uploads/guptipara_terracotta_temple.jpg" alt="Our Balagarh" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="font-extrabold text-white text-base leading-tight">
                  {lang === 'bn' ? 'আমাদের বলাগড়' : 'Our Balagarh'}
                </div>
                <div className="text-[11px] text-sky-200">
                  {lang === 'bn' ? 'বলাগড় ব্লক পোর্টাল' : 'Balagarh Block, Hooghly'}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === 'bn'
                ? 'বলাগড় ব্লকের সরকারি, শিক্ষা, স্বাস্থ্য, পর্যটন ও ঐতিহ্যের সম্পূর্ণ তথ্য কেন্দ্র।'
                : 'The Official Information Portal of Balagarh Block, Hooghly, West Bengal.'}
            </p>
          </div>

          <div>
            <h4 className="font-bold text-amber-300 text-sm mb-2.5">{lang === 'bn' ? 'দ্রুত নেভিগেশন' : 'Quick Navigation'}</h4>
            <ul className="space-y-1.5 text-xs text-slate-200">
              <li><button type="button" onClick={() => onNavigate('/')} className="hover:text-amber-300">▸ {lang === 'bn' ? 'হোম' : 'Home'}</button></li>
              <li><button type="button" onClick={() => onNavigate('/section/about-balagarh')} className="hover:text-amber-300">▸ {lang === 'bn' ? 'বলাগড় সম্পর্কে' : 'About Balagarh'}</button></li>
              <li><button type="button" onClick={() => onNavigate('/section/gram-panchayats')} className="hover:text-amber-300">▸ {lang === 'bn' ? 'পঞ্চায়েত' : 'Panchayats'}</button></li>
              <li><button type="button" onClick={() => onNavigate('/section/schools')} className="hover:text-amber-300">▸ {lang === 'bn' ? 'শিক্ষা' : 'Education'}</button></li>
              <li><button type="button" onClick={() => onNavigate('/section/hospitals')} className="hover:text-amber-300">▸ {lang === 'bn' ? 'স্বাস্থ্য' : 'Health'}</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-amber-300 text-sm mb-2.5">{lang === 'bn' ? 'তথ্য বিভাগ' : 'Information'}</h4>
            <ul className="space-y-1.5 text-xs text-slate-200">
              <li><button type="button" onClick={() => onNavigate('/section/tourism')} className="hover:text-amber-300">▸ {lang === 'bn' ? 'পর্যটন' : 'Tourism'}</button></li>
              <li><button type="button" onClick={() => onNavigate('/section/culture-heritage')} className="hover:text-amber-300">▸ {lang === 'bn' ? 'ঐতিহ্য' : 'Heritage'}</button></li>
              <li><button type="button" onClick={() => onNavigate('/section/news-announcements')} className="hover:text-amber-300">▸ {lang === 'bn' ? 'সংবাদ' : 'News'}</button></li>
              <li><button type="button" onClick={() => onNavigate('/events')} className="hover:text-amber-300">▸ {lang === 'bn' ? 'ইভেন্ট' : 'Events'}</button></li>
              <li><button type="button" onClick={() => onNavigate('/section/photo-gallery')} className="hover:text-amber-300">▸ {lang === 'bn' ? 'গ্যালারি' : 'Gallery'}</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-amber-300 text-sm mb-2.5">{lang === 'bn' ? 'গুরুত্বপূর্ণ লিঙ্ক' : 'Important Links'}</h4>
            <ul className="space-y-1.5 text-xs text-slate-200">
              <li><button type="button" onClick={() => onNavigate('/section/public-services')} className="hover:text-amber-300">▸ {lang === 'bn' ? 'সরকারি প্রকল্প' : 'Government Schemes'}</button></li>
              <li><button type="button" onClick={() => onNavigate('/section/public-services')} className="hover:text-amber-300">▸ {lang === 'bn' ? 'জনপরিষেবা' : 'Public Services'}</button></li>
              <li><button type="button" onClick={() => onNavigate('/section/notices-circulars')} className="hover:text-amber-300">▸ {lang === 'bn' ? 'বিজ্ঞপ্তি ও ডাউনলোড' : 'Notices & Downloads'}</button></li>
              <li><button type="button" onClick={() => onNavigate('/section/contact-information')} className="hover:text-amber-300">▸ {lang === 'bn' ? 'যোগাযোগ' : 'Contact Us'}</button></li>
              <li><button type="button" onClick={onOpenAdmin} className="text-slate-300 hover:text-white">▸ {lang === 'bn' ? 'অ্যাডমিন পোর্টাল' : 'Admin Portal'}</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-amber-300 text-sm mb-2.5">{lang === 'bn' ? 'যোগাযোগের তথ্য' : 'Contact Information'}</h4>
            <div className="space-y-2 text-xs text-slate-200">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'বলাগড় ব্লক, হুগলি – ৭১২৫০১, পশ্চিমবঙ্গ' : 'Balagarh Block, Hooghly – 712501, West Bengal'}</span>
              </div>
              <div className="flex items-center gap-2 tabular-nums">
                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>+91 33-2636-XXXX</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                <span>info@ourbalagarh.in</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#061534] py-3 px-4 text-xs text-slate-300 border-t border-white/10">
          <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
            <span>© 2026 Our Balagarh | আমাদের বলাগড়. All Rights Reserved.</span>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <button type="button" onClick={() => onNavigate('/section/about-balagarh')} className="hover:text-white">Privacy Policy</button>
              <span>|</span>
              <button type="button" onClick={() => onNavigate('/section/about-balagarh')} className="hover:text-white">Terms & Conditions</button>
              <span>|</span>
              <button type="button" onClick={() => onNavigate('/section/contact-information')} className="hover:text-white">Editorial Policy</button>
              <span>|</span>
              <button type="button" onClick={() => onNavigate('/section/contact-information')} className="hover:text-white">Corrections Policy</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

interface PublicHomeProps {
  data: PublicBootstrapData;
  lang: Language;
  onNavigate: (route: string) => void;
}

const SHORTCUT_THEMES_LIST = [
  { cardBg: 'from-emerald-500 via-green-500 to-teal-600', border: 'border-emerald-300/70', shadow: 'shadow-emerald-500/30', ring: 'ring-emerald-200/60', iconColor: '#059669' },
  { cardBg: 'from-sky-500 via-blue-500 to-indigo-600', border: 'border-sky-300/70', shadow: 'shadow-blue-500/30', ring: 'ring-sky-200/60', iconColor: '#1D4ED8' },
  { cardBg: 'from-violet-500 via-purple-500 to-fuchsia-600', border: 'border-violet-300/70', shadow: 'shadow-purple-500/30', ring: 'ring-violet-200/60', iconColor: '#7C3AED' },
  { cardBg: 'from-rose-500 via-pink-500 to-red-600', border: 'border-rose-300/70', shadow: 'shadow-rose-500/30', ring: 'ring-rose-200/60', iconColor: '#E11D48' },
  { cardBg: 'from-indigo-600 via-blue-600 to-cyan-600', border: 'border-indigo-300/70', shadow: 'shadow-indigo-500/30', ring: 'ring-indigo-200/60', iconColor: '#3730A3' },
  { cardBg: 'from-cyan-500 via-teal-500 to-emerald-600', border: 'border-cyan-300/70', shadow: 'shadow-cyan-500/30', ring: 'ring-cyan-200/60', iconColor: '#0891B2' },
  { cardBg: 'from-amber-500 via-orange-500 to-rose-500', border: 'border-amber-300/70', shadow: 'shadow-amber-500/30', ring: 'ring-amber-200/60', iconColor: '#D97706' },
  { cardBg: 'from-fuchsia-500 via-rose-500 to-orange-500', border: 'border-pink-300/70', shadow: 'shadow-pink-500/30', ring: 'ring-pink-200/60', iconColor: '#DB2777' },
];

const SHORTCUT_THEME: Record<string, { cardBg: string; border: string; shadow: string; ring: string; iconColor: string }> = {
  'gram-panchayats': SHORTCUT_THEMES_LIST[0],
  schools: SHORTCUT_THEMES_LIST[1],
  colleges: SHORTCUT_THEMES_LIST[2],
  hospitals: SHORTCUT_THEMES_LIST[3],
  'police-stations': SHORTCUT_THEMES_LIST[4],
  tourism: SHORTCUT_THEMES_LIST[5],
  'culture-heritage': SHORTCUT_THEMES_LIST[6],
  'events-programmes': SHORTCUT_THEMES_LIST[7],
};

const isVideoAssetUrl = (url?: string | null) =>
  Boolean(url && /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url));

const HeroVideoBackdrop: React.FC<{
  mediaUrl?: string | null;
  alt: string;
  isPlaying: boolean;
}> = ({ mediaUrl, alt, isPlaying }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isNativeVideo = isVideoAssetUrl(mediaUrl);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isPlaying) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [isPlaying, mediaUrl]);

  if (isNativeVideo && mediaUrl) {
    return (
      <video
        ref={videoRef}
        src={mediaUrl}
        poster="/uploads/hooghly_river_boats.jpg"
        preload="auto"
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover absolute inset-0"
      />
    );
  }

  return (
    <div className={`w-full h-full absolute inset-0 ${isPlaying ? 'animate-hero-motion' : 'animate-hero-motion-paused'}`}>
      <SmartImage
        src={mediaUrl}
        alt={alt}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

const POPUP_HEADER_THEME: Record<string, { header: string; btn: string; badge: string }> = {
  royal: {
    header: 'from-[#1D4ED8] via-[#2563EB] to-[#0284C7]',
    btn: 'from-[#1D4ED8] to-[#0284C7]',
    badge: 'bg-amber-300 text-slate-950',
  },
  crimson: {
    header: 'from-[#E11D48] via-[#DB2777] to-[#9333EA]',
    btn: 'from-[#E11D48] to-[#C026D3]',
    badge: 'bg-amber-300 text-slate-950',
  },
  emerald: {
    header: 'from-[#059669] via-[#10B981] to-[#0D9488]',
    btn: 'from-[#059669] to-[#0D9488]',
    badge: 'bg-yellow-300 text-slate-950',
  },
  amber: {
    header: 'from-[#D97706] via-[#F59E0B] to-[#EA580C]',
    btn: 'from-[#EA580C] to-[#D97706]',
    badge: 'bg-white text-slate-950',
  },
  violet: {
    header: 'from-[#7C3AED] via-[#9333EA] to-[#DB2777]',
    btn: 'from-[#7C3AED] to-[#DB2777]',
    badge: 'bg-amber-300 text-slate-950',
  },
};

export const PublicHome: React.FC<PublicHomeProps> = ({ data, lang, onNavigate }) => {
  const [slideIdx, setSlideIdx] = useState(0);
  const [videoBgPlaying, setVideoBgPlaying] = useState(true);
  const [popupOpen, setPopupOpen] = useState(false);
  const banners = data.banners.length > 0 ? data.banners : [];
  const activeBanner = banners[slideIdx % Math.max(1, banners.length)];

  useEffect(() => {
    if (!videoBgPlaying || banners.length <= 1) return;
    const timer = window.setInterval(() => {
      setSlideIdx((i) => (i + 1) % banners.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [videoBgPlaying, banners.length]);

  useEffect(() => {
    const p = data.popup;
    if (!p || !p.is_active) {
      setPopupOpen(false);
      return;
    }
    if (p.show_once_per_session === 1 && sessionStorage.getItem(`balagarh_popup_seen_${p.id}`)) {
      return;
    }
    const t = window.setTimeout(() => setPopupOpen(true), 350);
    return () => window.clearTimeout(t);
  }, [data.popup]);

  const dismissPopup = () => {
    if (data.popup?.show_once_per_session === 1) {
      sessionStorage.setItem(`balagarh_popup_seen_${data.popup.id}`, '1');
    }
    setPopupOpen(false);
  };

  const shortcuts = data.quickCards.filter((c) => c.card_type === 'shortcut');
  const glanceStats = data.quickCards.filter((c) => c.card_type === 'glance');
  const quickLinks = data.quickCards.filter((c) => c.card_type === 'quick_link');
  const schemeCard = data.quickCards.find((c) => c.card_type === 'scheme');

  const leadNews = data.latestNews[0];
  const sideNews = data.latestNews.slice(1, 5);

  const visibleSections = data.homepageSections
    .filter((s) => s.is_visible === 1)
    .sort((a, b) => a.sort_order - b.sort_order);

  const exploreCards = [
    { en: 'Panchayats', bn: 'পঞ্চায়েত', route: '/section/gram-panchayats', img: '/uploads/guptipara_heritage_temple_02.jpg', strip: 'bg-emerald-600' },
    { en: 'Schools & Education', bn: 'স্কুল ও শিক্ষা', route: '/section/schools', img: '/uploads/bengal_high_school.jpg', strip: 'bg-blue-600' },
    { en: 'Health Services', bn: 'স্বাস্থ্য পরিষেবা', route: '/section/hospitals', img: '/uploads/bengal_health_hospital.jpg', strip: 'bg-rose-600' },
    { en: 'Police & Safety', bn: 'পুলিশ ও নিরাপত্তা', route: '/section/police-stations', img: '/uploads/hooghly_river_boat_travel.jpg', strip: 'bg-indigo-700' },
    { en: 'Tourist Places', bn: 'পর্যটন স্থান', route: '/section/tourism', img: '/uploads/hooghly_river_boats.jpg', strip: 'bg-teal-600' },
    { en: 'Heritage Sites', bn: 'ঐতিহাসিক স্থান', route: '/section/culture-heritage', img: '/uploads/guptipara_terracotta_temple.jpg', strip: 'bg-amber-600' },
    { en: 'Markets & Business', bn: 'বাজার ও কৃষি', route: '/section/agriculture', img: '/uploads/bengal_agriculture_paddy.jpg', strip: 'bg-purple-600' },
    { en: 'Transport', bn: 'পরিবহন ও সড়ক', route: '/section/roads-infrastructure', img: '/uploads/hooghly_railway_transport.jpg', strip: 'bg-sky-700' },
  ];

  const exploreSectionBlock = (
    <section className="bg-white rounded-xl border border-sky-200 shadow-md overflow-hidden">
      <div className="bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] text-white px-4 py-2.5 flex items-center gap-2 font-extrabold text-sm">
        <Compass className="w-4 h-4" />
        <span>{lang === 'bn' ? 'আমাদের বলাগড়ের তথ্যভাণ্ডার / Explore Balagarh' : 'Explore Balagarh'}</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="text-center text-sm font-extrabold text-slate-800">
          {lang === 'bn' ? 'বলাগড়ের গুরুত্বপূর্ণ তথ্য ও দর্শনীয় স্থান' : 'Explore Balagarh – Key Information and Places'}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {exploreCards.map((card) => (
            <button
              key={card.route}
              type="button"
              onClick={() => onNavigate(card.route)}
              className="group rounded-xl overflow-hidden border border-slate-200 bg-white hover:shadow-lg transition-all text-left flex flex-col"
            >
              <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                <SmartImage
                  src={card.img}
                  alt={bi(lang, card.en, card.bn)}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className={`${card.strip} text-white px-2.5 py-1.5 text-center text-xs font-extrabold truncate`}>
                {lang === 'bn' ? card.bn : card.en}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );

  const hasExplore = visibleSections.some((s) => s.section_key === 'explore_grid');
  const hasAbout = visibleSections.some((s) => s.section_key === 'about_and_glance');

  const renderSection = (key: string) => {
    switch (key) {
      case 'hero_and_notices': {
        const tickerItems = [
          ...data.notices.slice(0, 4).map((n) => ({
            key: `n-${n.id}`,
            badge_en: 'NOTICE',
            badge_bn: 'বিজ্ঞপ্তি',
            badgeCls: 'bg-gradient-to-r from-amber-300 to-yellow-400 text-slate-950',
            text: bi(lang, n.title_en, n.title_bn),
            route: `/content/${n.id}`,
          })),
          ...data.latestNews.slice(0, 4).map((n) => ({
            key: `news-${n.id}`,
            badge_en: 'NEWS',
            badge_bn: 'সংবাদ',
            badgeCls: 'bg-gradient-to-r from-emerald-300 to-teal-300 text-slate-950',
            text: bi(lang, n.title_en, n.title_bn),
            route: `/content/${n.id}`,
          })),
          ...data.upcomingEvents.slice(0, 3).map((ev) => ({
            key: `ev-${ev.id}`,
            badge_en: 'EVENT',
            badge_bn: 'ইভেন্ট',
            badgeCls: 'bg-gradient-to-r from-pink-300 to-rose-300 text-slate-950',
            text: `${bi(lang, ev.title_en, ev.title_bn)}${ev.venue ? ` • ${ev.venue}` : ''}`,
            route: `/events/${ev.id}`,
          })),
        ];

        const noticeColors = [
          { border: 'border-l-emerald-500', dot: 'bg-emerald-500', hover: 'hover:border-emerald-300 hover:bg-emerald-50/70' },
          { border: 'border-l-sky-500', dot: 'bg-sky-500', hover: 'hover:border-sky-300 hover:bg-sky-50/70' },
          { border: 'border-l-violet-500', dot: 'bg-violet-500', hover: 'hover:border-violet-300 hover:bg-violet-50/70' },
          { border: 'border-l-amber-500', dot: 'bg-amber-500', hover: 'hover:border-amber-300 hover:bg-amber-50/70' },
        ];

        return (
          <section key={key} className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-w-0">
            {/* Hero Carousel with Running Video / Scenic Motion Background */}
            <div className="lg:col-span-8 min-w-0 relative rounded-2xl overflow-hidden shadow-xl ring-2 ring-sky-400/50 border-2 border-white min-h-[300px] sm:min-h-[355px] bg-slate-900">
              {activeBanner ? (
                <>
                  <HeroVideoBackdrop
                    mediaUrl={activeBanner.image_url}
                    alt={bi(lang, activeBanner.title_en, activeBanner.title_bn)}
                    isPlaying={videoBgPlaying}
                  />
                  {/* div:nth-of-type(1) — Clear background (no glass overlay over video/image) */}
                  <div className="pointer-events-none" />
                  {/* div:nth-of-type(2) — Hero Content Overlay */}
                  <div className="relative z-10 h-full flex flex-col justify-center px-10 sm:px-14 pt-6 pb-14 sm:py-8 text-white">
                    <div className="mb-2.5 sm:mb-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-400 text-slate-950 text-[10px] sm:text-[11px] font-extrabold shadow-md">
                        <span className={`w-2 h-2 rounded-full bg-rose-600 ${videoBgPlaying ? 'animate-ping' : ''}`} />
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'আমাদের বলাগড় • হুগলি ঐতিহ্য' : 'Our Balagarh • Hooghly Heritage'}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-700 border border-indigo-400 text-amber-200 text-[10px] sm:text-[11px] font-bold shadow">
                        <Video className="w-3 h-3" />
                        <span>{videoBgPlaying ? (lang === 'bn' ? 'লাইভ মোশন ব্যাকগ্রাউন্ড' : 'Live Video BG') : (lang === 'bn' ? 'বিরতি' : 'Paused')}</span>
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold leading-tight text-balance max-w-xl drop-shadow-[0_3px_10px_rgba(0,0,0,0.9)]">
                      {bi(lang, activeBanner.title_en, activeBanner.title_bn)}
                    </h1>
                    <p className="text-xs sm:text-base text-white font-semibold mt-2 sm:mt-2.5 max-w-lg leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                      {bi(lang, activeBanner.subtitle_en, activeBanner.subtitle_bn)}
                    </p>
                    <div className="mt-4 sm:mt-5 flex flex-wrap items-center gap-2.5 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => onNavigate(activeBanner.button_link || '/section/about-balagarh')}
                        className="inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-[#FDE047] via-[#FACC15] to-[#F97316] hover:brightness-105 text-slate-950 text-xs sm:text-sm font-extrabold transition-all shadow-lg shadow-amber-500/30"
                      >
                        <span>{bi(lang, activeBanner.button_text_en, activeBanner.button_text_bn)}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('/section/video-gallery')}
                        className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] hover:brightness-110 text-white text-xs sm:text-sm font-extrabold transition-all shadow-lg shadow-fuchsia-600/30 border border-white/40"
                      >
                        <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                        <span>{lang === 'bn' ? 'ভিডিও দেখুন' : 'Watch Videos'}</span>
                      </button>
                    </div>
                  </div>
                  {banners.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setSlideIdx((i) => (i - 1 + banners.length) % banners.length)}
                        className="absolute left-1.5 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 hover:brightness-110 text-white border border-white/60 flex items-center justify-center transition-all shadow-md"
                        aria-label="Previous slide"
                      >
                        <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlideIdx((i) => (i + 1) % banners.length)}
                        className="absolute right-1.5 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-rose-600 to-purple-700 hover:brightness-110 text-white border border-white/60 flex items-center justify-center transition-all shadow-md"
                        aria-label="Next slide"
                      >
                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                      <div className="absolute bottom-4 left-4 sm:left-1/2 sm:-translate-x-1/2 z-20 flex items-center gap-1.5">
                        {banners.map((b, idx) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setSlideIdx(idx)}
                            className={`h-2.5 rounded-full transition-all ${
                              idx === slideIdx % banners.length ? 'w-7 bg-gradient-to-r from-amber-400 to-rose-500 border border-white shadow' : 'w-2.5 bg-white/90'
                            }`}
                            aria-label={`Slide ${idx + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setVideoBgPlaying((p) => !p)}
                    className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold border border-white/40 transition-colors shadow-md"
                    title={videoBgPlaying ? 'Pause background motion' : 'Play background motion'}
                  >
                    {videoBgPlaying ? <Pause className="w-3.5 h-3.5 text-amber-300" /> : <Play className="w-3.5 h-3.5 text-emerald-300 fill-current" />}
                    <span>{videoBgPlaying ? (lang === 'bn' ? 'বিরতি' : 'Pause Video') : (lang === 'bn' ? 'চালু করুন' : 'Play Video')}</span>
                  </button>
                </>
              ) : null}
            </div>

            {/* Latest Notice Card (Vibrant Multi-Color Header & Pastel Notice Cards) */}
            <div className="lg:col-span-4 min-w-0 bg-white rounded-2xl border-2 border-rose-300/80 shadow-xl overflow-hidden flex flex-col">
              {/* div:nth-of-type(1) — Vibrant Multi-Color Header */}
              <div className="bg-gradient-to-r from-[#E11D48] via-[#C026D3] to-[#7C3AED] text-white px-4 py-3 flex items-center justify-between gap-2 font-extrabold text-sm border-b-2 border-amber-300">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shadow-inner">
                    <DynamicIcon name="Megaphone" className="w-4 h-4 text-amber-200" />
                  </span>
                  <span>{lang === 'bn' ? 'সর্বশেষ বিজ্ঞপ্তি / Latest Notice' : 'Latest Notice'}</span>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-300 text-slate-950 text-[10px] font-extrabold shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                  LIVE
                </span>
              </div>
              {/* div:nth-of-type(2) — Colorful Notice Body */}
              <div className="p-3.5 flex-1 bg-gradient-to-b from-rose-50/80 via-amber-50/40 to-violet-50/75 space-y-2">
                {data.notices.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">No published notices yet.</p>
                ) : (
                  data.notices.slice(0, 4).map((notice, idx) => {
                    const palette = noticeColors[idx % noticeColors.length];
                    return (
                      <button
                        key={notice.id}
                        type="button"
                        onClick={() => onNavigate(`/content/${notice.id}`)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl bg-white/90 border border-white border-l-4 ${palette.border} ${palette.hover} shadow-xs hover:shadow-sm transition-all group flex items-start justify-between gap-2`}
                      >
                        <span className="flex items-start gap-2 text-xs sm:text-sm text-slate-800 group-hover:text-rose-700 font-bold leading-snug">
                          <span className={`w-2 h-2 rounded-full ${palette.dot} mt-1.5 shrink-0`} />
                          <span>{bi(lang, notice.title_en, notice.title_bn)}</span>
                        </span>
                        {notice.metadata?.Badge && (
                          <span className="text-[10px] font-extrabold text-white bg-gradient-to-r from-red-600 to-orange-500 px-2 py-0.5 rounded-full shrink-0 shadow-xs">
                            {notice.metadata.Badge}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="px-4 py-2.5 bg-gradient-to-r from-rose-100 via-fuchsia-100 to-violet-100 border-t border-rose-200 text-center">
                <button
                  type="button"
                  onClick={() => onNavigate('/section/notices-circulars')}
                  className="text-xs font-extrabold text-purple-800 hover:text-rose-700 hover:underline inline-flex items-center gap-1"
                >
                  <span>{lang === 'bn' ? 'সকল বিজ্ঞপ্তি দেখুন' : 'View All Notices'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* div:nth-of-type(3) — Full-Width Colorful Running Text / Live Announcements Ticker */}
            <div className="lg:col-span-12 min-w-0 max-w-full rounded-xl overflow-hidden shadow-md border border-indigo-300/70 bg-gradient-to-r from-[#1E3A8A] via-[#7C3AED] via-[#DB2777] to-[#0D9488] text-white flex items-stretch">
              <div className="px-2.5 sm:px-4 py-2 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-slate-950 font-extrabold text-[11px] sm:text-sm flex items-center gap-1.5 sm:gap-2 shrink-0 shadow-md z-10">
                <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse text-white" />
                <span className="text-white drop-shadow-xs whitespace-nowrap">
                  {lang === 'bn' ? 'সর্বশেষ আপডেট' : 'LIVE UPDATES'}
                </span>
              </div>
              <div className="flex-1 min-w-0 overflow-hidden balagarh-marquee-wrapper flex items-center py-2">
                <div className="balagarh-marquee-track items-center">
                  {[0, 1].map((dup) => (
                    <div key={dup} className="flex items-center gap-6 pr-6 shrink-0">
                      {(tickerItems.length > 0
                        ? tickerItems
                        : [
                            {
                              key: 'fallback-1',
                              badge_en: 'PORTAL',
                              badge_bn: 'তথ্য',
                              badgeCls: 'bg-amber-300 text-slate-950',
                              text:
                                lang === 'bn'
                                  ? 'আমাদের বলাগড় ব্লকের অফিসিয়াল তথ্য পোর্টালে স্বাগতম — সমস্ত পঞ্চায়েত, স্কুল, হাসপাতাল ও প্রকল্পের তথ্য এখানে উপলব্ধ।'
                                  : 'Welcome to Our Balagarh Official Block Portal — Explore Panchayats, Schools, Hospitals, Heritage & Public Services.',
                              route: '/section/about-balagarh',
                            },
                          ]
                      ).map((item) => (
                        <button
                          key={`${dup}-${item.key}`}
                          type="button"
                          onClick={() => onNavigate(item.route)}
                          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-white hover:text-amber-200 transition-colors whitespace-nowrap"
                        >
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${item.badgeCls}`}>
                            {lang === 'bn' ? item.badge_bn : item.badge_en}
                          </span>
                          <span>{item.text}</span>
                          <span className="text-amber-300 font-extrabold pl-3">✦</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        );
      }

      case 'category_shortcuts':
        return (
          <section key={key} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {shortcuts.map((card, idx) => {
              const theme = SHORTCUT_THEME[card.target_section] || SHORTCUT_THEMES_LIST[idx % SHORTCUT_THEMES_LIST.length];
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onNavigate(card.url || `/section/${card.target_section}`)}
                  className={`relative overflow-hidden rounded-2xl border ${theme.border} bg-gradient-to-br ${theme.cardBg} p-3.5 flex flex-col items-center justify-center gap-2.5 shadow-md ${theme.shadow} hover:shadow-xl hover:-translate-y-1 hover:brightness-105 transition-all duration-200 text-center group`}
                >
                  <div
                    className={`w-12 h-12 rounded-full bg-white/95 shadow-md ring-4 ${theme.ring} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}
                    style={{ color: theme.iconColor }}
                  >
                    <DynamicIcon name={card.icon} className="w-6 h-6" />
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-white drop-shadow-xs leading-tight tracking-tight">
                    {lang === 'bn' ? card.label_bn : card.label_en}
                  </div>
                </button>
              );
            })}
          </section>
        );

      case 'news_and_events':
        return (
          <section key={key} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Latest News */}
            <div className="lg:col-span-8 bg-white rounded-xl border border-blue-200 shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 font-extrabold text-sm">
                  <DynamicIcon name="Newspaper" className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'সর্বশেষ খবর / Latest News' : 'Latest News'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('/section/news-announcements')}
                  className="text-xs font-bold text-sky-100 hover:text-white inline-flex items-center gap-1"
                >
                  <span>{lang === 'bn' ? 'সকল খবর' : 'View All News'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
                {leadNews ? (
                  <div className="md:col-span-6 flex flex-col">
                    <div className="aspect-[16/10] rounded-lg overflow-hidden bg-slate-100 mb-2.5 border border-slate-200">
                      <SmartImage
                        src={leadNews.cover_url}
                        alt={bi(lang, leadNews.title_en, leadNews.title_bn)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                      {bi(lang, leadNews.title_en, leadNews.title_bn)}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        {leadNews.metadata?.Date || formatDateTime(leadNews.created_at, lang)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-violet-600" />
                        {leadNews.views_count} Views
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                      {bi(lang, leadNews.summary_en, leadNews.summary_bn)}
                    </p>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => onNavigate(`/content/${leadNews.id}`)}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#9333EA] to-[#C026D3] hover:brightness-110 text-white text-xs font-bold shadow-sm transition-all"
                      >
                        <span>{lang === 'bn' ? 'বিস্তারিত পড়ুন' : 'Read More'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="md:col-span-6 divide-y divide-slate-100">
                  {sideNews.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(`/content/${item.id}`)}
                      className="w-full text-left py-2.5 first:pt-0 last:pb-0 flex items-start gap-3 group"
                    >
                      <div className="w-20 h-14 rounded-md overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                        <SmartImage
                          src={item.cover_url}
                          alt={bi(lang, item.title_en, item.title_bn)}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-700 line-clamp-2 leading-snug">
                          {bi(lang, item.title_en, item.title_bn)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 tabular-nums">
                          <Calendar className="w-3 h-3 text-blue-600" />
                          <span>{item.metadata?.Date || formatDateTime(item.created_at, lang)}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Upcoming Events */}
            <div className="lg:col-span-4 bg-white rounded-xl border border-violet-200 shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white px-4 py-2.5 flex items-center gap-2 font-extrabold text-sm">
                <DynamicIcon name="CalendarDays" className="w-4 h-4" />
                <span>{lang === 'bn' ? 'আসন্ন অনুষ্ঠান / Upcoming Events' : 'Upcoming Events'}</span>
              </div>
              <div className="p-4 divide-y divide-slate-100">
                {data.upcomingEvents.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">No upcoming events scheduled.</p>
                ) : (
                  data.upcomingEvents.map((ev) => {
                    const badge = extractDateBadge(ev.start_datetime);
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => onNavigate(`/events/${ev.id}`)}
                        className="w-full text-left py-2.5 first:pt-0 last:pb-0 flex items-start gap-3 group"
                      >
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-b from-violet-100 to-purple-100 border border-violet-300 flex flex-col items-center justify-center shrink-0 text-purple-800 tabular-nums">
                          <span className="text-base font-extrabold leading-none">{badge.day}</span>
                          <span className="text-[11px] font-bold leading-tight">{badge.month}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-purple-700 line-clamp-2 leading-snug">
                            {bi(lang, ev.title_en, ev.title_bn)}
                          </div>
                          <div className="text-[11px] text-slate-600 mt-1">
                            {lang === 'bn' ? 'স্থান' : 'Venue'}: {ev.venue}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="px-4 py-2.5 bg-violet-50/70 border-t border-violet-100 text-center">
                <button
                  type="button"
                  onClick={() => onNavigate('/events')}
                  className="text-xs font-extrabold text-purple-700 hover:underline inline-flex items-center gap-1"
                >
                  <span>{lang === 'bn' ? 'সকল ইভেন্ট দেখুন' : 'View All Events'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>
        );

      case 'about_and_glance':
        return (
          <section key={key} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left 8 cols: About Balagarh + Balagarh at a Glance + Explore Balagarh */}
            <div className="lg:col-span-8 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                {/* About Balagarh Card */}
                <div className="md:col-span-6 bg-white rounded-xl border border-sky-200 shadow-md overflow-hidden flex flex-col">
                  <div className="bg-gradient-to-r from-[#0284C7] to-[#2563EB] text-white px-4 py-2.5 flex items-center gap-2 font-extrabold text-sm">
                    <DynamicIcon name="Info" className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'বলাগড় পরিচিতি' : 'About Balagarh'}</span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    {data.aboutSummary && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                          <div className="sm:col-span-5 aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                            <SmartImage
                              src={data.aboutSummary.cover_url}
                              alt={bi(lang, data.aboutSummary.title_en, data.aboutSummary.title_bn)}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="sm:col-span-7 text-xs sm:text-sm text-slate-700 leading-relaxed line-clamp-5">
                            {bi(lang, data.aboutSummary.summary_en, data.aboutSummary.summary_bn)}
                          </p>
                        </div>
                        <div className="text-center pt-1">
                          <button
                            type="button"
                            onClick={() => onNavigate('/section/about-balagarh')}
                            className="inline-flex items-center gap-1.5 px-5 py-1.5 rounded-full bg-gradient-to-r from-[#1D4ED8] to-[#0284C7] hover:brightness-110 text-white text-xs font-bold shadow-sm transition-all"
                          >
                            <span>{lang === 'bn' ? 'বিস্তারিত জানুন' : 'Read More'}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Balagarh at a Glance Card */}
                <div className="md:col-span-6 bg-white rounded-xl border border-cyan-200 shadow-md overflow-hidden flex flex-col">
                  <div className="bg-gradient-to-r from-[#0369A1] to-[#0EA5E9] text-white px-4 py-2.5 flex items-center gap-2 font-extrabold text-sm">
                    <DynamicIcon name="Landmark" className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'এক নজরে বলাগড়' : 'Balagarh at a Glance'}</span>
                  </div>
                  <div className="p-4 flex-1 divide-y divide-slate-100">
                    {glanceStats.map((g) => (
                      <div key={g.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2 text-xs sm:text-sm">
                        <span className="flex items-center gap-2.5 font-medium text-slate-800">
                          <span style={{ color: g.color_hex }}>
                            <DynamicIcon name={g.icon} className="w-4 h-4" />
                          </span>
                          <span>{lang === 'bn' ? g.label_bn : g.label_en}</span>
                        </span>
                        <span className="font-extrabold text-slate-900 tabular-nums">{g.value_text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {hasExplore && exploreSectionBlock}
            </div>

            {/* Right 4 cols: Quick Links, Map of Balagarh, Government Schemes */}
            <div className="lg:col-span-4 space-y-5">
              {/* Quick Links */}
              <div className="bg-white rounded-xl border border-emerald-200 shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-[#16A34A] to-[#22C55E] text-white px-4 py-2.5 flex items-center gap-2 font-extrabold text-sm">
                  <DynamicIcon name="Link" className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'দ্রুত লিঙ্ক / Quick Links' : 'Quick Links'}</span>
                </div>
                <div className="p-3 divide-y divide-slate-100">
                  {quickLinks.map((ql) => (
                    <button
                      key={ql.id}
                      type="button"
                      onClick={() => onNavigate(ql.url || `/section/${ql.target_section}`)}
                      className="w-full text-left py-2 px-1.5 text-xs sm:text-sm text-slate-800 hover:text-emerald-700 font-semibold flex items-center gap-2.5 transition-colors"
                    >
                      <DynamicIcon name="Link" className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="flex-1 truncate">{lang === 'bn' ? ql.label_bn : ql.label_en}</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Map of Balagarh */}
              <div className="bg-white rounded-xl border border-green-200 shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-[#15803D] to-[#16A34A] text-white px-4 py-2.5 flex items-center gap-2 font-extrabold text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'বলাগড়ের মানচিত্র / Map of Balagarh' : 'Map of Balagarh'}</span>
                </div>
                <div className="p-3">
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 h-40 bg-emerald-50">
                    <SmartImage
                      src="/uploads/hooghly_river_boats.jpg"
                      alt="Map of Balagarh Block"
                      className="w-full h-full object-cover opacity-85"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-slate-900/20 to-transparent flex flex-col justify-between p-3">
                      <div className="flex justify-end">
                        <div className="bg-white/95 rounded-md shadow border border-slate-200 flex flex-col text-slate-700">
                          <span className="p-1 border-b border-slate-200"><Plus className="w-3 h-3" /></span>
                          <span className="p-1"><Minus className="w-3 h-3" /></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-white">
                        <MapPin className="w-5 h-5 text-red-500 fill-red-500 shrink-0" />
                        <div className="text-xs leading-tight">
                          <div className="font-extrabold">Balagarh Block</div>
                          <div className="text-slate-200">Hooghly · 23.12° N, 88.46° E</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-center mt-2.5">
                    <a
                      href="https://maps.google.com/?q=Balagarh,Hooghly,West+Bengal"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-extrabold text-blue-700 hover:underline inline-flex items-center gap-1"
                    >
                      <span>{lang === 'bn' ? 'Google Maps এ দেখুন' : 'Open in Maps'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Government Schemes */}
              {schemeCard && (
                <div className="bg-white rounded-xl border border-orange-200 shadow-md overflow-hidden">
                  <div className="bg-gradient-to-r from-[#EA580C] to-[#F97316] text-white px-4 py-2.5 flex items-center gap-2 font-extrabold text-sm">
                    <DynamicIcon name="HandHelping" className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'সরকারি প্রকল্প / Government Schemes' : 'Government Schemes'}</span>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-sky-100 via-blue-50 to-indigo-100 text-center space-y-2">
                    <div className="text-base font-extrabold text-[#15438C]">
                      {lang === 'bn' ? schemeCard.label_bn : schemeCard.label_en}
                    </div>
                    <p className="text-xs font-medium text-slate-700">{schemeCard.value_text}</p>
                    <button
                      type="button"
                      onClick={() => onNavigate(schemeCard.url || '/section/public-services')}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#1D4ED8] to-[#0284C7] hover:brightness-110 text-white text-xs font-bold shadow-sm transition-all"
                    >
                      <span>{lang === 'bn' ? 'আরও জানুন' : 'Know More'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        );

      case 'explore_grid':
        return hasAbout ? null : <React.Fragment key={key}>{exploreSectionBlock}</React.Fragment>;

      case 'media_galleries': {
        const featuredVideoSrc = isVideoAssetUrl(data.videoGallery[0]?.video_url)
          ? data.videoGallery[0]!.video_url!
          : '/uploads/balagarh_river_journey_doc.webm';
        const liveReelSrc = isVideoAssetUrl(data.videoGallery[1]?.video_url)
          ? data.videoGallery[1]!.video_url!
          : '/uploads/balagarh_river_boat_reel.webm';

        return (
          <section key={key} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Photo Gallery */}
            <div className="bg-white rounded-xl border border-pink-200 shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-[#DB2777] to-[#EC4899] text-white px-4 py-2.5 font-extrabold text-sm flex items-center gap-2">
                <DynamicIcon name="Image" className="w-4 h-4" />
                <span>{lang === 'bn' ? 'ছবি গ্যালারি / Photo Gallery' : 'Photo Gallery'}</span>
              </div>
              <div className="p-3">
                <button
                  type="button"
                  onClick={() => onNavigate('/section/photo-gallery')}
                  className="w-full group text-left"
                >
                  <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-slate-100">
                    <SmartImage
                      src={data.photoGallery[0]?.cover_url || '/uploads/guptipara_terracotta_temple.jpg'}
                      alt="Photo Gallery"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-extrabold px-2.5 py-1 rounded tabular-nums">
                      +120
                    </div>
                  </div>
                  <div className="mt-2.5 text-center text-xs font-extrabold text-blue-700 group-hover:underline">
                    {lang === 'bn' ? 'সকল ছবি দেখুন ›' : 'View Photos ›'}
                  </div>
                </button>
              </div>
            </div>

            {/* Video Gallery */}
            <div className="bg-white rounded-xl border border-red-200 shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-[#DC2626] to-[#EF4444] text-white px-4 py-2.5 font-extrabold text-sm flex items-center gap-2">
                <DynamicIcon name="Video" className="w-4 h-4" />
                <span>{lang === 'bn' ? 'ভিডিও গ্যালারি / Video Gallery' : 'Video Gallery'}</span>
              </div>
              <div className="p-3">
                <button
                  type="button"
                  onClick={() => onNavigate('/section/video-gallery')}
                  className="w-full group text-left"
                >
                  <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-slate-900">
                    <video
                      src={featuredVideoSrc}
                      poster={data.videoGallery[0]?.cover_url || '/uploads/hooghly_river_boats.jpg'}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-12 h-12 rounded-full bg-red-600/95 text-white flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 ml-0.5 fill-current" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-mono px-2 py-0.5 rounded">
                      HD WEBM
                    </div>
                  </div>
                  <div className="mt-2.5 text-center text-xs font-extrabold text-blue-700 group-hover:underline">
                    {lang === 'bn' ? 'সকল ভিডিও দেখুন ›' : 'Watch Videos ›'}
                  </div>
                </button>
              </div>
            </div>

            {/* Live Video / Events Spotlight */}
            <div className="bg-white rounded-xl border border-rose-200 shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-[#E11D48] to-[#F43F5E] text-white px-4 py-2.5 font-extrabold text-sm flex items-center gap-2">
                <DynamicIcon name="CalendarDays" className="w-4 h-4" />
                <span>{lang === 'bn' ? 'লাইভ ও ইভেন্টস / Live & Events' : 'Live Video & Events'}</span>
              </div>
              <div className="p-3">
                <button
                  type="button"
                  onClick={() => onNavigate('/events')}
                  className="w-full group text-left"
                >
                  <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-slate-900">
                    <video
                      src={liveReelSrc}
                      poster="/uploads/bengal_festival_puja.jpg"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold shadow">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      LIVE
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-11 h-11 rounded-full bg-black/60 border-2 border-white text-white flex items-center justify-center shadow">
                        <Play className="w-5 h-5 ml-0.5 fill-current" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 text-center text-xs font-extrabold text-blue-700 group-hover:underline">
                    {lang === 'bn' ? 'ইভেন্ট ও সম্প্রচার দেখুন ›' : 'Watch Live & Events ›'}
                  </div>
                </button>
              </div>
            </div>
          </section>
        );
      }

      default:
        return null;
    }
  };

  const activePopup = data.popup && data.popup.is_active ? data.popup : null;
  const popupTheme = activePopup
    ? POPUP_HEADER_THEME[activePopup.theme_color] || POPUP_HEADER_THEME.royal
    : POPUP_HEADER_THEME.royal;

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-5 space-y-5">
      {visibleSections.map((sec) => renderSection(sec.section_key))}

      {/* Admin-Managed Homepage Announcement Popup Modal */}
      {popupOpen && activePopup && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 flex items-center justify-center p-3 sm:p-4"
          onClick={dismissPopup}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-white animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`bg-gradient-to-r ${popupTheme.header} text-white px-5 py-3.5 flex items-center justify-between gap-3`}>
              <div className="flex items-center gap-2 min-w-0">
                <BellRing className="w-5 h-5 shrink-0 text-amber-200" />
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${popupTheme.badge} shrink-0`}>
                  {bi(lang, activePopup.badge_en, activePopup.badge_bn)}
                </span>
              </div>
              <button
                type="button"
                onClick={dismissPopup}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                aria-label="Close popup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activePopup.image_url && (
              <div className="aspect-[16/8] w-full bg-slate-100 overflow-hidden">
                <SmartImage
                  src={activePopup.image_url}
                  alt={bi(lang, activePopup.title_en, activePopup.title_bn)}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="p-5 space-y-3">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
                {bi(lang, activePopup.title_en, activePopup.title_bn)}
              </h3>
              {(activePopup.subtitle_en || activePopup.subtitle_bn) && (
                <p className="text-xs sm:text-sm font-bold text-blue-700">
                  {bi(lang, activePopup.subtitle_en, activePopup.subtitle_bn)}
                </p>
              )}
              {(activePopup.body_en || activePopup.body_bn) && (
                <p className="text-sm text-slate-600 leading-relaxed">
                  {bi(lang, activePopup.body_en, activePopup.body_bn)}
                </p>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={dismissPopup}
                  className="px-4 py-2 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs sm:text-sm font-bold transition-colors"
                >
                  {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = activePopup.button_link || '/section/notices-circulars';
                    dismissPopup();
                    onNavigate(target);
                  }}
                  className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-gradient-to-r ${popupTheme.btn} text-white text-xs sm:text-sm font-extrabold shadow-md hover:brightness-110 transition-all`}
                >
                  <span>{bi(lang, activePopup.button_text_en, activePopup.button_text_bn)}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
