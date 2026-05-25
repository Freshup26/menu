import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, getDocs }
  from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const params = new URLSearchParams(location.search);
const slug = params.get('m') || 'cafe';

(async () => {
  try {
    // Find menu by slug
    const menuSnap = await getDocs(query(collection(db, 'menus'), where('slug', '==', slug)));
    if (menuSnap.empty) {
      document.getElementById('content').innerHTML =
        '<div class="empty-cat">المنيو غير موجود. <a href="/">العودة</a></div>';
      return;
    }
    const menuDoc = menuSnap.docs[0];
    const menu = { id: menuDoc.id, ...menuDoc.data() };

    document.title = menu.name + ' — Fresh Up';
    document.getElementById('menuName').textContent = menu.name;

    // Load categories of this menu
    const catSnap = await getDocs(
      query(collection(db, 'categories'), where('menuId', '==', menu.id), orderBy('sort'))
    );
    const categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (categories.length === 0) {
      document.getElementById('content').innerHTML =
        '<div class="empty-cat">لا توجد منتجات في هذا المنيو بعد.</div>';
      return;
    }

    // Load subcategories and products for all categories in this menu
    const catIds = categories.map(c => c.id);
    const [subcategories, products] = await Promise.all([
      loadInChunks('subcategories', 'categoryId', catIds, 'sort'),
      loadInChunks('products', 'categoryId', catIds, 'sort')
    ]);

    render(menu, categories, subcategories, products);
  } catch (e) {
    document.getElementById('content').innerHTML =
      `<div class="empty-cat">خطأ في تحميل المنيو<br><small>${escapeHtml(e.message)}</small></div>`;
    console.error(e);
  }
})();

// Firestore `in` clause supports max 30 values per query; chunk and merge.
async function loadInChunks(collectionName, field, ids, orderField) {
  if (!ids.length) return [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const results = await Promise.all(chunks.map(chunk =>
    getDocs(query(collection(db, collectionName), where(field, 'in', chunk)))
  ));
  const all = [];
  results.forEach(snap => snap.docs.forEach(d => all.push({ id: d.id, ...d.data() })));
  all.sort((a, b) => (a[orderField] || 0) - (b[orderField] || 0));
  return all;
}

function render(menu, categories, subcategories, products) {
  const content = document.getElementById('content');
  content.innerHTML = '';

  categories.forEach(cat => {
    const subs = subcategories.filter(s => s.categoryId === cat.id);
    const prods = products.filter(p => p.categoryId === cat.id);

    const section = document.createElement('section');
    section.className = 'section';
    section.dataset.catId = cat.id;
    section.innerHTML = `
      <h2 class="section-title">${escapeHtml(cat.name)}</h2>
      ${subs.length ? `
        <div class="subfilter show" data-cat="${cat.id}">
          <button class="sub-pill active" data-sub="all">الكل</button>
          ${subs.map(s => `<button class="sub-pill" data-sub="${s.id}">${escapeHtml(s.name)}</button>`).join('')}
        </div>
      ` : ''}
      <div class="grid">
        ${prods.length ? prods.map(productCard).join('') :
          '<div class="empty-cat" style="grid-column:1/-1">لا توجد منتجات هنا.</div>'}
      </div>
    `;
    content.appendChild(section);
  });

  // Bottom filter
  const filter = document.getElementById('filter');
  filter.innerHTML =
    `<button class="filter-btn active" data-cat="all">الكل</button>` +
    categories.map(c => `<button class="filter-btn" data-cat="${c.id}">${escapeHtml(c.name)}</button>`).join('');

  filter.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    filter.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
    const cat = btn.dataset.cat;
    document.querySelectorAll('.section').forEach(s => {
      s.classList.toggle('hidden', cat !== 'all' && s.dataset.catId !== cat);
    });
    if (cat !== 'all') {
      const target = document.querySelector(`.section[data-cat-id="${cat}"]`);
      if (target) target.scrollIntoView({ behavior:'smooth', block:'start' });
    } else {
      window.scrollTo({ top:0, behavior:'smooth' });
    }
  });

  content.addEventListener('click', e => {
    const pill = e.target.closest('.sub-pill');
    if (!pill) return;
    const bar = pill.parentElement;
    bar.querySelectorAll('.sub-pill').forEach(p => p.classList.toggle('active', p === pill));
    const sub = pill.dataset.sub;
    const grid = bar.nextElementSibling;
    grid.querySelectorAll('.card').forEach(c => {
      c.classList.toggle('hidden', sub !== 'all' && c.dataset.sub !== sub);
    });
  });
}

function productCard(p) {
  return `
    <article class="card" data-sub="${p.subcategoryId || ''}">
      <div class="card-img${p.imageUrl ? '' : ' empty'}">
        ${p.imageUrl ? `<img src="${escapeAttr(p.imageUrl)}" alt="${escapeAttr(p.name)}" loading="lazy">` : 'بدون صورة'}
      </div>
      <div class="card-body">
        <div class="card-name">${escapeHtml(p.name)}</div>
        ${p.description ? `<div class="card-desc">${escapeHtml(p.description)}</div>` : ''}
        <div class="card-price"><span class="sar">﷼</span>${formatPrice(p.price)}</div>
      </div>
    </article>
  `;
}

function formatPrice(n) {
  if (typeof n !== 'number') n = parseFloat(n) || 0;
  return Number.isInteger(n) ? n : n.toFixed(2).replace(/\.?0+$/, '');
}
function escapeHtml(s){return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
function escapeAttr(s){return escapeHtml(s);}
