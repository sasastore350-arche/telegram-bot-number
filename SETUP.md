# تشغيل TG AFROTO (البوت + التطبيق المصغر)

## 1) البوت
ارفع `main.py` على الاستضافة مكان القديم وأعد التشغيل (`python main.py`). مفيش حاجة تتثبت زيادة.

## 2) التطبيق المصغر (Cloudflare مجاني)
**بدون كمبيوتر:** ارفع محتوى هذا الفولدر (worker.js, wrangler.toml, public/) على GitHub (Private)،
ثم Cloudflare Dashboard ← Workers & Pages ← Create ← Import a repository ← Deploy.
**بكمبيوتر:** `npx wrangler login` ثم `npx wrangler deploy`.

ثم: Worker ← Settings ← Variables and Secrets ← أضف Secret باسم `WORKER_SECRET` (القيمة من البوت).

## 3) BotFather
`/newapp` ← اختار البوت ← Web App URL = رابط الـ Worker ← Short name (مثلاً `app`) ← الرابط: `https://t.me/اسم_البوت/app`

## 4) إعداد البوت
لوحة الأدمن ← 💰 إدارة الكاش ← 📲 Mini App الشحن:
🔑 توليد سر (انسخه في Cloudflare) ← 🌐 رابط الـ Worker ← 🔗 رابط التطبيق ← 🧪 اختبار ← 🟢 تفعيل.

بعد التفعيل: زر «شحن رصيد» في البوت بيفتح التطبيق، والتطبيق فيه الشراء والجلسات والشحن والطلبات والهدايا والإعدادات.
أقسام الشراء (سليمة / سبام) بتتاخد من «إدارة الأقسام» في لوحة الأدمن.
