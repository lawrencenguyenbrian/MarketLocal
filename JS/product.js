import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  increment,
  collection,
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

// ════════════════════════════════════════
// STATE
// ════════════════════════════════════════
let currentUser  = null;
let listing      = null;
let images       = [];
let currentIndex = 0;
let isFav        = false;

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
const listingId = new URLSearchParams(window.location.search).get('id');

if (!listingId) {
  showError();
} else {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    await loadListing();
    if (user) await checkFavorite(user.uid);
  });
}

// ════════════════════════════════════════
// LOAD LISTING
// ════════════════════════════════════════
async function loadListing() {
  try {
    const snap = await getDoc(doc(db, 'listings', listingId));
    if (!snap.exists() || snap.data().status === 'removed') {
      showError();
      return;
    }

    listing = { id: snap.id, ...snap.data() };
    images  = listing.images || [];

    renderListing();
    await loadSeller(listing.ownerId);

    // Increment view count (fire and forget)
    updateDoc(doc(db, 'listings', listingId), { views: increment(1) }).catch(() => {});

  } catch (err) {
    console.error('Error loading listing:', err);
    showError();
  }
}

// ════════════════════════════════════════
// RENDER LISTING
// ════════════════════════════════════════
function renderListing() {
  // Show content, hide loading
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('productContent').style.display = 'block';

  // Page title
  document.title = `${listing.title} — MarketLocal`;

  // Breadcrumb
  document.getElementById('breadCat').textContent   = catLabel(listing.category);
  document.getElementById('breadTitle').textContent = listing.title;

  // Category & condition tags
  document.getElementById('tagCategory').textContent  = catLabel(listing.category);
  const condEl = document.getElementById('tagCondition');
  condEl.textContent  = condLabel(listing.condition);
  condEl.className    = `tag-condition cond-${listing.condition || ''}`;

  // Title
  document.getElementById('productTitle').textContent = listing.title || '—';

  // Price
  const priceEl = document.getElementById('productPrice');
  priceEl.textContent = listing.price
    ? Number(listing.price).toLocaleString('vi-VN') + ' ₫'
    : 'Liên hệ';

  // Meta
  document.getElementById('productProvince').textContent = listing.province || '—';
  document.getElementById('productTime').textContent     = formatTime(listing.createdAt?.toDate?.());
  document.getElementById('productViews').textContent    = (listing.views || 0) + 1; // +1 for current visit

  // Description
  const descEl = document.getElementById('productDesc');
  descEl.textContent = listing.description?.trim() || 'Người bán chưa có mô tả.';

  // Phone
  if (listing.phone) {
    const phoneRow = document.getElementById('phoneRow');
    const phoneLink = document.getElementById('productPhone');
    phoneRow.style.display = 'flex';
    phoneLink.textContent  = listing.phone;
    phoneLink.href         = `tel:${listing.phone}`;
  }

  // Images
  renderImages();
}

// ════════════════════════════════════════
// IMAGES
// ════════════════════════════════════════
function renderImages() {
  const mainImg     = document.getElementById('mainImage');
  const placeholder = document.getElementById('mainImagePlaceholder');
  const thumbRow    = document.getElementById('thumbnailRow');
  const counter     = document.getElementById('imgCounter');
  const prevBtn     = document.getElementById('imgPrev');
  const nextBtn     = document.getElementById('imgNext');

  if (images.length === 0) {
    placeholder.style.display = 'flex';
    mainImg.style.display     = 'none';
    return;
  }

  placeholder.style.display = 'none';
  mainImg.style.display     = 'block';

  // Show/hide arrows
  prevBtn.style.display = images.length > 1 ? 'flex' : 'none';
  nextBtn.style.display = images.length > 1 ? 'flex' : 'none';
  counter.style.display = images.length > 1 ? 'block' : 'none';

  function goTo(index) {
    currentIndex = (index + images.length) % images.length;
    mainImg.src  = images[currentIndex].url;
    counter.textContent = `${currentIndex + 1} / ${images.length}`;

    // Update thumbnails
    thumbRow.querySelectorAll('.thumb').forEach((t, i) => {
      t.classList.toggle('active', i === currentIndex);
    });
  }

  // Thumbnails
  thumbRow.innerHTML = '';
  images.forEach((img, i) => {
    const thumb = document.createElement('img');
    thumb.src       = img.url;
    thumb.alt       = `Ảnh ${i + 1}`;
    thumb.className = `thumb${i === 0 ? ' active' : ''}`;
    thumb.addEventListener('click', () => goTo(i));
    thumbRow.appendChild(thumb);
  });

  goTo(0);

  // Arrow clicks
  prevBtn.onclick = () => goTo(currentIndex - 1);
  nextBtn.onclick = () => goTo(currentIndex + 1);

  // Open lightbox on main image click
  document.getElementById('mainImageWrap').addEventListener('click', (e) => {
    if (e.target.closest('.img-arrow')) return;
    openLightbox(currentIndex);
  });
}

