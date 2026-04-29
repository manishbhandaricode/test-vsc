'use strict';

const DATA_URL = 'assets/data/ruilings.json';
const RELATED_URL = 'assets/data/ruilings_related_llm.json';
const STORAGE_KEY = 'premiumRulingsAtlasStateV1';
const THEME_KEY = 'premiumRulingsAtlasTheme';
const PAGE_SIZE = 12;

const DEFAULT_NOTES = [
  'Align this citation with factual matrix and stage before relying in court.',
  'Pair this with current binding precedent from the same jurisdiction.'
];

const state = {
  baseEntries: [],
  entries: [],
  filtered: [],
  relatedMap: {},
  page: 1,
  search: '',
  category: 'all',
  subCategory: 'all',
  stage: 'all',
  court: 'all',
  sort: 'serial-asc',
  editingId: null,
  currentDetailId: null,
  local: {
    upserts: {},
    deletedIds: []
  }
};

const els = {
  themeToggle: document.getElementById('themeToggle'),
  themeIcon: document.getElementById('themeIcon'),
  themeLabel: document.getElementById('themeLabel'),
  exportBtn: document.getElementById('exportBtn'),
  statEntries: document.getElementById('statEntries'),
  statCategories: document.getElementById('statCategories'),
  statSubCategories: document.getElementById('statSubCategories'),
  statCourts: document.getElementById('statCourts'),
  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  subCategoryFilter: document.getElementById('subCategoryFilter'),
  stageFilter: document.getElementById('stageFilter'),
  courtFilter: document.getElementById('courtFilter'),
  sortFilter: document.getElementById('sortFilter'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),
  openAddBtn: document.getElementById('openAddBtn'),
  resultCount: document.getElementById('resultCount'),
  activeFilters: document.getElementById('activeFilters'),
  cardsGrid: document.getElementById('cardsGrid'),
  pagination: document.getElementById('pagination'),
  detailModal: document.getElementById('detailModal'),
  detailTitle: document.getElementById('detailTitle'),
  detailMeta: document.getElementById('detailMeta'),
  detailIssue: document.getElementById('detailIssue'),
  detailHolding: document.getElementById('detailHolding'),
  detailTags: document.getElementById('detailTags'),
  detailNotes: document.getElementById('detailNotes'),
  detailRelatedDetails: document.getElementById('detailRelatedDetails'),
  detailSources: document.getElementById('detailSources'),
  relatedHint: document.getElementById('relatedHint'),
  relatedList: document.getElementById('relatedList'),
  copyDetailBtn: document.getElementById('copyDetailBtn'),
  editDetailBtn: document.getElementById('editDetailBtn'),
  deleteDetailBtn: document.getElementById('deleteDetailBtn'),
  editorModal: document.getElementById('editorModal'),
  rulingForm: document.getElementById('rulingForm'),
  editorMode: document.getElementById('editorMode'),
  editorTitle: document.getElementById('editorTitle'),
  saveRulingBtn: document.getElementById('saveRulingBtn'),
  caseReferenceInput: document.getElementById('caseReferenceInput'),
  issueInput: document.getElementById('issueInput'),
  holdingInput: document.getElementById('holdingInput'),
  categoryInput: document.getElementById('categoryInput'),
  subCategoryInput: document.getElementById('subCategoryInput'),
  stageInput: document.getElementById('stageInput'),
  courtInput: document.getElementById('courtInput'),
  yearInput: document.getElementById('yearInput'),
  tagsInput: document.getElementById('tagsInput'),
  notesInput: document.getElementById('notesInput'),
  relatedDetailsInput: document.getElementById('relatedDetailsInput'),
  toastWrap: document.getElementById('toastWrap')
};

init();

async function init() {
  applyTheme(getInitialTheme());
  bindEvents();
  await loadData();
}

