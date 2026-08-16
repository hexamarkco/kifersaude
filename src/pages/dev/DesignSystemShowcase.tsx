import { useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Home,
  LayoutGrid,
  Link2,
  List,
  Minus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Wallet,
} from 'lucide-react';
import './design-system-showcase.css';

const CARD =
  'rounded-[28px] border border-[#ECE5D6] bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(24,20,15,0.04)]';

function SectionLabel({ children }: { children: string }) {
  return <p className="mb-5 text-[13px] font-medium text-[#8A8172]">{children}</p>;
}

function Checkbox({
  checked,
  indeterminate,
  disabled,
  onClick,
}: {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const active = checked || indeterminate;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={checked}
      className={[
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors',
        disabled
          ? active
            ? 'border-[#D9D2C2] bg-[#D9D2C2]'
            : 'border-[#E7DFCF] bg-[#F4F0E7]'
          : active
            ? 'border-[#18140F] bg-[#18140F] cursor-pointer'
            : 'border-[#D8CFBC] bg-white cursor-pointer hover:border-[#18140F]',
      ].join(' ')}
    >
      {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
      {indeterminate && !checked && <Minus className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
    </button>
  );
}

function Radio({
  checked,
  disabled,
  onClick,
}: {
  checked?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={checked}
      className={[
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
        disabled
          ? checked
            ? 'border-[#D9D2C2]'
            : 'border-[#E7DFCF]'
          : checked
            ? 'border-[#18140F] cursor-pointer'
            : 'border-[#D8CFBC] cursor-pointer hover:border-[#18140F]',
      ].join(' ')}
    >
      {checked && (
        <span className={['h-2.5 w-2.5 rounded-full', disabled ? 'bg-[#D9D2C2]' : 'bg-[#18140F]'].join(' ')} />
      )}
    </button>
  );
}

function FieldRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3">
      {children}
      <span className="text-sm text-[#3A3226]">{label}</span>
    </div>
  );
}

