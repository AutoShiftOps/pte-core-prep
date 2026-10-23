// Describe Image stimulus: a static chart with labelled values, like the images in PTE.
// Colours come from the validated categorical palette (fixed order) in styles.css.

const W = 640, H = 380, M = { t: 48, r: 20, b: 64, l: 56 };
const fmt = (v) => (Number.isInteger(v) ? v.toLocaleString('en-CA') : v.toLocaleString('en-CA', { maximumFractionDigits: 2 }));

function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v || 1));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

function Axes({ max, unit }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const y = (v) => M.t + (H - M.t - M.b) * (1 - v / max);
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className="grid" />
          <text x={M.l - 8} y={y(t) + 4} textAnchor="end" className="tick">{fmt(t)}</text>
        </g>
      ))}
      <text x={M.l - 44} y={M.t - 14} className="tick">{unit}</text>
    </g>
  );
}

export default function Chart({ d }) {
  const innerW = W - M.l - M.r, innerH = H - M.t - M.b;
  let body;
  if (d.type === 'pie') {
    const total = d.values.reduce((a, b) => a + b, 0);
    const cx = 220, cy = 205, r = 130;
    let a0 = -Math.PI / 2;
    body = (
      <g>
        {d.values.map((v, i) => {
          const a1 = a0 + (v / total) * Math.PI * 2;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const path = `M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z`;
          a0 = a1;
          return <path key={i} d={path} fill={`var(--series-${i + 1})`} stroke="var(--chart-surface)" strokeWidth="2" />;
        })}
        {d.labels.map((l, i) => (
          <g key={l} transform={`translate(400, ${92 + i * 36})`}>
            <rect width="14" height="14" rx="3" fill={`var(--series-${i + 1})`} />
            <text x="24" y="12" className="lbl">{l}: {fmt(d.values[i])}{d.unit === '%' ? '%' : ''}</text>
          </g>
        ))}
      </g>
    );
  } else if (d.type === 'line') {
    const max = niceMax(Math.max(...d.values));
    const x = (i) => M.l + (innerW * i) / (d.values.length - 1);
    const y = (v) => M.t + innerH * (1 - v / max);
    const pts = d.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    body = (
      <g>
        <Axes max={max} unit={d.unit} />
        <polyline points={pts} fill="none" stroke="var(--series-1)" strokeWidth="2.5" strokeLinejoin="round" />
        {d.values.map((v, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r="4.5" fill="var(--series-1)" stroke="var(--chart-surface)" strokeWidth="2" />
            <text x={x(i)} y={y(v) - 10} textAnchor="middle" className="val">{fmt(v)}</text>
            <text x={x(i)} y={H - M.b + 20} textAnchor="middle" className="tick">{d.labels[i]}</text>
          </g>
        ))}
      </g>
    );
  } else {
    const series = d.type === 'group' ? d.series : [{ name: '', values: d.values }];
    const max = niceMax(Math.max(...series.flatMap((s) => s.values)));
    const band = innerW / d.labels.length;
    const bw = Math.min(56, (band * 0.7) / series.length);
    const y = (v) => M.t + innerH * (1 - v / max);
    body = (
      <g>
        <Axes max={max} unit={d.unit} />
        {d.labels.map((l, i) => (
          <g key={l}>
            {series.map((s, k) => {
              const x0 = M.l + band * i + (band - bw * series.length - 2 * (series.length - 1)) / 2 + k * (bw + 2);
              const v = s.values[i];
              return (
                <g key={k}>
                  <rect x={x0} y={y(v)} width={bw} height={Math.max(1, y(0) - y(v))} rx="4" fill={`var(--series-${k + 1})`} />
                  <text x={x0 + bw / 2} y={y(v) - 6} textAnchor="middle" className="val">{fmt(v)}</text>
                </g>
              );
            })}
            <text x={M.l + band * i + band / 2} y={H - M.b + 20} textAnchor="middle" className="tick">{l}</text>
          </g>
        ))}
        {d.type === 'group' && d.series.map((s, k) => (
          <g key={s.name} transform={`translate(${M.l + k * 130}, ${H - 18})`}>
            <rect width="14" height="14" rx="3" fill={`var(--series-${k + 1})`} />
            <text x="22" y="12" className="lbl">{s.name}</text>
          </g>
        ))}
      </g>
    );
  }
  return (
    <div className="chartwrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={d.title} className="chart">
        <rect width={W} height={H} fill="var(--chart-surface)" />
        <text x={W / 2} y="26" textAnchor="middle" className="title">{d.title}</text>
        {body}
      </svg>
    </div>
  );
}
