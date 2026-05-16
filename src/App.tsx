/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Activity, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Info, 
  ShoppingCart, 
  Brain, 
  Package, 
  TrendingUp, 
  Loader2,
  ChevronRight,
  ShieldCheck,
  Zap,
  MessageSquareQuote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

// Types
type Sentiment = 'Very Positive' | 'Positive' | 'Mixed' | 'Polarized' | 'Negative' | string;
type ConsensusStrength = 'Strong' | 'Moderate' | 'Weak' | string;

interface ReportData {
  header: {
    productName: string;
    asin: string;
    price: string;
    reviewsAnalyzed: string;
    generatedDate: string;
  };
  sentiment: Sentiment;
  consensusStrength: ConsensusStrength;
  confidenceScore: number;
  praise: { percent: string; text: string };
  warning: { percent: string; text: string };
  issue: { percent: string; text: string };
  failure: { percent: string; text: string };
  recommendation: { percent: string; text: string; verdict: string };
  emotionalTheme: string;
  emotionalExplanation: string;
  buyerTruth: string[];
  logisticsIssues: string;
  raw: string;
}

const SYSTEM_PROMPT = `You are ProductPulse — an AI-powered Consumer Intelligence Engine.
Analyze up to 50 Amazon reviews (or a product URL) and generate a high-fidelity intelligence report.

If only a URL is provided, try to identify the product from the URL segments and provide a theoretical consensus based on your internal knowledge of that product's general reception, but lower the Confidence Score to reflect this.

==================================================
MANDATORY OUTPUT FORMAT (USE THIS EXACT STRUCTURE)
==================================================
─────────────────────────────────────
PRODUCTPULSE // INTELLIGENCE REPORT
Product: [Full product name]
ASIN: [ASIN]
Price: [Price]
Reviews Analyzed: [Count]
Generated: [Date]
─────────────────────────────────────

Sentiment: [Very Positive / Positive / Mixed / Polarized / Negative]
Consensus Strength: [Strong / Moderate / Weak]
Confidence Score: [0-100] (CRITICAL: MUST INCLUDE THIS LINE)

👍 XX% [Praise]
⚠️ XX% [Warning]
😐 XX% [Issue]
❌ XX% [Failure]

🛒 XX% recommend | [Buy / Mixed / Avoid]

🧠 Emotional Core: "[Theme]"
   → [Explanation]

📦 Logistics Issues: [Ignore / Minor / Significant]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUYER TRUTH (5-LINE SIGNAL STACK)
① [Finding 1]
② [Finding 2]
③ [Finding 3]
④ [Finding 4]
⑤ [Finding 5]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINAL VERDICT: [Verdict] — [Reason]

STRICT: Use compact, factual, noun-heavy phrasing. Zero hallucination regarding specific buyer stories unless repeated in reviews.`;