async function loadData() {
  try {
    const [dataResponse, relatedResponse] = await Promise.all([
      fetch(DATA_URL, { cache: 'no-store' }),
      fetch(RELATED_URL, { cache: 'no-store' }).catch(() => null)
    ]);

    if (!dataResponse.ok) {
      throw new Error('Could not load rulings data.');
    }

    const payload = await dataResponse.json();
    const relatedPayload = relatedResponse && relatedResponse.ok
      ? await relatedResponse.json()
      : {};

    state.baseEntries = (payload.entries || []).map(normalizeEntry);
    state.relatedMap = relatedPayload.related || {};
    state.local = readLocalState();
    rebuildEntries();
    populateFilters();
    renderAll();
    showToast('Atlas Ready', `${state.entries.length} ruilings loaded into the workspace.`);
  } catch (error) {
    console.error(error);
    els.resultCount.textContent = 'Unable to load rulings.';
    els.cardsGrid.innerHTML = '<div class="empty-state">Could not load the rulings dataset. Please try again later.</div>';
  }
}

function bindEvents() {
  els.themeToggle.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });

  els.exportBtn.addEventListener('click', exportData);
  els.searchInput.addEventListener('input', debounce(() => {
    state.search = normalizeSearch(els.searchInput.value);
    state.page = 1;
    renderAll();
  }, 160));

  els.categoryFilter.addEventListener('change', () => {
    state.category = els.categoryFilter.value;
    state.subCategory = 'all';
    state.page = 1;
    updateSubCategoryFilter();
    renderAll();
  });

  [els.subCategoryFilter, els.stageFilter, els.courtFilter, els.sortFilter].forEach((element) => {
    element.addEventListener('change', () => {
      state.subCategory = els.subCategoryFilter.value;
      state.stage = els.stageFilter.value;
      state.court = els.courtFilter.value;
      state.sort = els.sortFilter.value;
      state.page = 1;
      renderAll();
    });
  });

  els.resetFiltersBtn.addEventListener('click', () => {
    resetFilters();
    renderAll();
  });

  els.openAddBtn.addEventListener('click', () => openEditor());

  els.cardsGrid.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    const card = event.target.closest('.ruling-card');

    if (button?.dataset.action === 'view') openDetail(Number(button.dataset.id));
    if (button?.dataset.action === 'edit') openEditor(Number(button.dataset.id));
    if (button?.dataset.action === 'delete') deleteEntry(Number(button.dataset.id));
    if (button?.dataset.action === 'copy') {
      const entry = findEntry(Number(button.dataset.id));
      if (entry) await copyCitation(entry.caseReference);
    }
    if (!button && card) openDetail(Number(card.dataset.id));
  });

  els.pagination.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-page]');
    if (!button) return;
    state.page = Number(button.dataset.page);
    renderCards();
    renderPagination();
    window.scrollTo({ top: document.getElementById('workspace').offsetTop - 80, behavior: 'smooth' });
  });

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => closeModal(button.dataset.closeModal));
  });

  els.copyDetailBtn.addEventListener('click', async () => {
    const entry = findEntry(state.currentDetailId);
    if (entry) await copyCitation(entry.caseReference);
  });
  els.editDetailBtn.addEventListener('click', () => openEditor(state.currentDetailId));
  els.deleteDetailBtn.addEventListener('click', () => deleteEntry(state.currentDetailId));
  els.rulingForm.addEventListener('submit', saveEditorEntry);
}

function normalizeEntry(entry) {
  const id = Number(entry.id || entry.serial || Date.now());
  return {
    id,
    serial: Number(entry.serial || id),
    caseReference: oneLine(entry.caseReference || 'Untitled ruling'),
    issue: cleanText(entry.issue || ''),
    holding: cleanText(entry.holding || ''),
    category: oneLine(entry.category || 'General Litigation Principles'),
    subCategory: oneLine(entry.subCategory || 'General legal principles'),
    court: oneLine(entry.court || 'Reported Court (See citation)'),
    year: parseYear(entry.year),
    stage: oneLine(entry.stage || 'Initial assessment'),
    statuteTags: uniqueList(entry.statuteTags || []),
    advocateNotes: uniqueList(entry.advocateNotes || DEFAULT_NOTES),
    relatedDetails: uniqueList(entry.relatedDetails || []),
    researchSources: uniqueList(entry.researchSources || []),
    localDraft: Boolean(entry.localDraft)
  };
}

