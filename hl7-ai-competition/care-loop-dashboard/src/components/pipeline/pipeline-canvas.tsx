"use client";

import type { Run } from "@/lib/runs";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { StageIcon } from "@/components/pipeline/stage-icon";
import { STAGE_DEFS } from "@/lib/stages";
import { cn } from "@/lib/utils";

const PER_ROW = 3;
const PITCH = 244;
const ROW_PITCH = 208;
const NODE_W = 162;
const NODE_H = 150;
const MARGIN_X = 320;
const MARGIN_Y = 200;

const TOTAL = STAGE_DEFS.length;
const ROWS = Math.ceil(TOTAL / PER_ROW);
const CONTENT_W = (PER_ROW - 1) * PITCH + NODE_W;
const CONTENT_H = (ROWS - 1) * ROW_PITCH + NODE_H;
const CANVAS_W = CONTENT_W + MARGIN_X * 2;
const CANVAS_H = CONTENT_H + MARGIN_Y * 2;

function pos(i: number) {
  const row = Math.floor(i / PER_ROW);
  const c = i % PER_ROW;
  const colFromLeft = row % 2 === 0 ? c : PER_ROW - 1 - c;
  return { left: MARGIN_X + colFromLeft * PITCH, top: MARGIN_Y + row * ROW_PITCH, row };
}

const LEGEND: { label: string; className: string }[] = [
  { label: "Received", className: "bg-foreground" },
  { label: "Processing", className: "bg-background border-2 border-foreground" },
  { label: "Pending", className: "bg-foreground/10" },
  { label: "Not observable", className: "bg-transparent border-2 border-dashed border-foreground/30" },
];

