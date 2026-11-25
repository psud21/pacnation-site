import { useState } from "react";

/**
 * Copies a link to this page's static share page (dist/share/<path>/, built by
 * scripts/share.mjs), whose link preview names the page. On touch devices with
 * a share sheet, opens it instead.
 */
export default function ShareButton({ path, title }: { path: string; title: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const url = new URL(`share/${path}/`, `${window.location.origin}${window.location.pathname}`).toString();

  async function share() {
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch (error) {
      if ((error as Error).name === "AbortError") return; // share sheet dismissed
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2500);
  }

  return (
    <span className="share">
      <button className="share-button" onClick={share}>
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M7.5 10.8l5-2.6M7.5 9.2l5 2.6" stroke="currentColor" strokeWidth="1.6" /><circle cx="5.5" cy="10" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="14.5" cy="5.5" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="14.5" cy="14.5" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
        Share
      </button>
      <span className="share-status" role="status">{state === "copied" ? "Link copied" : state === "failed" ? url : ""}</span>
    </span>
  );
}
