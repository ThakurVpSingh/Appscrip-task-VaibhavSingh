"use client";

import { useEffect, useState } from "react";

const notes = [
  { quote: "The pieces feel considered without feeling precious. My new everyday favourites.", name: "A note from Maya", detail: "Everyday edit" },
  { quote: "Beautifully simple, comfortable from the first wear, and easy to style again and again.", name: "A note from Elise", detail: "Slow mornings" },
  { quote: "A thoughtful little refresh. The quality and details made the whole experience feel special.", name: "A note from Rowan", detail: "Weekend away" },
];

export function Testimonials() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % notes.length), 6000);
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <section
      className="testimonial-section"
      aria-label="Customer notes"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
    >
      <p className="eyebrow">Kind words, worn often</p>
      <h2>Notes from the community.</h2>
      <div className="testimonial-card" key={active} aria-live="polite">
        <span className="testimonial-mark" aria-hidden="true">“</span>
        <blockquote>{notes[active].quote}</blockquote>
        <p className="testimonial-author">{notes[active].name}</p>
        <p className="testimonial-detail">{notes[active].detail}</p>
      </div>
      <div className="testimonial-controls" aria-label="Testimonial controls">
        {notes.map((note, index) => <button
          key={note.name}
          type="button"
          aria-label={`Show customer note ${index + 1}`}
          aria-current={index === active ? "true" : undefined}
          onClick={() => setActive(index)}
        />)}
      </div>
    </section>
  );
}
