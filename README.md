# Fresh Up — نسخة Firebase

نظام إدارة منيوهات يشتغل بالكامل على Firebase (مجاناً) — بدون أي سيرفر Node.js.

- **Hosting:** Firebase Hosting (مجاني، CDN عالمي)
- **قاعدة البيانات:** Firestore (مجاني حتى 50,000 قراءة/يوم)
- **الصور:** Firebase Storage (مجاني حتى 5 GB)

---

## 🔥 الخطوات كاملة (10 دقائق)

### الخطوة 1: إنشاء مشروع Firebase

1. روح [console.firebase.google.com](https://console.firebase.google.com)
2. اضغط **Add project** → اكتب اسم (مثل `freshup`) → التالي → التالي → **Create project**
3. لمّا يخلص، اضغط **Continue**

### الخطوة 2: تفعيل Firestore + Storage + Hosting

**Firestore:**
1. من القائمة اليسرى: **Build** → **Firestore Database** → **Create database**
2. اختر **Start in production mode** → التالي
3. اختر أقرب موقع (مثل `eur3` أو `nam5`) → **Enable**

**Storage:**
1. **Build** → **Storage** → **Get started**
2. **Start in production mode** → التالي → **Done**
3. ⚠️ Firebase الآن يطلب خطة Blaze لتفعيل Storage. الخطة مجانية حتى تتعدى الحد الشهري الكبير (5GB تخزين، 1GB تنزيل يومياً). تحتاج تضيف بطاقة لكن ما يخصم شيء.
4. لو ما تبغى Storage الآن، النظام يشتغل بدون صور.

**Web App:**
1. روح إلى **Project Overview** (⚙️ بجوار Project Settings)
2. تحت **Your apps**، اضغط أيقونة `</>` (Web)
3. اكتب nickname (مثل `freshup-web`)، تجاهل خيار Hosting، اضغط **Register app**
4. **انسخ كائن firebaseConfig** — هذا اللي تحتاجه

### الخطوة 3: ضع البيانات في المشروع

افتح ملف `public/js/firebase-config.js` واستبدل القيم بقيم firebaseConfig اللي نسختها:

```javascript
export const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXX",
  authDomain: "freshup-xxx.firebaseapp.com",
  projectId: "freshup-xxx",
  storageBucket: "freshup-xxx.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc"
};
```

افتح ملف `.firebaserc` واستبدل `YOUR-PROJECT-ID` بـ projectId:

```json
{
  "projects": { "default": "freshup-xxx" }
}
```

### الخطوة 4: رفع المشروع على GitHub

من جوّالك أو الكمبيوتر:

**من تطبيق GitHub على الجوال:**
1. افتح [github.com](https://github.com) → سجّل دخول بحساب `Freshup26`
2. اضغط ➕ → **New repository**
3. الاسم: `freshup-menu` → **Public** → **Create**
4. اضغط **uploading an existing file** → ارفع كل ملفات المشروع (اسحبها أو اخترها)
5. أو من المتصفح: افتح الريبو → **Add file** → **Upload files** → اسحب الملفات

**من الكمبيوتر (terminal):**
```bash
cd freshup-firebase
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Freshup26/freshup-menu.git
git push -u origin main
```

### الخطوة 5: ربط GitHub بـ Firebase Hosting (Auto-deploy)

من الكمبيوتر:

```bash
# 1. ثبّت Firebase CLI (مرة واحدة فقط)
npm install -g firebase-tools

# 2. سجّل دخول
firebase login

# 3. ادخل مجلد المشروع
cd freshup-firebase

# 4. شغّل إعداد GitHub integration
firebase init hosting:github
```

هذا الأمر سيسألك:
- **For which GitHub repository?** → اكتب `Freshup26/freshup-menu`
- **Set up the workflow to run a build script before every deploy?** → `N`
- **Set up automatic deployment to your site's live channel?** → `Y`
- **What is the name of the GitHub branch?** → `main`

سيُنشئ ملفات `.github/workflows/` تلقائياً — ارفعها لـ GitHub:

```bash
git add .github
git commit -m "Add Firebase auto-deploy"
git push
```

### الخطوة 6: نشر القواعد (rules) أول مرة

```bash
firebase deploy --only firestore:rules,storage
```

### ✅ خلاص! الآن:

- موقعك جاهز على: `https://YOUR-PROJECT-ID.web.app`
- لوحة التحكم على: `https://YOUR-PROJECT-ID.web.app/admin.html`
- **أي تعديل تدفعه (push) لـ GitHub** → يُنشر تلقائياً في خلال 1-2 دقيقة

---

## 📁 بنية الملفات

```
freshup-firebase/
├── firebase.json              ← إعدادات Hosting + Firestore + Storage
├── .firebaserc                ← project ID
├── firestore.rules            ← قواعد Firestore
├── storage.rules              ← قواعد Storage
├── firestore.indexes.json
├── .gitignore
└── public/                    ← كل اللي يُنشر
    ├── index.html             ← الصفحة الرئيسية (اختيار منيو)
    ├── menu.html              ← عرض المنيو للزبون
    ├── admin.html             ← لوحة التحكم
    ├── css/
    │   ├── menu.css
    │   └── admin.css
    └── js/
        ├── firebase-config.js  ← ⚠️ تعدّله ببياناتك
        ├── menu.js
        └── admin.js
```

---

## ⚠️ ملاحظات أمنية مهمة

النظام حالياً **مفتوح للجميع** — أي شخص يقدر يفتح `/admin.html` ويضيف/يحذف منتجات (هذا اللي اخترته).

### للأمان لاحقاً:

**خيار 1: حماية بكلمة سر بسيطة (HTML)**

أضف في بداية `admin.html`:
```javascript
const PASS = "كلمة-السر-الخاصة-بك";
if (sessionStorage.getItem('auth') !== PASS) {
  const p = prompt('أدخل كلمة السر:');
  if (p !== PASS) { location.href = '/'; }
  else sessionStorage.setItem('auth', p);
}
```
⚠️ هذا حماية ضعيفة — كلمة السر تظهر في الكود.

**خيار 2: Firebase Authentication (آمن)**

اقرأ: https://firebase.google.com/docs/auth/web/start

غيّر `firestore.rules` و `storage.rules` لتسمح بالكتابة فقط للمستخدمين المسجّلين:
```
allow write: if request.auth != null;
```

---

## 🔄 تحديث الموقع لاحقاً

أي تعديل على الملفات:
1. عدّل الملفات محلياً
2. `git add . && git commit -m "وصف" && git push`
3. Firebase ينشر تلقائياً

أو يدوياً: `firebase deploy --only hosting`

---

## 🆘 استكشاف الأخطاء

| المشكلة | الحل |
|--------|------|
| `Firebase: Error (auth/...)` | تأكد من نسخ firebaseConfig بشكل صحيح |
| `Missing or insufficient permissions` | لم تنشر القواعد: `firebase deploy --only firestore:rules` |
| لا تظهر صور | فعّل Storage في Firebase Console + خطة Blaze المجانية |
| `firebase: command not found` | `npm install -g firebase-tools` |
| Auto-deploy لا يعمل | تحقق من Actions في GitHub repo |

---

## 💰 التكلفة

كل شيء مجاني للاستخدام الطبيعي (مطعم واحد، آلاف الزيارات شهرياً):
- **Firestore:** 50K قراءة + 20K كتابة + 20K حذف يومياً مجاناً
- **Storage:** 5GB تخزين + 1GB تنزيل يومياً مجاناً
- **Hosting:** 10GB تخزين + 360MB نقل يومياً مجاناً

لو تعديت الحدود، Firebase ينبهك قبل ما يخصم.
