"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";

type Status = "idle" | "loading" | "success" | "already" | "error";

export function SubscribeForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot — must stay empty
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const done = status === "success" || status === "already";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || status === "loading") return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      if (data.status === "already") {
        setStatus("already");
        setMessage("You're already on the list. Thank you!");
      } else {
        setStatus("success");
        setMessage("Thanks! You're on the list.");
      }
      // Record the signup as a Vercel Analytics conversion event. The `status`
      // property lets you separate brand-new subscribers from repeat submits.
      track("newsletter_signup", { status: data.status ?? "subscribed" });
      setName("");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <form className="subscribeForm" onSubmit={onSubmit}>
      <label htmlFor="name">Name</label>
      <input
        id="name"
        name="name"
        type="text"
        placeholder="Your name"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        disabled={status === "loading" || done}
      />

      <label htmlFor="email">Email address</label>
      <div className="subscribeRow">
        <input
          id="email"
          name="email"
          type="email"
          placeholder="reader@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={status === "loading" || done}
        />
        <button type="submit" disabled={status === "loading" || done}>
          {status === "loading" ? "Joining…" : done ? "Subscribed ✓" : "Subscribe"}
        </button>
      </div>

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
          Join the reader list for early access to the next novel, launch-day
          news, and the first word on deals and discounts, plus the occasional
          note from the writing desk.
        </p>
      )}
    </form>
  );
}
