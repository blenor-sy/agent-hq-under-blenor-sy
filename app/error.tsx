"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="center-page">
      <section className="setup-card">
        <p className="eyebrow error-text">CONNECTION ERROR</p>
        <h1>Agent HQ could not load this view.</h1>
        <p className="muted">
          Your stored agent data is unchanged. Check your connection and try again.
        </p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