function PaymentChip({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      className={[
        'flex h-10 items-center justify-center rounded-full border border-[#ECE5D6] bg-white',
        wide ? 'min-w-[64px] px-4' : 'w-10',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

const FLAG_PAIRS: Array<[string, string]> = [
  ['#2E7D4F', '#F4F0E7'],
  ['#1A3E8C', '#E2672E'],
  ['#18140F', '#E2672E'],
  ['#1A3E8C', '#D8CFBC'],
  ['#E2672E', '#18140F'],
  ['#2E7D4F', '#E2672E'],
  ['#18140F', '#2E7D4F'],
  ['#E7B93D', '#18140F'],
  ['#1A3E8C', '#F4F0E7'],
  ['#2E7D4F', '#18140F'],
  ['#18140F', '#F4F0E7'],
  ['#1A3E8C', '#18140F'],
];

function FlagChip({ colors }: { colors: [string, string] }) {
  return (
    <span
      className="h-8 w-8 shrink-0 rounded-full border border-[#ECE5D6]"
      style={{ background: `linear-gradient(90deg, ${colors[0]} 50%, ${colors[1]} 50%)` }}
    />
  );
}

export default function DesignSystemShowcase() {
  const [accordionOpen, setAccordionOpen] = useState<'q1' | 'q2' | null>('q2');
  const [activeTag, setActiveTag] = useState<'all' | 'moodboard'>('all');
  const [checkChecked, setCheckChecked] = useState(true);
  const [checkUnchecked, setCheckUnchecked] = useState(false);
  const [checkTriState, setCheckTriState] = useState<'checked' | 'indeterminate' | 'unchecked'>('checked');
  const [radioValue, setRadioValue] = useState<'checked' | 'unchecked'>('checked');
  const [sliderValue, setSliderValue] = useState(68);
  const [sliderActive, setSliderActive] = useState(false);
  const [segmentIcon, setSegmentIcon] = useState<'grid' | 'list'>('grid');
  const [segmentIcon2, setSegmentIcon2] = useState<'grid' | 'list'>('list');
  const [segmentLabel, setSegmentLabel] = useState(0);

  return (
    <div className="min-h-screen bg-[#F4F0E7] px-4 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-14 text-center font-serif text-5xl font-medium text-[#18140F] sm:text-6xl">
          Design System
        </h1>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-12">
          {/* Buttons */}
          <div className={[CARD, 'sm:col-span-7'].join(' ')}>
            <SectionLabel>Buttons</SectionLabel>
            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded-full bg-[#18140F] px-7 py-3 text-sm font-medium text-white transition hover:opacity-90">
                Button
              </button>
              <button className="rounded-full border border-[#18140F] bg-white px-7 py-3 text-sm font-medium text-[#18140F] transition hover:bg-[#F4F0E7]">
                Button
              </button>
              <button
                aria-label="Expandir"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ECE3D3] text-[#18140F] transition hover:bg-[#E2D9C6]"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                aria-label="Filtrar"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ECE3D3] text-[#18140F] transition hover:bg-[#E2D9C6]"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button className="rounded-full bg-[#ECE3D3] px-7 py-3 text-sm font-medium text-[#3A3226] transition hover:bg-[#E2D9C6]">
                Button
              </button>
              <button className="rounded-full bg-[#ECE3D3] px-5 py-2.5 text-sm font-medium text-[#3A3226] transition hover:bg-[#E2D9C6]">
                Button
              </button>
              <button className="rounded-full bg-[#18140F] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
                Button
              </button>
              <button
                aria-label="Avançar"
                className="ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#ECE3D3] text-[#18140F] transition hover:bg-[#E2D9C6]"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tags & Badges */}
          <div className={[CARD, 'sm:col-span-5'].join(' ')}>
            <SectionLabel>Tags &amp; Badges</SectionLabel>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveTag('all')}
                className={[
                  'rounded-full px-4 py-2 text-sm font-semibold transition',
                  activeTag === 'all' ? 'bg-[#E2672E] text-white' : 'bg-[#F4F0E7] text-[#3A3226]',
                ].join(' ')}
              >
                ALL
              </button>
              <button
                onClick={() => setActiveTag('moodboard')}
                className={[
                  'rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition',
                  activeTag === 'moodboard' ? 'bg-[#E2672E] text-white' : 'bg-[#3A3630] text-white',
                ].join(' ')}
              >
                Moodboard
              </button>
              <button className="flex items-center gap-1 rounded-full bg-[#ECE3D3] px-4 py-2 text-sm font-medium text-[#3A3226]">
                Ratings
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button className="flex items-center gap-1.5 text-sm font-medium text-[#3A3226] hover:text-[#18140F]">
                Clear All
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E7DFCF] text-[10px]">
                  ✕
                </span>
              </button>
              <span className="rounded-full bg-[#F0EDE3] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#3A3226]">
                Art Deco
              </span>
              <span className="rounded-full bg-[#F0EDE3] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#3A3226]">
                Silver
              </span>
            </div>
          </div>

          {/* Bread + Bullets */}
          <div className="flex flex-col gap-5 sm:col-span-5">
            <div className={CARD}>
              <SectionLabel>Bread</SectionLabel>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-[#8A8172]">Home Page</span>
                <span className="text-[#C9BFA9]">·</span>
                <span className="rounded-full bg-[#F4F0E7] px-3 py-1.5 font-medium text-[#18140F]">
                  Case Study Details
                </span>
              </div>
            </div>
            <div className={CARD}>
              <SectionLabel>Bullets</SectionLabel>
              <div className="flex items-center gap-2.5 rounded-2xl bg-[#F4F0E7] px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#18140F]" />
                <span className="text-sm font-medium text-[#18140F]">Highly professional</span>
              </div>
            </div>
          </div>

          {/* Accordion */}
          <div className={[CARD, 'sm:col-span-7'].join(' ')}>
            <SectionLabel>Accordion</SectionLabel>
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl border border-[#ECE5D6] px-5 py-4">
                <button
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => setAccordionOpen(accordionOpen === 'q1' ? null : 'q1')}
                >
                  <span className="font-serif text-lg font-medium text-[#18140F]">What is Milray Park?</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F4F0E7] text-[#18140F]">
                    {accordionOpen === 'q1' ? <Minus className="h-3.5 w-3.5" /> : <span className="text-base leading-none">+</span>}
                  </span>
                </button>
                <div className={['ds-accordion-panel', accordionOpen === 'q1' ? 'is-open' : ''].join(' ')}>
                  <div>
                    <p className="pt-3 text-sm leading-relaxed text-[#6B6255]">
                      <span className="font-semibold text-[#E2672E]">Milray Park</span> is a curated collection of
                      interior design services connecting you with vetted decorators.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#ECE5D6] px-5 py-4">
                <button
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => setAccordionOpen(accordionOpen === 'q2' ? null : 'q2')}
                >
                  <span className="font-serif text-lg font-medium text-[#18140F]">
                    What makes Milray Park unique?
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#18140F] text-white">
                    {accordionOpen === 'q2' ? <Minus className="h-3.5 w-3.5" /> : <span className="text-base leading-none">+</span>}
                  </span>
                </button>
                <div className={['ds-accordion-panel', accordionOpen === 'q2' ? 'is-open' : ''].join(' ')}>
                  <div>
                    <p className="pt-3 text-sm leading-relaxed text-[#6B6255]">
                      On <span className="font-semibold text-[#E2672E]">Milray Park</span>, you collaborate with your
                      interior designer 100% online on our easy{' '}
                      <span className="font-semibold text-[#E2672E]">to use eDecorating platform</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Spinners */}
          <div className={[CARD, 'flex flex-col sm:col-span-3'].join(' ')}>
            <SectionLabel>Spinners</SectionLabel>
            <div className="flex flex-1 flex-col items-center justify-center gap-6">
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#F0EDE3] border-t-[#18140F]" />
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#18140F] border-t-[#F0EDE3]" />
            </div>
          </div>

          {/* Checkboxes */}
          <div className={[CARD, 'sm:col-span-5'].join(' ')}>
            <SectionLabel>Checkboxes</SectionLabel>
            <div className="mb-5 flex items-center gap-3">
              <Checkbox
                checked={checkTriState === 'checked'}
                indeterminate={checkTriState === 'indeterminate'}
                onClick={() =>
                  setCheckTriState((v) => (v === 'checked' ? 'indeterminate' : v === 'indeterminate' ? 'unchecked' : 'checked'))
                }
              />
              <Checkbox indeterminate onClick={() => setCheckTriState('indeterminate')} />
              <Checkbox checked={false} onClick={() => setCheckTriState('unchecked')} />
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <FieldRow label="Checked">
                <Checkbox checked={checkChecked} onClick={() => setCheckChecked((v) => !v)} />
              </FieldRow>
              <FieldRow label="Disabled Checked">
                <Checkbox checked disabled />
              </FieldRow>
              <FieldRow label="Unchecked">
                <Checkbox checked={checkUnchecked} onClick={() => setCheckUnchecked((v) => !v)} />
              </FieldRow>
              <FieldRow label="Disabled Unchecked">
                <Checkbox disabled />
              </FieldRow>
            </div>
          </div>

          {/* Radios */}
          <div className={[CARD, 'sm:col-span-4'].join(' ')}>
            <SectionLabel>Radios</SectionLabel>
            <div className="mb-5 flex items-center gap-3">
              <Radio checked onClick={() => {}} />
              <Radio checked={false} onClick={() => {}} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <FieldRow label="Checked">
                <Radio checked={radioValue === 'checked'} onClick={() => setRadioValue('checked')} />
              </FieldRow>
              <FieldRow label="Disabled Checked">
                <Radio checked disabled />
              </FieldRow>
              <FieldRow label="Unchecked">
                <Radio checked={radioValue === 'unchecked'} onClick={() => setRadioValue('unchecked')} />
              </FieldRow>
              <FieldRow label="Disabled Unchecked">
                <Radio disabled />
              </FieldRow>
            </div>
          </div>

          {/* Text Inputs */}
          <div className={[CARD, 'sm:col-span-7'].join(' ')}>
            <SectionLabel>Text Inputs</SectionLabel>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-full border border-[#18140F] py-2 pl-5 pr-2">
                <Search className="h-4 w-4 shrink-0 text-[#8A8172]" />
                <input
                  defaultValue="Search for Desktops"
                  className="w-full bg-transparent text-sm text-[#18140F] outline-none placeholder:text-[#8A8172]"
                />
                <button className="flex shrink-0 items-center gap-1 rounded-full bg-[#ECE3D3] px-4 py-2 text-sm font-medium text-[#3A3226]">
                  Budget
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-3 rounded-full border border-[#18140F] py-2 pl-5 pr-2">
                <Search className="h-4 w-4 shrink-0 text-[#8A8172]" />
                <input
                  defaultValue="Search for Mobiles"
                  className="w-full bg-transparent text-sm text-[#18140F] outline-none placeholder:text-[#8A8172]"
                />
                <button
                  aria-label="Filtrar"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ECE3D3] text-[#18140F]"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1 flex flex-col gap-3 sm:flex-row">
                <button className="flex flex-1 items-center justify-between rounded-2xl bg-[#F4F0E7] px-4 py-3.5 text-left text-sm text-[#8A8172]">
                  What is your inquiry about?
                  <ChevronDown className="h-4 w-4" />
                </button>
                <input
                  placeholder="Name"
                  className="flex-1 rounded-2xl bg-[#F4F0E7] px-4 py-3.5 text-sm text-[#18140F] outline-none placeholder:text-[#8A8172]"
                />
              </div>
            </div>
          </div>

          {/* Info blocks + Sliders */}
          <div className="flex flex-col gap-5 sm:col-span-5">
            <div className={CARD}>
              <SectionLabel>Info blocks</SectionLabel>
              <div className="flex items-start gap-3 rounded-2xl bg-[#F4F0E7] p-4">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#18140F]">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
                <p className="text-sm leading-relaxed text-[#3A3226]">
                  Like a particular brand? Just let your designer know. Otherwise, you can leave it up to your
                  designer who will be sourcing the best pieces at the best prices for your overall look.
                </p>
              </div>
            </div>
            <div className={CARD}>
              <SectionLabel>Sliders</SectionLabel>
              <div className="relative pt-8">
                {sliderActive && (
                  <span
                    className="absolute -top-1 flex -translate-x-1/2 items-center rounded-lg bg-[#18140F] px-2.5 py-1 text-[11px] font-medium text-white"
                    style={{ left: `${sliderValue}%` }}
                  >
                    {sliderValue}
                  </span>
                )}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sliderValue}
                  onChange={(e) => setSliderValue(Number(e.target.value))}
                  onPointerDown={() => setSliderActive(true)}
                  onPointerUp={() => setSliderActive(false)}
                  className="ds-slider"
                  style={{ ['--ds-slider-fill' as string]: `${sliderValue}%` }}
                />
              </div>
            </div>
          </div>

          {/* Payments */}
          <div className={[CARD, 'sm:col-span-6'].join(' ')}>
            <SectionLabel>Payments</SectionLabel>
            <div className="flex flex-wrap items-center gap-2.5">
              <PaymentChip wide>
                <span className="text-[11px] font-black italic tracking-wide text-[#1A3E8C]">VISA</span>
              </PaymentChip>
              <PaymentChip>
                <span className="flex -space-x-2">
                  <span className="h-4 w-4 rounded-full bg-[#EB001B]" />
                  <span className="h-4 w-4 rounded-full bg-[#F79E1B] opacity-90" />
                </span>
              </PaymentChip>
              <PaymentChip wide>
                <span className="text-xs font-semibold italic text-[#635BFF]">stripe</span>
              </PaymentChip>
              <PaymentChip wide>
                <span className="text-xs font-black italic text-[#27346A]">PayPal</span>
              </PaymentChip>
              <PaymentChip>
                <CreditCard className="h-4 w-4 text-[#18140F]" />
              </PaymentChip>
              <PaymentChip>
                <Wallet className="h-4 w-4 text-[#18140F]" />
              </PaymentChip>
              <PaymentChip>
                <Link2 className="h-4 w-4 text-[#18140F]" />
              </PaymentChip>
            </div>
          </div>

          {/* Flags */}
          <div className={[CARD, 'sm:col-span-6'].join(' ')}>
            <SectionLabel>Flags</SectionLabel>
            <div className="flex flex-wrap items-center gap-2">
              {FLAG_PAIRS.map((colors, i) => (
                <FlagChip key={i} colors={colors} />
              ))}
            </div>
          </div>

          {/* Cells */}
          <div className={[CARD, 'flex flex-col gap-3 sm:col-span-4'].join(' ')}>
            <SectionLabel>Cells</SectionLabel>
            <div className="flex items-center gap-3 rounded-2xl border border-[#ECE5D6] p-3">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F4F0E7]">
                <Home className="h-5 w-5 text-[#18140F]" />
                <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-[#E2672E]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#18140F]">T&amp;Cs Bday Promotion</p>
                <p className="text-[11px] font-medium tracking-wide text-[#9C917F]">NOVEMBER 2018</p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ECE3D3]">
                <ArrowRight className="h-4 w-4 text-[#18140F]" />
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[#ECE5D6] p-3">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E7B93D] to-[#C6501F] text-sm font-semibold text-white">
                JC
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#E7B93D] px-1.5 py-[1px] text-[8px] font-bold text-[#18140F]">
                  GOLD
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#18140F]">Jane Cooper</p>
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <Star key={i} className="h-3 w-3 fill-[#E7B93D] text-[#E7B93D]" />
                  ))}
                  <Star className="h-3 w-3 text-[#D8CFBC]" />
                </div>
                <p className="text-[11px] text-[#9C917F]">Sydney · Available now</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-[#18140F]">$599</p>
                <p className="text-[10px] text-[#9C917F]">/room</p>
              </div>
            </div>
          </div>

          {/* Segmented Controls */}
          <div className={[CARD, 'flex flex-col gap-4 sm:col-span-4'].join(' ')}>
            <SectionLabel>Segmented Controls</SectionLabel>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-full bg-[#F4F0E7] p-1">
                <button
                  onClick={() => setSegmentIcon('grid')}
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full transition',
                    segmentIcon === 'grid' ? 'bg-[#18140F] text-white' : 'text-[#8A8172]',
                  ].join(' ')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSegmentIcon('list')}
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full transition',
                    segmentIcon === 'list' ? 'bg-[#18140F] text-white' : 'text-[#8A8172]',
                  ].join(' ')}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-[#F4F0E7] p-1">
                <button
                  onClick={() => setSegmentIcon2('grid')}
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full transition',
                    segmentIcon2 === 'grid' ? 'bg-[#18140F] text-white' : 'text-[#8A8172]',
                  ].join(' ')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSegmentIcon2('list')}
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full transition',
                    segmentIcon2 === 'list' ? 'bg-[#18140F] text-white' : 'text-[#8A8172]',
                  ].join(' ')}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-[#F4F0E7] p-1">
              {['Label', 'Label', 'Label'].map((label, i) => (
                <button
                  key={i}
                  onClick={() => setSegmentLabel(i)}
                  className={[
                    'flex-1 rounded-full px-4 py-2 text-sm font-medium transition',
                    segmentLabel === i ? 'bg-[#18140F] text-white' : 'text-[#3A3226]',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Profile image */}
          <div className={[CARD, 'flex flex-col items-center justify-center gap-4 sm:col-span-4'].join(' ')}>
            <SectionLabel>Profile image</SectionLabel>
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-[#E7B93D] to-[#C6501F] text-2xl font-semibold text-white">
              JC
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-[#E7B93D] px-2.5 py-1 text-[10px] font-bold text-[#18140F]">
                GOLD
              </span>
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <button className="rounded-full bg-[#ECE3D3] px-6 py-3 text-sm font-medium text-[#3A3226] transition hover:bg-[#E2D9C6]">
            And more...
          </button>
        </div>
      </div>
    </div>
  );
}
