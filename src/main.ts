import "./style.css";
import { mountStrings, pluck } from "./strings";

const bed = document.querySelector<HTMLElement>("#stringbed");
const canvas = document.querySelector<HTMLCanvasElement>("#strings");
if (bed && canvas) mountStrings(canvas, bed);

document.querySelectorAll<HTMLAnchorElement>(".string-labels a").forEach((link) => {
  link.addEventListener("click", () => {
    const note = Number(link.dataset.note ?? "0");
    pluck(Number.isFinite(note) ? note : 0);
  });
});

if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.querySelectorAll("animateMotion").forEach((node) => node.remove());
}

const jumps: Record<string, string> = {
  "1": "#work",
  "2": "#path",
  "3": "#projects",
  "4": "#outside",
};

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  const key = event.key.toLowerCase();
  if (key === "g") {
    window.open("https://github.com/tejase", "_blank", "noopener,noreferrer");
    return;
  }
  const hash = jumps[key];
  if (!hash) return;
  const section = document.querySelector(hash);
  if (section instanceof HTMLElement) {
    event.preventDefault();
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    pluck(Number(key) - 1);
  }
});
