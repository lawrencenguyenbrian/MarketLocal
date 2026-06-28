import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
const provinces = [
  "An Giang", "Bắc Ninh", "Cao Bằng", "Cà Mau", "Điện Biên", "Đắk Lắk",
  "Đồng Tháp", "Gia Lai", "Hà Tĩnh", "Hưng Yên", "Khánh Hòa", "Lai Châu",
  "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Nghệ An", "Ninh Bình", "Phú Thọ",
  "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sơn La", "Tây Ninh",
  "Thanh Hóa", "Thái Nguyên", "Tuyên Quang", "Vĩnh Long", "TP. Cần Thơ",
  "TP. Đà Nẵng", "TP. Đồng Nai", "TP. Hà Nội", "TP. Hải Phòng",
  "TP. Hồ Chí Minh", "TP. Huế"
];

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  currentUser = user;
  await loadUserProfile(user.uid);
  await loadMyListings(user.uid);
  await loadFavorites(user.uid);
});

async function loadUserProfile(uid) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const data = snap.exists() ? snap.data() : {};

  document.getElementById('profileName').textContent = data.name || currentUser.email?.split('@')[0] || 'Người dùng';
  document.getElementById('profileEmail').textContent = currentUser.email;

  // Avatar
  const avatarDiv = document.getElementById('profileAvatar');
  if (data.photoURL || currentUser.photoURL) {
    avatarDiv.innerHTML = `<img src="${data.photoURL || currentUser.photoURL}" class="profile-avatar" alt="avatar">`;
  } else {
    avatarDiv.innerHTML = `<div class="profile-avatar bg-primary text-white d-flex align-items-center justify-content-center fs-1">${(data.name || 'U').charAt(0).toUpperCase()}</div>`;
  }

  // Form fields
  document.getElementById('editName').value = data.name || '';
  populateProvinceSelect(data.province);
}

function populateProvinceSelect(selected = '') {
  const select = document.getElementById('editProvince');
  select.innerHTML = '<option value="">Chọn tỉnh/thành</option>' + provinces.map(p => `<option ${p===selected?'selected':''}>${p}</option>`).join('');
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('editName').value.trim();
  const province = document.getElementById('editProvince').value;

  if (!name) return alert('Vui lòng nhập tên');

  try {
    await setDoc(doc(db, 'users', currentUser.uid), {
      name,
      province,
      email: currentUser.email || '',
      photoURL: currentUser.photoURL || '',
      lastSeen: serverTimestamp()
    }, { merge: true });
    alert('Cập nhật thành công!');
    loadUserProfile(currentUser.uid); // refresh
  } catch (err) {
    console.error(err);
    alert('Lỗi khi cập nhật');
  }
});

async function loadMyListings(uid) {
  const container = document.getElementById('myListings');
  container.innerHTML = '<p class="text-muted">Đang tải tin đăng...</p>';

  let snap;
  try {
    const q = query(
      collection(db, 'listings'),
      where('ownerId', '==', uid),
      orderBy('createdAt', 'desc')
    );
    snap = await getDocs(q);
  } catch {
    const q = query(collection(db, 'listings'), where('ownerId', '==', uid));
    snap = await getDocs(q);
  }

  container.innerHTML = snap.docs.map((listingDoc) => {
    const l = listingDoc.data();
    const imageUrl = l.images?.[0]?.url;
    const price = Number(l.price || 0).toLocaleString('vi-VN') + ' ₫';
    const statusText = l.status === 'sold' ? 'Đã bán' : l.status === 'removed' ? 'Đã ẩn' : 'Đang bán';
    return `<div class="col-md-6 mb-3">
      <div class="card h-100">
        ${imageUrl ? `<img src="${escHtml(imageUrl)}" class="card-img-top" alt="${escHtml(l.title)}" style="height:150px;object-fit:cover">` : ''}
        <div class="card-body d-flex flex-column">
          <h6>${escHtml(l.title)}</h6>
          <p class="text-muted mb-1">${price}</p>
          <small class="mb-3">${statusText}</small>
          <div class="d-flex gap-2 mt-auto">
            <a class="btn btn-sm btn-outline-primary" href="product.html?id=${listingDoc.id}">Xem</a>
            <a class="btn btn-sm btn-outline-warning" href="post.html?id=${listingDoc.id}"><i class="ti ti-edit"></i> Sửa</a>
            <button class="btn btn-sm btn-outline-secondary" data-action="toggle-status" data-id="${listingDoc.id}" data-status="${l.status || 'active'}">
              ${l.status === 'sold' ? 'Bán lại' : 'Đã bán'}
            </button>
            <button class="btn btn-sm btn-outline-danger" data-action="hide" data-id="${listingDoc.id}">${l.status === 'removed' ? 'Hiện' : 'Ẩn'}</button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${listingDoc.id}"><i class="ti ti-trash"></i> Xoá</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('') || '<p>Bạn chưa có tin đăng nào.</p>';

  container.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.id;
      const action = button.dataset.action;
      const currentStatus = button.dataset.status;
      button.disabled = true;

      try {
        if (action === 'delete') {
          if (!confirm('Bạn có chắc muốn xoá tin đăng này? Hành động này không thể hoàn tác.')) {
            button.disabled = false;
            return;
          }
          await deleteDoc(doc(db, 'listings', id));
          await loadMyListings(uid);
          return;
        }

        const nextStatus = action === 'hide'
          ? (currentStatus === 'removed' ? 'active' : 'removed')
          : currentStatus === 'sold' ? 'active' : 'sold';
        await updateDoc(doc(db, 'listings', id), {
          status: nextStatus,
          updatedAt: serverTimestamp()
        });
        await loadMyListings(uid);
      } catch (err) {
        console.error(err);
        alert('Không thể cập nhật tin đăng.');
        button.disabled = false;
      }
    });
  });
}

async function loadFavorites(uid) {
  const container = document.getElementById('myFavorites');
  container.innerHTML = '<p class="text-muted">Đang tải...</p>';

  try {
    const favSnap = await getDocs(collection(db, 'users', uid, 'favorites'));
    if (favSnap.empty) {
      container.innerHTML = '<p class="text-muted">Chưa có sản phẩm yêu thích nào.</p>';
      return;
    }

    const listingIds = favSnap.docs.map(d => d.id);
    const listings = await Promise.all(listingIds.map(id =>
      getDoc(doc(db, 'listings', id)).then(s => s.exists() ? { id: s.id, ...s.data() } : null)
    ));

    const valid = listings.filter(Boolean);

    if (valid.length === 0) {
      container.innerHTML = '<p class="text-muted">Sản phẩm yêu thích không còn tồn tại.</p>';
      return;
    }

    container.innerHTML = valid.map(l => {
      const imageUrl = l.images?.[0]?.url;
      const price = Number(l.price || 0).toLocaleString('vi-VN') + ' ₫';
      return `<div class="col-md-6 mb-3">
        <div class="card h-100">
          ${imageUrl ? `<img src="${escHtml(imageUrl)}" class="card-img-top" alt="${escHtml(l.title)}" style="height:150px;object-fit:cover">` : ''}
          <div class="card-body d-flex flex-column">
            <h6>${escHtml(l.title)}</h6>
            <p class="text-muted mb-1">${price}</p>
            <div class="mt-auto">
              <a class="btn btn-sm btn-outline-primary" href="product.html?id=${l.id}">Xem</a>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    console.error('Favorites error:', err);
    container.innerHTML = '<p class="text-muted">Lỗi tải danh sách yêu thích.</p>';
  }
}

window.logout = async () => {
  await signOut(auth);
  window.location.href = 'auth.html';
};

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
