import { readFile } from "fs/promises";
import { join } from "path";

/* ── Inline types (no external imports) ─────────────────────────── */

interface Opportunity {
  id: string;
  reference: string;
  title: string;
  description?: string;
  client: string;
  location?: string;
  province?: string;
  category?: string;
  closingDate: string;
  publishedDate?: string;
  source: string;
  sourceUrl?: string;
  documentUrls?: string[];
  estimatedValue?: string;
  contactEmail?: string;
  contactPhone?: string;
  fitScore: number;
  fitReason?: string;
  hash: string;
  ingestedAt: string;
  status: "active" | "closed";
}

const OPPORTUNITY_CATEGORIES = [
  "Town Planning",
  "Spatial Planning",
  "GIS",
  "Surveying",
  "Infrastructure",
  "Human Settlements",
  "Other",
];

function isOpportunity(o: unknown): o is Opportunity {
  return (
    typeof o === "object" &&
    o !== null &&
    "id" in o &&
    "reference" in o &&
    "title" in o &&
    "client" in o &&
    "closingDate" in o &&
    "source" in o &&
    "hash" in o &&
    "ingestedAt" in o &&
    "status" in o &&
    "fitScore" in o
  );
}

/* ── Helpers ────────────────────────────────────────────────────── */

function fmtClosing(iso: string) {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const time = d.toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${date} · ${time}`;
  } catch {
    return iso;
  }
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.ceil((then - now) / (1000 * 60 * 60 * 24));
  if (days < 0) return "Closed";
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  if (days <= 7) return `Closes in ${days} days`;
  return "";
}

function isNew(ingestedAt?: string) {
  if (!ingestedAt) return false;
  const then = new Date(ingestedAt).getTime();
  return Date.now() - then < 1000 * 60 * 60 * 48; // 48h
}

function fitRingColor(score: number) {
  if (score >= 90) return "text-emerald-600";
  if (score >= 75) return "text-amber-500";
  if (score >= 50) return "text-orange-500";
  return "text-red-500";
}

function fitBgColor(score: number) {
  if (score >= 90) return "bg-emerald-50";
  if (score >= 75) return "bg-amber-50";
  if (score >= 50) return "bg-orange-50";
  return "bg-red-50";
}

/* ── Page component ─────────────────────────────────────────────── */

export default async function OpportunitiesPage() {
  let opportunities: Opportunity[] = [];
  try {
    const filePath = join(process.cwd(), "data", "opportunities.json");
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      opportunities = parsed.filter(isOpportunity);
    }
  } catch {
    opportunities = [];
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-nfa-navy text-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Opportunities
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Active tenders matched to NFA capabilities.
            </p>
          </div>
          <button
            id="export-csv"
            className="inline-flex items-center rounded-md bg-white/10 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            Export CSV
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Quick filters */}
        <div className="flex flex-wrap gap-2">
          {["All active", "New today", "Briefing soon", "Closing soon", "High fit"].map(
            (filter) => (
              <button
                key={filter}
                type="button"
                data-quick-filter={filter}
                className="quick-filter rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-black/65 hover:bg-slate-50 transition-colors"
              >
                {filter}
              </button>
            )
          )}
        </div>

        {/* Search & refine */}
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <label htmlFor="search" className="block text-sm font-medium text-slate-700">
                Search
              </label>
              <input
                type="text"
                id="search"
                placeholder="Search title, client, location…"
                className="mt-1 block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-nfa-navy sm:text-sm sm:leading-6"
              />
            </div>
            <div>
              <label htmlFor="filter-category" className="block text-sm font-medium text-slate-700">
                Category
              </label>
              <select
                id="filter-category"
                className="mt-1 block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-nfa-navy sm:text-sm sm:leading-6"
              >
                <option value="">All categories</option>
                {OPPORTUNITY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-status" className="block text-sm font-medium text-slate-700">
                Status
              </label>
              <select
                id="filter-status"
                className="mt-1 block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-nfa-navy sm:text-sm sm:leading-6"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label htmlFor="sort-by" className="block text-sm font-medium text-slate-700">
                Sort by
              </label>
              <select
                id="sort-by"
                className="mt-1 block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-nfa-navy sm:text-sm sm:leading-6"
              >
                <option value="fit-desc">Fit Score (High → Low)</option>
                <option value="fit-asc">Fit Score (Low → High)</option>
                <option value="closing-asc">Closing Soonest</option>
                <option value="closing-desc">Closing Latest</option>
                <option value="title-asc">Title (A → Z)</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="fit-min" className="text-sm font-medium text-slate-700">Min Fit</label>
              <input type="number" id="fit-min" min={0} max={100} defaultValue={0} className="w-20 rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-nfa-navy sm:text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="fit-max" className="text-sm font-medium text-slate-700">Max Fit</label>
              <input type="number" id="fit-max" min={0} max={100} defaultValue={100} className="w-20 rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-nfa-navy sm:text-sm" />
            </div>
            <button id="clear-filters" className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
              Clear Filters
            </button>
            <div className="ml-auto text-sm text-slate-500">
              Showing <span id="showing-count">{opportunities.length}</span> of <span id="total-count">{opportunities.length}</span> opportunities
            </div>
          </div>
        </div>

        {/* Card grid */}
        <div id="card-grid" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {opportunities.map((opp) => {
            const closingStr = fmtClosing(opp.closingDate);
            const rel = relativeTime(opp.closingDate);
            const newBadge = isNew(opp.ingestedAt);
            const ringColor = fitRingColor(opp.fitScore);
            const bgTint = fitBgColor(opp.fitScore);
            return (
              <div
                key={opp.id}
                data-opp={JSON.stringify(opp)}
                className="opp-card group relative rounded-xl border border-black/10 bg-white p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                {/* Top row: reference + new badge */}
                <div className="flex items-start justify-between">
                  <span className="text-xs font-medium text-black/40">
                    {opp.reference}
                  </span>
                  {newBadge && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      New
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="mt-2 text-base font-semibold text-slate-900 leading-snug">
                  {opp.title}
                </h3>

                {/* Buyer */}
                <p className="mt-1 text-sm text-black/50">{opp.client}</p>

                {/* Meta row */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-black/65">
                    <span className="font-medium">Closing:</span> {closingStr}
                    {rel && (
                      <span className="ml-2 text-xs font-semibold text-red-600">{rel}</span>
                    )}
                  </div>
                </div>

                {/* Bottom row: score ring + category + location */}
                <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-4">
                  <div className="flex items-center gap-3">
                    {/* Fit score circle */}
                    <div className={`relative flex h-10 w-10 items-center justify-center rounded-full ${bgTint}`}>
                      <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-200"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        />
                        <path
                          className={ringColor}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray={`${opp.fitScore}, 100`}
                        />
                      </svg>
                      <span className="absolute text-xs font-bold text-slate-800">{opp.fitScore}</span>
                    </div>
                    <div className="text-xs text-black/40">
                      <div className="font-medium text-black/60">{opp.category || "Other"}</div>
                      <div>{opp.location}{opp.province ? `, ${opp.province}` : ""}</div>
                    </div>
                  </div>
                  <button className="view-btn rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
                    View
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        <div id="empty-state" className="hidden rounded-xl border border-black/10 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">No opportunities match your filters.</p>
          <button id="empty-clear" className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-500">
            Clear all filters
          </button>
        </div>
      </main>

      {/* Slide-over */}
      <div id="slide-over" className="fixed inset-0 z-50 hidden">
        <div id="slide-backdrop" className="absolute inset-0 bg-slate-900/50 opacity-0 transition-opacity duration-300" />
        <div id="slide-panel" className="absolute inset-y-0 right-0 w-full max-w-2xl transform translate-x-full bg-white shadow-xl transition-transform duration-300 ease-in-out">
          {/* Populated by script */}
        </div>
      </div>

      {/* Client-side interactivity */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function() {
  var grid = document.getElementById('card-grid');
  var cards = Array.from(grid.querySelectorAll('.opp-card'));
  var emptyState = document.getElementById('empty-state');
  var showingCount = document.getElementById('showing-count');

  function getOpp(card) {
    return JSON.parse(card.dataset.opp);
  }

  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      var date = d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
      var time = d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
      return date + ' · ' + time;
    } catch(e) { return iso; }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');
  }

  function applyFilters() {
    var search = (document.getElementById('search').value || '').toLowerCase();
    var category = document.getElementById('filter-category').value;
    var status = document.getElementById('filter-status').value;
    var fitMin = parseInt(document.getElementById('fit-min').value) || 0;
    var fitMax = parseInt(document.getElementById('fit-max').value) || 100;
    var sort = document.getElementById('sort-by').value;

    var visible = cards.filter(function(card) {
      var o = getOpp(card);
      var text = [o.title, o.client, o.location, o.province, o.reference].join(' ').toLowerCase();
      if (search && text.indexOf(search) === -1) return false;
      if (category && o.category !== category) return false;
      if (status && o.status !== status) return false;
      if (o.fitScore < fitMin || o.fitScore > fitMax) return false;
      return true;
    });

    visible.sort(function(a, b) {
      var oa = getOpp(a), ob = getOpp(b);
      if (sort === 'fit-desc') return ob.fitScore - oa.fitScore;
      if (sort === 'fit-asc') return oa.fitScore - ob.fitScore;
      if (sort === 'closing-asc') return new Date(oa.closingDate) - new Date(ob.closingDate);
      if (sort === 'closing-desc') return new Date(ob.closingDate) - new Date(oa.closingDate);
      if (sort === 'title-asc') return oa.title.localeCompare(ob.title);
      return 0;
    });

    cards.forEach(function(c) { c.classList.add('hidden'); });
    visible.forEach(function(c) {
      c.classList.remove('hidden');
      grid.appendChild(c);
    });

    if (visible.length === 0) {
      emptyState.classList.remove('hidden');
      grid.classList.add('hidden');
    } else {
      emptyState.classList.add('hidden');
      grid.classList.remove('hidden');
    }

    if (showingCount) showingCount.textContent = String(visible.length);
  }

  function openDetail(id) {
    var card = cards.find(function(c) { return getOpp(c).id === id; });
    if (!card) return;
    var o = getOpp(card);

    var fitColor = o.fitScore >= 80 ? 'bg-emerald-600' : o.fitScore >= 60 ? 'bg-amber-500' : o.fitScore >= 40 ? 'bg-orange-500' : 'bg-red-500';
    var statusDot = o.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400';
    var statusLabel = o.status === 'active' ? 'Active' : 'Closed';

    var catClass = {
      'Town Planning': 'bg-blue-100 text-blue-800',
      'Spatial Planning': 'bg-indigo-100 text-indigo-800',
      'GIS': 'bg-cyan-100 text-cyan-800',
      'Surveying': 'bg-teal-100 text-teal-800',
      'Infrastructure': 'bg-slate-100 text-slate-800',
      'Human Settlements': 'bg-rose-100 text-rose-800',
      'Other': 'bg-gray-100 text-gray-800'
    }[o.category || 'Other'] || 'bg-gray-100 text-gray-800';

    var panel = document.getElementById('slide-panel');
    panel.innerHTML =
      '<div class="flex h-full flex-col overflow-y-auto">' +
        '<div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">' +
          '<h2 class="text-lg font-semibold text-slate-900">Opportunity Details</h2>' +
          '<button id="close-detail" class="rounded-md p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600">' +
            '<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="space-y-6 px-6 py-6">' +
          '<div>' +
            '<h3 class="text-xl font-bold text-slate-900">' + escapeHtml(o.title) + '</h3>' +
            '<p class="mt-1 text-sm text-slate-500">Reference: ' + escapeHtml(o.reference) + '</p>' +
          '</div>' +
          '<div class="flex flex-wrap gap-2">' +
            '<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800">' +
              '<span class="h-2 w-2 rounded-full ' + statusDot + '"></span>' + statusLabel +
            '</span>' +
            (o.category ? '<span class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ' + catClass + '">' + o.category + '</span>' : '') +
          '</div>' +
          '<div>' +
            '<div class="mb-2 flex items-center gap-3">' +
              '<div class="h-3 w-32 overflow-hidden rounded-full bg-slate-200">' +
                '<div class="h-full ' + fitColor + '" style="width:' + o.fitScore + '%"></div>' +
              '</div>' +
              '<span class="text-lg font-bold text-slate-900">' + o.fitScore + '/100</span>' +
            '</div>' +
            '<p class="text-sm text-slate-600">' + escapeHtml(o.fitReason || '') + '</p>' +
          '</div>' +
          (o.description ? '<div class="text-sm text-slate-700"><p>' + escapeHtml(o.description) + '</p></div>' : '') +
          '<div class="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">' +
            '<div><span class="font-medium text-slate-500">Client</span><p class="text-slate-900">' + escapeHtml(o.client) + '</p></div>' +
            '<div><span class="font-medium text-slate-500">Location</span><p class="text-slate-900">' + escapeHtml(o.location || '—') + (o.province ? ', ' + escapeHtml(o.province) : '') + '</p></div>' +
            '<div><span class="font-medium text-slate-500">Closing Date</span><p class="text-slate-900">' + fmtDate(o.closingDate) + '</p></div>' +
            '<div><span class="font-medium text-slate-500">Published Date</span><p class="text-slate-900">' + (o.publishedDate ? fmtDate(o.publishedDate) : '—') + '</p></div>' +
            '<div><span class="font-medium text-slate-500">Source</span><p class="text-slate-900">' + escapeHtml(o.source) + '</p></div>' +
            '<div><span class="font-medium text-slate-500">Estimated Value</span><p class="text-slate-900">' + escapeHtml(o.estimatedValue || '—') + '</p></div>' +
            '<div><span class="font-medium text-slate-500">Contact Email</span><p class="text-slate-900">' + (o.contactEmail ? '<a href="mailto:' + o.contactEmail + '" class="text-blue-600 hover:underline">' + escapeHtml(o.contactEmail) + '</a>' : '—') + '</p></div>' +
            '<div><span class="font-medium text-slate-500">Contact Phone</span><p class="text-slate-900">' + escapeHtml(o.contactPhone || '—') + '</p></div>' +
          '</div>' +
          (o.documentUrls && o.documentUrls.length ? '<div><h4 class="mb-2 text-sm font-medium text-slate-500">Documents</h4><ul class="space-y-1">' + o.documentUrls.map(function(url, i) { return '<li><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer" class="break-all text-sm text-blue-600 hover:underline">Document ' + (i + 1) + '</a></li>'; }).join('') + '</ul></div>' : '') +
          (o.sourceUrl ? '<div><a href="' + escapeHtml(o.sourceUrl) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-sm font-medium text-blue-600 hover:underline">View source →</a></div>' : '') +
        '</div>' +
      '</div>';

    var container = document.getElementById('slide-over');
    var backdrop = document.getElementById('slide-backdrop');
    container.classList.remove('hidden');
    void container.offsetWidth;
    backdrop.classList.remove('opacity-0');
    backdrop.classList.add('opacity-100');
    panel.classList.remove('translate-x-full');
    panel.classList.add('translate-x-0');

    document.getElementById('close-detail').addEventListener('click', closeDetail);
    backdrop.addEventListener('click', closeDetail);
  }

  function closeDetail() {
    var panel = document.getElementById('slide-panel');
    var backdrop = document.getElementById('slide-backdrop');
    var container = document.getElementById('slide-over');
    panel.classList.remove('translate-x-0');
    panel.classList.add('translate-x-full');
    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
    setTimeout(function() { container.classList.add('hidden'); }, 300);
  }

  function exportCSV() {
    var visible = cards.filter(function(c) { return !c.classList.contains('hidden'); });
    var headers = ['ID','Reference','Title','Client','Location','Province','Category','Status','Closing Date','Fit Score','Estimated Value','Contact Email','Contact Phone'];
    var lines = [headers.join(',')];
    visible.forEach(function(card) {
      var o = getOpp(card);
      var vals = [o.id, o.reference, o.title, o.client, o.location || '', o.province || '', o.category || '', o.status, o.closingDate, o.fitScore, o.estimatedValue || '', o.contactEmail || '', o.contactPhone || ''];
      lines.push(vals.map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
    });
    var blob = new Blob([lines.join('\\\\n')], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'nfa-opportunities-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  document.getElementById('search').addEventListener('input', applyFilters);
  document.getElementById('filter-category').addEventListener('change', applyFilters);
  document.getElementById('filter-status').addEventListener('change', applyFilters);
  document.getElementById('fit-min').addEventListener('input', applyFilters);
  document.getElementById('fit-max').addEventListener('input', applyFilters);
  document.getElementById('sort-by').addEventListener('change', applyFilters);
  document.getElementById('clear-filters').addEventListener('click', function() {
    document.getElementById('search').value = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('fit-min').value = '0';
    document.getElementById('fit-max').value = '100';
    document.getElementById('sort-by').value = 'fit-desc';
    applyFilters();
  });
  document.getElementById('empty-clear').addEventListener('click', function() {
    document.getElementById('search').value = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('fit-min').value = '0';
    document.getElementById('fit-max').value = '100';
    document.getElementById('sort-by').value = 'fit-desc';
    applyFilters();
  });
  document.getElementById('export-csv').addEventListener('click', exportCSV);

  cards.forEach(function(card) {
    card.addEventListener('click', function() { openDetail(getOpp(card).id); });
  });

  document.querySelectorAll('.view-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var card = btn.closest('.opp-card');
      if (card) openDetail(getOpp(card).id);
    });
  });

  applyFilters();
})();
          `,
        }}
      />
    </div>
  );
}