function rebuildEntries() {
  const deletedIds = new Set((state.local.deletedIds || []).map(Number));
  const byId = new Map();

  state.baseEntries.forEach((entry) => {
    if (!deletedIds.has(Number(entry.id))) {
      byId.set(Number(entry.id), entry);
    }
  });

  Object.values(state.local.upserts || {}).forEach((entry) => {
    const normalized = normalizeEntry({ ...entry, localDraft: true });
    if (!deletedIds.has(Number(normalized.id))) {
      byId.set(Number(normalized.id), normalized);
    }
  });

  state.entries = [...byId.values()];
}

function populateFilters() {
  setOptions(els.categoryFilter, 'All categories', uniqueSorted(state.entries.map((entry) => entry.category)));
  els.categoryFilter.value = state.category;
  if (els.categoryFilter.value !== state.category) {
    state.category = 'all';
    els.categoryFilter.value = 'all';
  }
  updateSubCategoryFilter();
  setOptions(els.stageFilter, 'All stages', uniqueSorted(state.entries.map((entry) => entry.stage)));
  els.stageFilter.value = state.stage;
  if (els.stageFilter.value !== state.stage) {
    state.stage = 'all';
    els.stageFilter.value = 'all';
  }
  setOptions(els.courtFilter, 'All courts', uniqueSorted(state.entries.map((entry) => entry.court)));
  els.courtFilter.value = state.court;
  if (els.courtFilter.value !== state.court) {
    state.court = 'all';
    els.courtFilter.value = 'all';
  }
}

function updateSubCategoryFilter() {
  const pool = state.category === 'all'
    ? state.entries
    : state.entries.filter((entry) => entry.category === state.category);
  setOptions(els.subCategoryFilter, 'All sub-categories', uniqueSorted(pool.map((entry) => entry.subCategory)));
  els.subCategoryFilter.value = state.subCategory;
  if (els.subCategoryFilter.value !== state.subCategory) {
    state.subCategory = 'all';
  }
}