export function PipelineCanvas({
  run,
  selectedIndex,
  onSelectIndex,
}: {
  run: Run;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const centerOn = useCallback((left: number, top: number, smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      left: Math.max(0, left - el.clientWidth / 2),
      top: Math.max(0, top - el.clientHeight / 2),
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  const fit = useCallback(() => {
    centerOn(CANVAS_W / 2, CANVAS_H / 2, true);
  }, [centerOn]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let down = false;
    let sx = 0;
    let sy = 0;
    let sl = 0;
    let st = 0;

    function onDown(e: MouseEvent) {
      if ((e.target as HTMLElement).closest("[data-node]") || (e.target as HTMLElement).closest("button")) return;
      down = true;
      sx = e.clientX;
      sy = e.clientY;
      sl = el!.scrollLeft;
      st = el!.scrollTop;
      el!.style.cursor = "grabbing";
    }
    function onMove(e: MouseEvent) {
      if (!down) return;
      el!.scrollLeft = sl - (e.clientX - sx);
      el!.scrollTop = st - (e.clientY - sy);
    }
    function onUp() {
      if (down) {
        down = false;
        el!.style.cursor = "grab";
      }
    }

    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Center on the active/latest-reached stage whenever the run changes.
  useEffect(() => {
    const p = pos(Math.min(selectedIndex, TOTAL - 1));
    centerOn(p.left + NODE_W / 2, p.top + NODE_H / 2, false);
    // eslint-disable-next-line react/exhaustive-deps
  }, [run.id]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/40 shadow-inner">
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-md border border-border bg-background/85 px-2.5 py-1 text-[10.5px] text-muted-foreground backdrop-blur">
          Drag to pan
        </span>
        <button
          type="button"
          onClick={fit}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-[11px] font-semibold shadow-sm transition-colors hover:bg-foreground hover:text-background"
        >
          Fit
        </button>
      </div>

      <div className="absolute bottom-3 left-3 z-10 flex gap-3.5 rounded-lg border border-border bg-background/85 px-3 py-1.5 backdrop-blur">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span className={cn("inline-block size-2.5 rounded-full", l.className)} />
            {l.label}
          </span>
        ))}
      </div>

      <div ref={scrollRef} className="h-[420px] cursor-grab overflow-auto sm:h-[480px]">
        <div
          className="relative"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            backgroundPosition: "13px 13px",
          }}
        >
          {STAGE_DEFS.slice(0, -1).map((def, i) => (
            <Edge key={def.key} index={i} run={run} />
          ))}

          {STAGE_DEFS.map((def, i) => {
            const stage = run.stages[i]!;
            const selected = i === selectedIndex;
            const p = pos(i);
            const isActive = stage.status === "active";
            const isDone = stage.status === "done";
            const isNotObservable = stage.status === "not-observable";

            return (
              <button
                key={def.key}
                type="button"
                data-node
                onClick={() => onSelectIndex(i)}
                style={{ left: p.left, top: p.top, width: NODE_W, height: NODE_H }}
                className={cn(
                  "absolute z-[3] flex flex-col rounded-2xl border bg-background p-3.5 text-left transition-[border-color,box-shadow]",
                  isDone && "border-border/80",
                  isActive && "border-foreground/60 animate-canvas-node-pulse",
                  stage.status === "pending" && "border-border/80",
                  isNotObservable && "border-dashed border-border/80",
                  selected &&
                    (isActive
                      ? "border-foreground shadow-[0_0_0_3px_var(--border),0_10px_26px_rgba(0,0,0,0.12)]"
                      : "border-foreground/50 shadow-[0_0_0_3px_var(--border),0_10px_26px_rgba(0,0,0,0.12)]"),
                  !selected && !isActive && "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_22px_rgba(0,0,0,0.05)]",
                  "hover:border-foreground/40",
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-[9px] transition-all",
                      isDone && "bg-foreground text-background",
                      isActive && "border-[1.5px] border-foreground bg-background text-foreground",
                      stage.status === "pending" && "border border-border bg-foreground/5 text-muted-foreground/70",
                      isNotObservable &&
                        "border-[1.5px] border-dashed border-border text-muted-foreground/40",
                    )}
                  >
                    <StageIcon stageKey={def.key} className="size-4" />
                  </div>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 font-mono text-[9px] font-semibold",
                      isActive ? "bg-foreground text-background" : "bg-foreground/5 text-muted-foreground",
                    )}
                  >
                    {def.method}
                  </span>
                </div>
                <div
                  className={cn(
                    "text-[12.5px] font-semibold leading-tight",
                    (stage.status === "pending" || isNotObservable) && "text-muted-foreground",
                  )}
                >
                  {def.label}
                </div>
                <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground/70">
                  {def.endpoint}
                </div>
                <div className="mt-auto flex items-center gap-1.5 pt-2.5">
                  {isActive ? <Loader2 className="size-3 shrink-0 animate-spin" /> : null}
                  <span
                    className={cn(
                      "text-[11px] font-semibold",
                      isActive ? "text-foreground" : "text-muted-foreground/70",
                    )}
                  >
                    {isDone
                      ? "Received"
                      : isActive
                        ? "Processing"
                        : isNotObservable
                          ? "Not observable"
                          : "Pending"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Edge({ index, run }: { index: number; run: Run }) {
  const a = pos(index);
  const b = pos(index + 1);
  const flowing = run.stages[index]!.status === "done";
  const chipText = run.stages[index]!.event?.detail;
  const showChip = flowing && !!chipText;

  const d1 = `-${((index * 0.6) % 2.6).toFixed(2)}s`;
  const d2 = `-${(((index * 0.6) + 1.3) % 2.6).toFixed(2)}s`;

  if (a.top === b.top) {
    const leftX = Math.min(a.left, b.left) + NODE_W;
    const width = Math.max(a.left, b.left) - leftX;
    const rev = a.left > b.left;
    const dur = Math.max(1.1, width / 60).toFixed(2);

    return (
      <div
        className="absolute z-[1] h-[2px] rounded-full"
        style={{
          left: leftX,
          top: a.top + NODE_H / 2 - 1,
          width,
          background: flowing
            ? "linear-gradient(90deg, rgba(0,0,0,0.4), rgba(0,0,0,0.16))"
            : "var(--border)",
        }}
      >
        {flowing ? (
          <>
            <span
              className="absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-foreground shadow-[0_0_7px_1px_rgba(0,0,0,0.3)]"
              style={{
                animation: `canvas-flow-dot-h ${dur}s linear infinite`,
                animationDelay: d1,
                animationDirection: rev ? "reverse" : "normal",
              }}
            />
            <span
              className="absolute top-1/2 size-1 -translate-y-1/2 rounded-full bg-foreground/55"
              style={{
                animation: `canvas-flow-dot-h ${dur}s linear infinite`,
                animationDelay: d2,
                animationDirection: rev ? "reverse" : "normal",
              }}
            />
            {showChip ? (
              <div
                className="absolute -top-8 z-[6] -translate-x-1/2"
                style={{
                  animation: `canvas-flow-chip-h ${dur}s linear infinite`,
                  animationDelay: d1,
                  animationDirection: rev ? "reverse" : "normal",
                }}
              >
                <div className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10px] whitespace-nowrap shadow-lg">
                  {chipText}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }

  const topY = a.top + NODE_H;
  const height = b.top - topY;
  const x = a.left + NODE_W / 2;
  const dur = Math.max(1.1, height / 60).toFixed(2);

  return (
    <div
      className="absolute z-[1] w-[2px] rounded-full"
      style={{
        left: x - 1,
        top: topY,
        height,
        background: flowing
          ? "linear-gradient(180deg, rgba(0,0,0,0.4), rgba(0,0,0,0.16))"
          : "var(--border)",
      }}
    >
      {flowing ? (
        <>
          <span
            className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-foreground shadow-[0_0_7px_1px_rgba(0,0,0,0.3)]"
            style={{ animation: `canvas-flow-dot-v ${dur}s linear infinite`, animationDelay: d1 }}
          />
          <span
            className="absolute left-1/2 size-1 -translate-x-1/2 rounded-full bg-foreground/55"
            style={{ animation: `canvas-flow-dot-v ${dur}s linear infinite`, animationDelay: d2 }}
          />
          {showChip ? (
            <div
              className="absolute left-3.5 z-[6] -translate-y-1/2"
              style={{ animation: `canvas-flow-chip-v ${dur}s linear infinite`, animationDelay: d1 }}
            >
              <div className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10px] whitespace-nowrap shadow-lg">
                {chipText}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
