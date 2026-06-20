// ════════════════════════════════════════
// CONFIG — thay bằng thông tin thật của bạn
// ════════════════════════════════════════

// Firebase (keep your existing firebaseConfig)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const CLOUDINARY_CLOUD_NAME = "dfdom0zpb"; // TODO: thay
const CLOUDINARY_UPLOAD_PRESET = "market_local"; // TODO: tạo Unsigned preset trên Cloudinary

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
  console.warn(
    "Cloudinary config not set — update CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET in JS/post.js",
  );
}

const firebaseConfig = {
  apiKey: "AIzaSyDsNtYcowBKtJw_doiE_JpV_d0KZaLMqA0",
  authDomain: "marketlocal-e4ab7.firebaseapp.com",
  projectId: "marketlocal-e4ab7",
  storageBucket: "marketlocal-e4ab7.firebasestorage.app",
  messagingSenderId: "257007076578",
  appId: "1:257007076578:web:5e8897d117868494cf8abb",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

// ════════════════════════════════════════
// STATE
// ════════════════════════════════════════
let uploadedImages = []; // [{ localUrl, cloudUrl, publicId }]
let selectedCondition = "good";

// ════════════════════════════════════════
// CONDITION PILLS
// ════════════════════════════════════════
document.querySelectorAll(".condition-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".condition-btn")
      .forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedCondition = btn.dataset.value;
  });
});

// ════════════════════════════════════════
// IMAGE UPLOAD — Cloudinary Unsigned Upload
// ════════════════════════════════════════
const uploadZone = document.getElementById("uploadZone");
const fileInput = document.getElementById("fileInput");
const previewGrid = document.getElementById("previewGrid");

// Visible warning in UI when Cloudinary config is missing
if ((!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) && uploadZone) {
  const warn = document.createElement("div");
  warn.style.cssText =
    "padding:8px 10px;background:#fff3cd;border:1px solid #ffeeba;color:#664d03;border-radius:6px;margin-top:8px;font-size:13px";
  warn.textContent =
    "Cloudinary chưa cấu hình — ảnh sẽ không upload. Cập nhật `CLOUDINARY_CLOUD_NAME` và `CLOUDINARY_UPLOAD_PRESET` trong JS/post.js";
  uploadZone.appendChild(warn);
}

// Drag & drop visual
uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("drag-over");
});
uploadZone.addEventListener("dragleave", () =>
  uploadZone.classList.remove("drag-over"),
);
uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", () => handleFiles(fileInput.files));

function handleFiles(files) {
  if (uploadedImages.length + files.length > 6) {
    showToast("Tối đa 6 ảnh mỗi tin đăng", "error");
    return;
  }
  Array.from(files).forEach((file) => {
    if (!file.type.startsWith("image/")) return;
    const localUrl = URL.createObjectURL(file);
    const index = uploadedImages.length;
    uploadedImages.push({ localUrl, cloudUrl: null, publicId: null });
    renderPreviewItem(index, localUrl);
    uploadToCloudinary(file, index);
  });
  // Show first image in sidebar preview
  if (uploadedImages.length >= 1)
    updateSidebarImage(uploadedImages[0].localUrl);
}

function renderPreviewItem(index, localUrl) {
  const item = document.createElement("div");
  item.className = "preview-item";
  item.id = `preview-${index}`;
  item.innerHTML = `
    <img src="${localUrl}" alt="ảnh ${index + 1}" />
    <div class="preview-uploading" id="uploading-${index}">
      <div class="uploading-spinner"></div>
      <div class="uploading-text">Đang tải...</div>
      <div class="upload-progress" id="progress-${index}" style="width:80%;height:6px;background:rgba(0,0,0,0.06);border-radius:4px;margin-top:6px;overflow:hidden;">
        <div class="upload-progress-bar" id="progress-bar-${index}" style="width:0%;height:100%;background:var(--primary);transition:width .2s"></div>
      </div>
    </div>
    ${index === 0 ? '<span class="preview-main-badge">Ảnh bìa</span>' : ""}
    <button class="preview-remove" onclick="removeImage(${index})" title="Xoá ảnh">✕</button>
  `;
  previewGrid.appendChild(item);
}

function uploadToCloudinary(file, index) {
  // Use XMLHttpRequest to track upload progress
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const xhr = new XMLHttpRequest();
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const progressBar = document.getElementById(`progress-bar-${index}`);
  const uploadingEl = document.getElementById(`uploading-${index}`);

  xhr.open("POST", url, true);
  xhr.upload.addEventListener("progress", (e) => {
    if (!e.lengthComputable) return;
    const percent = Math.round((e.loaded / e.total) * 100);
    if (progressBar) progressBar.style.width = percent + "%";
    if (uploadingEl)
      uploadingEl.querySelector(".uploading-text").textContent =
        `Đang tải... ${percent}%`;
  });

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.secure_url) {
            uploadedImages[index].cloudUrl = data.secure_url;
            uploadedImages[index].publicId = data.public_id;
            uploadedImages[index].width = data.width || null;
            uploadedImages[index].height = data.height || null;
            if (progressBar) progressBar.style.width = "100%";
            const spinner = document.getElementById(`uploading-${index}`);
            if (spinner) spinner.style.display = "none";
          } else {
            showToast("Lỗi upload ảnh. Kiểm tra Cloudinary config.", "error");
          }
        } catch (err) {
          console.error("Cloudinary parse error:", err, xhr.responseText);
          showToast("Lỗi upload ảnh.", "error");
        }
      } else {
        console.error("Cloudinary upload failed", xhr.status, xhr.responseText);
        showToast("Upload ảnh thất bại.", "error");
      }
    }
  };

  xhr.onerror = function () {
    showToast("Không thể kết nối Cloudinary.", "error");
  };

  xhr.send(fd);
}

