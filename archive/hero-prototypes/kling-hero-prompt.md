# Kling — hero-видео «Видимый эксперт»: РЕАЛЬНЫЙ человек из света

**Цель:** фотореалистичный человек-профессионал, который проявляется/собирается из золотых частиц света на тёмно-синем фоне, доходит до чёткого уверенного образа, лёгкое движение, затем мягко возвращается в свет. Бесшовный луп. На сайте сверху ляжет тёмный скрим слева (под заголовок), человек — в правой части кадра.

**Рендерит:** Андрей (у меня нет доступа к Kling). Готовый файл → `landing-ekspert/img/hero.mp4`, дальше я вставляю, делаю poster, сжимаю, QA.

---

## РЕКОМЕНДУЮ: Image-to-Video (два шага, максимум контроля и реализма)

### Шаг 1. Сгенерировать фото-кадр человека (Midjourney / Higgsfield / любой фотогенератор)

**Prompt (EN):**
> Photorealistic cinematic portrait of a confident professional (a distinguished man or woman, 40s, business-casual, calm assured expression), upper body, positioned on the RIGHT side of a wide 16:9 frame, emerging from deep navy-blue darkness. The figure is partially formed from thousands of fine glowing golden light particles that coalesce into realistic skin and clothing; a warm gold rim-light traces the silhouette. Left side of the frame is dark empty space. Dramatic low-key lighting, shallow depth of field, premium, elegant, editorial. Deep navy background (#0F1430), warm gold accents (#C69A4C). No text, no logo.

**Negative:** text, watermark, logo, distorted face, deformed hands, extra fingers, cartoon, plastic 3d, oversaturated, harsh neon, cluttered background.

Выбери лучший кадр (лицо целое, руки не в кадре или аккуратные, человек справа, слева — тёмное место под текст).

### Шаг 2. Оживить кадр в Kling (Image-to-Video)

**Motion prompt (EN):**
> The golden light particles flow in and complete the person, who comes into sharp photorealistic focus with a gentle breath and a subtle, confident micro-movement; the gold rim-light shimmers softly. Then particles gently begin to lift off the edges. Slow, elegant, cinematic, seamless loop. Camera almost static, very slow push-in.

**Настройки Kling:** режим Professional / High Quality · 16:9 · 5 сек (лучше зациклить короткое) · CFG/relevance средний · сгенерировать 3–4 варианта, выбрать самый чистый (без артефактов лица/рук).

---

## Альтернатива: Text-to-Video напрямую в Kling (проще, но меньше контроля лица)

**Prompt (EN):**
> Cinematic photorealistic scene: a confident professional person (40s, business-casual) on the right side of a 16:9 frame, gradually materializing from thousands of glowing golden light particles against a deep navy-blue void; realistic skin and clothing form, a warm gold rim-light traces the silhouette, the person settles into a calm assured pose with subtle natural movement, then particles softly lift away. Left side dark and empty. Low-key dramatic lighting, shallow depth of field, premium editorial look, deep navy (#0F1430) background, warm gold (#C69A4C) light. Seamless loop, slow graceful motion. No text, no logo.

**Negative:** тот же, что выше.

---

## Требования к финальному файлу (чтобы лёг без проблем)
- Формат: **mp4 (H.264)**, 1920×1080, 16:9.
- Композиция: человек **справа**, слева тёмное поле (туда ляжет заголовок).
- Вес: пришли как есть — **сожму сам** до ~3–4 МБ.
- Куда: `landing-ekspert/img/hero.mp4`. Poster-кадр вытащу сам.

## Что делаю я, когда пришлёшь файл
1. Кладу `hero.mp4`, возвращаю в hero тег `<video>` (autoplay/muted/loop/playsinline) поверх тёмного скрима.
2. Вытаскиваю самый чёткий кадр → `hero-poster.jpg` (плейсхолдер, пока грузится видео).
3. Сжимаю до веса, проверяю читаемость заголовка поверх, `prefers-reduced-motion` → постер.
4. Canvas-«мишень» удаляю полностью.

Связано: `content-plan.md` (HERO), `index.html`.
