"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";

type Status = "idle" | "loading" | "success" | "already" | "error";

/**
 * ARC reader application form. Same shape as SubscribeForm: local state, POST
 * to a route handler, a Status union driving inline messaging, and a honeypot
 * field named `company` that real people never fill.
 */
export function ArcApplyForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [goodreadsUrl, setGoodreadsUrl] = useState("");
  const [amazonProfileUrl, setAmazonProfileUrl] = useState("");
  const [company, setCompany] = useState(""); // honeypot — must stay empty
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const done = status === "success" || status === "already";
  const busy = status === "loading";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !reason.trim() || busy || done) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/arc/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          reason,
          goodreadsUrl,
          amazonProfileUrl,
          company,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      if (data.status === "already") {
        setStatus("already");
        setMessage("You've already applied — I'll be in touch soon.");
      } else {
        setStatus("success");
        setMessage("Application received. Watch your inbox for a decision.");
      }
      track("arc_application", { status: data.status ?? "applied" });
      setReason("");
      setGoodreadsUrl("");
      setAmazonProfileUrl("");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <form className="subscribeForm arcApplyForm" onSubmit={onSubmit}>
      <label htmlFor="arc-name">Name</label>
      <input
        id="arc-name"
        name="name"
        type="text"
        placeholder="Your name"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={100}
        disabled={busy || done}
      />

      <label htmlFor="arc-email">Email address</label>
      <input
        id="arc-email"
        name="email"
        type="email"
        placeholder="reader@example.com"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        maxLength={254}
        disabled={busy || done}
      />

      <label htmlFor="arc-reason">Why you&apos;d like to read early</label>
      <textarea
        id="arc-reason"
        name="reason"
        rows={4}
        placeholder="Tell me what you read, where you review, and why this book appeals to you."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
        minLength={20}
        maxLength={1000}
        disabled={busy || done}
      />

      <label htmlFor="arc-goodreads">Goodreads profile (optional)</label>
      <input
        id="arc-goodreads"
        name="goodreadsUrl"
        type="url"
        placeholder="https://www.goodreads.com/user/show/…"
        value={goodreadsUrl}
        onChange={(e) => setGoodreadsUrl(e.target.value)}
        maxLength={300}
        disabled={busy || done}
      />

      <label htmlFor="arc-amazon">Amazon reviewer profile (optional)</label>
      <input
        id="arc-amazon"
        name="amazonProfileUrl"
        type="url"
        placeholder="https://www.amazon.com/gp/profile/…"
        value={amazonProfileUrl}
        onChange={(e) => setAmazonProfileUrl(e.target.value)}
        maxLength={300}
        disabled={busy || done}
      />

      <button type="submit" className="arcApplyButton" disabled={busy || done}>
        {busy ? "Sending…" : done ? "Applied ✓" : "Apply to read early"}
      </button>

      {/* Honeypot — hidden from people, tempting to bots. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          opacity: 0,
        }}
      />

      {message ? (
        <p className={`subscribeMsg ${status === "error" ? "isError" : "isOk"}`}>
          {message}
        </p>
      ) : (
        <p>
          Applications are read personally. Approved readers get the manuscript
          in their browser before publication, and are invited to leave an
          honest review.
        </p>
      )}
    </form>
  );
}