function setOptions(select, allLabel, values) {
  select.innerHTML = `<option value="all">${escapeHtml(allLabel)}</option>${values
    .map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`)
    .join('')}`;
}

function renderAll() {
  applyFilters();
  renderStats();
  renderActiveFilters();
  renderCards();
  renderPagination();
}

function applyFilters() {
  const query = state.search;
  let out = [...state.entries];

  if (query) {
    out = out.filter((entry) => searchableText(entry).includes(query));
  }
  if (state.category !== 'all') out = out.filter((entry) => entry.category === state.category);
  if (state.subCategory !== 'all') out = out.filter((entry) => entry.subCategory === state.subCategory);
  if (state.stage !== 'all') out = out.filter((entry) => entry.stage === state.stage);
  if (state.court !== 'all') out = out.filter((entry) => entry.court === state.court);

  out.sort((a, b) => {
    if (state.sort === 'serial-desc') return (b.serial || 0) - (a.serial || 0);
    if (state.sort === 'year-desc') return (b.year || 0) - (a.year || 0);
    if (state.sort === 'year-asc') return (a.year || 0) - (b.year || 0);
    return (a.serial || 0) - (b.serial || 0);
  });

  state.filtered = out;
  const maxPage = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
  state.page = Math.min(state.page, maxPage);
}

function renderStats() {
  els.statEntries.textContent = state.entries.length;
  els.statCategories.textContent = uniqueSorted(state.entries.map((entry) => entry.category)).length;
  els.statSubCategories.textContent = uniqueSorted(state.entries.map((entry) => entry.subCategory)).length;
  els.statCourts.textContent = uniqueSorted(state.entries.map((entry) => entry.court)).length;
  els.resultCount.textContent = `${state.filtered.length} ${state.filtered.length === 1 ? 'ruiling' : 'ruilings'} found`;
}

function renderActiveFilters() {
  const filters = [];
  if (state.search) filters.push(`Search: ${state.search}`);
  if (state.category !== 'all') filters.push(state.category);
  if (state.subCategory !== 'all') filters.push(state.subCategory);
  if (state.stage !== 'all') filters.push(state.stage);
  if (state.court !== 'all') filters.push(state.court);

  els.activeFilters.innerHTML = filters.length
    ? filters.map((filter) => `<span class="filter-pill">${escapeHtml(filter)}</span>`).join('')
    : '<span class="filter-pill">No active filters</span>';
}

function renderCards() {
  const start = (state.page - 1) * PAGE_SIZE;
  const pageEntries = state.filtered.slice(start, start + PAGE_SIZE);

  if (!pageEntries.length) {
    els.cardsGrid.innerHTML = '<div class="empty-state">No ruilings match the current filters.</div>';
    return;
  }

  els.cardsGrid.innerHTML = pageEntries.map((entry) => {
    const tags = entry.statuteTags.slice(0, 4);
    return `
      <article class="ruling-card" data-id="${entry.id}" tabindex="0" aria-label="${escapeAttribute(entry.caseReference)}">
        <div class="card-top">
          <span class="serial-pill">#${String(entry.serial).padStart(3, '0')}</span>
          <span class="stage-pill">${escapeHtml(entry.stage)}</span>
        </div>
        <h3 class="ruling-title">${escapeHtml(entry.caseReference)}</h3>
        ${entry.localDraft ? '<span class="source-badge">Local Draft</span>' : ''}
        <div class="meta-row">
          <span>${escapeHtml(entry.court)}</span>
          <span>•</span>
          <span>${entry.year || 'Year not captured'}</span>
        </div>
        <p class="quicktake">${escapeHtml(truncate(entry.holding || entry.issue, 240))}</p>
        <div class="summary-grid">
          <div class="summary-box"><strong>Category</strong>${escapeHtml(entry.category)}</div>
          <div class="summary-box"><strong>Sub-category</strong>${escapeHtml(entry.subCategory)}</div>
        </div>
        <div class="tag-list">
          ${tags.length ? tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('') : '<span class="tag">No tags</span>'}
        </div>
        <div class="card-actions">
          <button class="mini-btn view" type="button" data-action="view" data-id="${entry.id}">View</button>
          <button class="mini-btn" type="button" data-action="copy" data-id="${entry.id}">Copy</button>
          <button class="mini-btn" type="button" data-action="edit" data-id="${entry.id}">Edit</button>
          <button class="mini-btn delete" type="button" data-action="delete" data-id="${entry.id}">Delete</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
  if (totalPages <= 1) {
    els.pagination.innerHTML = '';
    return;
  }

  const pages = getVisiblePages(totalPages, state.page);
  els.pagination.innerHTML = `
    <button class="page-btn" type="button" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>‹</button>
    ${pages.map((page) => page === '…'
      ? '<button class="page-btn" type="button" disabled>…</button>'
      : `<button class="page-btn ${page === state.page ? 'active' : ''}" type="button" data-page="${page}">${page}</button>`
    ).join('')}
    <button class="page-btn" type="button" data-page="${state.page + 1}" ${state.page === totalPages ? 'disabled' : ''}>›</button>
  `;
}

function openDetail(entryId) {
  const entry = findEntry(entryId);
  if (!entry) return;

  state.currentDetailId = entry.id;
  els.detailTitle.textContent = `#${String(entry.serial).padStart(3, '0')} ${entry.caseReference}`;
  els.detailMeta.textContent = `${entry.court} | ${entry.year || 'Year not captured'} | ${entry.stage} | ${entry.category} -> ${entry.subCategory}`;
  els.detailIssue.textContent = entry.issue || 'Issue text is not available.';
  els.detailHolding.textContent = entry.holding || 'Holding text is not available.';
  els.detailTags.innerHTML = renderTagList(entry.statuteTags);
  els.detailNotes.innerHTML = renderList(entry.advocateNotes, 'No playbook notes added yet.');
  els.detailRelatedDetails.innerHTML = renderList(entry.relatedDetails, 'No counterpoints or related details added yet.');
  els.detailSources.innerHTML = renderSources(entry.researchSources);
  renderRelated(entry);
  openModal(els.detailModal);
}

