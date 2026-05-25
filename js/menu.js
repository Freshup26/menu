import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const params = new URLSearchParams(location.search);
const slug = params.get('m') || 'cafe';

(async () => {
  try {
    // Load all data
    const [menusSnap, catsSnap, subsSnap, prodsSnap] = await Promise.all([
      get(ref(db, 'menus')),
      get(ref(db, 'categories')),
      get(ref(db, 'subcategories')),
      get(ref(db, 'products')),
    ]);

    const menus = toArray(menusSnap.val());
    const menu = menus.find(m => m.slug === slug);

    if (!menu) {
      document.getElementById('content').innerHTML =
        '<div class="empty-cat">المنيو غير موجود. <a href="./">العودة</a></div>';
      return;
    }

    document.title = menu.name + ' — Fresh Up';
    document.getElementById('menuName').textContent = menu.name;

    const categories = toArray(catsSnap.val())
      .filter(c => c.menuId === menu.id)
      .sort((a,b) => (a.sort||0) - (b.sort||0));

    if (!categories.length) {
      document.getElementById('content').innerHTML =
        '<div class="empty-cat">لا توجد منتجات في هذا المنيو بعد.</div>';
      return;
    }

    const catIds = new Set(categories.map(c => c.id));
    const subcategories = toArray(subsSnap.val())
      .filter(s => catIds.has(s.categoryId))
      .sort((a,b) => (a.sort||0) - (b.sort||0));
    const products = toArray(prodsSnap.val())
      .filter(p => catIds.has(p.categoryId))
      .sort((a,b) => (a.sort||0) - (b.sort||0));

    render(menu, categories, subcategories, products);
  } catch (e) {
    document.getElementById('content').innerHTML =
      `<div class="empty-cat">خطأ في تحميل المنيو<br><small>${escapeHtml(e.message)}</small></div>`;
    console.error(e);
  }
})();

function toArray(obj) {
  if (!obj) return [];
  return Object.entries(obj).map(([id, v]) => ({ id, ...v }));
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
