const state = {
  user: null,
  csrfToken: '',
  feedPage: 1,
  loadingFeed: false,
  currentCategory: null,
  map: null,
  categories: [
    { id: 'nature', name: 'NATURE', phrase: 'Mountains, forests, waterfalls, and wildlife.', image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=80' },
    { id: 'cities', name: 'CITIES', phrase: 'Skylines, streets, and urban stories.', image: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1000&q=80' },
    { id: 'architecture', name: 'ARCHITECTURE', phrase: 'Historic landmarks and modern design.', image: 'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1000&q=80' },
    { id: 'beaches', name: 'BEACHES', phrase: 'Coastal sunsets and island shores.', image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1000&q=80' },
    { id: 'oceans', name: 'OCEANS', phrase: 'Deep-blue waters and marine horizons.', image: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1000&q=80' },
    { id: 'hidden-gems', name: 'HIDDEN GEMS', phrase: 'Quiet villages and remote discoveries.', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=80' }
  ]
};

const appSections = ['home', 'explore', 'category-view', 'photo-detail', 'upload', 'map', 'community', 'profile'];
const get = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.csrfToken) headers['x-csrf-token'] = state.csrfToken;
  const res = await fetch(path, { credentials: 'include', headers, ...options });
  if (!res.ok) {
    let message = 'Request failed';
    try {
      const err = await res.json();
      message = err.error || message;
    } catch (_e) {}
    throw new Error(message);
  }
  return res.json();
}

function notify(msg) {
  window.alert(msg);
}

function renderAuthActions() {
  const node = get('auth-actions');
  if (!state.user) {
    node.innerHTML = `<button class="ghost-btn" id="open-login">Log in</button><button class="primary-btn" id="open-register">Register</button>`;
    document.getElementById('open-login').onclick = () => openAuthModal('login');
    document.getElementById('open-register').onclick = () => openAuthModal('register');
    return;
  }
  node.innerHTML = `<span>@${state.user.username}</span><button class="ghost-btn" id="logout">Logout</button>`;
  document.getElementById('logout').onclick = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    state.user = null;
    renderAuthActions();
    route();
  };
}

function openAuthModal(type = 'login') {
  const isLogin = type === 'login';
  const html = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.7);display:grid;place-items:center;z-index:2000" id="auth-modal">
      <form id="auth-form" style="width:min(95vw,420px);background:#121820;padding:1rem;border-radius:12px">
        <h3>${isLogin ? 'Log in' : 'Create account'}</h3>
        <input required name="username" placeholder="Username" pattern="[A-Za-z0-9_]{3,30}" />
        <input required name="password" type="password" minlength="8" placeholder="Password" />
        ${isLogin ? '' : '<input name="country" placeholder="Country (optional)" />'}
        <div style="display:flex;gap:.5rem;margin-top:.8rem"><button class="primary-btn" type="submit">${isLogin ? 'Log in' : 'Register'}</button><button class="ghost-btn" type="button" id="close-auth">Cancel</button></div>
      </form>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('close-auth').onclick = () => document.getElementById('auth-modal').remove();
  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    try {
      const data = await api(`/api/auth/${isLogin ? 'login' : 'register'}`, { method: 'POST', body: JSON.stringify(payload) });
      state.user = data.user;
      renderAuthActions();
      document.getElementById('auth-modal').remove();
      route();
    } catch (error) {
      notify(error.message);
    }
  };
}

function hideAllSections() {
  appSections.forEach((id) => get(id).classList.add('hidden'));
}

function reveal(...ids) {
  ids.forEach((id) => get(id).classList.remove('hidden'));
}

function photoCard(photo) {
  const tpl = document.getElementById('photo-card-template').content.cloneNode(true);
  tpl.querySelector('img').src = photo.image_url;
  tpl.querySelector('img').alt = `${photo.title} in ${photo.city || photo.country}`;
  tpl.querySelector('h3').textContent = photo.title;
  tpl.querySelector('.location').textContent = `${photo.city ? `${photo.city}, ` : ''}${photo.country}`;
  tpl.querySelector('.contributor').textContent = `by @${photo.username}`;
  tpl.querySelector('.photo-click').onclick = () => {
    location.hash = `photo/${photo.id}`;
  };
  return tpl;
}

