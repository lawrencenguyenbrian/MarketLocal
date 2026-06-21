import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
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

// ── If already logged in, redirect to home ──
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = 'home.html';
  }
});

// ── Tab switching ──
const tabs = document.querySelectorAll('.auth-tab');
const sections = document.querySelectorAll('.form-section');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    tabs.forEach(t => t.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(target).classList.add('active');
  });
});

// ── Toggle password visibility ──
document.querySelectorAll('.toggle-password').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.closest('.input-wrap').querySelector('input');
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'ti ti-eye-off';
    } else {
      input.type = 'password';
      icon.className = 'ti ti-eye';
    }
  });
});

// ── Save user profile to Firestore ──
async function saveUserProfile(user, extraData = {}) {
  const userRef = doc(db, 'users', user.uid);
  const existing = await getDoc(userRef);
  if (!existing.exists()) {
    await setDoc(userRef, {
      name: extraData.name || user.displayName || '',
      email: user.email || '',
      province: extraData.province || '',
      photoURL: user.photoURL || '',
      createdAt: serverTimestamp(),
      ...extraData
    });
  } else {
    // Update last seen
    await setDoc(userRef, { lastSeen: serverTimestamp() }, { merge: true });
  }
}

// ── Login ──
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showAlert('loginAlert', 'Vui lòng điền đầy đủ thông tin.', 'danger');
    return;
  }

  showAlert('loginAlert', 'Đang đăng nhập...', 'info');

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await saveUserProfile(cred.user);
    showAlert('loginAlert', 'Đăng nhập thành công! Đang chuyển hướng...', 'success');
    setTimeout(() => { window.location.href = 'home.html'; }, 800);
  } catch (err) {
    const msg = friendlyError(err.code);
    showAlert('loginAlert', msg, 'danger');
  }
});

// ── Register ──
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const province = document.getElementById('regProvince').value;
  const password = document.getElementById('regPassword').value;
  const confirm  = document.getElementById('regConfirm').value;

  if (!name || !email || !province || !password || !confirm) {
    showAlert('registerAlert', 'Vui lòng điền đầy đủ thông tin.', 'danger');
    return;
  }
  if (password !== confirm) {
    showAlert('registerAlert', 'Mật khẩu xác nhận không khớp.', 'danger');
    return;
  }
  if (password.length < 6) {
    showAlert('registerAlert', 'Mật khẩu phải có ít nhất 6 ký tự.', 'danger');
    return;
  }

  showAlert('registerAlert', 'Đang tạo tài khoản...', 'info');

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await saveUserProfile(cred.user, { name, province });
    showAlert('registerAlert', 'Đăng ký thành công! Đang chuyển hướng...', 'success');
    setTimeout(() => { window.location.href = 'home.html'; }, 800);
  } catch (err) {
    const msg = friendlyError(err.code);
    showAlert('registerAlert', msg, 'danger');
  }
});

// ── Google Sign-In ──
document.querySelectorAll('.btn-google').forEach(btn => {
  btn.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await saveUserProfile(result.user);
      showAlert('loginAlert', 'Đăng nhập Google thành công! Đang chuyển hướng...', 'success');
      setTimeout(() => { window.location.href = 'home.html'; }, 800);
    } catch (err) {
      showAlert('loginAlert', err.message || 'Google Sign-In thất bại.', 'danger');
    }
  });
});

// ── Friendly error messages ──
function friendlyError(code) {
  const map = {
    'auth/user-not-found':       'Email không tồn tại.',
    'auth/wrong-password':       'Mật khẩu không đúng.',
    'auth/email-already-in-use': 'Email này đã được đăng ký.',
    'auth/invalid-email':        'Email không hợp lệ.',
    'auth/too-many-requests':    'Quá nhiều lần thử. Vui lòng thử lại sau.',
    'auth/network-request-failed': 'Lỗi kết nối mạng.',
  };
  return map[code] || 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

// ── Show alert ──
function showAlert(id, message, type) {
  const el = document.getElementById(id);
  el.className = `alert alert-${type} py-2 px-3 mt-3`;
  el.style.display = 'block';
  el.textContent = message;
}