# Higgsfield — ролик 11A «Business DNA / Money Leaks»
Источник: ТЗ из чата ChatGPT (share 6aae06cd). Сведено 18.09.

Сюжет в одной строке: **ДНК бизнеса → трещина и утечка денег → диагностический скан → цифровые
сотрудники входят в найденные узлы → система целая.**

Правило: **текст в кадре не генерируем** — модели плохо рисуют буквы. Все надписи накладываем
в монтаже. Итог 10 с = три шота по 5 с, подрезаются на монтаже (есть запас).

---

## Порядок сборки (важнее самих промптов)

1. Сгенерировать **один мастер-кадр** ДНК (Soul / Nano Banana, промпт STILL ниже).
2. Шот A — image-to-video от этого кадра.
3. Шот B — **стартовый кадр = последний кадр шота A**.
4. Шот C — **стартовый кадр = последний кадр шота B**.

Без цепочки кадров три генерации дадут три разные ДНК, и «один непрерывный shot» развалится.

Модель: **Kling 3.0** или **Seedance 2.5** — это то, что реально стоит в Higgsfield на 19.09.2026
(Kling заметно дешевле по кредитам, Seedance точнее держит камеру). 16:9, 5 с на шот.
Ключевой объект держать по центру — чтобы потом кадрировать в 9:16.

---

## STILL — мастер-кадр (для image-to-video)

```
Colossal vertical double helix floating in a pitch-black void, built not from biology but from
interlocking business modules: thin platinum data-filaments, geometric nodes, brushed metal rings.
Cold white and platinum, deep graphite shadows, volumetric haze, subtle rim light.
One node near the center shows a hairline fracture.
Premium technology commercial, cinematic 35mm, shallow depth of field, ultra clean.
No text, no letters, no UI panels, no robots, no neon, no cyberpunk.
```

---

## БЛОК 1 — THE LEAK (0.0–3.5 с)

```
A colossal platinum double helix of business modules slowly rotates in a black void.
A hairline fracture opens on one node and warm golden light particles begin bleeding out,
drifting down slowly like escaping embers. The leak grows steadily.
Camera: slow cinematic dolly in toward the fracture.
Cold white key light, deep shadows, volumetric haze, shallow depth of field, premium tech commercial.
No text, no robots, no UI, no sparks or fireworks.
```
Наложение (монтаж): **Где ваш бизнес теряет деньги?** / *WHERE IS YOUR BUSINESS LOSING MONEY?*

---

## БЛОК 2 — THE DIAGNOSTIC (3.5–6.5 с)

```
The same platinum double helix in the black void. A thin cold blue scanning plane sweeps down
the full structure; where it passes, the helix turns semi-transparent and reveals its inner
architecture. Three damaged nodes ignite deep red, all other nodes stay neutral white.
Golden particles still leaking from the fracture.
Camera: slow 20-degree orbit around the helix during the scan.
Medical scan precision, cold white and pale blue light, clean and controlled.
No text, no HUD graphics, no charts, no robots.
```
Наложение: **Сначала — глубокая диагностика** / *FIRST — DIAGNOSE*

---

## БЛОК 3 — THE FIX (6.5–10.0 с)

```
Four minimal humanoid silhouettes made of pure white light rise and fly deliberately into the
red damaged nodes of the platinum double helix. On contact the red fades to clean white,
the fractures seal, the golden leak stops. The whole helix pulses once with steady even energy.
Camera: smooth slow pull back revealing the complete repaired structure.
Elegant, controlled, premium, balanced white and gold light.
No metal robots, no text, no arrows, no charts, no percentages, no confetti.
```
Финальное наложение: **Находим потери. Усиливаем систему. Масштабируем с AI.**

---

## Общий стиль (если модель просит отдельным полем)

`premium cinematic business technology, McKinsey / Apple / Palantir commercial, dark graphite
environment, platinum and cold white, controlled golden particles, volumetric haze, 35mm,
shallow depth of field`

**Negative:** `text, letters, typography, UI, HUD, charts, percentages, humanoid metal robots,
cyberpunk, neon, Matrix, crypto, office, people, handshake, dollar bills, arrows up, cartoon`

---

## Что проверять на приёмке

- золотые частицы — **медленные**, не фейерверк;
- узлов с проблемой **три-четыре**, не больше, иначе кадр в мусоре;
- в финале **никаких графиков с цифрами и процентами** (анти-гарантия проекта);
- на лендинге ставить **без loop**: `autoplay muted playsinline`, замереть на последнем кадре —
  иначе петля читается как «починили → опять сломалось».
