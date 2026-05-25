# Fresh Up — منيو (GitHub Pages + Firebase RTDB)

نظام منيو يُستضاف على **GitHub Pages** بدون أي سيرفر، ويستخدم:
- **Realtime Database** (مجاني في خطة Spark)
- **Firebase Storage** (لتخزين صور المنتجات)

الرابط النهائي: `https://freshup26.github.io/menu/`
لوحة التحكم:   `https://freshup26.github.io/menu/admin.html`

---

## 📋 الخطوات

### 1️⃣ ضع بيانات Firebase في الكود

افتح ملف `js/firebase-config.js` وعدّل القيم:

```javascript
export const firebaseConfig = {
  apiKey: "AIzaSy.....",                    // من Project Settings
  authDomain: "freshup-2026.firebaseapp.com",
  databaseURL: "https://freshup-2026-default-rtdb.asia-southeast1.firebasedatabase.app",  // ⚠️ ضروري للـ RTDB
  projectId: "freshup-2026",
  storageBucket: "freshup-2026.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc"
};
```

من وين تجيب القيم:
- Firebase Console → ⚙️ **Project Settings** → تحت **Your apps** → اختر تطبيق الويب → انسخ `firebaseConfig`
- لو ما عندك تطبيق ويب، اضغط `</>` ايقونة لإنشاء واحد

---

### 2️⃣ تأكد من قواعد Realtime Database

في Firebase Console → **Realtime Database** → **Rules**

الصق هذه القواعد (مفتوحة للجميع، أنت اخترتها):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

اضغط **Publish**.

> ⚠️ هذه القواعد تسمح لأي شخص بالتعديل. للحماية لاحقاً انظر قسم "الأمان" أسفل.

---

### 3️⃣ فعّل Firebase Storage

1. Firebase Console → **Build → Storage** → **Get started**
2. اختر **Start in production mode** → التالي → **Done**
3. Firebase يطلب الترقية لخطة **Blaze** (الدفع مع وجود مستوى مجاني)
   - أضف بطاقة ائتمانية
   - **مجاناً حتى 5GB تخزين + 1GB تنزيل يومياً** — مستحيل تتعدى للاستخدام العادي
4. روح إلى **Rules** والصق:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

اضغط **Publish**.

---

### 4️⃣ ⚠️ ضبط CORS لـ Storage (مهم جداً لـ GitHub Pages!)

GitHub Pages يحتاج إذن خاص ليرفع صور إلى Firebase Storage. الإعداد مرة واحدة فقط:

**الطريقة الأسهل: Google Cloud Shell (من المتصفح، ما يحتاج تثبيت):**

