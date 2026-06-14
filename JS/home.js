// ── Category filter chips ──
const chips = document.querySelectorAll('.filter-chip[data-cat]');
chips.forEach(chip => {
  chip.addEventListener('click', () => {
    chips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const cat = chip.dataset.cat;
    filterProducts(cat);
  });
});

function filterProducts(cat) {
  const cards = document.querySelectorAll('.product-card[data-cat]');
  cards.forEach(card => {
    if (cat === 'all' || card.dataset.cat === cat) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

// ── Favourite toggle ──
document.querySelectorAll('.product-fav').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    btn.classList.toggle('active');
    const icon = btn.querySelector('i');
    icon.className = btn.classList.contains('active')
      ? 'ti ti-heart-filled'
      : 'ti ti-heart';
    // TODO: save to Firestore — users/{uid}/favorites
  });
});

// ── Location change modal (placeholder) ──
const btnChangeLocation = document.getElementById('btnChangeLocation');
if (btnChangeLocation) {
  btnChangeLocation.addEventListener('click', () => {
    const province = prompt('Nhập tỉnh / thành phố của bạn:');
    if (province && province.trim()) {
      document.getElementById('currentLocation').textContent = province.trim();
      // TODO: save to Firestore user profile & re-query listings by region
    }
  });
}

// ── Search bar (live filter demo) ──
const searchInput = document.getElementById('globalSearch');
if (searchInput) {
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    document.querySelectorAll('.product-card').forEach(card => {
      const name = card.querySelector('.product-name')?.textContent.toLowerCase() || '';
      card.style.display = (!q || name.includes(q)) ? '' : 'none';
    });
  });
}

// ── Product card click → detail page ──
document.querySelectorAll('.product-card').forEach(card => {
  card.addEventListener('click', () => {
    const id = card.dataset.id;
    // TODO: window.location.href = `product.html?id=${id}`;
    alert(`Xem chi tiết sản phẩm #${id} — trang chi tiết sẽ làm ở bước tiếp theo`);
  });
});