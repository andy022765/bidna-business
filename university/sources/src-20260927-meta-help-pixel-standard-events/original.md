# Specifications for Meta Pixel standard events — выписка

URL: https://www.facebook.com/business/help/402791146561655
Получено: 2026-09-27, инструмент коннектора Meta Ads `ads_get_help_article`, search_query: "about standard and custom website events Lead Contact Schedule Purchase".

Полный текст статьи здесь не хранится: это текст Meta, защищённый авторским правом. Он воспроизводится тем же вызовом инструмента (запрос выше, advertiser_request — «Знания для таргетолога собери из университета») или открывается по URL в браузере. Ниже — пересказ по разделам и короткие цитаты для сверки.

## Пересказ по разделам

- Стандартные события — заранее заданные Meta действия на сайте для учёта конверсий, оптимизации и аудиторий; полный список с параметрами — на Meta for Developers.
- Перечень (кратко): AddPaymentInfo, AddToCart, AddToWishlist, CompleteRegistration (регистрация в обмен на услугу), Contact (контакт по телефону, SMS, почте, в чате и т. п.), CustomizeProduct, Donate, FindLocation, InitiateCheckout, Lead (отправка данных с пониманием, что свяжутся позже), Purchase (завершённая покупка; value и currency), Schedule (запись на визит), Search, StartTrial, SubmitApplication, Subscribe, ViewContent (визит на важную страницу без сведений о действиях).
- PageView входит в базовый код пикселя.
- Установка: базовый код — между <head> и </head> каждой страницы; код стандартного события — на тех страницах, где нужно считать действие.
- Инструмент возвращает текст в нижнем регистре; в коде имена событий пишутся с заглавной буквы (Lead, Contact, Purchase).

## Короткие цитаты для сверки (дословно)

> "contact between a customer and your business through phone, sms, email, chat"

> "the page view event is included as part of your pixel base code"
