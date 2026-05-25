import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  getStorage, ref as sRef, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// ============================================================
const state = {
  menus: [], currentMenuId: null,
  categories: [], subcategories: [], products: [],
};
const $  = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2400);
}
function escapeHtml(s){return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
function formatPrice(n){if(typeof n!=='number')n=parseFloat(n)||0;return Number.isInteger(n)?n:n.toFixed(2).replace(/\.?0+$/,'');}

// ============================================================
//  Seed default menus on first run
// ============================================================
async function ensureSeed() {
  const snap = await getDocs(collection(db, 'menus'));
  if (snap.empty) {
    await addDoc(collection(db, 'menus'), { slug:'cafe', name:'منيو المقهى', sort:1, createdAt: serverTimestamp() });
    await addDoc(collection(db, 'menus'), { slug:'restaurant', name:'منيو المطعم', sort:2, createdAt: serverTimestamp() });
  }
}

// ============================================================
//  Menus
// ============================================================
async function loadMenus() {
  const snap = await getDocs(query(collection(db, 'menus'), orderBy('sort')));
  state.menus = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderMenus();
  if (state.menus.length && !state.currentMenuId) await selectMenu(state.menus[0].id);
  else if (state.menus.length && state.currentMenuId && !state.menus.find(m => m.id === state.currentMenuId)) {
    state.currentMenuId = null;
    await selectMenu(state.menus[0].id);
  }
  else if (!state.menus.length) {
    state.currentMenuId = null;
    $('#workspace').hidden = true;
    $('#empty').hidden = false;
  }
}

function renderMenus() {
  $('#menuList').innerHTML = state.menus.map(m => `
    <li data-id="${m.id}" class="${m.id === state.currentMenuId ? 'active' : ''}">
      <span>${escapeHtml(m.name)}</span>
      <span class="slug">${escapeHtml(m.slug)}</span>
    </li>
  `).join('');
  $('#menuList').querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => selectMenu(li.dataset.id));
  });
}

async function selectMenu(id) {
  state.currentMenuId = id;
  renderMenus();
  await loadWorkspace();
}

$('#addMenuBtn').addEventListener('click', () => {
  openPrompt({
    title: 'منيو جديد',
    fields: [
      { name:'name', label:'اسم المنيو (يُعرض للزبون)', required:true, placeholder:'مثال: منيو المقهى' },
      { name:'slug', label:'الرابط (إنجليزي بدون مسافات)', required:true, placeholder:'مثال: cafe' }
    ],
    onSubmit: async ({ name, slug }) => {
      if (!/^[a-z0-9\-_]+$/i.test(slug)) throw new Error('slug يجب أن يكون إنجليزي');
      // ensure unique slug
      const existing = await getDocs(query(collection(db,'menus'), where('slug','==',slug)));
      if (!existing.empty) throw new Error('هذا الـ slug موجود مسبقاً');
      const sort = (Math.max(0, ...state.menus.map(m => m.sort || 0)) || 0) + 1;
      await addDoc(collection(db,'menus'), { name, slug, sort, createdAt: serverTimestamp() });
      toast('تم إنشاء المنيو');
      await loadMenus();
    }
  });
});

$('#renameMenu').addEventListener('click', () => {
  const menu = state.menus.find(m => m.id === state.currentMenuId);
  if (!menu) return;
  openPrompt({
    title: 'إعادة تسمية',
    fields: [{ name:'name', label:'الاسم الجديد', required:true, value:menu.name }],
    onSubmit: async ({ name }) => {
      await updateDoc(doc(db,'menus',menu.id), { name });
      toast('تم التعديل');
      await loadMenus();
    }
  });
});

$('#deleteMenu').addEventListener('click', () => {
  const menu = state.menus.find(m => m.id === state.currentMenuId);
  if (!menu) return;
  openConfirm(`سيتم حذف المنيو "${menu.name}" وكل أقسامه ومنتجاته.`, async () => {
    await cascadeDeleteMenu(menu.id);
    state.currentMenuId = null;
    toast('تم الحذف');
    await loadMenus();
  });
});

async function cascadeDeleteMenu(menuId) {
  const cats = await getDocs(query(collection(db,'categories'), where('menuId','==',menuId)));
  for (const c of cats.docs) await cascadeDeleteCategory(c.id);
  await deleteDoc(doc(db,'menus',menuId));
}

