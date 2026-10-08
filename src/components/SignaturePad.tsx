"use client";
import { useRef, useState } from "react";
export default function SignaturePad({
  value,
  onChange,
  disabled = false,
}: {
  value: number[][][];
  onChange: (v: number[][][]) => void;
  disabled?: boolean;
}) {
  const drawing = useRef(false);
  const cursor = useRef([100, 100]);
  const [notice, setNotice] = useState("");
  function start(point: number[]) {
    if (disabled || value.length >= 30) return;
    drawing.current = true;
    onChange([...value, [point]]);
  }
  function move(point: number[]) {
    if (!drawing.current || disabled) return;
    const total = value.flat().length;
    if (total >= 450) {
      drawing.current = false;
      setNotice("Signature limit reached. Clear and redraw if needed.");
      return;
    }
    onChange(value.map((s, i) => (i === value.length - 1 ? [...s, point] : s)));
  }
  function point(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      Math.round(
        Math.min(600, Math.max(0, ((e.clientX - r.left) * 600) / r.width)),
      ),
      Math.round(
        Math.min(200, Math.max(0, ((e.clientY - r.top) * 200) / r.height)),
      ),
    ];
  }
  return (
    <fieldset className="signature-field">
      <legend>Drawn signature</legend>
      <p>
        Draw with touch or mouse. Keyboard: Space starts/stops a stroke; arrow
        keys draw.
      </p>
      <svg
        viewBox="0 0 600 200"
        tabIndex={disabled ? -1 : 0}
        role="application"
        aria-label="Signature drawing area"
        className="signature-pad"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start(point(e));
        }}
        onPointerMove={(e) => move(point(e))}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerCancel={() => {
          drawing.current = false;
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === " ") {
            e.preventDefault();
            if (drawing.current) drawing.current = false;
            else start([...cursor.current]);
          }
          if (e.key.startsWith("Arrow")) {
            e.preventDefault();
            const [x, y] = cursor.current;
            cursor.current = [
              Math.min(
                600,
                Math.max(
                  0,
                  x +
                    (e.key === "ArrowRight"
                      ? 5
                      : e.key === "ArrowLeft"
                        ? -5
                        : 0),
                ),
              ),
              Math.min(
                200,
                Math.max(
                  0,
                  y +
                    (e.key === "ArrowDown" ? 5 : e.key === "ArrowUp" ? -5 : 0),
                ),
              ),
            ];
            move([...cursor.current]);
          }
        }}
      >
        {value.map((s, i) => (
          <polyline
            key={i}
            points={s.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        ))}
      </svg>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          drawing.current = false;
          onChange([]);
          setNotice("Signature cleared.");
        }}
      >
        Clear signature
      </button>
      <p role="status">{notice}</p>
    </fieldset>
  );
}
