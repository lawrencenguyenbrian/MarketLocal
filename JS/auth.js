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

  // TODO: Firebase Auth — signInWithEmailAndPassword(auth, email, password)
  showAlert('loginAlert', 'Đang đăng nhập...', 'info');
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

  // TODO: Firebase Auth — createUserWithEmailAndPassword(auth, email, password)
  //       then save user profile to Firestore: { name, email, province }
  showAlert('registerAlert', 'Đăng ký thành công! Đang chuyển hướng...', 'success');
});

// ── Google Sign-In ──
document.querySelectorAll('.btn-google').forEach(btn => {
  btn.addEventListener('click', () => {
    // TODO: Firebase Auth — signInWithPopup(auth, new GoogleAuthProvider())
    alert('Google Sign-In — kết nối Firebase để kích hoạt.');
  });
});

// ── Helper: show alert ──
function showAlert(id, message, type) {
  const el = document.getElementById(id);
  el.className = `alert alert-${type} py-2 px-3 mt-3`;
  el.style.display = 'block';
  el.textContent = message;
}