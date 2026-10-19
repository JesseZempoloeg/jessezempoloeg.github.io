import "./style.css";

/* Reveal blocks when they scroll into view, same pattern as the homepage. */
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-in");
      revealObserver.unobserve(entry.target);
    }
  },
  { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
);

document.querySelectorAll("[data-reveal]").forEach((node) => revealObserver.observe(node));

/* Thin progress bar at the top of the page. */
const progressBar = document.querySelector(".scroll-progress");
let queued = false;

function paintProgress() {
  queued = false;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
  progressBar.style.transform = `scaleX(${ratio})`;
}

window.addEventListener(
  "scroll",
  () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(paintProgress);
  },
  { passive: true }
);

paintProgress();
