import { useState, useEffect, useCallback } from "react";

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500&family=Cormorant+Garamond:ital,wght@0,300;1,300&display=swap";

// ─── Physics Timing ───────────────────────────────────────────────────────────
// Forward roll: ball lands with impact momentum but backspin immediately fights it.
// Decelerates continuously — each step takes longer as the ball slows toward a stop.
const FORWARD_DELAYS = [62, 72, 84, 98, 116, 136, 160, 188, 218, 250];

// Grip pause: the moment the ball fully stops — backspin has cancelled all
// forward momentum and is now about to take it backward. Pronounced and clear.
const GRIP_PAUSE = 480;

// Suck-back: starts from dead rest, so very slow at first. Backspin accelerates
// it — delays shrink toward the middle (peak velocity). Then spin energy depletes
// and the ball decelerates back to rest. True bell-curve velocity profile.
const BACKWARD_DELAYS = [265, 205, 152, 108, 74, 54, 52, 72, 116, 186];

const EXTRA_I_COUNT = FORWARD_DELAYS.length; // 10 extra i's at peak

export default function SpinSlogan() {
  const [text, setText] = useState("");
  const [cursorOn, setCursorOn] = useState(true);
  const [done, setDone] = useState(false);
  const [tick, setTick] = useState(0); // increment to restart

  const runAnimation = useCallback(() => {
    const timeouts = [];
    const go = (fn, delay) => timeouts.push(setTimeout(fn, delay));

    setText("");
    setDone(false);
    setCursorOn(true);

    let t = 1100; // initial pause before typing

    // Phase 1: Type "The Sp"
    const prefix = "The Sp";
    for (let i = 1; i <= prefix.length; i++) {
      const snapshot = i;
      go(() => setText(prefix.slice(0, snapshot)), t);
      t += 108;
    }

    // Phase 2: Land the 'i' — moment of impact
    go(() => setText("The Spi"), t);
    t += 280; // impact pause — ball hits the green

    // Phase 3: Forward roll — add extra i's (ball sliding forward)
    for (let k = 0; k < FORWARD_DELAYS.length; k++) {
      const iCount = k + 2; // 2 → 7
      go(() => setText(`The Sp${"i".repeat(iCount)}`), t);
      t += FORWARD_DELAYS[k];
    }

    // Phase 4: Backspin grips (ball checks up before reversing)
    t += GRIP_PAUSE;

    // Phase 5: Backward roll — remove extra i's (suck-back)
    for (let k = 0; k < BACKWARD_DELAYS.length; k++) {
      const iCount = EXTRA_I_COUNT - k; // 6 → 1
      go(() => setText(`The Sp${"i".repeat(iCount)}`), t);
      t += BACKWARD_DELAYS[k];
    }

    // Phase 6: Ball settled — longer pause, the ball has come to rest
    t += 240;

    // Phase 7: Continue typing "n Company"
    const suffix = "n Company";
    for (let i = 1; i <= suffix.length; i++) {
      const snapshot = i;
      go(() => setText(`The Spi${suffix.slice(0, snapshot)}`), t);
      t += 78;
    }

    go(() => setDone(true), t + 450);

    return () => timeouts.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const cleanup = runAnimation();
    return cleanup;
  }, [tick, runAnimation]);

  // Cursor blink (only while animating)
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setCursorOn((v) => !v), 540);
    return () => clearInterval(id);
  }, [done]);

  const replay = () => setTick((n) => n + 1);

  return (
    <>
      <style>{`
        @import url('${FONT_URL}');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .sc-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #0c1a0d;
          padding: 2.5rem 1.5rem;
          position: relative;
          overflow: hidden;
        }

        /* Subtle radial atmosphere — no animation, purely additive depth */
        .sc-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 50% at 25% 30%, rgba(28,58,24,0.55) 0%, transparent 70%),
            radial-gradient(ellipse 55% 40% at 75% 75%, rgba(18,42,16,0.40) 0%, transparent 65%);
          pointer-events: none;
        }

        .sc-inner {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
        }

        /* ── Top emblem ── */
        .sc-emblem {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 2.8rem;
        }

        .sc-rule {
          width: 56px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(191,158,64,0.55), transparent);
        }

        .sc-ball {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: #e5ddb8;
          box-shadow:
            inset -1.5px -1.5px 3px rgba(0,0,0,0.35),
            inset 1px 1px 2px rgba(255,255,255,0.12);
        }

        /* ── Slogan ── */
        .sc-slogan-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 1.25em;
        }

        .sc-slogan {
          font-family: 'Cinzel', serif;
          font-size: clamp(1.9rem, 5.5vw, 4rem);
          font-weight: 400;
          letter-spacing: 0.14em;
          color: #e8dfc2;
          white-space: nowrap;
          line-height: 1;
          /* Subtle warmth in the text shadow */
          text-shadow: 0 1px 28px rgba(191,158,64,0.12);
        }

        .sc-cursor {
          display: inline-block;
          width: 2.5px;
          height: 0.78em;
          background: #bf9e40;
          margin-left: 5px;
          vertical-align: middle;
          border-radius: 1px;
          transition: opacity 80ms linear;
        }

        /* ── Tagline ── */
        .sc-tagline {
          margin-top: 1.8rem;
          font-family: 'Cormorant Garamond', serif;
          font-style: italic;
          font-size: clamp(0.7rem, 1.4vw, 0.85rem);
          font-weight: 300;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: rgba(191,158,64,0.52);
          opacity: 0;
          transform: translateY(4px);
          transition: opacity 0.9s ease 0.1s, transform 0.9s ease 0.1s;
        }

        .sc-tagline.visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* ── Bottom rule ── */
        .sc-bottom-rule {
          margin-top: 2.6rem;
          width: 120px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(191,158,64,0.28), transparent);
          opacity: 0;
          transition: opacity 0.8s ease 0.4s;
        }

        .sc-bottom-rule.visible { opacity: 1; }

        /* ── Replay ── */
        .sc-replay-wrap {
          margin-top: 2.2rem;
          min-height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sc-replay {
          font-family: 'Cinzel', serif;
          font-size: 0.65rem;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: rgba(191,158,64,0.42);
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px 12px;
          transition: color 0.25s;
        }

        .sc-replay:hover { color: rgba(191,158,64,0.78); }
        .sc-replay:active { transform: scale(0.97); }
      `}</style>

      <div className="sc-root">
        <div className="sc-inner">

          <div className="sc-emblem">
            <div className="sc-rule" />
            <div className="sc-ball" />
            <div className="sc-rule" />
          </div>

          <div className="sc-slogan-wrap">
            <span className="sc-slogan">
              {text}
              {!done && (
                <span
                  className="sc-cursor"
                  style={{ opacity: cursorOn ? 1 : 0 }}
                />
              )}
            </span>
          </div>

          <p className={`sc-tagline ${done ? "visible" : ""}`}>
            Wedges &amp; Short Game Accessories
          </p>

          <div className={`sc-bottom-rule ${done ? "visible" : ""}`} />

          <div className="sc-replay-wrap">
            {done && (
              <button className="sc-replay" onClick={replay}>
                ↺ &nbsp;Replay
              </button>
            )}
          </div>

        </div>
      </div>
    </>
  );
}