// ============================================================
//  Workspace
// ============================================================
async function loadWorkspace() {
  if (!state.currentMenuId) return;
  $('#empty').hidden = true;
  $('#workspace').hidden = false;
  const menu = state.menus.find(m => m.id === state.currentMenuId);
  $('#menuTitle').textContent = menu.name;

  const cats = await getDocs(query(collection(db,'categories'), where('menuId','==',state.currentMenuId), orderBy('sort')));
  state.categories = cats.docs.map(d => ({ id:d.id, ...d.data() }));
  const catIds = state.categories.map(c => c.id);

  state.subcategories = await loadInChunks('subcategories', 'categoryId', catIds);
  state.products      = await loadInChunks('products',      'categoryId', catIds);

  $('#catCount').textContent = state.categories.length;
  $('#prodCount').textContent = state.products.length;
  renderCategories();
}

async function loadInChunks(coll, field, ids) {
  if (!ids.length) return [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const all = [];
  for (const chunk of chunks) {
    const snap = await getDocs(query(collection(db, coll), where(field, 'in', chunk)));
    snap.docs.forEach(d => all.push({ id:d.id, ...d.data() }));
  }
  all.sort((a,b) => (a.sort||0) - (b.sort||0));
  return all;
}

function renderCategories() {
  const root = $('#catList');
  if (!state.categories.length) {
    root.innerHTML = `<div class="empty" style="min-height:auto;padding:30px 10px;">لا توجد أقسام بعد. اضغط "+ قسم جديد" للبدء.</div>`;
    return;
  }
  root.innerHTML = state.categories.map(cat => {
    const catSubs = state.subcategories.filter(s => s.categoryId === cat.id);
    const catProds = state.products.filter(p => p.categoryId === cat.id);
    return `
      <div class="cat-card" data-cat="${cat.id}">
        <div class="cat-head">
          <div class="name">${escapeHtml(cat.name)} <span style="opacity:0.6;font-weight:500;font-size:12px">(${catProds.length})</span></div>
          <div class="controls">
            <button class="btn-sm outline" data-action="rename-cat">تعديل</button>
            <button class="btn-sm outline danger" data-action="delete-cat">حذف</button>
          </div>
        </div>
        <div class="cat-body">
          <div class="subs">
            ${catSubs.map(s => `
              <span class="sub-tag">
                ${escapeHtml(s.name)}
                <button class="del" data-action="del-sub" data-sub="${s.id}" title="حذف">×</button>
              </span>
            `).join('')}
            <button class="add-sub" data-action="add-sub">+ قسم فرعي</button>
          </div>
          <div class="prods">
            ${catProds.map(productItem).join('')}
            <button class="add-product" data-action="add-product">+ إضافة منتج</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  root.querySelectorAll('.cat-card').forEach(card => {
    const catId = card.dataset.cat;
    card.addEventListener('click', e => {
      const action = e.target.dataset.action;
      if (!action) return;
      if (action === 'rename-cat')   renameCategory(catId);
      else if (action === 'delete-cat')    deleteCategory(catId);
      else if (action === 'add-sub')       addSubcategory(catId);
      else if (action === 'del-sub')       deleteSubcategory(e.target.dataset.sub);
      else if (action === 'add-product')   openProductModal(catId, null);
      else if (action === 'edit-product')  openProductModal(catId, e.target.dataset.prod);
      else if (action === 'delete-product')deleteProduct(e.target.dataset.prod);
    });
  });
}

function productItem(p) {
  const sub = state.subcategories.find(s => s.id === p.subcategoryId);
  return `
    <div class="prod" data-prod="${p.id}">
      <div class="prod-img">
        ${p.imageUrl ? `<img src="${escapeHtml(p.imageUrl)}" alt="">` : 'بدون<br>صورة'}
      </div>
      <div class="prod-info">
        <div class="prod-name">${escapeHtml(p.name)}</div>
        <div class="prod-price">${formatPrice(p.price)} ﷼</div>
        ${sub ? `<div class="prod-sub">${escapeHtml(sub.name)}</div>` : ''}
        <div class="prod-actions">
          <button class="mini" data-action="edit-product" data-prod="${p.id}">تعديل</button>
          <button class="mini danger" data-action="delete-product" data-prod="${p.id}">حذف</button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
//  Categories
// ============================================================
$('#addCat').addEventListener('click', () => {
  openPrompt({
    title:'قسم جديد',
    fields:[{ name:'name', label:'اسم القسم', required:true, placeholder:'مثال: ساندويش' }],
    onSubmit: async ({ name }) => {
      const sort = (Math.max(0, ...state.categories.map(c => c.sort || 0)) || 0) + 1;
      await addDoc(collection(db,'categories'), { menuId: state.currentMenuId, name, sort });
      toast('تم إنشاء القسم');
      await loadWorkspace();
    }
  });
});

function renameCategory(catId) {
  const c = state.categories.find(x => x.id === catId);
  openPrompt({
    title:'تعديل القسم',
    fields:[{ name:'name', label:'اسم القسم', required:true, value:c.name }],
    onSubmit: async ({ name }) => {
      await updateDoc(doc(db,'categories',catId), { name });
      toast('تم التعديل');
      await loadWorkspace();
    }
  });
}

async function cascadeDeleteCategory(catId) {
  // delete products + images
  const prodSnap = await getDocs(query(collection(db,'products'), where('categoryId','==',catId)));
  for (const p of prodSnap.docs) {
    const data = p.data();
    if (data.imagePath) {
      try { await deleteObject(sRef(storage, data.imagePath)); } catch {}
    }
    await deleteDoc(p.ref);
  }
  // delete subcategories
  const subSnap = await getDocs(query(collection(db,'subcategories'), where('categoryId','==',catId)));
  for (const s of subSnap.docs) await deleteDoc(s.ref);
  // delete category
  await deleteDoc(doc(db,'categories',catId));
}

function deleteCategory(catId) {
  const c = state.categories.find(x => x.id === catId);
  const prodCount = state.products.filter(p => p.categoryId === catId).length;
  openConfirm(`حذف القسم "${c.name}"${prodCount ? ` و${prodCount} منتج بداخله` : ''}؟`, async () => {
    await cascadeDeleteCategory(catId);
    toast('تم الحذف');
    await loadWorkspace();
  });
}

// ============================================================
//  Subcategories
// ============================================================
function addSubcategory(catId) {
  openPrompt({
    title:'قسم فرعي جديد',
    fields:[{ name:'name', label:'اسم القسم الفرعي', required:true, placeholder:'مثال: دجاج' }],
    onSubmit: async ({ name }) => {
      const sort = (Math.max(0, ...state.subcategories.filter(s => s.categoryId === catId).map(s => s.sort || 0)) || 0) + 1;
      await addDoc(collection(db,'subcategories'), { categoryId: catId, name, sort });
      toast('تم الإضافة');
      await loadWorkspace();
    }
  });
}

async function deleteSubcategory(subId) {
  const s = state.subcategories.find(x => x.id === subId);
  openConfirm(`حذف القسم الفرعي "${s.name}"؟`, async () => {
    // unlink products that reference it
    const linkedProds = await getDocs(query(collection(db,'products'), where('subcategoryId','==',subId)));
    const batch = writeBatch(db);
    linkedProds.docs.forEach(p => batch.update(p.ref, { subcategoryId: null }));
    batch.delete(doc(db,'subcategories',subId));
    await batch.commit();
    toast('تم الحذف');
    await loadWorkspace();
  });
}

// ============================================================
//  Products
// ============================================================
const prodModal = $('#productModal');
const prodForm  = $('#productForm');
const prodImg   = $('#prodImg');
const prodImgPreview = $('#prodImgPreview');
const clearImgBtn    = $('#clearImg');

$('#pickImgBtn').addEventListener('click', () => prodImg.click());

prodImg.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    prodImgPreview.innerHTML = `<img src="${ev.target.result}" alt="">`;
    clearImgBtn.hidden = false;
  };
  reader.readAsDataURL(file);
});

clearImgBtn.addEventListener('click', () => {
  prodImg.value = '';
  prodImgPreview.innerHTML = '<span>اختر صورة</span>';
  clearImgBtn.hidden = true;
});

function openProductModal(catId, prodId) {
  prodForm.reset();
  $('#prodId').value = prodId || '';
  $('#prodCatId').value = catId;

  // Populate subcategories
  const subs = state.subcategories.filter(s => s.categoryId === catId);
  $('#prodSub').innerHTML = '<option value="">— بدون —</option>' +
    subs.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

  if (prodId) {
    const p = state.products.find(x => x.id === prodId);
    $('#prodModalTitle').textContent = 'تعديل منتج';
    $('#prodName').value  = p.name;
    $('#prodPrice').value = p.price;
    $('#prodDesc').value  = p.description || '';
    if (p.subcategoryId) $('#prodSub').value = p.subcategoryId;
    if (p.imageUrl) {
      prodImgPreview.innerHTML = `<img src="${escapeHtml(p.imageUrl)}" alt="">`;
      clearImgBtn.hidden = false;
    } else {
      prodImgPreview.innerHTML = '<span>اختر صورة</span>';
      clearImgBtn.hidden = true;
    }
  } else {
    $('#prodModalTitle').textContent = 'منتج جديد';
    prodImgPreview.innerHTML = '<span>اختر صورة</span>';
    clearImgBtn.hidden = true;
  }
  showModal(prodModal);
}

prodForm.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('#saveProdBtn');
  const id      = $('#prodId').value;
  const catId   = $('#prodCatId').value;
  const subId   = $('#prodSub').value || null;
  const name    = $('#prodName').value.trim();
  const price   = parseFloat($('#prodPrice').value) || 0;
  const desc    = $('#prodDesc').value.trim();
  const file    = prodImg.files[0];

  btn.disabled = true; btn.textContent = 'جارٍ الحفظ...';
  try {
    let imageUrl = null, imagePath = null;
    const existing = id ? state.products.find(p => p.id === id) : null;

    if (file) {
      // delete old image if exists
      if (existing?.imagePath) {
        try { await deleteObject(sRef(storage, existing.imagePath)); } catch {}
      }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      imagePath = `products/${Date.now()}-${Math.random().toString(36).slice(2,10)}.${ext}`;
      const snap = await uploadBytes(sRef(storage, imagePath), file);
      imageUrl = await getDownloadURL(snap.ref);
    } else if (existing) {
      imageUrl  = existing.imageUrl  || null;
      imagePath = existing.imagePath || null;
    }

    const payload = {
      categoryId: catId,
      subcategoryId: subId,
      name, description: desc, price,
      imageUrl, imagePath,
    };

    if (id) {
      await updateDoc(doc(db,'products',id), payload);
      toast('تم حفظ التعديلات');
    } else {
      const sort = (Math.max(0, ...state.products.filter(p => p.categoryId === catId).map(p => p.sort || 0)) || 0) + 1;
      await addDoc(collection(db,'products'), { ...payload, sort, createdAt: serverTimestamp() });
      toast('تم إضافة المنتج');
    }
    hideModal(prodModal);
    await loadWorkspace();
  } catch (err) {
    console.error(err);
    toast(err.message || 'فشلت العملية', true);
  } finally {
    btn.disabled = false; btn.textContent = 'حفظ';
  }
});

