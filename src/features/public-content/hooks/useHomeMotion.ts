import { useEffect, type RefObject } from "react";

/** A missed observer/unsupported animation always leaves the resting content visible. */
export function createHomeMotionController(scope: HTMLElement) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const visited = new WeakSet<HTMLElement>();
  const running = new Map<Animation, HTMLElement>();
  const stopWithin = (container: Element) => {
    for (const [animation, section] of running) {
      if (container.contains(section) || section.contains(container)) {
        animation.cancel();
        running.delete(animation);
      }
    }
  };
  const stop = () => stopWithin(scope);
  const onPreference = () => {
    if (reduced.matches) stop();
  };
  const onVisibility = () => {
    if (document.hidden) stop();
  };
  const onFocus = (event: FocusEvent) => {
    if (event.target instanceof Element) stopWithin(event.target);
  };
  reduced.addEventListener("change", onPreference);
  document.addEventListener("visibilitychange", onVisibility);
  scope.addEventListener("focusin", onFocus);
  return {
    enter(section: HTMLElement) {
      if (visited.has(section)) return;
      visited.add(section);
      if (
        reduced.matches ||
        document.hidden ||
        section.contains(document.activeElement)
      )
        return;
      const targets = section.classList.contains("hero")
        ? section.querySelectorAll(".hero-copy, .hero-photo")
        : section.querySelectorAll(
            ".section-head, .profile, .clarity .wrap > div, .step, .about-grid > div, .faq-grid > div, .quote-grid > div, .quote-card, .contact-banner, .footer-grid > *",
          );
      targets.forEach((target, index) => {
        if (typeof target.animate !== "function") return;
        try {
          const animation = target.animate(
            [
              { opacity: 0.65, transform: "translateY(14px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            {
              duration: 620,
              delay: Math.min(index, 3) * 60,
              easing: "cubic-bezier(.16,1,.3,1)",
              fill: "backwards",
            },
          );
          running.set(animation, section);
          const finish = () => {
            running.delete(animation);
            animation.cancel();
          };
          animation.addEventListener("finish", finish, { once: true });
          animation.addEventListener(
            "cancel",
            () => running.delete(animation),
            { once: true },
          );
        } catch {
          /* Optional decoration never blocks navigation or content. */
        }
      });
    },
    dispose() {
      stop();
      reduced.removeEventListener("change", onPreference);
      document.removeEventListener("visibilitychange", onVisibility);
      scope.removeEventListener("focusin", onFocus);
    },
  };
}

export function useHomeMotion(anchor: RefObject<HTMLElement>) {
  useEffect(() => {
    const scope = anchor.current?.closest<HTMLElement>(".kifer-landing");
    if (!scope) return;
    const controller = createHomeMotionController(scope);
    let observer: IntersectionObserver | undefined;
    try {
      if (typeof IntersectionObserver === "function") {
        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries)
              if (entry.isIntersecting) {
                controller.enter(entry.target as HTMLElement);
                observer?.unobserve(entry.target);
              }
          },
          { threshold: 0.08, rootMargin: "0px 0px -20px 0px" },
        );
        scope
          .querySelectorAll<HTMLElement>("main > section, .footer")
          .forEach((section) => observer?.observe(section));
      }
    } catch {
      observer?.disconnect();
    }

    const header = scope.querySelector<HTMLElement>(".header");
    const links = [
      ...scope.querySelectorAll<HTMLAnchorElement>(".header nav a"),
    ].map((link) => ({
      link,
      section: document.getElementById(link.hash.slice(1)),
    }));
    let frame = 0;
    const update = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - innerHeight;
      header?.style.setProperty(
        "--page-progress",
        String(
          scrollable > 0 ? Math.min(1, Math.max(0, scrollY / scrollable)) : 0,
        ),
      );
      header?.classList.toggle("is-scrolled", scrollY > 24);
      let current: HTMLAnchorElement | undefined;
      for (const item of links)
        if (
          item.section &&
          item.section.getBoundingClientRect().top < innerHeight * 0.45
        )
          current = item.link;
      for (const { link } of links) {
        if (link === current) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const resize =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(schedule)
        : undefined;
    resize?.observe(scope);
    update();
    return () => {
      observer?.disconnect();
      resize?.disconnect();
      controller.dispose();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [anchor]);
}
