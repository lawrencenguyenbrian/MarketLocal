import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

const firebaseConfig = { /* same as your other files */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  currentUser = user;
  await loadUserProfile(user.uid);
  await loadMyListings(user.uid);
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
  // Reuse the same provinces from home.html or add full list
  const provinces = ["TP. Hồ Chí Minh","Hà Nội","Đà Nẵng", /* ... add more */];
  select.innerHTML = '<option value="">Chọn tỉnh/thành</option>' + provinces.map(p => `<option ${p===selected?'selected':''}>${p}</option>`).join('');
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('editName').value.trim();
  const province = document.getElementById('editProvince').value;

  if (!name) return alert('Vui lòng nhập tên');

  try {
    await updateDoc(doc(db, 'users', currentUser.uid), {
      name,
      province,
      lastSeen: serverTimestamp()
    });
    alert('Cập nhật thành công!');
    loadUserProfile(currentUser.uid); // refresh
  } catch (err) {
    console.error(err);
    alert('Lỗi khi cập nhật');
  }
});

async function loadMyListings(uid) {
  const q = query(collection(db, 'listings'), where('ownerId', '==', uid));
  const snap = await getDocs(q);
  const container = document.getElementById('myListings');
  container.innerHTML = snap.docs.map(doc => {
    const l = doc.data();
    return `<div class="col-md-6 mb-3">
      <div class="card">
        <div class="card-body">
          <h6>${l.title}</h6>
          <p class="text-muted">${l.price?.toLocaleString('vi-VN')} ₫</p>
          <small>${l.status || 'active'}</small>
        </div>
      </div>
    </div>`;
  }).join('') || '<p>Bạn chưa có tin đăng nào.</p>';
}

window.logout = async () => {
  await signOut(auth);
  window.location.href = 'auth.html';
};