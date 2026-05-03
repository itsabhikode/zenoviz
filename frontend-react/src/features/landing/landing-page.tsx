import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import * as bookingsApi from '@/core/api/bookings'
import { nprText, formatNprAmount } from '@/core/currency'
import type { PricingConfigResponse } from '@/core/api/models'
import { Button } from '@/components/ui/button'
import {
  BookOpen, Clock, Wifi, Shield, MapPin, Phone,
  ArrowRight, CheckCircle2, MessageCircle, ExternalLink,
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0, 0, 0.2, 1] as const } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
}

/* ─── Nav ─── */
function LandingNav() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header className="sticky top-0 z-50 bg-[#122C6B] shadow-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-white">Z</span>
          </div>
          <span className="text-lg font-semibold text-white">Zenoviz</span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {['features', 'pricing', 'gallery', 'how-it-works', 'contact'].map((id) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="rounded-md px-3 py-2 text-sm font-medium text-[#94A3B8] transition-colors hover:bg-white/10 hover:text-white"
            >
              {id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" className="text-[#94A3B8] hover:bg-white/10 hover:text-white" asChild>
            <Link to="/login">Sign In</Link>
          </Button>
          <Button className="btn-primary" asChild>
            <Link to="/login">Book Now</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

/* ─── Hero ─── */
function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#122C6B] py-24">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#10B981]/10 via-transparent to-[#122C6B]" />
      <div className="pointer-events-none absolute -left-32 top-20 h-[500px] w-[500px] rounded-full bg-[#10B981]/8 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-20 h-[400px] w-[400px] rounded-full bg-[#10B981]/5 blur-3xl" />

      <motion.div
        className="relative z-10 mx-auto max-w-6xl px-6"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <motion.div variants={fadeUp} className="max-w-2xl">
          <span className="mb-4 inline-block rounded-full bg-primary/20 px-4 py-1.5 text-xs font-semibold text-primary">
            Study Room Booking
          </span>
          <h1 className="text-5xl font-bold leading-tight tracking-tight text-white md:text-6xl">
            Your perfect{' '}
            <span className="text-primary">study spot</span>{' '}
            awaits.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[#94A3B8] md:text-xl">
            Reserve a quiet, focused workspace in seconds. Pick your dates,
            choose your seat, and start studying.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button size="lg" className="btn-primary h-12 px-8 text-base" asChild>
              <Link to="/login">
                Book a Seat <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 border-white/20 px-8 text-base text-white hover:bg-white/10"
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
            >
              View Pricing
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

/* ─── Features ─── */
const FEATURES = [
  { icon: BookOpen, title: 'Quiet Study Spaces', desc: 'Distraction-free environment designed for deep focus and productivity.' },
  { icon: Clock, title: 'Flexible Hours', desc: 'Choose 3-hour slots or full-day anytime access to suit your schedule.' },
  { icon: Wifi, title: 'High-Speed Wi-Fi', desc: 'Fast, reliable internet for research, streaming lectures, and more.' },
  { icon: Shield, title: 'Secure Lockers', desc: 'Keep your belongings safe with optional personal locker add-ons.' },
]

function FeaturesSection() {
  return (
    <section id="features" className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="text-center"
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-foreground">
            Everything you need to focus
          </motion.h2>
          <motion.p variants={fadeUp} className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Our study rooms are designed with one goal: helping you do your best work.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              className="rounded-lg border border-border/50 bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ─── Pricing ─── */

function PricingCard({ title, subtitle, badge, daily, weekly, monthly, lockerDaily, lockerWeekly, lockerMonthly, weeklySaving, monthlySaving }: {
  title: string; subtitle: string; badge?: string
  daily: number; weekly: number; monthly: number
  lockerDaily: number; lockerWeekly: number; lockerMonthly: number
  weeklySaving: number; monthlySaving: number
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-sm">
      <div className="border-b border-border/30 px-5 py-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {badge && <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{badge}</span>}
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="divide-y divide-border/30">
        {[
          { label: 'Daily', price: daily, saving: 0 },
          { label: 'Weekly', price: weekly, saving: weeklySaving },
          { label: 'Monthly', price: monthly, saving: monthlySaving },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              {row.saving > 0 && (
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                  Save {row.saving}%
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-foreground">{formatNprAmount(row.price)}</span>
              <span className="text-xs text-muted-foreground"> /day</span>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between bg-muted/30 px-5 py-2.5">
          <span className="text-xs text-muted-foreground">+ Locker add-on</span>
          <span className="text-xs text-muted-foreground">
            {formatNprAmount(lockerDaily)} / {formatNprAmount(lockerWeekly)} / {formatNprAmount(lockerMonthly)}
          </span>
        </div>
      </div>
    </div>
  )
}

function PricingTable({ pricing }: { pricing: PricingConfigResponse }) {
  const weeklySaving = pricing.anytime_daily_price > 0
    ? Math.round((1 - pricing.anytime_weekly_price / pricing.anytime_daily_price) * 100)
    : 0
  const monthlySaving = pricing.anytime_daily_price > 0
    ? Math.round((1 - pricing.anytime_monthly_price / pricing.anytime_daily_price) * 100)
    : 0

  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-card shadow-sm">
      {/* Table header */}
      <div className="grid grid-cols-4 border-b border-border/50 bg-muted/40">
        <div className="px-5 py-3" />
        <div className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Daily</div>
        <div className="bg-primary/5 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Weekly
          {weeklySaving > 0 && (
            <span className="ml-1.5 inline-block rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
              Save {weeklySaving}%
            </span>
          )}
        </div>
        <div className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Monthly
          {monthlySaving > 0 && (
            <span className="ml-1.5 inline-block rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
              Save {monthlySaving}%
            </span>
          )}
        </div>
      </div>

      {/* Anytime row */}
      <div className="grid grid-cols-4 border-b border-border/30">
        <div className="flex items-center px-5 py-4">
          <div>
            <div className="flex items-center gap-2 font-semibold text-foreground">
              Anytime
              <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Popular</span>
            </div>
            <div className="text-xs text-muted-foreground">Unlimited hours</div>
          </div>
        </div>
        <PriceCell price={pricing.anytime_daily_price} />
        <PriceCell price={pricing.anytime_weekly_price} total={pricing.anytime_weekly_price * 7} period="wk" highlight />
        <PriceCell price={pricing.anytime_monthly_price} total={pricing.anytime_monthly_price * 30} period="mo" />
      </div>

      {/* 3-hour slot row */}
      <div className="grid grid-cols-4 border-b border-border/30">
        <div className="flex items-center px-5 py-4">
          <div>
            <div className="font-semibold text-foreground">3-hour slot</div>
            <div className="text-xs text-muted-foreground">One session / day</div>
          </div>
        </div>
        <PriceCell price={pricing.timeslot_daily_price} />
        <PriceCell price={pricing.timeslot_weekly_price} total={pricing.timeslot_weekly_price * 7} period="wk" highlight />
        <PriceCell price={pricing.timeslot_monthly_price} total={pricing.timeslot_monthly_price * 30} period="mo" />
      </div>

      {/* Locker add-on */}
      <div className="grid grid-cols-4">
        <div className="flex items-center px-5 py-3">
          <div>
            <div className="text-sm font-medium text-muted-foreground">+ Locker</div>
            <div className="text-xs text-muted-foreground">Optional add-on</div>
          </div>
        </div>
        <div className="flex items-center justify-center px-4 py-3 text-center text-sm text-muted-foreground">
          + {formatNprAmount(pricing.locker_daily_price)}
        </div>
        <div className="flex items-center justify-center bg-primary/5 px-4 py-3 text-center text-sm text-muted-foreground">
          + {formatNprAmount(pricing.locker_weekly_price)}
        </div>
        <div className="flex items-center justify-center px-4 py-3 text-center text-sm text-muted-foreground">
          + {formatNprAmount(pricing.locker_monthly_price)}
        </div>
      </div>
    </div>
  )
}

function PriceCell({ price, total, period, highlight }: {
  price: number
  total?: number
  period?: string
  highlight?: boolean
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-4 py-4 text-center ${highlight ? 'bg-primary/5' : ''}`}>
      <div className="text-xl font-bold text-foreground">{formatNprAmount(price)}</div>
      <div className="text-xs text-muted-foreground">per day</div>
      {total != null && period && (
        <div className="mt-0.5 text-[11px] text-muted-foreground/70">{nprText(total)} / {period}</div>
      )}
    </div>
  )
}

function PricingSection({ pricing }: { pricing: PricingConfigResponse | undefined }) {
  if (!pricing) return null

  const weeklySaving = pricing.anytime_daily_price > 0
    ? Math.round((1 - pricing.anytime_weekly_price / pricing.anytime_daily_price) * 100)
    : 0
  const monthlySaving = pricing.anytime_daily_price > 0
    ? Math.round((1 - pricing.anytime_monthly_price / pricing.anytime_daily_price) * 100)
    : 0

  return (
    <section id="pricing" className="bg-background py-20">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="text-center"
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-foreground">
            Simple, transparent pricing
          </motion.h2>
          <motion.p variants={fadeUp} className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Choose the plan that fits your study schedule. All prices in NPR per day.
          </motion.p>
        </motion.div>

        {/* Desktop: 4-col table */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          className="mt-10 hidden md:block"
        >
          <PricingTable pricing={pricing} />
        </motion.div>

        {/* Mobile: stacked cards */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="mt-10 space-y-4 md:hidden"
        >
          <motion.div variants={fadeUp}>
            <PricingCard
              title="Anytime" subtitle="Unlimited hours" badge="Popular"
              daily={pricing.anytime_daily_price}
              weekly={pricing.anytime_weekly_price}
              monthly={pricing.anytime_monthly_price}
              lockerDaily={pricing.locker_daily_price}
              lockerWeekly={pricing.locker_weekly_price}
              lockerMonthly={pricing.locker_monthly_price}
              weeklySaving={weeklySaving} monthlySaving={monthlySaving}
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <PricingCard
              title="3-hour slot" subtitle="One session / day"
              daily={pricing.timeslot_daily_price}
              weekly={pricing.timeslot_weekly_price}
              monthly={pricing.timeslot_monthly_price}
              lockerDaily={pricing.locker_daily_price}
              lockerWeekly={pricing.locker_weekly_price}
              lockerMonthly={pricing.locker_monthly_price}
              weeklySaving={weeklySaving} monthlySaving={monthlySaving}
            />
          </motion.div>
        </motion.div>

        {/* Included features */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          {['High-speed Wi-Fi', 'Charging stations', 'Drinking water', 'Open seating'].map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              {f}
            </span>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Button size="lg" className="btn-primary h-12 px-8 text-base" asChild>
            <Link to="/login">
              Book a Seat <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ─── Gallery ─── */
const FALLBACK_IMAGES = [
  { src: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=600&h=400&fit=crop', alt: 'Study room overview' },
  { src: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop', alt: 'Individual desks' },
  { src: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=600&h=400&fit=crop', alt: 'Quiet workspace' },
  { src: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&h=400&fit=crop', alt: 'Modern interior' },
]

function GallerySection({ galleryImages }: { galleryImages: { src: string; alt: string }[] }) {
  const images = galleryImages.length > 0 ? galleryImages : FALLBACK_IMAGES

  return (
    <section id="gallery" className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="text-center"
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-foreground">
            Our Space
          </motion.h2>
          <motion.p variants={fadeUp} className="mx-auto mt-3 max-w-xl text-muted-foreground">
            A modern, clean environment designed to help you focus.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="mt-10 grid gap-4 sm:grid-cols-2"
        >
          {images.map((img) => (
            <motion.div
              key={img.alt}
              variants={fadeUp}
              className="overflow-hidden rounded-lg shadow-sm"
            >
              <img
                src={img.src}
                alt={img.alt}
                className="h-56 w-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ─── How It Works ─── */
const STEPS = [
  { num: '1', title: 'Pick Your Dates', desc: 'Select your start and end dates for the booking period.' },
  { num: '2', title: 'Choose Your Seat', desc: 'Browse the interactive seat map and pick your preferred spot.' },
  { num: '3', title: 'Start Studying', desc: 'Confirm your booking, pay, and enjoy your focused workspace.' },
]

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-background py-20">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="text-center"
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-foreground">
            How it works
          </motion.h2>
          <motion.p variants={fadeUp} className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Book your study spot in three simple steps.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="mt-12 grid gap-8 md:grid-cols-3"
        >
          {STEPS.map((step) => (
            <motion.div key={step.num} variants={fadeUp} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
                {step.num}
              </div>
              <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ─── Contact / Footer ─── */
function ContactSection() {
  return (
    <section id="contact" className="bg-[#122C6B] py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 md:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-white">Z</span>
              </div>
              <span className="text-lg font-semibold text-white">Zenoviz</span>
            </div>
            <p className="text-sm leading-relaxed text-[#94A3B8]">
              Premium study room booking for students who demand focus and comfort.
            </p>
          </div>

          {/* Contact info */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white">Contact</h3>
            <div className="space-y-3 text-sm text-[#94A3B8]">
              <a
                href="https://maps.app.goo.gl/quLBb1KWU62w2BMk7"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 transition-colors hover:text-white"
              >
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                Gandnayak Marg, Kathmandu 44600
                <ExternalLink className="h-3 w-3 opacity-50" />
              </a>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <a href="tel:+9779861164158" className="transition-colors hover:text-white">+977-9861164158</a>
                <a
                  href="https://wa.me/9779861164158"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 transition-colors hover:text-green-300"
                  title="WhatsApp"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <a href="tel:+9779869502772" className="transition-colors hover:text-white">+977-9869502772</a>
                <a
                  href="https://wa.me/9779869502772"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 transition-colors hover:text-green-300"
                  title="WhatsApp"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white">Quick Links</h3>
            <div className="space-y-2 text-sm">
              <Link to="/login" className="block text-[#94A3B8] transition-colors hover:text-white">
                Sign In
              </Link>
              <Link to="/register" className="block text-[#94A3B8] transition-colors hover:text-white">
                Create Account
              </Link>
              <button
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="block text-[#94A3B8] transition-colors hover:text-white"
              >
                Pricing
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-[#7c98b6]">
          &copy; {new Date().getFullYear()} Zenoviz. All rights reserved.
        </div>
      </div>
    </section>
  )
}

/* ─── Main Page ─── */
export default function LandingPage() {
  const { data: pricing } = useQuery({
    queryKey: ['pricing', 'public'],
    queryFn: bookingsApi.publicPricing,
  })

  const { data: galleryData } = useQuery({
    queryKey: ['gallery', 'public'],
    queryFn: bookingsApi.publicGallery,
  })

  const galleryImages = (galleryData ?? []).map((img) => ({
    src: img.image_url,
    alt: img.alt_text || img.title || 'Gallery image',
  }))

  return (
    <div className="min-h-screen">
      <LandingNav />
      <HeroSection />
      <FeaturesSection />
      <PricingSection pricing={pricing} />
      <GallerySection galleryImages={galleryImages} />
      <HowItWorksSection />
      <ContactSection />
    </div>
  )
}
