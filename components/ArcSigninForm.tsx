"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "sent" | "error";

/**
 * Returning-reader sign-in. The response is deliberately identical whether or
 * not the address belongs to an approved reader, so the form can't be used to
 * discover who is on the ARC team.
 */
export function ArcSigninForm() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot — must stay empty
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const busy = status === "loading";
  const sent = status === "sent";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy || sent) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/arc/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setStatus("sent");
      setMessage(
        "If that address belongs to an approved ARC reader, a sign-in link is on its way. It expires in 15 minutes.",
      );
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <form className="subscribeForm arcApplyForm" onSubmit={onSubmit}>
      <label htmlFor="arc-signin-email">Email address</label>
      <input
        id="arc-signin-email"
        name="email"
        type="email"
        placeholder="reader@example.com"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        maxLength={254}
        disabled={busy || sent}
      />

      <button type="submit" className="arcApplyButton" disabled={busy || sent}>
        {busy ? "Sending…" : sent ? "Link sent ✓" : "Email me a sign-in link"}
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
          No password needed. Enter the email address you applied with and
          you&apos;ll get a one-time link to your reading library.
        </p>
      )}
    </form>
  );
}