1. افتح [shell.cloud.google.com](https://shell.cloud.google.com) (سجّل دخول بنفس الحساب)
2. لمّا تفتح الترمنال، الصق هذه الأوامر **سطر سطر**:

```bash
# 1. أنشئ ملف cors.json
cat > cors.json << 'EOF'
[
  {
    "origin": [
      "https://freshup26.github.io",
      "http://localhost:5500",
      "http://127.0.0.1:5500"
    ],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Authorization"]
  }
]
EOF

# 2. اعرف اسم الـ bucket من firebaseConfig (storageBucket)
# مثال: freshup-2026.firebasestorage.app
# 3. طبّق CORS — استبدل BUCKET_NAME باسم الـ bucket عندك:
gcloud storage buckets update gs://BUCKET_NAME --cors-file=cors.json
```

⚠️ لو ظهر خطأ، جرّب الأمر القديم:
```bash
gsutil cors set cors.json gs://BUCKET_NAME
```

للتأكد:
```bash
gcloud storage buckets describe gs://BUCKET_NAME --format="default(cors_config)"
```

---

### 5️⃣ ارفع الملفات على GitHub

عندك ريبو `menu` فاضي. ارفع كل ملفات هذا المجلد إليه:

**من المتصفح:**
1. افتح `https://github.com/Freshup26/menu`
2. اضغط **Add file → Upload files**
3. اسحب كل الملفات (`index.html`, `menu.html`, `admin.html`, مجلد `css/`, مجلد `js/`)
4. اضغط **Commit changes**

**من سطر الأوامر:**
```bash
cd freshup-rtdb
git init
git add .
git commit -m "Fresh Up menu system"
git branch -M main
git remote add origin https://github.com/Freshup26/menu.git
git push -u origin main
```

---

### 6️⃣ فعّل GitHub Pages

1. افتح `https://github.com/Freshup26/menu/settings/pages`
2. تحت **Source** → اختر **Deploy from a branch**
3. اختر **Branch: `main`** + **Folder: `/ (root)`**
4. اضغط **Save**

بعد دقيقة أو دقيقتين، الرابط يصير شغّال:
- 🏠 المنيو: `https://freshup26.github.io/menu/`
- ⚙️ لوحة التحكم: `https://freshup26.github.io/menu/admin.html`

---

## ✅ الاختبار

1. افتح لوحة التحكم → يجب أن يظهر منيوهين افتراضيين (cafe + restaurant)
2. اضغط على منيو → أضف قسم (مثل "ساندويش")
3. اضغط "+ إضافة منتج" → اكتب اسم، سعر، نبذة، ارفع صورة
4. افتح المنيو من الصفحة الرئيسية → المنتج يظهر مع صورته

---

## 📁 بنية الملفات

```
freshup26/menu/
├── index.html              ← الصفحة الرئيسية (اختيار منيو)
├── menu.html               ← عرض المنيو للزبون
├── admin.html              ← لوحة التحكم
├── README.md
├── css/
│   ├── menu.css
│   └── admin.css
└── js/
    ├── firebase-config.js  ← ⚠️ تعدّله ببياناتك
    ├── menu.js
    └── admin.js
```

---

## 🔄 تحديث الموقع لاحقاً

أي تعديل → ادفعه على GitHub → خلال دقيقة يظهر تلقائياً.

---

## 🆘 استكشاف الأخطاء

| المشكلة | الحل |
|--------|------|
| `Failed to fetch` أو `CORS error` عند رفع صورة | لم تضبط CORS — راجع الخطوة 4 |
| `Permission denied` في الكونسول | قواعد RTDB أو Storage مغلقة — راجع الخطوات 2 و 3 |
| الصفحة بيضاء بعد النشر | تأكد أنك عدّلت `firebase-config.js` بقيمك الصحيحة. افتح Console (F12) لرؤية الخطأ |
| `databaseURL is not defined` | أضف `databaseURL` في `firebase-config.js` (مهم لـ RTDB) |
| GitHub Pages لا يعمل | تأكد من تفعيله من Settings → Pages |

---

## 🔒 الأمان لاحقاً (اختياري)

النظام مفتوح حالياً — أي شخص يفتح `/admin.html` يقدر يعدّل. للحماية:

### حماية بسيطة بكلمة سر (في `admin.html` أعلى أول `<script>`):

```javascript
const PASS = "fresh2026";  // غيّر كلمة السر
if (sessionStorage.getItem('fu_auth') !== PASS) {
  const p = prompt('أدخل كلمة السر:');
  if (p !== PASS) { location.href = './'; throw new Error(); }
  sessionStorage.setItem('fu_auth', p);
}
```

⚠️ كلمة السر تكون في الكود (مرئية للخبير). لحماية حقيقية استخدم Firebase Authentication.

---

## 💰 التكلفة

كل شيء مجاني للاستخدام الطبيعي:
- **Realtime Database:** 1GB تخزين + 10GB نقل/شهر مجاناً
- **Storage:** 5GB تخزين + 1GB تنزيل يومياً مجاناً
- **GitHub Pages:** مجاني تماماً

لاستخدام مطعم واحد بآلاف الزيارات شهرياً، **ما راح تدفع شيء**.