async function loadFeed(append = false) {
  if (state.loadingFeed) return;
  state.loadingFeed = true;
  try {
    const data = await api(`/api/photos?page=${state.feedPage}&limit=9&sort=random`);
    const grid = get('feed-grid');
    if (!append) grid.innerHTML = '';
    data.photos.forEach((photo) => grid.append(photoCard(photo)));
    get('load-more').style.display = data.hasMore ? 'inline-block' : 'none';
  } finally {
    state.loadingFeed = false;
  }
}

function renderExplore() {
  const wrap = get('category-cards');
  wrap.innerHTML = '';
  state.categories.forEach((c) => {
    const card = document.createElement('button');
    card.className = 'category-card';
    card.innerHTML = `<img src="${c.image}" alt="${c.name}" /><div class="overlay"><h3>${c.name}</h3><p>${c.phrase}</p></div>`;
    card.onclick = () => { location.hash = `category/${c.id}`; };
    wrap.append(card);
  });
}

async function renderCategory(categoryId) {
  const host = get('category-view');
  const found = state.categories.find((x) => x.id === categoryId);
  if (!found) return;
  const params = new URLSearchParams(location.search);
  const country = params.get('country') || '';
  const city = params.get('city') || '';
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'recent';
  const data = await api(`/api/photos?category=${categoryId}&country=${encodeURIComponent(country)}&city=${encodeURIComponent(city)}&q=${encodeURIComponent(q)}&sort=${sort === 'recent' ? '' : sort}&limit=18`);

  host.innerHTML = '';
  const title = document.createElement('h2');
  title.textContent = found.name;
  const phrase = document.createElement('p');
  phrase.textContent = found.phrase;

  const form = document.createElement('form');
  form.id = 'filters';
  form.className = 'filters';
  form.innerHTML = `
    <input name="country" placeholder="Country" />
    <input name="city" placeholder="City or region" />
    <input name="q" placeholder="Search title/tags" />
    <select name="sort">
      <option value="recent">Recently uploaded</option>
      <option value="most-liked">Most liked</option>
      <option value="popular">Popular destinations</option>
    </select>
    <button class="primary-btn" type="submit">Apply</button>
  `;
  form.country.value = country;
  form.city.value = city;
  form.q.value = q;
  form.sort.value = ['recent', 'most-liked', 'popular'].includes(sort) ? sort : 'recent';

  const grid = document.createElement('div');
  grid.className = 'masonry-grid';
  grid.id = 'category-grid';

  host.append(title, phrase, form, grid);

  form.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const next = new URLSearchParams(fd);
    history.replaceState(null, '', `${location.pathname}#category/${categoryId}?${next.toString()}`);
    route();
  };
  data.photos.forEach((photo) => grid.append(photoCard(photo)));
}