export default function App() {
  const [reviews, setReviews] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const analyzeReviews = async () => {
    if (!reviews.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    setReport(null);

    try {
      const isUrl = reviews.trim().split('\n').length === 1 && reviews.trim().match(/^https?:\/\//);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const promptSuffix = isUrl ? "\n\n(Note: A URL was provided. Please infer the product details and general consensus from your internal knowledge base if direct review text is missing.)" : "";
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze these reviews and provide the ProductPulse Intelligence Report:\n\n${reviews}${promptSuffix}`,
        config: {
          systemInstruction: SYSTEM_PROMPT,
        }
      });

      const text = response.text || '';
      const parsedReport = parseReport(text);
      setReport(parsedReport);
      
      // Scroll to results after a short delay
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error(err);
      setError("Analysis failed. Please check your inputs or try again later.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const parseReport = (text: string): ReportData => {
    const lines = text.split('\n');
    const data: any = { 
      raw: text,
      header: { productName: 'Analysis Subject', asin: 'N/A', price: '', reviewsAnalyzed: 'N/A', generatedDate: '' },
      buyerTruth: [],
      confidenceScore: 0
    };

    let inBuyerTruth = false;

    lines.forEach((line, index) => {
      const trimmed = line.trim().replace(/^\*+|#+|\*+$/g, ''); // Clean markdown formatting
      
      // Improved robust parsing using regex
      const productMatch = trimmed.match(/Product:\s*(.*)/i);
      if (productMatch) data.header.productName = productMatch[1].trim();

      const asinMatch = trimmed.match(/ASIN:\s*(.*)/i);
      if (asinMatch) data.header.asin = asinMatch[1].trim();

      const priceMatch = trimmed.match(/Price:\s*(.*)/i);
      if (priceMatch) data.header.price = priceMatch[1].trim();

      const analyzedMatch = trimmed.match(/Reviews Analyzed:\s*(.*)/i);
      if (analyzedMatch) data.header.reviewsAnalyzed = analyzedMatch[1].trim();

      const generatedMatch = trimmed.match(/Generated:\s*(.*)/i);
      if (generatedMatch) data.header.generatedDate = generatedMatch[1].trim();

      if (trimmed.match(/Sentiment:/i)) data.sentiment = trimmed.split(/Sentiment:/i)[1]?.trim();
      if (trimmed.match(/Consensus Strength:/i)) data.consensusStrength = trimmed.split(/Consensus Strength:/i)[1]?.trim();
      
      // Improved Confidence Score parsing
      const confMatch = trimmed.match(/(?:Confidence Score|Confidence):\s*(\d+)/i);
      if (confMatch) {
        data.confidenceScore = parseInt(confMatch[1]);
      } else if (trimmed.includes('Score') && line.includes(':')) {
        // Fallback for weird formatting
        const parts = trimmed.split(':');
        const scoreVal = parseInt(parts[1]?.trim());
        if (!isNaN(scoreVal)) data.confidenceScore = scoreVal;
      }
      
      if (line.includes('👍')) {
        const row = line.substring(line.indexOf('👍') + 2).trim();
        const parts = row.split('%');
        data.praise = { percent: (parts[0] || '0').trim() + '%', text: parts[1]?.trim() || '' };
      }
      if (line.includes('⚠️')) {
        const row = line.substring(line.indexOf('⚠️') + 2).trim();
        const parts = row.split('%');
        data.warning = { percent: (parts[0] || '0').trim() + '%', text: parts[1]?.trim() || '' };
      }
      if (line.includes('😐')) {
        const row = line.substring(line.indexOf('😐') + 2).trim();
        const parts = row.split('%');
        data.issue = { percent: (parts[0] || '0').trim() + '%', text: parts[1]?.trim() || '' };
      }
      if (line.includes('❌')) {
        const row = line.substring(line.indexOf('❌') + 2).trim();
        const parts = row.split('%');
        data.failure = { percent: (parts[0] || '0').trim() + '%', text: parts[1]?.trim() || '' };
      }
      if (line.includes('🛒')) {
        const main = line.substring(line.indexOf('🛒') + 2).trim();
        const parts = main.split('|');
        const percentPart = parts[0]?.trim() || '';
        const percentValMatch = percentPart.match(/(\d+)/);
        data.recommendation = { 
          percent: (percentValMatch ? percentValMatch[1] : '0') + '%', 
          text: parts[1]?.trim() || '',
          verdict: percentPart.replace(/\d+%/, '').trim() || 'Mixed'
        };
      }
      
      if (line.includes('🧠 Emotional Core:')) {
        data.emotionalTheme = line.split(':')[1]?.trim().replace(/"/g, '');
        const nextLine = lines[index + 1];
        if (nextLine && nextLine.includes('→')) {
          data.emotionalExplanation = nextLine.split('→')[1]?.trim();
        }
      }

      if (line.includes('📦 Logistics Issues:')) data.logisticsIssues = line.split(':')[1]?.trim();

      if (line.includes('BUYER TRUTH')) {
        inBuyerTruth = true;
      } else if (inBuyerTruth && line.includes('━━━━')) {
        inBuyerTruth = false;
      } else if (inBuyerTruth && /^[①②③④⑤]/.test(line.trim())) {
        data.buyerTruth.push(line.trim());
      }

      if (line.includes('FINAL VERDICT:')) {
        data.finalVerdict = line.split('FINAL VERDICT:')[1]?.trim();
      }
    });

    return data as ReportData;
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#141414] font-sans selection:bg-[#141414] selection:text-white">
      {/* Navigation */}
      <nav className="border-b border-[#141414]/10 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-[#141414] text-white p-1.5 rounded-sm">
              <Activity size={18} strokeWidth={2.5} />
            </div>
            <span className="font-bold tracking-tight text-lg uppercase">ProductPulse</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-[11px] font-mono uppercase tracking-[0.1em] opacity-40 hidden sm:block">Consumer Intel Engine v2.0</span>
            <div className="h-8 w-px bg-[#141414]/10 hidden sm:block" />
            <ShieldCheck size={20} strokeWidth={1.5} className="opacity-40" />
          </div>
        </div>
      </nav>

      <main className="max-w-screen-xl mx-auto px-6 py-12 lg:py-20">
        {/* Hero Section */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start mb-20">
          <div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl lg:text-7xl font-bold tracking-tighter leading-[0.9] mb-8 uppercase">
                Extract <span className="text-[#141414]/40 italic px-1">High-Fidelity</span> Buyer Truth.
              </h1>
              <p className="text-xl text-[#141414]/60 max-w-md leading-relaxed mb-10">
                Premium intelligence designed to compress thousands of review words into a high-signal consensus report. Zero hallucination. Pure insight.
              </p>
              
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#141414]/5 rounded-full text-[10px] uppercase font-bold tracking-wider">
                  <TrendingUp size={12} /> Investor-Grade Sentiment
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#141414]/5 rounded-full text-[10px] uppercase font-bold tracking-wider">
                  <Zap size={12} /> Instant Scanability
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white border border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] p-6 lg:p-8"
          >
            <div className="flex items-center justify-between mb-4">
              <label className="text-[11px] font-mono uppercase tracking-[0.2em] font-bold">Input Stack (Up to 50 Reviews)</label>
              <MessageSquareQuote size={18} className="opacity-20" />
            </div>
            
            <textarea
              value={reviews}
              onChange={(e) => setReviews(e.target.value)}
              placeholder="Paste Amazon product reviews here..."
              className="w-full h-64 bg-[#FDFCFB] border border-[#141414]/10 p-4 font-mono text-sm focus:outline-none focus:border-[#141414] transition-colors resize-none placeholder:opacity-30"
            />
            
            <button
              onClick={analyzeReviews}
              disabled={isAnalyzing || !reviews.trim()}
              className={`w-full mt-6 h-14 flex items-center justify-center gap-2 uppercase font-bold tracking-[0.2em] transition-all
                ${isAnalyzing 
                  ? 'bg-[#141414]/10 cursor-not-allowed' 
                  : 'bg-[#141414] text-white hover:bg-neutral-800'}`}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Scanning Nodes...
                </>
              ) : (
                <>
                  Analyze Consensus
                  <ChevronRight size={18} />
                </>
              )}
            </button>

            {error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs flex gap-2 items-center"
              >
                <AlertTriangle size={14} /> {error}
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Results Sections */}
        <div ref={resultsRef}>
          <AnimatePresence>
            {report && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="space-y-8"
              >
                <div className="flex flex-col border-b-4 border-[#141414] pb-6 gap-6">
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-2"
                  >
                    <div className="text-[10px] uppercase font-bold tracking-[0.3em] opacity-40 mb-2">Subject Analysis</div>
                    <h3 className="text-2xl md:text-4xl font-black uppercase tracking-tighter leading-none">
                      {report.header.productName || 'Analysis Subject'}
                    </h3>
                  </motion.div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                    <div>
                      <h2 className="text-3xl font-bold uppercase tracking-tighter">Intelligence Report</h2>
                      <p className="text-[11px] font-mono opacity-40 uppercase tracking-widest mt-1">Verified Consensus // P-PULSE_EXTRACT</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] uppercase font-bold opacity-40 tracking-widest mb-1">Confidence Score</div>
                      <div className="text-5xl font-mono font-bold">{report.confidenceScore || 0}%</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#141414]/10">
                    <HeaderItem label="Price Vector" value={report.header.price} />
                    <HeaderItem label="Generation Date" value={report.header.generatedDate} />
                  </div>
                </div>

                {/* Primary Stats Grid */}
                <div className="grid md:grid-cols-3 gap-1 bg-[#141414]/10">
                  <StatCard 
                    label="Aggregate Sentiment" 
                    value={report.sentiment} 
                    icon={<Brain size={20} />} 
                    colorClass={getSentimentColor(report.sentiment)}
                  />
                  <StatCard 
                    label="Consensus Strength" 
                    value={report.consensusStrength} 
                    icon={<Activity size={20} />} 
                    colorClass={getStrengthColor(report.consensusStrength)}
                  />
                  <StatCard 
                    label="Purchase Verdict" 
                    value={report.recommendation?.verdict || 'Mixed'} 
                    icon={<ShoppingCart size={20} />} 
                    colorClass={getVerdictColor(report.recommendation?.verdict)}
                  />
                </div>

                {/* Details Grid */}
                <div className="grid lg:grid-cols-5 gap-4">
                  {/* Left Column: Key Findings */}
                  <div className="lg:col-span-3 space-y-4">
                    <InsightBar 
                      type="praise" 
                      percent={report.praise?.percent} 
                      text={report.praise?.text} 
                      icon={<CheckCircle2 size={18} />} 
                    />
                    <InsightBar 
                      type="warning" 
                      percent={report.warning?.percent} 
                      text={report.warning?.text} 
                      icon={<Info size={18} />} 
                    />
                    <InsightBar 
                      type="issue" 
                      percent={report.issue?.percent} 
                      text={report.issue?.text} 
                      icon={<AlertTriangle size={18} />} 
                    />
                    <InsightBar 
                      type="failure" 
                      percent={report.failure?.percent} 
                      text={report.failure?.text} 
                      icon={<XCircle size={18} />} 
                    />
                  </div>

                  {/* Right Column: Narrative Context */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white border border-[#141414]/10 p-6 h-full flex flex-col">
                      <div className="text-[10px] uppercase font-mono tracking-[0.2em] font-bold opacity-30 mb-6">Psychological Pulse</div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-[#141414] text-white flex items-center justify-center shrink-0">
                            <Brain size={20} />
                          </div>
                          <h4 className="text-sm font-bold uppercase tracking-wider">Emotional Core</h4>
                        </div>
                        <p className="text-xl italic font-serif leading-snug mb-2">
                          "{report.emotionalTheme}"
                        </p>
                        <p className="text-xs text-[#141414]/60 leading-relaxed pl-4 border-l-2 border-[#141414]/10">
                          {report.emotionalExplanation || "Primary emotional driver identified through recurring sentiment patterns."}
                        </p>
                      </div>

                      <div className="mt-8 pt-8 border-t border-[#141414]/5">
                        <div className="flex items-center gap-2 mb-2">
                          <Package size={16} className="opacity-40" />
                          <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">Logistics Context</span>
                        </div>
                        <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm inline-block
                          ${report.logisticsIssues?.includes('Ignore') ? 'bg-green-50 text-green-700' : 
                            report.logisticsIssues?.includes('Minor') ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                          {report.logisticsIssues}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Buyer Truth Section */}
                <div className="bg-[#141414]/5 border border-[#141414]/10 p-8 lg:p-12 mt-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="h-[2px] flex-1 bg-[#141414]/10" />
                    <h3 className="text-xl font-black uppercase tracking-widest">Buyer Truth Signal Stack</h3>
                    <div className="h-[2px] flex-1 bg-[#141414]/10" />
                  </div>
                  
                  <div className="grid md:grid-cols-1 gap-4 max-w-3xl mx-auto">
                    {report.buyerTruth.map((truth, i) => (
                      <div key={i} className="flex gap-6 items-start group">
                        <span className="text-xl font-mono text-[#141414]/40 group-hover:text-[#141414] transition-colors">{truth.charAt(0)}</span>
                        <p className="text-sm sm:text-base font-medium leading-relaxed pt-1 border-b border-[#141414]/5 pb-4 w-full">
                          {truth.substring(1).trim()}
                        </p>
                      </div>
                    ))}
                    {report.buyerTruth.length === 0 && (
                      <p className="text-center text-sm opacity-40 italic py-8">Awaiting signal validation...</p>
                    )}
                  </div>
                </div>

                {/* Recommendation Banner */}
                <div className="bg-[#141414] text-white p-8 lg:p-12 mt-8 flex flex-col md:flex-row items-center gap-8 justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-white/5 to-transparent skew-x-[-20deg]" />
                  <div className="relative z-10 w-full md:w-auto">
                    <div className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-50 mb-4">Final Intelligence Vector</div>
                    <div className="flex items-baseline gap-4">
                      <span className="text-6xl sm:text-7xl font-mono font-bold leading-none shrink-0">{report.recommendation?.percent}</span>
                      <span className="text-xl sm:text-2xl font-bold uppercase tracking-tight">Recommend</span>
                    </div>
                  </div>
                  <div className="h-20 w-px bg-white/20 hidden md:block" />
                  <div className="relative z-10 text-center md:text-right w-full md:w-auto">
                    <div className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-50 mb-2">Verdict Action</div>
                    <div className="text-3xl sm:text-4xl font-black uppercase tracking-widest italic font-serif">
                      {(report as any).finalVerdict || report.recommendation?.verdict}
                    </div>
                  </div>
                </div>

                {/* Raw Feed View */}
                <details className="group border-t border-[#141414]/10 pt-8 opacity-40 hover:opacity-100 transition-opacity">
                  <summary className="list-none flex items-center justify-center gap-2 cursor-pointer text-[10px] uppercase font-bold tracking-[0.2em] mb-4 outline-none">
                    <Search size={12} /> View Raw Analytical Feed
                  </summary>
                  <div className="bg-white p-6 border border-[#141414]/5 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                    <ReactMarkdown>{report.raw}</ReactMarkdown>
                  </div>
                </details>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-screen-xl mx-auto px-6 py-12 border-t border-[#141414]/5 mt-20">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-[10px] font-mono uppercase tracking-widest opacity-30">
            © 2026 ProductPulse / Experimental Intel Engine
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            <FooterLink label="Accuracy Policy" />
            <FooterLink label="Data Ethics" />
            <FooterLink label="API Documentation" />
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeaderItem({ label, value }: { label: string, value: string }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <div className="text-[9px] uppercase font-bold tracking-widest opacity-30">{label}</div>
      <div className="text-xs font-bold leading-tight line-clamp-1">{value}</div>
    </div>
  );
}

function StatCard({ label, value, icon, colorClass }: { label: string, value: string, icon: React.ReactNode, colorClass: string }) {
  return (
    <div className={`bg-white border-[#141414]/10 p-6 flex flex-col justify-between min-h-[140px] transition-all hover:bg-neutral-50`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">{label}</span>
        <div className="opacity-20">{icon}</div>
      </div>
      <div className={`text-2xl font-black uppercase tracking-tight leading-tight ${colorClass}`}>
        {value}
      </div>
    </div>
  );
}

function InsightBar({ type, percent, text, icon }: { type: 'praise' | 'warning' | 'issue' | 'failure', percent: string, text: string, icon: React.ReactNode }) {
  const styles = {
    praise: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', accent: 'bg-green-500', label: 'Positive Resonance' },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900', accent: 'bg-yellow-500', label: 'Dependency Note' },
    issue: { bg: 'bg-neutral-50', border: 'border-neutral-200', text: 'text-neutral-900', accent: 'bg-neutral-500', label: 'Usability Friction' },
    failure: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', accent: 'bg-red-500', label: 'Critical Failure' },
  };

  const current = styles[type];

  return (
    <div className={`border ${current.border} ${current.bg} p-6 flex flex-col sm:flex-row items-center gap-6 relative group overflow-hidden`}>
      <div className="absolute top-0 left-0 w-1 h-full bg-[#141414]/10 group-hover:w-2 transition-all" />
      
      <div className="flex flex-col items-center shrink-0 w-24">
        <div className="text-4xl font-mono font-bold leading-none tracking-tighter mb-1">{percent || '0%'}</div>
        <div className="text-[8px] uppercase font-black tracking-widest opacity-40 text-center leading-tight">{current.label}</div>
      </div>

      <div className="hidden sm:block w-px h-12 bg-[#141414]/5 shrink-0" />

      <div className="flex-1 flex items-start gap-4 w-full sm:w-auto">
        <div className={`mt-0.5 p-1.5 rounded-sm shrink-0 ${current.text} bg-white border ${current.border}`}>
          {icon}
        </div>
        <p className="text-sm font-medium leading-relaxed">
          {text || "Evidence density insufficient for clear extraction."}
        </p>
      </div>
    </div>
  );
}

function FooterLink({ label }: { label: string }) {
  return (
    <a href="#" className="text-[10px] uppercase font-bold tracking-widest opacity-30 hover:opacity-100 transition-opacity">
      {label}
    </a>
  );
}

// Helpers
const getSentimentColor = (s: string) => {
  if (!s) return 'text-neutral-400';
  const lower = s.toLowerCase();
  if (lower.includes('very positive')) return 'text-green-600';
  if (lower.includes('positive')) return 'text-green-500';
  if (lower.includes('polarized')) return 'text-orange-500';
  if (lower.includes('negative')) return 'text-red-500';
  return 'text-neutral-900';
};

const getStrengthColor = (s: string) => {
  if (!s) return 'text-neutral-400';
  const lower = s.toLowerCase();
  if (lower.includes('strong')) return 'text-neutral-900';
  if (lower.includes('moderate')) return 'text-neutral-600';
  return 'text-neutral-400';
};

const getVerdictColor = (v: string) => {
  if (!v) return 'text-neutral-400';
  const lower = v.toLowerCase();
  if (lower.includes('buy')) return 'text-green-600';
  if (lower.includes('avoid')) return 'text-red-600';
  return 'text-orange-500';
};

