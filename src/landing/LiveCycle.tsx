import { useEffect, useId, useState } from "react";
import { useScript } from "../dsl/useScript";
import { formatNumber } from "../dsl/format";
import {
  SNAPSHOT,
  T1,
  cycleOf,
  cycleSource,
  type Cycle,
  type Point,
} from "./cycle";

/**
 * The worksheet the landing shows, live: the visitor sets the evaporator
 * temperature and CoolProp solves the cycle again, with the worksheet's own
 * engine. Before any change (and without JavaScript) it shows the cycle
 * solved at build time.
 */
export function LiveCycle() {
  const [t1, setT1] = useState(T1.initial);
  // The worksheet's engine starts on the first change, not on every visit.
  const [touched, setTouched] = useState(false);
  const [live, setLive] = useState<{ t1: number; cycle: Cycle } | null>(null);
  const [failed, setFailed] = useState(false);
  const sliderId = useId();

  // The last cycle solved; dimmed while the one for `t1` is on its way.
  const shown = live?.cycle ?? SNAPSHOT.cycle;
  const current = (live?.t1 ?? T1.initial) === t1;
  const cop = current && shown.cop !== null ? formatNumber(shown.cop) : "…";

  return (
    <figure className="live" data-ui aria-label="A live worksheet">
      <CycleChart cycle={shown} busy={!current} />
      <div className="live__result">
        <label className="live__control" htmlFor={sliderId}>
          <span>Evaporator temperature</span>
          <input
            id={sliderId}
            type="range"
            min={T1.min}
            max={T1.max}
            step={1}
            value={t1}
            aria-valuetext={`${t1} °C`}
            onChange={(e) => {
              setTouched(true);
              setT1(Number(e.target.value));
            }}
          />
        </label>
        <p className="live__cop" aria-live="polite">
          <span>COP</span> <strong>{failed ? "–" : cop}</strong>
        </p>
      </div>
      <pre className="live__code" aria-label="Its script">
        <code>
          <span className="k">fluid</span> R134a{"\n"}
          <span className="n">1</span>: <span className="p">T</span> ={" "}
          <output htmlFor={sliderId} className="live__value">
            {t1}
          </output>{" "}
          <span className="u">°C</span>, <span className="k">sat</span> vapor
          {"\n"}
          <span className="n">2</span>: <span className="k">from</span> 1,{" "}
          <span className="k">compressed</span> <span className="k">to</span>{" "}
          <span className="p">P</span> = 1.2 <span className="u">MPa</span>,{" "}
          <span className="p">eta</span> = 80<span className="u">%</span>
          {"\n"}
          <span className="n">3</span>: <span className="p">P</span> ={" "}
          <span className="p">P2</span>, <span className="k">sat</span> liquid
          {"\n"}
          <span className="n">4</span>: <span className="k">from</span> 3,{" "}
          <span className="k">throttled</span> <span className="k">to</span>{" "}
          <span className="p">P</span> = <span className="p">P1</span>
          {"\n"}
          <span className="k">draw</span> 1 -&gt; 2 -&gt; 3 -&gt; 4 -&gt; 1
          {"\n"}
          <span className="n">COP</span> = (<span className="p">h1</span> -{" "}
          <span className="p">h4</span>) / (<span className="p">h2</span> -{" "}
          <span className="p">h1</span>)
        </code>
      </pre>
      {touched && (
        <Solve
          t1={t1}
          onCycle={(cycle) => {
            setFailed(false);
            setLive({ t1, cycle });
          }}
          onError={() => setFailed(true)}
        />
      )}
    </figure>
  );
}

/** Solves the worksheet for one temperature; renders nothing. */
function Solve({
  t1,
  onCycle,
  onError,
}: {
  t1: number;
  onCycle: (cycle: Cycle) => void;
  onError: () => void;
}) {
  const { result, error, pending } = useScript(cycleSource(t1), 40);
  useEffect(() => {
    if (pending) return;
    if (result && result.diagnostics.length === 0) onCycle(cycleOf(result));
    else if (error || result) onError();
    // The callbacks change on every render; the answer is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, error, pending]);
  return null;
}

// The chart's frame: fixed, so moving the temperature moves the cycle and
// not the axes. s in kJ/(kg·K), T in °C.
const VIEW = { s: [0.7, 1.9], t: [-45, 110] } as const;
const SIZE = { w: 360, h: 196, left: 22, right: 8, top: 10, bottom: 22 };

function x(s: number) {
  const { w, left, right } = SIZE;
  return (
    left + ((s - VIEW.s[0]) / (VIEW.s[1] - VIEW.s[0])) * (w - left - right)
  );
}

function y(t: number) {
  const { h, top, bottom } = SIZE;
  return (
    h -
    bottom -
    ((t - VIEW.t[0]) / (VIEW.t[1] - VIEW.t[0])) * (h - top - bottom)
  );
}

const line = (points: Point[]) =>
  points
    .filter(([, t]) => t >= VIEW.t[0])
    .map(([s, t], i) => `${i ? "L" : "M"}${x(s).toFixed(1)} ${y(t).toFixed(1)}`)
    .join(" ");

/** Which side of its point each state's number goes on. */
const LABEL: Record<string, { dx: number; dy: number }> = {
  "1": { dx: 8, dy: 14 },
  "2": { dx: 8, dy: -6 },
  "3": { dx: -14, dy: -6 },
  "4": { dx: -14, dy: 14 },
};

function CycleChart({ cycle, busy }: { cycle: Cycle; busy: boolean }) {
  const { dome } = SNAPSHOT;
  const { w, h, left, bottom } = SIZE;
  return (
    <svg
      className={`live__chart${busy ? " is-busy" : ""}`}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`T–s chart of the cycle: ${cycle.states
        .map((s) => `state ${s.name} at ${formatNumber(s.at[1])} °C`)
        .join(", ")}`}
    >
      <path
        className="axis"
        d={`M${left} ${SIZE.top} V${h - bottom} H${w - SIZE.right}`}
      />
      <text className="axis-label" x={4} y={SIZE.top + 8}>
        T
      </text>
      <text className="axis-label" x={w - 14} y={h - 6}>
        s
      </text>
      {/* Both branches rise to the critical point: one line over the top. */}
      <path
        className="dome"
        d={line([...dome.liquid, ...[...dome.vapor].reverse()])}
      />
      {cycle.paths.map((p) => (
        <path key={`${p.from}-${p.to}`} className="leg" d={line(p.points)} />
      ))}
      {cycle.states.map((s) => (
        <g key={s.name}>
          <circle cx={x(s.at[0])} cy={y(s.at[1])} r={4.5} />
          <text
            x={x(s.at[0]) + (LABEL[s.name]?.dx ?? 8)}
            y={y(s.at[1]) + (LABEL[s.name]?.dy ?? -6)}
          >
            {s.name}
          </text>
        </g>
      ))}
    </svg>
  );
}
