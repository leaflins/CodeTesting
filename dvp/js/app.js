// app.js - Hospitalised road injuries dashboard (D3). Reads data/CSVG6.csv.
(() => {
const C = { ink: '#1B2333', muted: '#5B6578', rule: '#DDE3EE', navy: '#2A4A8D', amber: '#B8651B', grey: '#9AA5B1' };
const SHADES = ['#1B2559', '#2A4A8D', '#3F7FC1', '#5AA9E6', '#7FBFF2'];
const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const ABB = MON.map(m => m.slice(0, 3));
const AGES = ['0-7','8-16','17-25','26-39','40-64','65-74','75+','Missing'];
const KEYS = ['year','remote','user','sex','age'];
const NAMES = { year: 'Year', remote: 'Remoteness', user: 'Road user', sex: 'Sex', age: 'Age group' };
const NICE = { Missing: 'Not stated', 'intersex or indeterminate or missing': 'Other / not stated' };
const lab = v => NICE[v] || v;
const fmt = d3.format(','), pct = d3.format('.0%');
const signed = x => d3.format('+.0%')(x).replace('-', '\u2212');
const $ = s => document.querySelector(s);
const total = a => d3.sum(a, r => r.n);
let rows = [], drop = null;
const f = Object.fromEntries(KEYS.map(k => [k, 'all']));

// rows that match every filter except the ones in `skip` (so a chart can show all its own categories)
const pick = (skip = []) => rows.filter(r => KEYS.every(k => skip.includes(k) || f[k] === 'all' || String(r[k]) === f[k]));

const tip = d3.select('body').append('div').attr('class', 'tip');
const show = (e, h) => tip.html(h).style('display', 'block').style('left', (e.clientX + 14) + 'px').style('top', (e.clientY + 14) + 'px');
const hide = () => tip.style('display', 'none');

function canvas(sel, W, H, label) {
  const box = d3.select(sel); box.selectAll('*').remove();
  return box.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', label)
    .style('width', '100%').style('height', 'auto').style('display', 'block').append('g');
}
const empty = sel => { d3.select(sel).html('<div class="empty-state"><h3>No data for this selection</h3><p>Try &ldquo;Reset filters&rdquo;.</p></div>'); };
function grid(g, y, W, M) {
  g.append('g').selectAll('g').data(y.ticks(5)).join('g').attr('transform', d => `translate(0,${y(d)})`).call(s => {
    s.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('stroke', C.rule);
    s.append('text').attr('x', M.l - 8).attr('dy', '.32em').attr('text-anchor', 'end').attr('font-size', 12).attr('fill', C.muted).text(d => fmt(d));
  });
}
function toggle(k, v) { f[k] = f[k] === String(v) ? 'all' : String(v); $('#f-' + k).value = f[k]; render(); }

// ---------- Filters ----------
function buildFilters() {
  const present = k => new Set(rows.map(r => r[k]));
  const byUser = d3.rollups(rows, total, r => r.user).sort((a, b) => b[1] - a[1]).map(d => d[0]);
  const all = {
    year: d3.range(2021, 2010, -1), remote: ['Major Cities', 'Regional', 'Remote', 'Missing'], user: byUser,
    sex: ['Male', 'Female', 'intersex or indeterminate or missing'], age: AGES
  };
  $('#controls').innerHTML = KEYS.map(k => {
    const p = present(k), opts = all[k].filter(v => p.has(v));
    return `<div><label for="f-${k}">${NAMES[k]}</label><select id="f-${k}"><option value="all">All</option>` +
      opts.map(v => `<option value="${v}">${lab(v)}</option>`).join('') + '</select></div>';
  }).join('');
  KEYS.forEach(k => $('#f-' + k).addEventListener('change', e => { f[k] = e.target.value; render(); }));
  $('#reset').addEventListener('click', () => { KEYS.forEach(k => { f[k] = 'all'; $('#f-' + k).value = 'all'; }); render(); });
}

// ---------- Overview ----------
function kpis() {
  const s = pick(), T = total(s);
  if (!T) { $('#kpis').innerHTML = '<div class="stat"><div class="label">Hospitalisations</div><div class="value">0</div></div>'; return; }
  const top = k => d3.greatest(d3.rollups(s, total, r => r[k]), d => d[1]);
  const u = top('user'), a = top('age'), male = total(s.filter(r => r.sex === 'Male'));
  $('#kpis').innerHTML = [
    ['Hospitalisations', fmt(T), 'in the current selection', ''],
    ['Most affected road user', lab(u[0]), pct(u[1] / T) + ' of hospitalisations', 'text'],
    ['Largest age group', lab(a[0]), pct(a[1] / T) + ' of hospitalisations', 'text'],
    ['Male share', pct(male / T), 'of hospitalisations', '']
  ].map(([l, v, sub, c]) => `<div class="stat"><div class="label">${l}</div><div class="value ${c}">${v}</div><div class="sub">${sub}</div></div>`).join('');
}
function findings() {
  const s = pick(), T = total(s);
  if (!T) { $('#findings').innerHTML = ''; return; }
  const m = d3.rollup(pick(['year']), total, r => r.year), v = y => m.get(y) || 0;
  const items = [];
  items.push(`Hospitalisations went from <strong>${fmt(v(2011))}</strong> in 2011 to <strong>${fmt(v(2019))}</strong> in 2019, then <strong>${fmt(v(2020))}</strong> in 2020 (${v(2019) ? signed(v(2020) / v(2019) - 1) : 'n/a'} on 2019) and <strong>${fmt(v(2021))}</strong> in 2021.`);
  items.push(drop && drop.pct < -0.05
    ? `<strong>${drop.month} 2020</strong> was the sharpest fall: <strong>${fmt(drop.cur)}</strong> hospitalisations, ${signed(drop.pct)} against the 2017&ndash;2019 average for ${drop.month} (${fmt(Math.round(drop.prev))}).`
    : `No month of 2020 fell more than 5% below the 2017&ndash;2019 average for this selection.`);
  const u = d3.greatest(d3.rollups(s, total, r => r.user), d => d[1]);
  const mo = total(s.filter(r => r.user === 'Motorcyclist')), cy = total(s.filter(r => r.user === 'Pedal cyclist'));
  items.push(`<strong>${lab(u[0])}</strong> accounts for ${pct(u[1] / T)} of hospitalisations. Motorcyclists make up ${pct(mo / T)} and pedal cyclists ${pct(cy / T)}.`);
  const a = d3.greatest(d3.rollups(s, total, r => r.age), d => d[1]);
  items.push(`The largest age group is <strong>${lab(a[0])}</strong> (${pct(a[1] / T)}). Males account for ${pct(total(s.filter(r => r.sex === 'Male')) / T)} of hospitalisations.`);
  $('#findings').innerHTML = items.map(t => `<div class="story-card"><div class="story-content"><p>${t}</p></div></div>`).join('');
}

// ---------- Charts ----------
function trend() {
  const data = pick(['year']); if (!total(data)) return empty('#trend');
  const m = d3.rollup(data, total, r => r.year), ys = d3.range(2011, 2022), val = y => m.get(y) || 0;
  const W = 720, H = 300, M = { t: 34, r: 30, b: 36, l: 56 };
  const g = canvas('#trend', W, H, 'Hospitalisations per year, 2011 to 2021');
  const x = d3.scalePoint(ys, [M.l, W - M.r]).padding(.3), y = d3.scaleLinear([0, d3.max(ys, val) * 1.12], [H - M.b, M.t]).nice();
  grid(g, y, W, M);
  g.append('g').selectAll('text').data(ys).join('text').attr('x', x).attr('y', H - 10).attr('text-anchor', 'middle').attr('font-size', 12)
    .attr('fill', d => d === 2020 ? C.amber : C.muted).attr('font-weight', d => d === 2020 ? 700 : 400).text(d => d);
  g.append('path').datum(ys).attr('d', d3.area().x(x).y0(y(0)).y1(d => y(val(d))).curve(d3.curveMonotoneX)).attr('fill', '#1E90C8').attr('opacity', .12);
  g.append('path').datum(ys).attr('d', d3.line().x(x).y(d => y(val(d))).curve(d3.curveMonotoneX)).attr('fill', 'none').attr('stroke', '#1E90C8').attr('stroke-width', 3);
  g.append('g').selectAll('circle').data(ys).join('circle').attr('cx', x).attr('cy', d => y(val(d)))
    .attr('r', d => String(d) === f.year ? 8 : 5).attr('fill', d => d === 2020 ? C.amber : '#1E90C8')
    .attr('stroke', d => String(d) === f.year ? C.ink : '#fff').attr('stroke-width', 2).style('cursor', 'pointer')
    .on('click', (e, d) => toggle('year', d)).on('mousemove', (e, d) => show(e, `<b>${d}</b><br>${fmt(val(d))} hospitalisations`)).on('mouseleave', hide);
  g.append('g').selectAll('text').data([2011, 2019, 2020, 2021]).join('text').attr('x', x).attr('text-anchor', 'middle')
    .attr('y', d => y(val(d)) + (d === 2020 ? 24 : -12)).attr('font-size', 12).attr('font-weight', 700)
    .attr('fill', d => d === 2020 ? C.amber : C.ink).text(d => fmt(val(d)));
}

function months() {
  const base = pick(['year']);
  const c = d3.rollup(base.filter(r => r.year === 2020), total, r => r.month);
  const p = d3.rollup(base.filter(r => r.year >= 2017 && r.year <= 2019), v => total(v) / 3, r => r.month);
  const cv = MON.map(k => c.get(k) || 0), pv = MON.map(k => p.get(k) || 0);
  drop = null;
  if (!d3.max([...cv, ...pv])) return empty('#months');
  const idx = d3.range(12).filter(i => pv[i] > 0);
  if (idx.length) { const i = d3.least(idx, j => cv[j] / pv[j] - 1); drop = { i, month: MON[i], pct: cv[i] / pv[i] - 1, cur: cv[i], prev: pv[i] }; }
  const W = 720, H = 300, M = { t: 40, r: 30, b: 36, l: 56 };
  const g = canvas('#months', W, H, 'Hospitalisations per month in 2020 compared with the 2017 to 2019 average');
  const x = d3.scalePoint(ABB, [M.l, W - M.r]).padding(.3), y = d3.scaleLinear([0, d3.max([...cv, ...pv]) * 1.12], [H - M.b, M.t]).nice();
  grid(g, y, W, M);
  g.append('g').selectAll('text').data(ABB).join('text').attr('x', x).attr('y', H - 10).attr('text-anchor', 'middle').attr('font-size', 12).attr('fill', C.muted).text(d => d);
  const line = d3.line().x((d, i) => x(ABB[i])).y(d => y(d)).curve(d3.curveMonotoneX);
  g.append('path').datum(pv).attr('d', line).attr('fill', 'none').attr('stroke', C.navy).attr('stroke-width', 3).attr('stroke-dasharray', '6 4');
  g.append('path').datum(cv).attr('d', line).attr('fill', 'none').attr('stroke', C.amber).attr('stroke-width', 3.5);
  g.append('g').selectAll('circle').data(cv).join('circle').attr('cx', (d, i) => x(ABB[i])).attr('cy', d => y(d)).attr('r', 4).attr('fill', C.amber).attr('stroke', '#fff').attr('stroke-width', 2);
  g.append('g').selectAll('rect').data(ABB).join('rect').attr('x', d => x(d) - 24).attr('y', M.t).attr('width', 48).attr('height', H - M.t - M.b).attr('fill', 'transparent')
    .on('mousemove', (e, d) => { const i = ABB.indexOf(d); show(e, `<b>${MON[i]}</b><br>2020: ${fmt(cv[i])}<br>2017&ndash;2019 average: ${fmt(Math.round(pv[i]))}`); }).on('mouseleave', hide);
  const lg = g.append('g').attr('transform', `translate(${M.l},16)`);
  lg.append('line').attr('x2', 26).attr('y1', 0).attr('y2', 0).attr('stroke', C.amber).attr('stroke-width', 3.5);
  lg.append('text').attr('x', 32).attr('dy', '.32em').attr('font-size', 12).attr('fill', C.ink).attr('font-weight', 700).text('2020');
  lg.append('line').attr('x1', 80).attr('x2', 106).attr('y1', 0).attr('y2', 0).attr('stroke', C.navy).attr('stroke-width', 3).attr('stroke-dasharray', '6 4');
  lg.append('text').attr('x', 112).attr('dy', '.32em').attr('font-size', 12).attr('fill', C.ink).text('2017\u20132019 average');
  if (drop && drop.pct < -0.05) g.append('text').attr('x', x(ABB[drop.i])).attr('y', y(drop.cur) + 26).attr('text-anchor', 'middle').attr('font-size', 13)
    .attr('font-weight', 700).attr('fill', C.amber).text(`${ABB[drop.i]} 2020: ${signed(drop.pct)}`);
}

function agg(key, order) {
  const m = d3.rollup(pick([key]), total, r => r[key]);
  const data = (order || [...m.keys()]).map(k => ({ k, label: lab(k), v: m.get(k) || 0 })).filter(d => d.v > 0);
  return order ? data : data.sort((a, b) => b.v - a.v);
}
function hbar(sel, data, key, colorFn, label) {
  if (!data.length) return empty(sel);
  const W = 760, rowH = 36, M = { l: 215, r: 130 }, H = data.length * rowH + 8, tot = d3.sum(data, d => d.v);
  const g = canvas(sel, W, H, label), x = d3.scaleLinear([0, d3.max(data, d => d.v)], [0, W - M.l - M.r]);
  const row = g.selectAll('g').data(data).join('g').attr('transform', (d, i) => `translate(0,${i * rowH + 4})`).style('cursor', 'pointer')
    .attr('opacity', d => f[key] === 'all' || f[key] === d.k ? 1 : .35).on('click', (e, d) => toggle(key, d.k))
    .on('mousemove', (e, d) => show(e, `<b>${d.label}</b><br>${fmt(d.v)} hospitalisations (${pct(d.v / tot)})`)).on('mouseleave', hide);
  row.append('rect').attr('y', -4).attr('width', W).attr('height', rowH).attr('fill', 'transparent');
  row.append('text').attr('x', M.l - 12).attr('y', rowH / 2 - 3).attr('dy', '.32em').attr('text-anchor', 'end').attr('font-size', 13).attr('fill', C.ink).text(d => d.label);
  row.append('rect').attr('x', M.l).attr('y', 4).attr('height', rowH - 14).attr('rx', 3).attr('width', d => Math.max(2, x(d.v))).attr('fill', colorFn);
  row.append('text').attr('x', d => M.l + Math.max(2, x(d.v)) + 8).attr('y', rowH / 2 - 3).attr('dy', '.32em').attr('font-size', 12).attr('fill', C.muted).text(d => `${fmt(d.v)} \u00b7 ${pct(d.v / tot)}`);
}
function ages() {
  const data = agg('age', AGES); if (!data.length) return empty('#ages');
  const W = 720, H = 300, M = { t: 30, r: 20, b: 40, l: 56 }, tot = d3.sum(data, d => d.v);
  const g = canvas('#ages', W, H, 'Hospitalisations by age group');
  const x = d3.scaleBand(data.map(d => d.k), [M.l, W - M.r]).padding(.25), y = d3.scaleLinear([0, d3.max(data, d => d.v) * 1.1], [H - M.b, M.t]).nice();
  grid(g, y, W, M);
  const b = g.selectAll('g.b').data(data).join('g').attr('class', 'b').style('cursor', 'pointer').attr('opacity', d => f.age === 'all' || f.age === d.k ? 1 : .35)
    .on('click', (e, d) => toggle('age', d.k)).on('mousemove', (e, d) => show(e, `<b>${d.label}</b><br>${fmt(d.v)} hospitalisations (${pct(d.v / tot)})`)).on('mouseleave', hide);
  b.append('rect').attr('x', d => x(d.k)).attr('y', d => y(d.v)).attr('width', x.bandwidth()).attr('height', d => y(0) - y(d.v)).attr('rx', 3).attr('fill', C.navy);
  b.append('text').attr('x', d => x(d.k) + x.bandwidth() / 2).attr('y', d => y(d.v) - 8).attr('text-anchor', 'middle').attr('font-size', 12).attr('font-weight', 700).attr('fill', C.ink).text(d => fmt(d.v));
  b.append('text').attr('x', d => x(d.k) + x.bandwidth() / 2).attr('y', H - 14).attr('text-anchor', 'middle').attr('font-size', 12).attr('fill', C.muted).text(d => d.label);
}

function render() {
  if (!rows.length) return;
  kpis(); trend(); months(); findings();
  hbar('#users', agg('user'), 'user', (d, i) => SHADES[Math.min(i, 4)], 'Hospitalisations by road user');
  ages();
  hbar('#remote', agg('remote', ['Major Cities', 'Regional', 'Remote', 'Missing']), 'remote', d => d.k === 'Missing' ? C.grey : C.amber, 'Hospitalisations by remoteness area');
}

d3.csv('data/CSVG6.csv', d => ({ year: +d['Calendar year'], month: d.Month, remote: d['ABS remoteness area'], age: d['Age group'], sex: d.Sex, user: d['Road user'], n: +d.Hospitalisations }))
  .then(data => {
    rows = data; buildFilters(); render();
    $('#statusIndicator').className = 'status-indicator success';
    $('#statusText').textContent = `Data loaded (${fmt(rows.length)} rows)`;
  })
  .catch(err => {
    console.error(err);
    $('#statusIndicator').className = 'status-indicator';
    $('#statusText').textContent = 'Could not load data/CSVG6.csv. Open the page through a local server (e.g. VS Code Live Server).';
  });
})();