async function renderPhotoDetail(id) {
  const host = get('photo-detail');
  const { photo, comments, related } = await api(`/api/photos/${id}`);
  host.innerHTML = `
    <img class="hero" src="${esc(photo.image_url)}" alt="${esc(photo.title)}" />
    <h2>${esc(photo.title)}</h2>
    <p>${esc(photo.description || '')}</p>
    <p><strong>Location:</strong> ${esc(photo.city ? `${photo.city}, ` : '')}${esc(photo.country)}</p>
    <p><strong>Category:</strong> ${esc(photo.category.toUpperCase())}</p>
    <p><strong>Contributor:</strong> <a href="#profile/${encodeURIComponent(photo.username)}">@${esc(photo.username)}</a></p>
    <p><strong>Uploaded:</strong> ${new Date(photo.created_at).toLocaleString()}</p>
    <div class="actions">
      <button id="like-btn" class="ghost-btn">${photo.liked ? 'Unlike' : 'Like'} (${photo.likes_count})</button>
      <button id="save-btn" class="ghost-btn">${photo.saved ? 'Unsave' : 'Save'}</button>
      <button id="report-btn" class="ghost-btn">Report</button>
      <button id="random-btn" class="primary-btn">Random Discovery</button>
    </div>
    <h3>Comments</h3>
    ${state.user ? `<form id="comment-form"><textarea name="content" placeholder="Share your thoughts..."></textarea><button class="primary-btn" type="submit">Post comment</button></form>` : '<p>Log in to comment.</p>'}
    <div class="comments">${comments.map((c) => `<div class="comment"><strong>@${esc(c.username)}</strong><p>${esc(c.content)}</p></div>`).join('')}</div>
    <h3>MORE WONDERS TO EXPLORE</h3>
    <div class="masonry-grid" id="related-grid"></div>
  `;

  const relatedGrid = host.querySelector('#related-grid');
  related.forEach((p) => relatedGrid.append(photoCard(p)));

  host.querySelector('#random-btn').onclick = async () => {
    const data = await api('/api/photos/random?limit=1');
    if (data.photos[0]) location.hash = `photo/${data.photos[0].id}`;
  };

  host.querySelector('#report-btn').onclick = async () => {
    const reason = window.prompt('Report reason');
    if (!reason) return;
    await api(`/api/photos/${id}/report`, { method: 'POST', body: JSON.stringify({ reason }) });
    notify('Report submitted.');
  };

  if (state.user) {
    host.querySelector('#like-btn').onclick = async () => {
      await api(`/api/photos/${id}/like`, { method: 'POST' });
      route();
    };
    host.querySelector('#save-btn').onclick = async () => {
      await api(`/api/photos/${id}/save`, { method: 'POST' });
      route();
    };
    const form = host.querySelector('#comment-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const content = new FormData(form).get('content');
        await api(`/api/photos/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
        route();
      };
    }
  }
}

function renderUploadPanel() {
  const host = get('upload');
  host.innerHTML = `
    <h2>Upload a New Wonder</h2>
    <p>Supported formats: JPG, JPEG, PNG, WebP.</p>
    ${state.user ? `
      <form id="upload-form" enctype="multipart/form-data">
        <input required type="file" name="photo" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" />
        <img id="upload-preview" style="max-width:280px;display:none;border-radius:10px;margin:.5rem 0" alt="Preview" />
        <input required name="title" maxlength="120" placeholder="Photograph title" />
        <textarea name="description" maxlength="500" placeholder="Short description"></textarea>
        <select name="category" required>${state.categories.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
        <input required name="country" placeholder="Country" />
        <input name="city" placeholder="City or location" />
        <input name="tags" placeholder="Optional tags (comma separated)" />
        <select name="locationVisibility"><option value="approximate">Show approximate location</option><option value="hidden">Hide precise location</option></select>
        <input name="lat" type="number" step="any" placeholder="Approx latitude (optional)" />
        <input name="lng" type="number" step="any" placeholder="Approx longitude (optional)" />
        <button class="primary-btn" type="submit">Upload</button>
      </form>
      <progress id="upload-progress" value="0" max="100" style="width:min(100%,320px);display:none"></progress>
      <div id="upload-msg"></div>
    ` : '<p>Please log in to upload photos.</p>'}
  `;

  const form = host.querySelector('#upload-form');
  if (!form) return;

  const preview = host.querySelector('#upload-preview');
  form.photo.onchange = () => {
    const file = form.photo.files[0];
    if (!file) return;
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const progress = host.querySelector('#upload-progress');
    const msg = host.querySelector('#upload-msg');
    progress.style.display = 'block';
    progress.value = 0;

    const req = new XMLHttpRequest();
    req.open('POST', '/api/photos', true);
    req.withCredentials = true;
    if (state.csrfToken) req.setRequestHeader('x-csrf-token', state.csrfToken);
    req.upload.onprogress = (ev) => {
      if (ev.lengthComputable) progress.value = Math.round((ev.loaded * 100) / ev.total);
    };
    req.onload = () => {
      if (req.status >= 200 && req.status < 300) {
        msg.textContent = 'Upload complete and sent for moderation.';
        form.reset();
        preview.style.display = 'none';
      } else {
        msg.textContent = 'Upload failed.';
      }
    };
    req.send(fd);
  };
}

async function renderMap() {
  const host = get('map');
  host.innerHTML = `<h2>Interactive World Map</h2><p>Browse approved photographs geographically.</p><div id="world-map"></div>`;
  const data = await api('/api/map/markers');
  if (!state.map) {
    state.map = L.map('world-map').setView([22, 10], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(state.map);
  } else {
    state.map.remove();
    state.map = L.map('world-map').setView([22, 10], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(state.map);
  }

  data.markers.forEach((m) => {
    L.marker([m.lat, m.lng]).addTo(state.map)
      .bindPopup(`<strong>${m.city ? `${m.city}, ` : ''}${m.country}</strong><br/>${m.photo_count} photo(s)<br/><a href="#category/nature">Explore</a>`);
  });
}

async function renderCommunity() {
  const host = get('community');
  const around = await api('/api/discovery/around-world');
  const wonder = await api('/api/discovery/wonder-of-day');
  host.innerHTML = `
    <h2>Community Discovery</h2>
    <p>Wonder of the Day</p>
    ${wonder.photo ? `<article class="photo-card"><img src="${esc(wonder.photo.image_url)}" alt="${esc(wonder.photo.title)}"><div class="meta"><h3>${esc(wonder.photo.title)}</h3><p>${esc(wonder.photo.country)}</p></div></article>` : '<p>No photo yet.</p>'}
    <h3>Around the World</h3>
    <div class="masonry-grid" id="around-grid"></div>
  `;
  const grid = host.querySelector('#around-grid');
  around.photos.forEach((p) => grid.append(photoCard(p)));
}

async function renderProfile(username) {
  const host = get('profile');
  if (!username) {
    if (!state.user) {
      host.innerHTML = '<h2>Profile</h2><p>Please log in to view your profile.</p>';
      return;
    }
    username = state.user.username;
  }
  try {
    const data = await api(`/api/users/${username}`);
    const canFollow = state.user && state.user.username !== username;
    host.innerHTML = `
      <h2>@${esc(data.user.username)}</h2>
      ${data.user.avatar_url ? `<img src="${esc(data.user.avatar_url)}" alt="${esc(data.user.username)}" width="72" height="72" style="border-radius:50%"/>` : ''}
      <p>${esc(data.user.bio || 'No bio yet.')}</p>
      <p>${esc(data.user.country || 'Location hidden')}</p>
      <p>${data.followers} followers • ${data.following} following</p>
      ${canFollow ? `<button class="ghost-btn" id="follow-btn">${data.isFollowing ? 'Unfollow' : 'Follow'}</button>` : ''}
      ${state.user && state.user.username === username ? '<h3>Saved Wonders</h3><div id="saved-grid" class="masonry-grid"></div>' : ''}
      <h3>Uploaded Photographs</h3>
      <div id="profile-grid" class="masonry-grid"></div>
    `;

    const profileGrid = host.querySelector('#profile-grid');
    data.uploads.forEach((p) => profileGrid.append(photoCard({ ...p, username })));

    if (canFollow) {
      host.querySelector('#follow-btn').onclick = async () => {
        await api(`/api/users/${username}/follow`, { method: 'POST' });
        route();
      };
    }

    if (state.user && state.user.username === username) {
      const saved = await api('/api/saved');
      const savedGrid = host.querySelector('#saved-grid');
      saved.photos.forEach((p) => savedGrid.append(photoCard(p)));
    }
  } catch (error) {
    host.innerHTML = `<h2>Profile</h2><p>${error.message}</p>`;
  }
}

async function route() {
  hideAllSections();
  const hash = location.hash.replace(/^#/, '') || 'home';

  if (hash === 'home') {
    reveal('home');
    get('explore').classList.add('hidden');
    state.feedPage = 1;
    await loadFeed(false);
    return;
  }

  if (hash === 'explore') {
    reveal('home', 'explore');
    get('home').classList.add('hidden');
    renderExplore();
    return;
  }

  if (hash.startsWith('category/')) {
    reveal('category-view');
    const categoryId = hash.split('/')[1].split('?')[0];
    await renderCategory(categoryId);
    return;
  }

  if (hash.startsWith('photo/')) {
    reveal('photo-detail');
    await renderPhotoDetail(hash.split('/')[1]);
    return;
  }

  if (hash === 'upload') {
    reveal('upload');
    renderUploadPanel();
    return;
  }

  if (hash === 'map') {
    reveal('map');
    await renderMap();
    return;
  }

  if (hash === 'community') {
    reveal('community');
    await renderCommunity();
    return;
  }

  if (hash.startsWith('profile')) {
    reveal('profile');
    const username = hash.split('/')[1];
    await renderProfile(username);
    return;
  }

  location.hash = 'home';
}

async function init() {
  const csrf = await api('/api/csrf', { headers: {} });
  state.csrfToken = csrf.csrfToken || '';
  const data = await api('/api/auth/me');
  state.user = data.user;
  renderAuthActions();
  renderExplore();
  get('wonder-entry').onclick = () => { location.hash = 'explore'; };
  get('load-more').onclick = async () => {
    state.feedPage += 1;
    await loadFeed(true);
  };

  get('menu-toggle').onclick = () => {
    get('main-nav').classList.toggle('open');
  };

  window.addEventListener('hashchange', route);
  await route();
}

init().catch((error) => {
  console.error(error);
  notify(error.message);
});
