// Firebase modular SDK (CDN) imports — keep your original firebaseConfig
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

// Your web app's Firebase configuration (unchanged)
const firebaseConfig = {
  apiKey: "AIzaSyDsNtYcowBKtJw_doiE_JpV_d0KZaLMqA0",
  authDomain: "marketlocal-e4ab7.firebaseapp.com",
  projectId: "marketlocal-e4ab7",
  storageBucket: "marketlocal-e4ab7.firebasestorage.app",
  messagingSenderId: "257007076578",
  appId: "1:257007076578:web:5e8897d117868494cf8abb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

// ── Login form submit ──
document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showAlert('loginAlert', 'Vui lòng điền đầy đủ thông tin.', 'danger');
    return;
  }
  showAlert('loginAlert', 'Đang đăng nhập...', 'info');
  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      showAlert('loginAlert', 'Đăng nhập thành công. Chuyển hướng...', 'success');
      // redirect after short delay
      setTimeout(() => { window.location.href = 'home.html'; }, 800);
    })
    .catch((err) => {
      showAlert('loginAlert', err.message || 'Đăng nhập thất bại.', 'danger');
    });
});

// ── Register form submit ──
document.getElementById('registerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const province = document.getElementById('regProvince').value;
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;

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
  createUserWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      const user = userCredential.user;
      try {
        await setDoc(doc(db, 'users', user.uid), {
          name,
          email,
          province,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('Failed to write user profile:', e);
      }
      showAlert('registerAlert', 'Đăng ký thành công! Chuyển hướng...', 'success');
      setTimeout(() => { window.location.href = 'home.html'; }, 800);
    })
    .catch((err) => {
      showAlert('registerAlert', err.message || 'Đăng ký thất bại.', 'danger');
    });
});

// ── Google Sign-In ──
document.querySelectorAll('.btn-google').forEach(btn => {
  btn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then(async (result) => {
        const user = result.user;
        try {
          await setDoc(doc(db, 'users', user.uid), {
            name: user.displayName || '',
            email: user.email || '',
            province: '',
            provider: 'google',
            lastLogin: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.warn('Failed to write Google user:', e);
        }
        showAlert('loginAlert', 'Đăng nhập Google thành công. Chuyển hướng...', 'success');
        setTimeout(() => { window.location.href = 'home.html'; }, 800);
      })
      .catch((err) => {
        showAlert('loginAlert', err.message || 'Google Sign-In thất bại.', 'danger');
      });
  });
});

// ── Helper: show alert ──
function showAlert(id, message, type) {
  const el = document.getElementById(id);
  el.className = `alert alert-${type} py-2 px-3 mt-3`;
  el.style.display = 'block';
  el.textContent = message;
}