function renderRelated(entry) {
  const related = getRelatedEntries(entry, 4);
  els.relatedHint.textContent = related.source === 'llm'
    ? 'Model-ranked companion authorities where available.'
    : 'Similarity-ranked companion authorities based on taxonomy, tags, and text.';

  if (!related.items.length) {
    els.relatedList.innerHTML = '<div class="empty-state">No companion authorities found.</div>';
    return;
  }

  els.relatedList.innerHTML = related.items.map((item) => `
    <button class="related-card" type="button" onclick="openDetail(${Number(item.id)})">
      <strong>#${String(item.serial).padStart(3, '0')} ${escapeHtml(item.caseReference)}</strong>
      <p>${escapeHtml(truncate(item.holding || item.issue, 170))}</p>
    </button>
  `).join('');
}

function getRelatedEntries(entry, limit) {
  const id = Number(entry.id);
  const raw = state.relatedMap[id] || state.relatedMap[String(id)];
  if (Array.isArray(raw) && raw.length) {
    const items = raw.map((relatedId) => findEntry(Number(relatedId))).filter(Boolean).slice(0, limit);
    if (items.length) return { source: 'llm', items };
  }

  const baseTags = new Set(entry.statuteTags.map((tag) => tag.toLowerCase()));
  const baseWords = keywordSet([entry.issue, entry.holding, entry.category, entry.subCategory].join(' '));

  const items = state.entries
    .filter((candidate) => Number(candidate.id) !== id)
    .map((candidate) => {
      let score = 0;
      if (candidate.category === entry.category) score += 7;
      if (candidate.subCategory === entry.subCategory) score += 5;
      if (candidate.stage === entry.stage) score += 2;
      if (candidate.court === entry.court) score += 1;
      score += intersectionSize(baseTags, new Set(candidate.statuteTags.map((tag) => tag.toLowerCase()))) * 2;
      score += intersectionSize(baseWords, keywordSet([candidate.issue, candidate.holding].join(' '))) * 0.35;
      return { candidate, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.serial - b.candidate.serial)
    .slice(0, limit)
    .map((item) => item.candidate);

  return { source: 'fallback', items };
}

function openEditor(entryId = null) {
  const entry = entryId ? findEntry(entryId) : null;
  state.editingId = entry ? Number(entry.id) : null;
  els.editorMode.textContent = entry ? 'Edit Mode' : 'Add Mode';
  els.editorTitle.textContent = entry ? 'Edit Ruiling' : 'Add Ruiling';
  els.saveRulingBtn.textContent = entry ? 'Save Changes' : 'Add Ruiling';

  els.caseReferenceInput.value = entry?.caseReference || '';
  els.issueInput.value = entry?.issue || '';
  els.holdingInput.value = entry?.holding || '';
  els.categoryInput.value = entry?.category || '';
  els.subCategoryInput.value = entry?.subCategory || '';
  els.stageInput.value = entry?.stage || '';
  els.courtInput.value = entry?.court || '';
  els.yearInput.value = entry?.year || '';
  els.tagsInput.value = (entry?.statuteTags || []).join(', ');
  els.notesInput.value = (entry?.advocateNotes || []).join('\n');
  els.relatedDetailsInput.value = (entry?.relatedDetails || []).join('\n');

  closeModal('detailModal');
  openModal(els.editorModal);
}

function saveEditorEntry(event) {
  event.preventDefault();

  const caseReference = cleanText(els.caseReferenceInput.value);
  const issue = cleanText(els.issueInput.value);
  const holding = cleanText(els.holdingInput.value);

  if (!caseReference || !issue || !holding) {
    showToast('Required Fields Missing', 'Case reference, verdict/issue, and impact/holding are required.');
    return;
  }

  const id = state.editingId || nextEntryId();
  const existing = findEntry(id);
  const entry = normalizeEntry({
    id,
    serial: existing?.serial || nextSerial(),
    caseReference,
    issue,
    holding,
    category: els.categoryInput.value || inferCategory(issue, holding),
    subCategory: els.subCategoryInput.value || 'General legal principles',
    stage: els.stageInput.value || 'Initial assessment',
    court: els.courtInput.value || inferCourt(caseReference),
    year: els.yearInput.value || inferYear(caseReference),
    statuteTags: splitCommaList(els.tagsInput.value),
    advocateNotes: splitLineList(els.notesInput.value),
    relatedDetails: splitLineList(els.relatedDetailsInput.value),
    researchSources: existing?.researchSources || [],
    localDraft: true
  });

  state.local.deletedIds = (state.local.deletedIds || []).filter((deletedId) => Number(deletedId) !== Number(id));
  state.local.upserts[String(id)] = entry;
  writeLocalState();
  rebuildEntries();
  populateFilters();
  renderAll();
  closeModal('editorModal');
  showToast(state.editingId ? 'Ruiling Updated' : 'Ruiling Added', 'Your changes were saved in this browser.');
}

function deleteEntry(entryId) {
  const entry = findEntry(entryId);
  if (!entry) return;
  const confirmed = window.confirm(`Delete this ruiling?\n\n${entry.caseReference}\n\nThis will remove it from this browser workspace.`);
  if (!confirmed) return;

  delete state.local.upserts[String(entry.id)];
  if (!state.local.deletedIds.includes(Number(entry.id))) {
    state.local.deletedIds.push(Number(entry.id));
  }
  writeLocalState();
  rebuildEntries();
  populateFilters();
  renderAll();
  closeModal('detailModal');
  showToast('Ruiling Deleted', 'The ruiling was removed from this browser workspace.');
}

async function copyCitation(citation) {
  try {
    await navigator.clipboard.writeText(citation);
    showToast('Citation Copied', citation);
  } catch (error) {
    const textArea = document.createElement('textarea');
    textArea.value = citation;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
    showToast('Citation Copied', citation);
  }
}

function exportData() {
  const payload = {
    meta: {
      exportedOn: new Date().toISOString(),
      totalEntries: state.entries.length,
      note: 'Exported from Premium Rulings Atlas local browser workspace.'
    },
    entries: state.entries
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rulings-atlas-export.json';
  link.click();
  URL.revokeObjectURL(url);
  showToast('Export Ready', 'The current atlas data was exported as JSON.');
}

function resetFilters() {
  state.search = '';
  state.category = 'all';
  state.subCategory = 'all';
  state.stage = 'all';
  state.court = 'all';
  state.sort = 'serial-asc';
  state.page = 1;
  els.searchInput.value = '';
  els.categoryFilter.value = 'all';
  updateSubCategoryFilter();
  els.stageFilter.value = 'all';
  els.courtFilter.value = 'all';
  els.sortFilter.value = 'serial-asc';
}

function openModal(modal) {
  if (!modal.open) modal.showModal();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal?.open) modal.close();
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  els.themeIcon.textContent = theme === 'dark' ? '☀' : '☾';
  els.themeLabel.textContent = theme === 'dark' ? 'Light' : 'Dark';
  els.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

function getInitialTheme() {
  return localStorage.getItem(THEME_KEY)
    || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function readLocalState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      upserts: parsed.upserts && typeof parsed.upserts === 'object' ? parsed.upserts : {},
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []
    };
  } catch (error) {
    return { upserts: {}, deletedIds: [] };
  }
}

function writeLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.local));
}

