'use client';
import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

const Logo = () => (
    <a href="#" className="flex items-center gap-3">
        <Image src="/icon.png" alt="CorchCRM logo" width="28" height="28" />
        <span className="font-bold text-lg tracking-tight text-ink">CorchCRM</span>
    </a>
);


export default function LandingPage() {
    React.useEffect(() => {
        const yearEl = document.getElementById('year');
        if (yearEl) {
            yearEl.textContent = new Date().getFullYear().toString();
        }
      }, []);

  return (
    <div className="bg-white text-ink">
      <style jsx global>{`
        /* Simple waveform placeholder animation for Hero */
        .wave { height: 40px; display: flex; gap: 6px; align-items: flex-end; }
        .wave span { width: 6px; background: #61d8c4; display: inline-block; animation: bounce 1.2s infinite ease-in-out; border-radius: 3px; }
        .wave span:nth-child(2){ animation-delay:.1s }
        .wave span:nth-child(3){ animation-delay:.2s }
        .wave span:nth-child(4){ animation-delay:.3s }
        .wave span:nth-child(5){ animation-delay:.4s }
        @keyframes bounce{ 0%,100%{ height:8px } 50%{ height:40px } }
      `}</style>
      {/* NAV */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <a href="#how" className="hover:text-mint">How it works</a>
            <a href="#product" className="hover:text-mint">Product</a>
            <a href="#benefits" className="hover:text-mint">For Teams</a>
          </nav>
          <div className="flex items-center gap-3">
             <Button asChild className="inline-flex items-center justify-center rounded-full bg-ink text-white px-4 py-2 text-sm hover:bg-mint hover:text-ink transition">
                <Link href="/home">Enter App</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-lavender/40 px-3 py-1 text-xs font-medium text-ink/80 mb-4">The Customer Orchestrator</div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">The CRM that updates itself.<br /><span className="text-mint">Seal customer leakage with CorchCRM.</span></h1>
            <p className="mt-5 text-lg text-ink/80 max-w-xl">CorchCRM is a zero‑click, voice‑and‑AI powered CRM. Speak or connect Gmail; we transcribe, extract and auto‑update contacts, deals and tasks — so nothing slips through the funnel.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/home" className="inline-flex items-center rounded-full bg-mint px-5 py-3 font-semibold text-ink shadow-sm hover:brightness-95">Try the Demo</Link>
              <a href="#how" className="inline-flex items-center rounded-full border border-ink/10 px-5 py-3 font-semibold hover:border-mint">See how it works</a>
            </div>
            <div className="mt-8 wave" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
          </div>
          <div className="relative">
            {/* Replace this poster with a real gif/video of: voice → AI card → deal created */}
            <div className="aspect-video w-full rounded-2xl ring-1 ring-ink/10 bg-gradient-to-br from-mint/20 via-white to-lavender/30 flex items-center justify-center">
              <div className="text-center p-8">
                <p className="text-sm text-ink/60">Demo video placeholder</p>
                <button className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink text-white px-4 py-2 text-sm hover:bg-mint hover:text-ink transition">
                  ▶ Play 45s
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS / DEMO FLOW */}
      <section id="how" className="border-t border-ink/10 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="text-3xl font-bold">How it works</h2>
          <p className="mt-3 text-ink/80 max-w-2xl">Three steps. From voice to structured CRM data — with an approval step you control.</p>
          <div className="mt-10 grid md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-ink/10 p-6">
              <div className="text-2xl">1️⃣</div>
              <h3 className="mt-3 font-semibold">Speak or connect Gmail</h3>
              <p className="mt-2 text-sm text-ink/70">Record a quick voice note or enable Gmail. CorchCRM captures calls, emails and meetings.</p>
            </div>
            <div className="rounded-2xl border border-ink/10 p-6">
              <div className="text-2xl">2️⃣</div>
              <h3 className="mt-3 font-semibold">AI extracts contacts, deals & tasks</h3>
              <p className="mt-2 text-sm text-ink/70">Transcription and entity extraction turn messy conversations into structured fields.</p>
            </div>
            <div className="rounded-2xl border border-ink/10 p-6">
              <div className="text-2xl">3️⃣</div>
              <h3 className="mt-3 font-semibold">Approve or let it fly — Zero Click</h3>
              <p className="mt-2 text-sm text-ink/70">Review in one place. Approve once or auto‑apply above a confidence threshold.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT SCREENS / FEATURES */}
      <section id="product" className="border-t border-ink/10 bg-gradient-to-b from-white to-mint/10">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="text-3xl font-bold">Product</h2>
          <p className="mt-3 text-ink/80 max-w-2xl">Meet the three core views that power your day.</p>
          <div className="mt-10 grid lg:grid-cols-3 gap-8">
            {/* Zero‑Click Inbox */}
            <div className="rounded-2xl bg-white border border-ink/10 p-6">
              <h3 className="font-semibold">Zero‑Click Inbox</h3>
              <p className="mt-2 text-sm text-ink/70">Approve AI suggestions collected from voice, email and meetings.</p>
              <div className="mt-4 aspect-video rounded-lg bg-lavender/30"></div>
              <p className="mt-3 text-xs text-ink/60">“Meetings, calls and emails auto‑organized by AI.”</p>
            </div>
            {/* Deal card with AI summary */}
            <div className="rounded-2xl bg-white border border-ink/10 p-6">
              <h3 className="font-semibold">Deal View</h3>
              <p className="mt-2 text-sm text-ink/70">See AI summaries, next steps and stakeholders in one place.</p>
              <div className="mt-4 aspect-video rounded-lg bg-honey/30"></div>
              <p className="mt-3 text-xs text-ink/60">“Auto‑updated pipeline. Nothing slips.”</p>
            </div>
            {/* NLQ search */}
            <div className="rounded-2xl bg-white border border-ink/10 p-6">
              <h3 className="font-semibold">Natural‑Language Search</h3>
              <p className="mt-2 text-sm text-ink/70">Ask: “deals without a reply in 10 days” — get answers instantly.</p>
              <div className="mt-4 aspect-video rounded-lg bg-mint/30"></div>
              <p className="mt-3 text-xs text-ink/60">“Search by intent, not by filters.”</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOR TEAMS / BENEFITS */}
      <section id="benefits" className="border-t border-ink/10 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="text-3xl font-bold">For Teams</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-ink/10 p-6">
              <h3 className="font-semibold">Founders</h3>
              <p className="mt-2 text-sm text-ink/70">Spend zero time updating CRM. CorchCRM orchestrates your pipeline for you.</p>
            </div>
            <div className="rounded-2xl border border-ink/10 p-6">
              <h3 className="font-semibold">Sales</h3>
              <p className="mt-2 text-sm text-ink/70">Never forget a follow‑up. Auto‑created tasks and next best actions.</p>
            </div>
            <div className="rounded-2xl border border-ink/10 p-6">
              <h3 className="font-semibold">RevOps</h3>
              <p className="mt-2 text-sm text-ink/70">Data hygiene on autopilot. Auditable changes, dedupe and governance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA / WAITLIST */}
      <section id="waitlist" className="border-t border-ink/10 bg-ink">
        <div className="mx-auto max-w-7xl px-6 py-20 text-white grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl font-extrabold">Ready to seal your funnel?</h2>
            <p className="mt-3 text-white/80">Join the early access list and get the 45‑second demo. CorchCRM: Customer Orchestrator that stops leakage before it happens.</p>
            <div className="mt-8 flex gap-3">
              {/* Replace href with your Typeform or Firebase form URL */}
              <a href="#" className="inline-flex items-center rounded-full bg-mint px-5 py-3 font-semibold text-ink hover:brightness-95">Get Early Access</a>
              <a href="#demo" className="inline-flex items-center rounded-full border border-white/20 px-5 py-3 font-semibold hover:bg-white hover:text-ink">Watch Demo</a>
            </div>
            <div className="mt-6 flex items-center gap-4 opacity-80">
              {/* Integrations logos placeholders */}
              <span className="text-xs">Integrates with</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="px-2 py-1 rounded bg-white/10">Gmail</span>
                <span className="px-2 py-1 rounded bg-white/10">Google Calendar</span>
                <span className="px-2 py-1 rounded bg-white/10">Zoom</span>
              </div>
            </div>
          </div>
          <form className="bg-white/5 rounded-2xl p-6">
            <label className="block text-sm mb-1" htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="you@company.com" className="w-full rounded-lg bg-white/10 text-white placeholder-white/50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-mint" required />
            <label className="block text-sm mt-4 mb-1" htmlFor="role">Role</label>
            <select id="role" className="w-full rounded-lg bg-white/10 text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-mint">
              <option>Founder</option>
              <option>Sales</option>
              <option>RevOps</option>
              <option>Other</option>
            </select>
            <button type="submit" className="mt-6 w-full rounded-lg bg-honey text-ink font-semibold px-4 py-3 hover:brightness-95">Join Waitlist</button>
            <p className="mt-3 text-xs text-white/60">By joining you agree to get early product updates. Unsubscribe anytime.</p>
          </form>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-ink/10">
        <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-ink/60">
          <p>© <span id="year">{new Date().getFullYear()}</span> CorchCRM. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-ink">Privacy</a>
            <a href="#" className="hover:text-ink">Terms</a>
            <a href="#" className="hover:text-ink">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