function removeImage(index) {
  uploadedImages.splice(index, 1);
  // Re-render toàn bộ preview
  previewGrid.innerHTML = "";
  uploadedImages.forEach((img, i) => {
    renderPreviewItem(i, img.localUrl);
    if (img.cloudUrl) {
      const spinner = document.getElementById(`uploading-${i}`);
      if (spinner) spinner.style.display = "none";
    }
  });
  updateSidebarImage(uploadedImages[0]?.localUrl || null);
}

// ════════════════════════════════════════
// LIVE PREVIEW (sidebar)
// ════════════════════════════════════════
const inpTitle = document.getElementById("inpTitle");
const inpPrice = document.getElementById("inpPrice");
const inpProvince = document.getElementById("inpProvince");

const prevName = document.getElementById("prevName");
const prevPrice = document.getElementById("prevPrice");
const prevLoc = document.getElementById("prevLoc");
const prevImg = document.getElementById("prevImg");

inpTitle.addEventListener("input", () => {
  prevName.textContent = inpTitle.value || "Tên sản phẩm";
  prevName.className = "preview-card-name" + (inpTitle.value ? "" : " empty");
});

inpPrice.addEventListener("input", () => {
  const val = parseInt(inpPrice.value.replace(/\D/g, ""));
  prevPrice.textContent = val
    ? val.toLocaleString("vi-VN") + " ₫"
    : "Chưa có giá";
  prevPrice.className = "preview-card-price" + (val ? "" : " empty");
});

inpProvince.addEventListener("change", () => {
  prevLoc.textContent = inpProvince.value || "—";
});

function updateSidebarImage(url) {
  const placeholder = document.getElementById("imgPlaceholder");
  if (url) {
    prevImg.src = url;
    prevImg.style.display = "block";
    if (placeholder) placeholder.style.display = "none";
  } else {
    prevImg.style.display = "none";
    if (placeholder) placeholder.style.display = "flex";
  }
}

// ════════════════════════════════════════
// SUBMIT — lưu vào Firestore
// ════════════════════════════════════════
document.getElementById("postForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = inpTitle.value.trim();
  const price = parseInt(inpPrice.value.replace(/\D/g, ""));
  const category = document.getElementById("inpCategory").value;
  const province = inpProvince.value;
  const description = document.getElementById("inpDesc").value.trim();
  const phone = document.getElementById("inpPhone").value.trim();

  // Validate
  if (!title) return showToast("Vui lòng nhập tên sản phẩm", "error");
  if (!price) return showToast("Vui lòng nhập giá", "error");
  if (!category) return showToast("Vui lòng chọn danh mục", "error");
  if (!province) return showToast("Vui lòng chọn khu vực", "error");
  if (uploadedImages.length === 0)
    return showToast("Vui lòng thêm ít nhất 1 ảnh", "error");

  // Kiểm tra ảnh còn đang upload
  const stillUploading = uploadedImages.some((img) => !img.cloudUrl);
  if (stillUploading)
    return showToast("Đang upload ảnh, vui lòng chờ...", "info");

  // Bật loading
  const btnSubmit = document.getElementById("btnSubmit");
  btnSubmit.classList.add("loading");
  btnSubmit.disabled = true;

  const listing = {
    title,
    price,
    category,
    province,
    description,
    phone,
    condition: selectedCondition,
    images: uploadedImages.map((img) => ({
      url: img.cloudUrl,
      publicId: img.publicId,
      width: img.width || null,
      height: img.height || null,
    })),
    // Firestore timestamps
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    // TODO: thêm sellerId từ Firebase Auth
  };

  try {
    if (!currentUser) {
      showToast("Bạn cần đăng nhập để đăng tin.", "error");
      btnSubmit.classList.remove("loading");
      btnSubmit.disabled = false;
      setTimeout(() => (window.location.href = "auth.html"), 1000);
      return;
    }

    const docRef = await addDoc(collection(db, "listings"), {
      ...listing,
      ownerId: currentUser.uid,
      status: "active",
    });
    console.log("Created listing:", docRef.id);
    showToast("Đăng tin thành công!", "success");
    setTimeout(() => (window.location.href = "index.html"), 1200);
  } catch (err) {
    console.error(err);
    showToast("Có lỗi xảy ra, thử lại sau.", "error");
  } finally {
    btnSubmit.classList.remove("loading");
    btnSubmit.disabled = false;
  }
});

// ════════════════════════════════════════
// TOAST helper
// ════════════════════════════════════════
function showToast(message, type = "info") {
  const wrap = document.getElementById("toastWrap");
  const icons = {
    success: "ti-circle-check",
    error: "ti-alert-circle",
    info: "ti-info-circle",
  };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="ti ${icons[type]}"></i> ${message}`;
  wrap.appendChild(toast);

  setTimeout(() => toast.remove(), 3500);
}