function findEntry(entryId) {
  return state.entries.find((entry) => Number(entry.id) === Number(entryId));
}

function nextEntryId() {
  return Math.max(0, ...state.entries.map((entry) => Number(entry.id) || 0)) + 1;
}

function nextSerial() {
  return Math.max(0, ...state.entries.map((entry) => Number(entry.serial) || 0)) + 1;
}

function renderTagList(tags) {
  return tags.length
    ? tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')
    : '<span class="tag">No section tags available</span>';
}

function renderList(items, emptyText) {
  return items.length
    ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : `<li>${escapeHtml(emptyText)}</li>`;
}

function renderSources(sources) {
  return sources.length
    ? sources.slice(0, 8).map((url, index) => `<a class="source-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">Source ${index + 1}: ${escapeHtml(shortUrl(url))}</a>`).join('')
    : '<p class="muted">No web references captured for this entry.</p>';
}

function showToast(title, message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(truncate(message, 180))}</span>`;
  els.toastWrap.appendChild(toast);
  setTimeout(() => toast.remove(), 3400);
}

function getVisiblePages(totalPages, currentPage) {
  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) out.push('…');
    out.push(page);
  });
  return out;
}

function searchableText(entry) {
  return normalizeSearch([
    entry.caseReference,
    entry.issue,
    entry.holding,
    entry.category,
    entry.subCategory,
    entry.court,
    entry.stage,
    entry.statuteTags.join(' '),
    entry.advocateNotes.join(' ')
  ].join(' '));
}

function keywordSet(text) {
  const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'from', 'this', 'into', 'under', 'while', 'where', 'which', 'there', 'shall', 'would', 'after', 'before', 'against', 'case', 'cases', 'court', 'section', 'sections', 'code', 'act']);
  return new Set(normalizeSearch(text).split(/\s+/).filter((word) => word.length > 2 && !stopWords.has(word)));
}

function intersectionSize(setA, setB) {
  let count = 0;
  setA.forEach((value) => {
    if (setB.has(value)) count += 1;
  });
  return count;
}

function inferCategory(issue, holding) {
  const text = normalizeSearch(`${issue} ${holding}`);
  if (text.includes('criminal') || text.includes('crpc') || text.includes('bail')) return 'Criminal Procedure & Trial';
  if (text.includes('maintenance') || text.includes('marriage') || text.includes('divorce')) return 'Family & Matrimonial Law';
  if (text.includes('evidence') || text.includes('witness') || text.includes('proof')) return 'Evidence Law & Trial Proof';
  if (text.includes('property') || text.includes('tenancy') || text.includes('land')) return 'Property, Land & Tenancy';
  return 'General Litigation Principles';
}

function inferCourt(caseReference) {
  const text = normalizeSearch(caseReference);
  if (text.includes('supreme court') || text.includes(' scc ') || text.includes(' sc ')) return 'Supreme Court';
  if (text.includes('calcutta') || text.includes(' cal ')) return 'Calcutta High Court';
  if (text.includes('high court')) return 'High Court';
  return 'Reported Court (See citation)';
}

function inferYear(text) {
  const match = String(text || '').match(/\b(18|19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function parseYear(value) {
  const year = Number(value);
  return Number.isFinite(year) && year >= 1800 && year <= 2100 ? Math.trunc(year) : null;
}

function splitCommaList(value) {
  return uniqueList(String(value || '').split(','));
}

function splitLineList(value) {
  return uniqueList(String(value || '').split(/\n+/));
}

function uniqueList(items) {
  const seen = new Set();
  const out = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    const text = oneLine(item);
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      out.push(text);
    }
  });
  return out;
}

function uniqueSorted(items) {
  return uniqueList(items).sort((a, b) => a.localeCompare(b));
}

function cleanText(value) {
  return String(value || '').trim();
}

function oneLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeSearch(value) {
  return oneLine(value).toLowerCase();
}

function truncate(value, maxLength) {
  const text = oneLine(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function shortUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.length > 34 ? `${parsed.pathname.slice(0, 31)}…` : parsed.pathname;
    return `${parsed.hostname.replace(/^www\./, '')}${path}`;
  } catch (error) {
    return url;
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function debounce(fn, delay) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

window.openDetail = openDetail;