function deleteProduct(prodId) {
  const p = state.products.find(x => x.id === prodId);
  openConfirm(`حذف المنتج "${p.name}"؟`, async () => {
    if (p.imagePath) {
      try { await deleteObject(sRef(storage, p.imagePath)); } catch {}
    }
    await deleteDoc(doc(db,'products',prodId));
    toast('تم الحذف');
    await loadWorkspace();
  });
}

// ============================================================
//  Modal helpers
// ============================================================
function showModal(m) { m.hidden = false; }
function hideModal(m) { m.hidden = true; }

document.addEventListener('click', e => {
  if (e.target.dataset.close !== undefined || e.target.classList.contains('modal-bg')) {
    const modal = e.target.closest('.modal');
    if (modal) hideModal(modal);
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $$('.modal').forEach(m => !m.hidden && hideModal(m));
});

function openPrompt({ title, fields, onSubmit }) {
  $('#promptTitle').textContent = title;
  $('#promptFields').innerHTML = fields.map(f => `
    <label class="field">
      <span class="label">${escapeHtml(f.label)}${f.required ? ' <em>*</em>' : ''}</span>
      <input type="text" name="${f.name}" ${f.required ? 'required' : ''}
        ${f.placeholder ? `placeholder="${escapeHtml(f.placeholder)}"` : ''}
        value="${escapeHtml(f.value || '')}">
    </label>
  `).join('');
  const form = $('#promptForm');
  form.onsubmit = async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await onSubmit(data);
      hideModal($('#promptModal'));
    } catch (err) {
      toast(err.message || 'فشلت العملية', true);
    }
  };
  showModal($('#promptModal'));
  setTimeout(() => form.querySelector('input')?.focus(), 50);
}

function openConfirm(message, onYes) {
  $('#confirmMessage').textContent = message;
  $('#confirmYes').onclick = async () => {
    try {
      await onYes();
      hideModal($('#confirmModal'));
    } catch (err) {
      toast(err.message || 'فشل الحذف', true);
    }
  };
  showModal($('#confirmModal'));
}

// ============================================================
//  Start
// ============================================================
(async () => {
  try {
    await ensureSeed();
    await loadMenus();
  } catch (e) {
    console.error(e);
    toast('فشل الاتصال بـ Firebase: ' + e.message, true);
  }
})();