// ════════════════════════════════════════
// SELLER INFO
// ════════════════════════════════════════
async function loadSeller(ownerId) {
  const nameEl     = document.getElementById('sellerName');
  const avatarEl   = document.getElementById('sellerAvatar');
  const provinceEl = document.getElementById('sellerProvince');

  if (!ownerId) {
    nameEl.textContent = listing.ownerName || 'Ẩn danh';
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'users', ownerId));
    if (snap.exists()) {
      const seller = snap.data();
      const name   = seller.name || listing.ownerName || 'Ẩn danh';

      nameEl.textContent     = name;
      provinceEl.textContent = seller.province || listing.province || '—';

      if (seller.photoURL) {
        avatarEl.innerHTML = `<img src="${seller.photoURL}" alt="${name}">`;
      } else {
        avatarEl.textContent = name.charAt(0).toUpperCase();
      }
    } else {
      nameEl.textContent = listing.ownerName || 'Ẩn danh';
    }
  } catch {
    nameEl.textContent = listing.ownerName || 'Ẩn danh';
  }
}

// ════════════════════════════════════════
// FAVORITES
// ════════════════════════════════════════
async function checkFavorite(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'favorites', listingId));
    isFav = snap.exists();
    updateFavBtn();
  } catch { isFav = false; }
}

function updateFavBtn() {
  const btn     = document.getElementById('btnFav');
  const icon    = document.getElementById('favIcon');
  btn.classList.toggle('active', isFav);
  icon.className = isFav ? 'ti ti-heart-filled' : 'ti ti-heart';
}

document.getElementById('btnFav').addEventListener('click', async () => {
  if (!currentUser) {
    alert('Vui lòng đăng nhập để lưu sản phẩm yêu thích.');
    window.location.href = 'auth.html';
    return;
  }
  const favRef = doc(db, 'users', currentUser.uid, 'favorites', listingId);
  if (isFav) {
    await deleteDoc(favRef);
    isFav = false;
  } else {
    await setDoc(favRef, { listingId, createdAt: serverTimestamp() });
    isFav = true;
  }
  updateFavBtn();
});

// ════════════════════════════════════════
// CONTACT BUTTON
// ════════════════════════════════════════
document.getElementById('btnContact').addEventListener('click', () => {
  if (!currentUser) {
    alert('Vui lòng đăng nhập để nhắn tin người bán.');
    window.location.href = 'auth.html';
    return;
  }
  if (currentUser.uid === listing?.ownerId) {
    alert('Đây là tin đăng của bạn.');
    return;
  }
  // W3: redirect to chat page
  alert('Tính năng nhắn tin sẽ ra mắt sớm! 💬');
});

// ════════════════════════════════════════
// SHARE
// ════════════════════════════════════════
document.getElementById('btnShare').addEventListener('click', async () => {
  const url = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: listing?.title, url });
    } catch { /* user cancelled */ }
  } else {
    await navigator.clipboard.writeText(url);
    alert('Đã sao chép đường dẫn!');
  }
});

// ════════════════════════════════════════
// LIGHTBOX
// ════════════════════════════════════════
function openLightbox(index) {
  if (images.length === 0) return;
  const lb       = document.getElementById('lightbox');
  const lbImg    = document.getElementById('lightboxImg');
  const lbCount  = document.getElementById('lightboxCounter');
  let lbIndex    = index;

  function updateLb() {
    lbImg.src = images[lbIndex].url;
    lbCount.textContent = images.length > 1 ? `${lbIndex + 1} / ${images.length}` : '';
    document.getElementById('lightboxPrev').style.display = images.length > 1 ? 'flex' : 'none';
    document.getElementById('lightboxNext').style.display = images.length > 1 ? 'flex' : 'none';
  }

  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  updateLb();

  document.getElementById('lightboxPrev').onclick = () => { lbIndex = (lbIndex - 1 + images.length) % images.length; updateLb(); };
  document.getElementById('lightboxNext').onclick = () => { lbIndex = (lbIndex + 1) % images.length; updateLb(); };
}

function closeLightbox() {
  document.getElementById('lightbox').style.display = 'none';
  document.body.style.overflow = '';
}

document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
document.getElementById('lightboxBackdrop').addEventListener('click', closeLightbox);

document.addEventListener('keydown', (e) => {
  const lb = document.getElementById('lightbox');
  if (lb.style.display === 'none') return;
  if (e.key === 'Escape')     closeLightbox();
  if (e.key === 'ArrowLeft')  document.getElementById('lightboxPrev').click();
  if (e.key === 'ArrowRight') document.getElementById('lightboxNext').click();
});

// ════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════
function showError() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display   = 'flex';
}

function formatTime(date) {
  if (!date) return '—';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)    return 'Vừa xong';
  if (mins < 60)   return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 30)   return `${days} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

const catLabels = {
  electronics: '💻 Điện tử',
  fashion:     '👗 Thời trang',
  furniture:   '🛋️ Nội thất',
  vehicle:     '🚲 Xe cộ',
  books:       '📚 Sách',
  sports:      '⚽ Thể thao',
  kids:        '🧸 Mẹ & Bé',
  other:       '📦 Khác'
};

const condLabels = {
  'new':      'Mới 100%',
  'like-new': 'Như mới (99%)',
  'good':     'Còn tốt (80–90%)',
  'fair':     'Đã qua sử dụng'
};

function catLabel(cat)  { return catLabels[cat]  || 'Khác'; }
function condLabel(cond) { return condLabels[cond] || cond || '—'; }