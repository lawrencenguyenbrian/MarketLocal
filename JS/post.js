// ════════════════════════════════════════
// CONFIG — thay bằng thông tin thật của bạn
// ════════════════════════════════════════
const CLOUDINARY_CLOUD_NAME = 'your_cloud_name';   // TODO: thay
const CLOUDINARY_UPLOAD_PRESET = 'your_preset';    // TODO: tạo Unsigned preset trên Cloudinary

// ════════════════════════════════════════
// STATE
// ════════════════════════════════════════
let uploadedImages = []; // [{ localUrl, cloudUrl, publicId }]
let selectedCondition = 'good';

// ════════════════════════════════════════
// CONDITION PILLS
// ════════════════════════════════════════
document.querySelectorAll('.condition-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.condition-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedCondition = btn.dataset.value;
  });
});

// ════════════════════════════════════════
// IMAGE UPLOAD — Cloudinary Unsigned Upload
// ════════════════════════════════════════
const uploadZone   = document.getElementById('uploadZone');
const fileInput    = document.getElementById('fileInput');
const previewGrid  = document.getElementById('previewGrid');

// Drag & drop visual
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', ()  => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => handleFiles(fileInput.files));

function handleFiles(files) {
  if (uploadedImages.length + files.length > 6) {
    showToast('Tối đa 6 ảnh mỗi tin đăng', 'error');
    return;
  }
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const localUrl = URL.createObjectURL(file);
    const index = uploadedImages.length;
    uploadedImages.push({ localUrl, cloudUrl: null, publicId: null });
    renderPreviewItem(index, localUrl);
    uploadToCloudinary(file, index);
  });
  // Show first image in sidebar preview
  if (uploadedImages.length >= 1) updateSidebarImage(uploadedImages[0].localUrl);
}

function renderPreviewItem(index, localUrl) {
  const item = document.createElement('div');
  item.className = 'preview-item';
  item.id = `preview-${index}`;
  item.innerHTML = `
    <img src="${localUrl}" alt="ảnh ${index + 1}" />
    <div class="preview-uploading" id="uploading-${index}">
      <div class="uploading-spinner"></div>
      Đang tải...
    </div>
    ${index === 0 ? '<span class="preview-main-badge">Ảnh bìa</span>' : ''}
    <button class="preview-remove" onclick="removeImage(${index})" title="Xoá ảnh">✕</button>
  `;
  previewGrid.appendChild(item);
}

async function uploadToCloudinary(file, index) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    );
    const data = await res.json();
    if (data.secure_url) {
      uploadedImages[index].cloudUrl  = data.secure_url;
      uploadedImages[index].publicId  = data.public_id;
      // Ẩn spinner
      const spinner = document.getElementById(`uploading-${index}`);
      if (spinner) spinner.style.display = 'none';
    } else {
      showToast('Lỗi upload ảnh. Kiểm tra Cloudinary config.', 'error');
    }
  } catch (err) {
    console.error('Cloudinary error:', err);
    showToast('Không thể kết nối Cloudinary.', 'error');
  }
}

function removeImage(index) {
  uploadedImages.splice(index, 1);
  // Re-render toàn bộ preview
  previewGrid.innerHTML = '';
  uploadedImages.forEach((img, i) => {
    renderPreviewItem(i, img.localUrl);
    if (img.cloudUrl) {
      const spinner = document.getElementById(`uploading-${i}`);
      if (spinner) spinner.style.display = 'none';
    }
  });
  updateSidebarImage(uploadedImages[0]?.localUrl || null);
}

// ════════════════════════════════════════
// LIVE PREVIEW (sidebar)
// ════════════════════════════════════════
const inpTitle    = document.getElementById('inpTitle');
const inpPrice    = document.getElementById('inpPrice');
const inpProvince = document.getElementById('inpProvince');

const prevName    = document.getElementById('prevName');
const prevPrice   = document.getElementById('prevPrice');
const prevLoc     = document.getElementById('prevLoc');
const prevImg     = document.getElementById('prevImg');

inpTitle.addEventListener('input', () => {
  prevName.textContent = inpTitle.value || 'Tên sản phẩm';
  prevName.className   = 'preview-card-name' + (inpTitle.value ? '' : ' empty');
});

inpPrice.addEventListener('input', () => {
  const val = parseInt(inpPrice.value.replace(/\D/g, ''));
  prevPrice.textContent = val ? val.toLocaleString('vi-VN') + ' ₫' : 'Chưa có giá';
  prevPrice.className   = 'preview-card-price' + (val ? '' : ' empty');
});

inpProvince.addEventListener('change', () => {
  prevLoc.textContent = inpProvince.value || '—';
});

function updateSidebarImage(url) {
  const placeholder = document.getElementById('imgPlaceholder');
  if (url) {
    prevImg.src   = url;
    prevImg.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  } else {
    prevImg.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
  }
}

// ════════════════════════════════════════
// SUBMIT — lưu vào Firestore
// ════════════════════════════════════════
document.getElementById('postForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const title       = inpTitle.value.trim();
  const price       = parseInt(inpPrice.value.replace(/\D/g, ''));
  const category    = document.getElementById('inpCategory').value;
  const province    = inpProvince.value;
  const description = document.getElementById('inpDesc').value.trim();
  const phone       = document.getElementById('inpPhone').value.trim();

  // Validate
  if (!title)       return showToast('Vui lòng nhập tên sản phẩm', 'error');
  if (!price)       return showToast('Vui lòng nhập giá', 'error');
  if (!category)    return showToast('Vui lòng chọn danh mục', 'error');
  if (!province)    return showToast('Vui lòng chọn khu vực', 'error');
  if (uploadedImages.length === 0) return showToast('Vui lòng thêm ít nhất 1 ảnh', 'error');

  // Kiểm tra ảnh còn đang upload
  const stillUploading = uploadedImages.some(img => !img.cloudUrl);
  if (stillUploading) return showToast('Đang upload ảnh, vui lòng chờ...', 'info');

  // Bật loading
  const btnSubmit = document.getElementById('btnSubmit');
  btnSubmit.classList.add('loading');
  btnSubmit.disabled = true;

  const listing = {
    title,
    price,
    category,
    province,
    description,
    phone,
    condition: selectedCondition,
    images: uploadedImages.map(img => img.cloudUrl),
    createdAt: new Date().toISOString(),
    // TODO: thêm sellerId từ Firebase Auth: firebase.auth().currentUser.uid
  };

  try {
    // TODO: lưu vào Firestore
    // const db = getFirestore(app);
    // await addDoc(collection(db, 'listings'), listing);

    // Demo — giả lập delay
    await new Promise(r => setTimeout(r, 1000));
    console.log('Listing data:', listing);

    showToast('Đăng tin thành công!', 'success');
    setTimeout(() => window.location.href = 'index.html', 1500);
  } catch (err) {
    console.error(err);
    showToast('Có lỗi xảy ra, thử lại sau.', 'error');
  } finally {
    btnSubmit.classList.remove('loading');
    btnSubmit.disabled = false;
  }
});

// ════════════════════════════════════════
// TOAST helper
// ════════════════════════════════════════
function showToast(message, type = 'info') {
  const wrap  = document.getElementById('toastWrap');
  const icons = { success: 'ti-circle-check', error: 'ti-alert-circle', info: 'ti-info-circle' };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="ti ${icons[type]}"></i> ${message}`;
  wrap.appendChild(toast);

  setTimeout(() => toast.remove(), 3500);
}