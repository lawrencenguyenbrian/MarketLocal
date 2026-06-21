// ════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════
const CLOUDINARY_CLOUD_NAME = "dfdom0zpb";
const CLOUDINARY_UPLOAD_PRESET = "market_local";

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

// ── Redirect to login if not authenticated ──
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) {
    showToast("Vui lòng đăng nhập để đăng tin.", "error");
    setTimeout(() => {
      window.location.href = "auth.html";
    }, 1200);
  }
});

// ════════════════════════════════════════
// SHARED NAVBAR UPDATER (copy this function)
// ════════════════════════════════════════
function updateNavbar(user) {
  const userMenu = document.getElementById("navUserMenu");
  const userAvatar = document.getElementById("navUserAvatar");
  const userName = document.getElementById("navUserName");

  if (!userMenu) return; // Safety check

  if (user) {
    userMenu.classList.remove("d-none");
    userMenu.classList.add("d-md-flex");

    const name = user.displayName || user.email?.split("@")[0] || "Bạn";
    if (userName) userName.textContent = name;

    if (userAvatar) {
      if (user.photoURL) {
        userAvatar.innerHTML = `<img src="${user.photoURL}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
      } else {
        userAvatar.textContent = name.charAt(0).toUpperCase();
      }
    }
  } else {
    userMenu.classList.add("d-none");
    userMenu.classList.remove("d-md-flex");
  }
}

// Call it when auth state changes
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) {
    showToast("Vui lòng đăng nhập để đăng tin.", "error");
    setTimeout(() => {
      window.location.href = "auth.html";
    }, 1200);
    return;
  }
  updateNavbar(user); // ← This makes the menu show
});

// ════════════════════════════════════════
// STATE
// ════════════════════════════════════════
let uploadedImages = [];
let selectedCondition = "new";

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
// IMAGE UPLOAD
// ════════════════════════════════════════
const uploadZone = document.getElementById("uploadZone");
const fileInput = document.getElementById("fileInput");
const previewGrid = document.getElementById("previewGrid");

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
      <div style="width:80%;height:6px;background:rgba(0,0,0,0.06);border-radius:4px;margin-top:6px;overflow:hidden;">
        <div id="progress-bar-${index}" style="width:0%;height:100%;background:var(--primary);transition:width .2s"></div>
      </div>
    </div>
    ${index === 0 ? '<span class="preview-main-badge">Ảnh bìa</span>' : ""}
    <button class="preview-remove" onclick="removeImage(${index})" title="Xoá ảnh">✕</button>
  `;
  previewGrid.appendChild(item);
}

function uploadToCloudinary(file, index) {
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
    const pct = Math.round((e.loaded / e.total) * 100);
    if (progressBar) progressBar.style.width = pct + "%";
    if (uploadingEl)
      uploadingEl.querySelector(".uploading-text").textContent =
        `Đang tải... ${pct}%`;
  });

  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
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
      } catch {
        showToast("Lỗi phân tích phản hồi Cloudinary.", "error");
      }
    } else {
      showToast("Upload ảnh thất bại (HTTP " + xhr.status + ").", "error");
    }
  };

  xhr.onerror = () => showToast("Không thể kết nối Cloudinary.", "error");
  xhr.send(fd);
}

window.removeImage = function (index) {
  uploadedImages.splice(index, 1);
  previewGrid.innerHTML = "";
  uploadedImages.forEach((img, i) => {
    renderPreviewItem(i, img.localUrl);
    if (img.cloudUrl) {
      const spinner = document.getElementById(`uploading-${i}`);
      if (spinner) spinner.style.display = "none";
    }
  });
  updateSidebarImage(uploadedImages[0]?.localUrl || null);
};

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
// SUBMIT
// ════════════════════════════════════════
document.getElementById("postForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) {
    showToast("Vui lòng đăng nhập để đăng tin.", "error");
    setTimeout(() => {
      window.location.href = "auth.html";
    }, 1000);
    return;
  }

  const title = inpTitle.value.trim();
  const price = parseInt(inpPrice.value.replace(/\D/g, ""));
  const category = document.getElementById("inpCategory").value;
  const province = inpProvince.value;
  const description = document.getElementById("inpDesc").value.trim();
  const phone = document.getElementById("inpPhone").value.trim();

  if (!title) return showToast("Vui lòng nhập tên sản phẩm", "error");
  if (!price) return showToast("Vui lòng nhập giá", "error");
  if (!category) return showToast("Vui lòng chọn danh mục", "error");
  if (!province) return showToast("Vui lòng chọn khu vực", "error");
  if (uploadedImages.length === 0)
    return showToast("Vui lòng thêm ít nhất 1 ảnh", "error");

  const stillUploading = uploadedImages.some((img) => !img.cloudUrl);
  if (stillUploading)
    return showToast("Đang upload ảnh, vui lòng chờ...", "info");

  const btnSubmit = document.getElementById("btnSubmit");
  btnSubmit.classList.add("loading");
  btnSubmit.disabled = true;

  try {
    const docRef = await addDoc(collection(db, "listings"), {
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
      ownerId: currentUser.uid,
      ownerName:
        currentUser.displayName ||
        currentUser.email?.split("@")[0] ||
        "Ẩn danh",
      status: "active",
      views: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    showToast("Đăng tin thành công! 🎉", "success");
    setTimeout(() => {
      window.location.href = "home.html";
    }, 1200);
  } catch (err) {
    console.error("Firestore error:", err);
    showToast("Có lỗi xảy ra khi lưu tin. Thử lại sau.", "error");
  } finally {
    btnSubmit.classList.remove("loading");
    btnSubmit.disabled = false;
  }
});

// ════════════════════════════════════════
// TOAST
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

// Logout handler
document.getElementById("navLogoutBtn")?.addEventListener("click", async () => {
  const { signOut } =
    await import("https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js");
  await signOut(auth);
  window.location.href = "auth.html";
});
