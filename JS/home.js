import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDsNtYcowBKtJw_doiE_JpV_d0KZaLMqA0",
  authDomain: "marketlocal-e4ab7.firebaseapp.com",
  projectId: "marketlocal-e4ab7",
  storageBucket: "marketlocal-e4ab7.firebasestorage.app",
  messagingSenderId: "257007076578",
  appId: "1:257007076578:web:5e8897d117868494cf8abb"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser = null;
let currentCat  = 'all';
let allListings = [];
let userFavorites = new Set();

// ════════════════════════════════════════
// AUTH STATE — update navbar
// ════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  updateNavbar(user);

  if (user) {
    await loadFavorites(user.uid);
  }

  await loadListings();
});

function updateNavbar(user) {
  const loginBtn  = document.getElementById('navLoginBtn');
  const userMenu  = document.getElementById('navUserMenu');
  const userAvatar = document.getElementById('navUserAvatar');
  const userName   = document.getElementById('navUserName');

  if (!loginBtn || !userMenu) return;

  if (user) {
    loginBtn.style.display  = 'none';
    userMenu.style.display  = 'flex';

    // Show display name or email prefix
    const name = user.displayName || user.email?.split('@')[0] || 'Bạn';
    if (userName) userName.textContent = name;

    // Avatar: photo or initials
    if (userAvatar) {
      if (user.photoURL) {
        userAvatar.innerHTML = `<img src="${user.photoURL}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
      } else {
        userAvatar.textContent = name.charAt(0).toUpperCase();
      }
    }
  } else {
    loginBtn.style.display  = 'flex';
    userMenu.style.display  = 'none';
  }
}

// ── Logout ──
document.getElementById('navLogoutBtn')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'auth.html';
});

// ════════════════════════════════════════
// LOAD LISTINGS FROM FIRESTORE
// ════════════════════════════════════════
async function loadListings() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="col-span-full" style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted)">
      <div class="uploading-spinner" style="margin:0 auto 8px"></div>
      Đang tải sản phẩm...
    </div>`;

  try {
    const q = query(
      collection(db, 'listings'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    allListings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    // Index may not exist yet — fall back without orderBy
    console.warn('Falling back to unordered query:', err.message);
    try {
      const q2 = query(
        collection(db, 'listings'),
        where('status', '==', 'active'),
        limit(20)
      );
      const snap2 = await getDocs(q2);
      allListings = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err2) {
      console.error('Failed to load listings:', err2);
      allListings = [];
    }
  }

  renderListings(allListings);
}

// ════════════════════════════════════════
// RENDER
// ════════════════════════════════════════
function renderListings(listings) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  if (listings.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">
        <div style="font-size:40px;margin-bottom:8px">📭</div>
        <div>Chưa có sản phẩm nào${currentCat !== 'all' ? ' trong danh mục này' : ''}.</div>
        <a href="post.html" style="color:var(--primary);font-weight:500;margin-top:8px;display:inline-block">Đăng tin đầu tiên →</a>
      </div>`;
    return;
  }

  grid.innerHTML = listings.map(listing => cardHTML(listing)).join('');

  // Attach events after render
  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.product-fav')) return;
      window.location.href = `product.html?id=${card.dataset.id}`;
    });
  });

  grid.querySelectorAll('.product-fav').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(btn.dataset.id, btn);
    });
  });
}

function cardHTML(listing) {
  const price    = listing.price ? Number(listing.price).toLocaleString('vi-VN') + ' ₫' : 'Liên hệ';
  const imgEl    = listing.images?.[0]?.url
    ? `<img src="${listing.images[0].url}" alt="${listing.title}" style="width:100%;height:100%;object-fit:cover">`
    : `<i class="ti ti-photo" style="font-size:36px;color:#d1d5db"></i>`;
  const timeAgo  = formatTime(listing.createdAt?.toDate?.());
  const isFav    = userFavorites.has(listing.id);
  const catIcon  = catIconMap[listing.category] || 'ti-tag';

  return `
    <div class="product-card" data-id="${listing.id}" data-cat="${listing.category || 'other'}">
      <div class="product-img-placeholder">${imgEl}</div>
      <button class="product-fav${isFav ? ' active' : ''}" data-id="${listing.id}" aria-label="Yêu thích">
        <i class="ti ${isFav ? 'ti-heart-filled' : 'ti-heart'}"></i>
      </button>
      <div class="product-info">
        <div class="product-name">${escHtml(listing.title)}</div>
        <div class="product-price">${price}</div>
        <div class="product-meta">
          <span class="product-location"><i class="ti ti-map-pin"></i> ${escHtml(listing.province || '—')}</span>
          <span>${timeAgo}</span>
        </div>
      </div>
    </div>`;
}

const catIconMap = {
  electronics: 'ti-device-laptop',
  fashion:     'ti-shirt',
  furniture:   'ti-armchair',
  vehicle:     'ti-bike',
  books:       'ti-book',
  sports:      'ti-ball-basketball',
  kids:        'ti-baby-carriage',
  other:       'ti-dots'
};

function formatTime(date) {
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)   return `${mins || 1} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  return `${days} ngày trước`;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ════════════════════════════════════════
// FAVORITES
// ════════════════════════════════════════
async function loadFavorites(uid) {
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'favorites'));
    userFavorites = new Set(snap.docs.map(d => d.id));
  } catch {
    userFavorites = new Set();
  }
}

async function toggleFavorite(listingId, btn) {
  if (!currentUser) {
    alert('Vui lòng đăng nhập để lưu sản phẩm yêu thích.');
    return;
  }
  const favRef = doc(db, 'users', currentUser.uid, 'favorites', listingId);
  const icon   = btn.querySelector('i');

  if (userFavorites.has(listingId)) {
    await deleteDoc(favRef);
    userFavorites.delete(listingId);
    btn.classList.remove('active');
    icon.className = 'ti ti-heart';
  } else {
    await setDoc(favRef, { listingId, createdAt: serverTimestamp() });
    userFavorites.add(listingId);
    btn.classList.add('active');
    icon.className = 'ti ti-heart-filled';
  }
}

// ════════════════════════════════════════
// CATEGORY FILTER CHIPS
// ════════════════════════════════════════
document.querySelectorAll('.filter-chip[data-cat]').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip[data-cat]').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentCat = chip.dataset.cat;
    applyFilters();
  });
});

