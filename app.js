const els = {
  form: document.getElementById('connection-form'),
  host: document.getElementById('host'),
  apiKey: document.getElementById('api-key'),
  protocol: document.getElementById('protocol'),
  port: document.getElementById('port'),
  pathPrefix: document.getElementById('path-prefix'),
  status: document.getElementById('status'),
  disconnect: document.getElementById('disconnect'),
  refreshHealth: document.getElementById('refresh-health'),
  healthOk: document.getElementById('health-ok'),
  node: document.getElementById('node'),
  version: document.getElementById('version'),
  docsCount: document.getElementById('docs-count'),
  collectionsCount: document.getElementById('collections-count'),
  memory: document.getElementById('memory'),
  collectionList: document.getElementById('collection-list'),
  collectionTemplate: document.getElementById('collection-item-template'),
  selectedCollectionTitle: document.getElementById('selected-collection-title'),
  collectionSchema: document.getElementById('collection-schema'),
  query: document.getElementById('query'),
  queryBy: document.getElementById('query-by'),
  perPage: document.getElementById('per-page'),
  runSearch: document.getElementById('run-search'),
  searchResults: document.getElementById('search-results')
};

let selectedCollection = null;
let config = null;

function getBaseUrl() {
  const cleanHost = els.host.value.trim().replace(/\/$/, '');
  if (!cleanHost) return '';

  if (/^https?:\/\//.test(cleanHost)) {
    return `${cleanHost}${els.pathPrefix.value.trim()}`;
  }

  const prefix = els.pathPrefix.value.trim();
  return `${els.protocol.value}://${cleanHost}:${els.port.value}${prefix}`;
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.style.color = isError ? '#ff8f8f' : '#7dffa4';
}

function loadSavedConfig() {
  const raw = localStorage.getItem('typesense-monitor-config');
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    els.host.value = saved.host || '';
    els.apiKey.value = saved.apiKey || '';
    els.protocol.value = saved.protocol || 'https';
    els.port.value = saved.port || '443';
    els.pathPrefix.value = saved.pathPrefix || '';
  } catch {
    localStorage.removeItem('typesense-monitor-config');
  }
}

function saveConfig() {
  localStorage.setItem(
    'typesense-monitor-config',
    JSON.stringify({
      host: els.host.value,
      apiKey: els.apiKey.value,
      protocol: els.protocol.value,
      port: els.port.value,
      pathPrefix: els.pathPrefix.value
    })
  );
}

async function api(path, query = {}) {
  if (!config) throw new Error('Please connect first.');

  const url = new URL(`${config.baseUrl}${path}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    headers: {
      'X-TYPESENSE-API-KEY': config.apiKey
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }

  return response.json();
}

async function refreshHealth() {
  const [health, stats, collections] = await Promise.all([
    api('/health'),
    api('/stats.json'),
    api('/collections')
  ]);

  els.healthOk.textContent = health.ok ? 'OK' : 'NOT OK';
  els.node.textContent = stats.system_metrics?.hostname ?? '-';
  els.version.textContent = stats.typesense_version || '-';
  els.docsCount.textContent =
    stats.collection_stats?.reduce((sum, item) => sum + (item.num_documents || 0), 0) ?? '-';
  els.collectionsCount.textContent = collections.length;
  els.memory.textContent = stats.system_metrics?.memory_total_bytes
    ? `${Math.round(stats.system_metrics.memory_total_bytes / 1024 / 1024)} MB`
    : '-';

  return collections;
}

function renderCollections(collections) {
  els.collectionList.innerHTML = '';

  collections.forEach((collection) => {
    const node = els.collectionTemplate.content.cloneNode(true);
    const button = node.querySelector('button');
    button.textContent = `${collection.name} (${collection.num_documents ?? 0} docs)`;
    button.addEventListener('click', () => selectCollection(collection.name));
    els.collectionList.appendChild(node);
  });
}

async function selectCollection(name) {
  selectedCollection = name;
  els.selectedCollectionTitle.textContent = `Collection: ${name}`;

  const schema = await api(`/collections/${encodeURIComponent(name)}`);
  els.collectionSchema.textContent = JSON.stringify(schema, null, 2);

  if (!els.queryBy.value && Array.isArray(schema.fields)) {
    const textFields = schema.fields
      .filter((f) => typeof f.type === 'string' && f.type.includes('string'))
      .map((f) => f.name);
    els.queryBy.value = textFields.slice(0, 3).join(',');
  }
}

async function runSearch() {
  if (!selectedCollection) {
    throw new Error('Select a collection first.');
  }

  const result = await api(`/collections/${encodeURIComponent(selectedCollection)}/documents/search`, {
    q: els.query.value || '*',
    query_by: els.queryBy.value,
    per_page: els.perPage.value
  });

  els.searchResults.textContent = JSON.stringify(result, null, 2);
}

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  config = {
    baseUrl: getBaseUrl(),
    apiKey: els.apiKey.value.trim()
  };

  saveConfig();
  setStatus('Connecting...');

  try {
    const collections = await refreshHealth();
    renderCollections(collections);
    setStatus('Connected');
  } catch (error) {
    setStatus(error.message, true);
  }
});

els.disconnect.addEventListener('click', () => {
  config = null;
  selectedCollection = null;
  els.collectionList.innerHTML = '';
  els.collectionSchema.textContent = 'No collection selected.';
  els.searchResults.textContent = 'Search results will appear here.';
  setStatus('Disconnected.');
});

els.refreshHealth.addEventListener('click', async () => {
  try {
    const collections = await refreshHealth();
    renderCollections(collections);
    setStatus('Health refreshed.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

els.runSearch.addEventListener('click', async () => {
  try {
    await runSearch();
    setStatus('Search complete.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

loadSavedConfig();
