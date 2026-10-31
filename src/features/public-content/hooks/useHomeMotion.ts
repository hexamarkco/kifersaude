import { useEffect, useRef, type RefObject } from "react";

const controllers = new WeakMap<HTMLElement, HomeMotionController>();
const sectionSelector = "main > section, .home-footer";

function motionTokens(scope: HTMLElement) {
  const style = getComputedStyle(scope);
  const number = (name: string, fallback: number) => {
    const value = Number.parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    entry: number("--home-motion-entry", 560),
    profile: number("--home-motion-profile", 280),
    stagger: number("--home-motion-stagger", 60),
    distance: number("--home-motion-distance", 18),
    ease: style.getPropertyValue("--home-motion-ease").trim() || "ease-out",
    compact: window.matchMedia("(max-width: 639.98px)").matches,
  };
}

/** All resting styles stay in CSS. Cancelling an effect restores visible content. */
export function createHomeMotionController(scope: HTMLElement) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const running = new Map<Animation, { target: Element; finish: () => void }>();
  const entering = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  const visited = new WeakSet<HTMLElement>();
  const allowed = () => !reduced.matches && !document.hidden;

  const play = (
    target: Element | null,
    frames: Keyframe[],
    options: KeyframeAnimationOptions = {},
    cleanup?: () => void,
  ): Animation | null => {
    if (!target || !allowed() || typeof target.animate !== "function") {
      cleanup?.();
      return null;
    }
    const tokens = motionTokens(scope);
    let animation: Animation;
    try {
      animation = target.animate(frames, {
        duration: tokens.entry,
        easing: tokens.ease,
        fill: "backwards",
        ...options,
      });
    } catch {
      cleanup?.();
      return null;
    }
    const finish = () => {
      if (!running.delete(animation)) return;
      cleanup?.();
      animation.removeEventListener("finish", finish);
      animation.removeEventListener("cancel", finish);
      animation.cancel();
    };
    running.set(animation, { target, finish });
    animation.addEventListener("finish", finish);
    animation.addEventListener("cancel", finish);
    return animation;
  };

  const endEntry = (section: HTMLElement) => {
    const timer = entering.get(section);
    if (timer !== undefined) clearTimeout(timer);
    entering.delete(section);
    section.classList.remove("home-motion-entering");
  };
  const stopWithin = (container: Element) => {
    for (const { target, finish } of [...running.values()]) {
      if (container.contains(target)) finish();
    }
    for (const section of entering.keys()) {
      if (container.contains(section) || container === section) endEntry(section);
    }
  };
  const stop = () => stopWithin(scope);
  const onPreference = () => { if (reduced.matches) stop(); };
  const onVisibility = () => { if (document.hidden) stop(); };
  const onFocus = (event: FocusEvent) => {
    if (!(event.target instanceof Element)) return;
    const section = event.target.closest("section, footer");
    if (section && scope.contains(section)) stopWithin(section);
  };
  reduced.addEventListener("change", onPreference);
  document.addEventListener("visibilitychange", onVisibility);
  scope.addEventListener("focusin", onFocus);

  const enter = (section: HTMLElement) => {
    if (visited.has(section)) return;
    visited.add(section);
    section.dataset.homeMotion = "played";
    if (!allowed() || typeof section.animate !== "function") return;
    const tokens = motionTokens(scope);
    const find = (selector: string) => section.querySelector(selector);
    const group = (selector: string, frames: Keyframe[], delay = 0, stagger = tokens.stagger) => {
      section.querySelectorAll(selector).forEach((target, index) => {
        play(target, frames, { delay: delay + index * stagger });
      });
    };
    const rise: Keyframe[] = [
      { opacity: 0, transform: `translateY(${tokens.distance}px)` },
      { opacity: 1, transform: "translateY(0)" },
    ];
    section.classList.add("home-motion-entering");
    entering.set(section, setTimeout(() => endEntry(section), tokens.entry + tokens.stagger * 9));

    if (section.classList.contains("home-hero")) {
      // H1 and conversion controls remain opaque and clickable from the first frame.
      play(find(".home-eyebrow"), [{ opacity: 0.6, transform: "translateY(-4px)" }, { opacity: 1, transform: "translateY(0)" }]);
      group(".home-hero-line", [{ transform: "translateY(10px)" }, { transform: "translateY(0)" }], 0, 35);
      play(find(".home-hero-description"), [{ transform: "translateY(6px)" }, { transform: "translateY(0)" }], { delay: 60 });
      group(".home-hero-actions > *", [{ transform: "translateY(4px)" }, { transform: "translateY(0)" }], 90, 35);
      play(find(".home-luiza-photo"), [{ transform: "translateX(6px) scale(1.03)" }, { transform: "translateX(0) scale(1)" }], { duration: tokens.entry + 100 });
      group(".home-hero-benefits li", [{ opacity: 0.6, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], 90, 35);
      play(find(".home-hero-wave"), [{ opacity: 0.7, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }]);
    } else if (section.classList.contains("home-trust")) {
      play(find(".home-trust-grid > div"), [{ opacity: 0.6, transform: "translateX(-10px)" }, { opacity: 1, transform: "translateX(0)" }]);
      group(".home-trust-list li", rise);
      group(".home-trust-list .home-icon", [{ transform: "scale(.94)" }, { transform: "scale(1)" }]);
      group(".home-partner-logos li", [{ opacity: 0.25, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }], 90, 40);
    } else if (section.classList.contains("home-audience")) {
      play(find(".home-section-intro"), [{ opacity: 0.6 }, { opacity: 1 }]);
      play(find(".home-audience-selector"), [{ opacity: 0.6, transform: "translateX(-8px)" }, { opacity: 1, transform: "translateX(0)" }]);
      play(find('.home-audience-panel[aria-hidden="false"]'), [{ opacity: 0.6, transform: "translateX(8px)" }, { opacity: 1, transform: "translateX(0)" }]);
    } else if (section.classList.contains("home-process")) {
      play(find(".home-process-line > svg"), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0)" }], { duration: 700 });
      group(".home-process-line li", rise, 0, tokens.stagger + 20);
      group(".home-process-icon .home-icon", [{ transform: "scale(.92)" }, { transform: "scale(1)" }], 0, tokens.stagger + 20);
    } else if (section.classList.contains("home-testimonials")) {
      play(find(".home-testimonial-portrait"), [{ opacity: 0.6, transform: "scale(.98)" }, { opacity: 1, transform: "scale(1)" }]);
      play(find(".home-testimonial-empty"), [{ opacity: 0.65, transform: "translateX(10px)" }, { opacity: 1, transform: "translateX(0)" }], { delay: tokens.stagger });
      group(".home-testimonial-secondary > div", rise, tokens.stagger * 2);
    } else if (section.classList.contains("home-about")) {
      play(find(".home-about-photo"), tokens.compact ? [{ opacity: 0.8 }, { opacity: 1 }] : [{ clipPath: "inset(0 6% 0 0)" }, { clipPath: "inset(0)" }]);
      group(".home-about-copy > .home-eyebrow, .home-about-copy > .home-title, .home-about-copy > .home-lead", rise, 0, 40);
      group(".home-about-benefits > li", rise, 80, 40);
      play(find(".home-about-name"), [{ opacity: 0.3 }, { opacity: 1 }], { delay: 150 });
    } else if (section.classList.contains("home-faq")) {
      play(find(tokens.compact ? ".home-faq-copy > .home-title" : ".home-faq-copy"), [{ opacity: 0.6, transform: "translateX(-8px)" }, { opacity: 1, transform: "translateX(0)" }]);
      group(".home-faq-item", [{ opacity: 0.65, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], 0, 35);
    } else if (section.classList.contains("home-quote")) {
      play(find(tokens.compact ? ".home-quote-copy > .home-title" : ".home-quote-copy"), [{ opacity: 0.65, transform: "translateX(-10px)" }, { opacity: 1, transform: "translateX(0)" }]);
      play(find(".home-quote-form"), [{ opacity: 0.9, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: tokens.entry - 80 });
    } else if (section.classList.contains("home-whatsapp")) {
      play(find(".home-whatsapp-copy"), rise);
      play(find(".home-whatsapp-photo"), [{ clipPath: "inset(0 3% 0 0)" }, { clipPath: "inset(0)" }]);
    } else if (section.classList.contains("home-footer")) {
      group(".home-footer-grid > *", [{ opacity: 0.65, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], 0, 40);
    }
  };

  const enterConversation = (phone: HTMLElement) => {
    if (visited.has(phone)) return;
    visited.add(phone);
    phone.dataset.homeMotion = "played";
    phone.querySelectorAll(".home-message").forEach((message, index) => {
      if (index < 2) return;
      play(message, [{ opacity: 0.15, transform: "translateY(7px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 400, delay: (index - 2) * 120 });
    });
  };

  return {
    play, enter, enterConversation, stopWithin, allowed,
    dispose() {
      stop();
      reduced.removeEventListener("change", onPreference);
      document.removeEventListener("visibilitychange", onVisibility);
      scope.removeEventListener("focusin", onFocus);
    },
  };
}

type HomeMotionController = ReturnType<typeof createHomeMotionController>;

/** One observer for the ten sections. No observer or no animations leaves the page visible. */
export function useHomeMotion(anchor: RefObject<HTMLElement>) {
  useEffect(() => {
    const scope = anchor.current?.closest<HTMLElement>(".kifer-home");
    if (!scope) return;
    const controller = createHomeMotionController(scope);
    controllers.set(scope, controller);
    const sections = scope.querySelectorAll<HTMLElement>(sectionSelector);
    let observer: IntersectionObserver | null = null;
    try {
      if (typeof IntersectionObserver === "function") {
        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const phone = entry.target.closest<HTMLElement>(".home-phone");
            if (phone) controller.enterConversation(phone);
            else controller.enter(entry.target as HTMLElement);
            observer?.unobserve(entry.target);
          }
        }, { rootMargin: "0px 0px 70px 0px", threshold: 0.08 });
      }
    } catch {
      // Entrances are optional; an unavailable observer must not affect the page.
      observer = null;
    }
    for (const section of sections) {
      if (section.classList.contains("home-hero")) controller.enter(section);
      else observer?.observe(section);
    }
    const conversation = scope.querySelector(".home-message:nth-child(3)");
    if (conversation) observer?.observe(conversation);
    return () => {
      observer?.disconnect();
      controller.dispose();
      controllers.delete(scope);
    };
  }, [anchor]);
}

/** Keeps the existing shared grid dimensions and native radio focus during profile changes. */
export function useHomeProfileMotion(slides: RefObject<HTMLDivElement>, selected: string) {
  const previous = useRef(selected);
  useEffect(() => {
    const old = previous.current;
    previous.current = selected;
    const scope = slides.current?.closest<HTMLElement>(".kifer-home");
    const controller = scope && controllers.get(scope);
    if (old === selected || !controller?.allowed() || !scope || !slides.current) return;
    const incoming = slides.current.querySelector<HTMLElement>(`#audience-panel-${selected}`);
    const outgoing = slides.current.querySelector<HTMLElement>(`#audience-panel-${old}`);
    if (!incoming || !outgoing) return;
    const tokens = motionTokens(scope);
    const animations: Animation[] = [];
    const keep = (animation: Animation | null) => { if (animation) animations.push(animation); };
    outgoing.style.visibility = "visible";
    keep(controller.play(outgoing, [{ opacity: 1 }, { opacity: 0 }], { duration: tokens.profile * 0.65 }, () => { outgoing.style.removeProperty("visibility"); }));
    keep(controller.play(incoming, [{ opacity: 0, transform: `translateY(${tokens.compact ? 2 : 6}px)` }, { opacity: 1, transform: "translateY(0)" }], { duration: tokens.profile }));
    if (!tokens.compact) {
      incoming.querySelectorAll(".home-audience-title, .home-profile-benefits, .home-audience-copy > button").forEach((target, index) => {
        keep(controller.play(target, [{ transform: "translateY(6px)" }, { transform: "translateY(0)" }], { duration: tokens.profile, delay: index * 20 }));
      });
      keep(controller.play(incoming.querySelector(".home-audience-photo"), [{ transform: "translateX(8px)" }, { transform: "translateX(0)" }], { duration: tokens.profile }));
    }
    return () => animations.forEach(animation => animation.cancel());
  }, [selected, slides]);
}