// Category grid shortcuts
document.querySelectorAll('.cat-item[data-cat]').forEach(item => {
  item.addEventListener('click', () => {
    const chip = document.querySelector(`.filter-chip[data-cat="${item.dataset.cat}"]`);
    if (chip) chip.click();
    document.querySelector('.section')?.scrollIntoView({ behavior: 'smooth' });
  });
});

// ════════════════════════════════════════
// SEARCH
// ════════════════════════════════════════
document.querySelectorAll('#globalSearch, #mobileSearch').forEach(input => {
  input?.addEventListener('input', () => applyFilters());
});

// ── Central filter function ──
function applyFilters() {
  const province    = document.getElementById('provinceSelect')?.value || '';
  const searchQuery = (document.getElementById('globalSearch')?.value ||
                       document.getElementById('mobileSearch')?.value || '').toLowerCase().trim();

  let result = allListings;
  if (currentCat !== 'all') result = result.filter(l => l.category === currentCat);
  if (province)             result = result.filter(l => l.province === province);
  if (searchQuery)          result = result.filter(l => l.title?.toLowerCase().includes(searchQuery));
  renderListings(result);
}

// ════════════════════════════════════════
// PROVINCE FILTER
// ════════════════════════════════════════
document.getElementById('provinceSelect')?.addEventListener('change', (e) => {
  const province = e.target.value; // '' = Toàn quốc
  const catFiltered = currentCat === 'all'
    ? allListings
    : allListings.filter(l => l.category === currentCat);
  const filtered = !province
    ? catFiltered
    : catFiltered.filter(l => l.province === province);
  renderListings(filtered);
});