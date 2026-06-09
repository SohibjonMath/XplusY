(function(){
  "use strict";

  const STORAGE_KEY = "orzumall_lang";
  const CACHE_KEY = "orzumall_ai_translations_v2";
  const SUPPORTED = ["uz", "ru", "en"];
  const LANG_LABELS = { uz:"UZ", ru:"RU", en:"EN" };

  const exact = {
    ru: {
      "Qidiruv":"Поиск",
      "Qidirish":"Искать",
      "Mahsulot va toifalarni qidiring":"Ищите товары и категории",
      "OrzuMall Search":"OrzuMall Поиск",
      "Topa olmadingiz?":"Не нашли?",
      "Rasm yoki qisqa izoh yuboring — bot topib beradi.":"Отправьте фото или краткое описание — бот поможет найти.",
      "Kiyim, elektronika, uy-ro‘zg‘or va boshqa kategoriyalar.":"Одежда, электроника, товары для дома и другие категории.",
      "Botga yuborish":"Отправить боту",
      "Mahsulotlar":"Товары",
      "Kategoriya":"Категория",
      "Ommabop":"Популярное",
      "Narx ↑":"Цена ↑",
      "Narx ↓":"Цена ↓",
      "Yangi":"Новинки",
      "Yana yuklash":"Загрузить ещё",
      "Ko‘proq mahsulotlar uchun “Yana yuklash”ni bosing yoki pastga scroll qiling.":"Чтобы увидеть больше товаров, нажмите «Загрузить ещё» или прокрутите вниз.",
      "Hech narsa topilmadi.":"Ничего не найдено.",
      "Bosh sahifa":"Главная",
      "Sevimlilar":"Избранное",
      "Savat":"Корзина",
      "Profil":"Профиль",
      "Yoqtirgan mahsulotlaringiz bir joyda.":"Понравившиеся товары в одном месте.",
      "Sevimlilar hozircha bo‘sh":"Избранное пока пусто",
      "Yoqgan mahsulotlaringizni yurakcha orqali shu bo‘limga saqlang.":"Сохраняйте понравившиеся товары сюда через сердечко.",
      "Savatingiz hozircha bo‘sh":"Ваша корзина пока пуста",
      "Mahsulotlarni savatga qo‘shsangiz, buyurtma shu yerda shakllanadi.":"Когда добавите товары в корзину, заказ появится здесь.",
      "Buyurtma uchun tanlash":"Выбор для заказа",
      "Kerakli mahsulotlarni belgilang yoki hammasini tanlang.":"Отметьте нужные товары или выберите все.",
      "Hammasini tanlash":"Выбрать все",
      "Buyurtma berish":"Оформить заказ",
      "Telegramga yuborish":"Отправить в Telegram",
      "Tozalash":"Очистить",
      "Variant tanlang":"Выберите вариант",
      "Yopish":"Закрыть",
      "Rang":"Цвет",
      "Iltimos, rangni tanlang":"Пожалуйста, выберите цвет",
      "O‘lcham":"Размер",
      "Iltimos, o‘lchamni tanlang":"Пожалуйста, выберите размер",
      "Miqdor":"Количество",
      "Kamaytirish":"Уменьшить",
      "Ko‘paytirish":"Увеличить",
      "Bekor":"Отмена",
      "Savatchaga qo‘shish":"Добавить в корзину",
      "Savatchaga":"В корзину",
      "Savatga":"В корзину",
      "Savatga qo‘shildi":"Добавлено в корзину",
      "Ko‘rish":"Открыть",
      "Sevimli":"Избранное",
      "Sevimlidan olib tashlash":"Удалить из избранного",
      "O‘chirish":"Удалить",
      "Oldindan to‘lov":"Предоплата",
      "Asl mahsulot":"Оригинальный товар",
      "Mahsulot turi":"Тип товара",
      "Barchasi":"Все",
      "Mahsulotlarni ko‘rish":"Показать товары",
      "Filterni tozalash":"Сбросить фильтр",
      "Kategoriya topilmadi.":"Категория не найдена.",
      "Tavsif":"Описание",
      "Video":"Видео",
      "Sharh":"Отзывы",
      "Ma'lumot":"Информация",
      "Balans":"Баланс",
      "Balans to‘ldirish":"Пополнить баланс",
      "Click orqali balans to‘ldirish":"Пополнение баланса через Click",
      "Ro‘yxatdan o‘tish":"Регистрация",
      "Kirish":"Войти",
      "Telefon":"Телефон",
      "Parol":"Пароль",
      "Parolni qayta kiriting":"Повторите пароль",
      "Qayta parol":"Повторите пароль",
      "Ism":"Имя",
      "Familiya":"Фамилия",
      "Viloyat":"Область",
      "Tuman":"Район",
      "Pochta indeks":"Почтовый индекс",
      "Ko‘rsatish/Yashirish":"Показать/скрыть",
      "Ro‘yxatdan o‘tganda sizga avtomatik ID beriladi.":"При регистрации вам автоматически будет присвоен ID.",
      "Kuting...":"Подождите...",
      "Tekshirilmoqda va yuklanmoqda":"Проверка и загрузка",
      "Tahrirlash":"Редактировать",
      "Saqlash":"Сохранить",
      "Chiqish":"Выйти",
      "Manzil":"Адрес",
      "Yetkazib berish":"Доставка",
      "To‘lov":"Оплата",
      "Umumiy summa":"Итого",
      "Jami":"Итого",
      "Savatcha":"Корзина",
      "Orqaga":"Назад",
      "Tanlangan mahsulotlaringiz shu yerda jamlanadi.":"Выбранные товары будут собраны здесь.",
      "Sevimlilarni tozalash":"Очистить избранное",
      "Savatchani tozalash":"Очистить корзину",
      "Savatchada":"В корзине",
      "tanlangan":"выбрано",
      "Sevimli":"Избранное",
      "Yuborilmoqda...":"Отправляется...",
      "Yuklanmoqda...":"Загрузка...",
      "Hozircha sharh yo‘q.":"Отзывов пока нет.",
      "Bu mahsulot uchun video link qo‘shilmagan.":"Для этого товара видео-ссылка не добавлена.",
      "ta":"шт.",
      "Hammasi yuklandi":"Всё загружено",
      "Nomsiz":"Без названия",
      "Hammasi":"Все",
      "UZB":"УЗБ",
      "Xitoy":"Китай",
      "O‘zbekiston":"Узбекистан",
      "Xitoydan":"Из Китая",
      "O‘zbekistondan":"Из Узбекистана",
      "Xitoydan buyurtma":"Заказ из Китая",
      "Manzil tanlangandan keyin":"После выбора адреса",
      "Taxminan 20 kun":"Примерно 20 дней",
      "Xitoydan: taxminan 20 kun":"Из Китая: примерно 20 дней",
      "Yetkazish manzil tanlangandan keyin hisoblanadi":"Срок доставки рассчитывается после выбора адреса",
      "Buyurtma asosida olib kelinadi":"Привезём под заказ",
      "O‘zbekiston ichidan yetkaziladi":"Доставляется из Узбекистана",
      "Oddiy ombor mahsulotidan alohida tizim":"Отдельная система для товаров под заказ",
      "guruh":"группа",
      "Variant ma’lumoti hozircha kiritilmagan":"Данные о вариантах пока не добавлены",
      "Tashqi katalog variantlari":"Варианты внешнего каталога",
      "Variant":"Вариант",
      "Variantlar":"Варианты",
      "O‘lchamlar":"Размеры",
      "Variantni aniq tanlang":"Точно выберите вариант",
      "Rang, model, o‘lcham yoki komplekt alohida SKU sifatida hisoblanadi.":"Цвет, модель, размер или комплект считаются отдельными SKU.",
      "Mahsulot siz uchun Xitoydan olib kelinadi.":"Товар будет привезён для вас из Китая.",
      "Yetkazish muddati manzil tanlangandan keyin hisoblanadi.":"Срок доставки рассчитывается после выбора адреса.",
      "Buyurtma tasdiqlangach xarid jarayoni boshlanadi.":"После подтверждения заказа начинается процесс покупки.",
      "Xitoydan buyurtma mahsuloti":"Товар под заказ из Китая",
      "O‘zbekiston mahsuloti":"Товар из Узбекистана",
      "Kerakli variantlarni aniq tanlang. Mahsulot taxminan 20 kunda olib kelinadi.":"Точно выберите нужные варианты. Товар будет доставлен примерно за 20 дней.",
      "Kerakli variantlarni aniq tanlang. Yetkazish muddati savatda manzil tanlangandan keyin hisoblanadi.":"Точно выберите нужные варианты. Срок доставки рассчитывается в корзине после выбора адреса.",
      "Xitoydan olib kelinadi":"Доставляется из Китая",
      "Mahsulot siz uchun buyurtma asosida olib kelinadi":"Товар будет привезён для вас под заказ",
      "Aniq muddat savatda manzil tanlangandan keyin hisoblanadi":"Точный срок рассчитывается в корзине после выбора адреса",
      "Xitoydan olib kelamiz":"Привезём из Китая",
      "O‘zbekistonda":"В Узбекистане",
      "Holati":"Статус",
      "Vazn":"Вес",
      "Ranglar":"Цвета",
      "Kerakli variantni tanlang":"Выберите нужный вариант",
      "Variant tanlash shart emas":"Выбирать вариант не требуется",
      "Tasdiqlangan xaridorlar bahosi":"Оценки подтверждённых покупателей",
      "Sharh faqat xariddan keyin yoziladi":"Отзыв можно оставить только после покупки",
      "Buyurtma yetkazilgach, Profil → Buyurtmalar bo‘limidagi mahsulot qatoridan alohida baho va fikr qoldirishingiz mumkin.":"После доставки заказа вы сможете отдельно оценить товар и оставить отзыв в разделе Профиль → Заказы.",
      "Hozircha tasdiqlangan sharh yo‘q":"Подтверждённых отзывов пока нет",
      "Sharhlar faqat yetkazilgan buyurtmalardagi mahsulotlardan yoziladi.":"Отзывы можно оставлять только на товары из доставленных заказов.",
      "Sharhlar yuklanmoqda...":"Отзывы загружаются...",
      "Tekshiruvda":"На проверке",
      "E’lon qilingan":"Опубликовано",
      "Baho bering":"Оценить",
      "Mahsulot haqida fikringizni yozing":"Напишите мнение о товаре",
      "Baholash hali yopiq":"Оценка пока недоступна",
      "Buyurtma yetkazilgandan keyin ochiladi":"Откроется после доставки заказа",
      "Mahsulotlar topilmadi.":"Товары не найдены.",
      "xil":"видов",
      "dona":"шт.",
      "Chek":"Чек",
      "Qayta buyurtma":"Повторить заказ",
      "Bekor qilish":"Отменить",
      "Tasdiqlangan xarid":"Подтверждённая покупка",
      "Variant tanlanmagan":"Вариант не выбран",
      "Buyurtmani bekor qilish":"Отмена заказа",
      "Eng mos sababni tanlang. Kerak bo‘lsa “Boshqa sabab” orqali o‘zingiz yozishingiz mumkin. Buyurtma balansdan to‘langan bo‘lsa mablag‘ avtomatik qaytariladi.":"Выберите подходящую причину. При необходимости укажите свою через «Другая причина». Если заказ оплачен с баланса, средства будут возвращены автоматически.",
      "Bekor qilish sababi":"Причина отмены",
      "Masalan: adashib buyurtma berdim":"Например: заказал по ошибке",
      "Mahsulotni baholash":"Оценка товара",
      "Faqat yetkazib berilgan ushbu mahsulot uchun baho va sharh yozing. Fikringiz admin tekshiruvidan keyin mahsulot sahifasida ko‘rinadi.":"Оцените и оставьте отзыв только на этот доставленный товар. Отзыв появится на странице товара после проверки администратором.",
      "Fikringiz":"Ваш отзыв",
      "Mahsulot va xizmat haqida fikringizni yozing":"Напишите мнение о товаре и обслуживании",
      "Fikrni saqlash":"Сохранить отзыв",
      "Bahoni tanlang":"Выберите оценку",
      "Yoqmadi":"Не понравилось",
      "Qoniqarsiz":"Неудовлетворительно",
      "Yaxshi":"Хорошо",
      "Juda yaxshi":"Очень хорошо",
      "A’lo":"Отлично",
      "Tasdiqlangan xaridor fikri":"Отзыв подтверждённого покупателя",
      "Sizning bahoyingiz boshqa xaridorlarga to‘g‘ri tanlov qilishda yordam beradi.":"Ваша оценка поможет другим покупателям сделать правильный выбор.",
      "Mahsulotni qanday baholaysiz?":"Как вы оцениваете товар?",
      "Yulduzchani bosing":"Нажмите на звезду",
      "Tezkor fikrlar":"Быстрые отзывы",
      "Sifatli":"Качественный товар",
      "Sifatli mahsulot":"Качественный товар",
      "Qadoqlanishi yaxshi":"Хорошая упаковка",
      "Narxiga arziydi":"Стоит своих денег",
      "Tavsiya qilaman":"Рекомендую",
      "Sabab yoki izoh":"Причина или комментарий",
      "Mahsulot sifati, qadoqlanishi va foydalanish taassurotingizni yozing...":"Напишите о качестве товара, упаковке и впечатлениях от использования...",
      "Qisqa, aniq va foydali fikr yozing":"Напишите краткий, понятный и полезный отзыв",
      "Yuborish":"Отправить",
      "Buyurtma amali":"Действие с заказом",
      "Buyurtma cheki":"Чек заказа",
      "Bekor qilish sababini tanlang":"Выберите причину отмены",
      "Sababni tanlang":"Выберите причину",
      "Adashib buyurtma berdim":"Заказал по ошибке",
      "Mahsulotni noto‘g‘ri tanladim":"Выбрал не тот товар",
      "Yetkazib berish muddati menga to‘g‘ri kelmadi":"Не подошёл срок доставки",
      "Yetkazib berish narxi menga to‘g‘ri kelmadi":"Не подошла стоимость доставки",
      "To‘lov usulini o‘zgartirmoqchiman":"Хочу изменить способ оплаты",
      "Manzil yoki telefon raqamini noto‘g‘ri kiritdim":"Неверно указал адрес или телефон",
      "Boshqa joydan xarid qildim":"Купил в другом месте",
      "Boshqa sabab":"Другая причина",
      "Boshqa sababni yozing":"Укажите другую причину",
      "Sababni qisqacha yozing...":"Кратко укажите причину...",
      "Fikr bildirildi":"Отзыв отправлен",
      "admin tasdig‘i kutilmoqda":"ожидает проверки администратора",
      "OrzuMall javobi":"Ответ OrzuMall",
      "Chek topilmadi.":"Чек не найден.",
      "Buyurtma topilmadi.":"Заказ не найден.",
      "Mahsulot topilmadi.":"Товар не найден.",
      "Fikringizni yozing.":"Напишите отзыв.",
      "Sababni batafsil yozing.":"Опишите причину подробнее.",
      "Fikringiz yuborildi. Admin tasdiqlagach namoyish qilinadi.":"Ваш отзыв отправлен. Он появится после проверки администратором.",
      "Sharh faqat yetkazib berilgan buyurtmadagi mahsulotga yoziladi.":"Отзыв можно оставить только на товар из доставленного заказа.",
      "Bu mahsulotga fikr yuborilgan.":"Отзыв на этот товар уже отправлен.",
      "Ertaga":"Завтра",
      "2 kun ichida":"В течение 2 дней",
      "3 kun ichida":"В течение 3 дней",
      "ko‘rish":"просмотров",
      "savat":"в корзину",
      "sevimli":"избранное",
      "sotuv":"продаж",
      "ball":"баллов",
      "turi":"тип",
      "Hammasi tanlangan":"Выбрано всё",
      "Chekni yuklang va yuboring.":"Загрузите чек и отправьте.",
      "Chek faylini yuklang.":"Загрузите файл чека.",
      "Chek Telegram'ga yuborilmoqda...":"Чек отправляется в Telegram...",
      "Chek yuborish":"Отправить чек",
      "Chek (screenshot/PDF)":"Чек (скриншот/PDF)",
      "Chekni yuklang va so‘rovni yuboring.":"Загрузите чек и отправьте заявку.",
      "sharh":"отзывов",
      "popular":"популярность",
      "Ko‘rishlar":"Просмотры",
      "Popularlik":"Популярность",
      "Mahsulot statistikasi":"Статистика товара",
      "ta sharh":"отзывов",
      "Xaridorlar sharhlari":"Отзывы покупателей",
      "Faqat yetkazib berilgan buyurtmalar asosidagi haqiqiy fikrlar.":"Только реальные отзывы по доставленным заказам.",
      "Foydalanuvchi":"Пользователь",
      "Yaqinda":"Недавно",
      "yulduz":"звёзд",
      "Baho qoldirilgan.":"Оставлена оценка.",
      "Buyurtma holati":"Статус заказа",
      "Tanlangan filter bo‘yicha buyurtma topilmadi.":"Заказы по выбранному фильтру не найдены.",
      "Avvalgi buyurtma fikri":"Предыдущий отзыв о заказе",
      "Mijoz":"Клиент",
      "To‘lov turi":"Способ оплаты",
      "Xaritada ochish":"Открыть на карте",
      "Savolingiz bo‘lsa buyurtma ID sini ko‘rsating":"При обращении укажите ID заказа",
      "Buyurtma harakati":"История заказа",
      "Sabab":"Причина",
      "Izoh":"Комментарий",
      "Qaytarish sababi":"Причина возврата",
      "Yangi":"Новый",
      "Yangi • to‘langan":"Новый • оплачено",
      "Yig‘ilyapti":"Собирается",
      "Yetkazib berishda":"В доставке",
      "Yetkazib berildi":"Доставлено",
      "Bekor qilindi":"Отменено",
      "Qaytarish so‘rovi yuborildi":"Запрос на возврат отправлен",
      "Qaytarildi":"Возвращено",
      "Qaytarish rad etildi":"Возврат отклонён",
      "Muvaffaqiyatsiz":"Не удалось",
      "Naqd":"Наличные",
      "Karta":"Карта",
      "Balans":"Баланс",
      "Buyurtmalar":"Заказы",
      "Buyurtmalarim":"Мои заказы",
      "Yetkazildi":"Доставлено",
      "Bekor":"Отменено",
      "Qaytarish":"Возврат",
      "Hozircha buyurtmalar yo‘q.":"Заказов пока нет.",
      "Faollik tarixi":"История активности",
      "Mablag‘lar":"Средства",
      "Mablag‘lar tarixi":"История операций",
      "Joriy balans":"Текущий баланс",
      "Joriy hisob":"Текущий счёт",
      "Ichki hamyon":"Внутренний кошелёк",
      "Balansdan to‘lash":"Оплатить с баланса",
      "To‘ldirish":"Пополнить",
      "Yetkazib berishni sozlash":"Настройка доставки",
      "Yetkazib berishni o‘zgartirish":"Изменить доставку",
      "Yetkazish usuli":"Способ доставки",
      "Yetkazish usulini tanlang":"Выберите способ доставки",
      "Kuryer orqali yetkazish":"Курьерская доставка",
      "Do‘kondan olib ketish":"Самовывоз",
      "Topshirish punkti":"Пункт выдачи",
      "Topshirish punktini tanlang":"Выберите пункт выдачи",
      "Lokatsiyani aniqlash":"Определить местоположение",
      "Saqlangan manzil":"Сохранённый адрес",
      "Asosiy manzil":"Основной адрес",
      "Nom bering":"Введите название",
      "Masalan: Uyim / Ishim":"Например: Дом / Работа",
      "Promokod":"Промокод",
      "Promokodingiz bo‘lsa kiriting.":"Введите промокод, если он у вас есть.",
      "Qo‘llash":"Применить",
      "Yakuniy summa":"Итоговая сумма",
      "To‘lanadigan jami summa":"Сумма к оплате",
      "Rasmiylashtirish":"Оформить",
      "Mahsulot kelib chiqishi bo‘yicha filtr":"Фильтр по происхождению товара",
      "Mahsulotlar soni":"Количество товаров",
      "Savatga qo‘shish":"Добавить в корзину",
      "Mahsulot tafsiloti":"Детали товара",
      "Mahsulot yuklanmoqda...":"Товар загружается...",
      "Mahsulot ma'lumotlari":"Информация о товаре",
      "Tavsifni ko‘rish":"Показать описание",
      "Bildirishnomalar":"Уведомления",
      "Hozircha bildirishnoma yo‘q.":"Уведомлений пока нет.",
      "Hammasini o‘qilgan qilish":"Отметить всё прочитанным",
      "Siz uchun":"Для вас",
      "Sizga yoqishi mumkin":"Вам может понравиться",
      "Tavsiya mahsulotlari":"Рекомендуемые товары",
      "Yaqinda ko‘rilganlar":"Недавно просмотренные",
      "Yaqinda ko‘rilgan mahsulotlar":"Недавно просмотренные товары",
      "Balans to‘ldirish bosqichlari":"Этапы пополнения баланса",
      "Click orqali":"Через Click",
      "Summa (so‘m)":"Сумма (сум)",
      "Yuboriladigan summa":"Сумма перевода",
      "Karta egasi":"Владелец карты",
      "Karta raqami":"Номер карты",
      "Pulni shu kartaga o‘tkazing":"Переведите деньги на эту карту",
      "Davom etish":"Продолжить",
      "Oldingi":"Назад",
      "Keyingi":"Далее",
      "Mahsulot sharhlari":"Отзывы о товаре",
      "Xarid qilish":"Покупка",
      "Jami narx":"Итоговая цена",
      "Savatchaga":"В корзину",
      "Reklama":"Реклама",
      "Popular ball":"Популярность",
      "Tanlangan":"Выбрано",
      "Hammasi tanlangan":"Выбрано всё",
      "Tanlangan:":"Выбрано:",
      "Mahsulot tanlanmagan":"Товар не выбран",
      "Mahsulot tanlang":"Выберите товар",
      "Mahsulot tafsilotlari tayyorlanmoqda...":"Подготавливаются детали товара...",
      "Do‘kondan olib ketish":"Самовывоз",
      "Xaritada":"На карте",
      "To‘liq ekran":"Полный экран",
      "Pochta indeksi":"Почтовый индекс",
      "Yetkazish":"Доставка",
      "Boshqa mahsulotlar":"Другие товары",
      "Rasmni to‘liq ekranda ko‘rish":"Открыть изображение на весь экран",
      "Shu kategoriyadagi mahsulotlarni ko‘rish":"Показать товары этой категории",
      "Tasdiqlangan":"Подтверждено",
      "Tekshirilmoqda":"Проверяется",
      "Yangi seller":"Новый продавец",
      "Muvaffaqiyatli yetkazilgan":"Успешно доставлено",
      "Mahsulotlar hozir sotuvda mavjud emas.":"Товары сейчас недоступны для продажи.",
      "Buyurtma mahsulotlari topilmadi.":"Товары заказа не найдены.",
      "Rasm":"Фото"
    },
    en: {
      "Qidiruv":"Search",
      "Qidirish":"Search",
      "Mahsulot va toifalarni qidiring":"Search products and categories",
      "OrzuMall Search":"OrzuMall Search",
      "Topa olmadingiz?":"Couldn’t find it?",
      "Rasm yoki qisqa izoh yuboring — bot topib beradi.":"Send a photo or short description — the bot will help find it.",
      "Kiyim, elektronika, uy-ro‘zg‘or va boshqa kategoriyalar.":"Clothing, electronics, home goods and other categories.",
      "Botga yuborish":"Send to bot",
      "Mahsulotlar":"Products",
      "Kategoriya":"Category",
      "Ommabop":"Popular",
      "Narx ↑":"Price ↑",
      "Narx ↓":"Price ↓",
      "Yangi":"New",
      "Yana yuklash":"Load more",
      "Ko‘proq mahsulotlar uchun “Yana yuklash”ni bosing yoki pastga scroll qiling.":"To see more products, tap “Load more” or scroll down.",
      "Hech narsa topilmadi.":"Nothing found.",
      "Bosh sahifa":"Home",
      "Sevimlilar":"Favorites",
      "Savat":"Cart",
      "Profil":"Profile",
      "Yoqtirgan mahsulotlaringiz bir joyda.":"Your favorite products in one place.",
      "Sevimlilar hozircha bo‘sh":"Favorites are empty",
      "Yoqgan mahsulotlaringizni yurakcha orqali shu bo‘limga saqlang.":"Save products you like here using the heart icon.",
      "Savatingiz hozircha bo‘sh":"Your cart is empty",
      "Mahsulotlarni savatga qo‘shsangiz, buyurtma shu yerda shakllanadi.":"When you add products to the cart, your order will appear here.",
      "Buyurtma uchun tanlash":"Select for order",
      "Kerakli mahsulotlarni belgilang yoki hammasini tanlang.":"Choose the needed products or select all.",
      "Hammasini tanlash":"Select all",
      "Buyurtma berish":"Place order",
      "Telegramga yuborish":"Send to Telegram",
      "Tozalash":"Clear",
      "Variant tanlang":"Choose variant",
      "Yopish":"Close",
      "Rang":"Color",
      "Iltimos, rangni tanlang":"Please choose a color",
      "O‘lcham":"Size",
      "Iltimos, o‘lchamni tanlang":"Please choose a size",
      "Miqdor":"Quantity",
      "Kamaytirish":"Decrease",
      "Ko‘paytirish":"Increase",
      "Bekor":"Cancel",
      "Savatchaga qo‘shish":"Add to cart",
      "Savatchaga":"Cart",
      "Savatga":"To cart",
      "Savatga qo‘shildi":"Added to cart",
      "Ko‘rish":"View",
      "Sevimli":"Favorite",
      "Sevimlidan olib tashlash":"Remove from favorites",
      "O‘chirish":"Delete",
      "Oldindan to‘lov":"Prepayment",
      "Asl mahsulot":"Original product",
      "Mahsulot turi":"Product type",
      "Barchasi":"All",
      "Mahsulotlarni ko‘rish":"View products",
      "Filterni tozalash":"Clear filter",
      "Kategoriya topilmadi.":"Category not found.",
      "Tavsif":"Description",
      "Video":"Video",
      "Sharh":"Reviews",
      "Ma'lumot":"Information",
      "Balans":"Balance",
      "Balans to‘ldirish":"Top up balance",
      "Click orqali balans to‘ldirish":"Balance top-up via Click",
      "Ro‘yxatdan o‘tish":"Sign up",
      "Kirish":"Log in",
      "Telefon":"Phone",
      "Parol":"Password",
      "Parolni qayta kiriting":"Repeat password",
      "Qayta parol":"Repeat password",
      "Ism":"First name",
      "Familiya":"Last name",
      "Viloyat":"Region",
      "Tuman":"District",
      "Pochta indeks":"Postal code",
      "Ko‘rsatish/Yashirish":"Show/hide",
      "Ro‘yxatdan o‘tganda sizga avtomatik ID beriladi.":"You will automatically receive an ID when you sign up.",
      "Kuting...":"Please wait...",
      "Tekshirilmoqda va yuklanmoqda":"Checking and loading",
      "Tahrirlash":"Edit",
      "Saqlash":"Save",
      "Chiqish":"Log out",
      "Manzil":"Address",
      "Yetkazib berish":"Delivery",
      "To‘lov":"Payment",
      "Umumiy summa":"Total",
      "Jami":"Total",
      "Savatcha":"Cart",
      "Orqaga":"Back",
      "Tanlangan mahsulotlaringiz shu yerda jamlanadi.":"Your selected products are collected here.",
      "Sevimlilarni tozalash":"Clear favorites",
      "Savatchani tozalash":"Clear cart",
      "Savatchada":"In cart",
      "tanlangan":"selected",
      "Sevimli":"Favorite",
      "Yuborilmoqda...":"Sending...",
      "Yuklanmoqda...":"Loading...",
      "Hozircha sharh yo‘q.":"No reviews yet.",
      "Bu mahsulot uchun video link qo‘shilmagan.":"No video link has been added for this product.",
      "ta":"pcs",
      "Hammasi yuklandi":"All loaded",
      "Nomsiz":"Untitled",
      "Hammasi":"All",
      "UZB":"UZB",
      "Xitoy":"China",
      "O‘zbekiston":"Uzbekistan",
      "Xitoydan":"From China",
      "O‘zbekistondan":"From Uzbekistan",
      "Xitoydan buyurtma":"Order from China",
      "Manzil tanlangandan keyin":"After selecting an address",
      "Taxminan 20 kun":"About 20 days",
      "Xitoydan: taxminan 20 kun":"From China: about 20 days",
      "Yetkazish manzil tanlangandan keyin hisoblanadi":"Delivery time is calculated after selecting an address",
      "Buyurtma asosida olib kelinadi":"Delivered to order",
      "O‘zbekiston ichidan yetkaziladi":"Delivered from Uzbekistan",
      "Oddiy ombor mahsulotidan alohida tizim":"Separate system for made-to-order products",
      "guruh":"group",
      "Variant ma’lumoti hozircha kiritilmagan":"Variant information has not been added yet",
      "Tashqi katalog variantlari":"External catalog variants",
      "Variant":"Variant",
      "Variantlar":"Variants",
      "O‘lchamlar":"Sizes",
      "Variantni aniq tanlang":"Choose the exact variant",
      "Rang, model, o‘lcham yoki komplekt alohida SKU sifatida hisoblanadi.":"Color, model, size or bundle is treated as a separate SKU.",
      "Mahsulot siz uchun Xitoydan olib kelinadi.":"The product will be brought from China for you.",
      "Yetkazish muddati manzil tanlangandan keyin hisoblanadi.":"Delivery time is calculated after selecting an address.",
      "Buyurtma tasdiqlangach xarid jarayoni boshlanadi.":"The purchase process starts after the order is confirmed.",
      "Xitoydan buyurtma mahsuloti":"Made-to-order product from China",
      "O‘zbekiston mahsuloti":"Product from Uzbekistan",
      "Kerakli variantlarni aniq tanlang. Mahsulot taxminan 20 kunda olib kelinadi.":"Choose the required variants carefully. The product will arrive in about 20 days.",
      "Kerakli variantlarni aniq tanlang. Yetkazish muddati savatda manzil tanlangandan keyin hisoblanadi.":"Choose the required variants carefully. Delivery time is calculated in the cart after selecting an address.",
      "Xitoydan olib kelinadi":"Delivered from China",
      "Mahsulot siz uchun buyurtma asosida olib kelinadi":"The product will be brought for you to order",
      "Aniq muddat savatda manzil tanlangandan keyin hisoblanadi":"The exact delivery time is calculated in the cart after selecting an address",
      "Xitoydan olib kelamiz":"We will bring it from China",
      "O‘zbekistonda":"In Uzbekistan",
      "Holati":"Status",
      "Vazn":"Weight",
      "Ranglar":"Colors",
      "Kerakli variantni tanlang":"Choose the required variant",
      "Variant tanlash shart emas":"No variant selection is required",
      "Tasdiqlangan xaridorlar bahosi":"Verified buyer ratings",
      "Sharh faqat xariddan keyin yoziladi":"Reviews can only be written after purchase",
      "Buyurtma yetkazilgach, Profil → Buyurtmalar bo‘limidagi mahsulot qatoridan alohida baho va fikr qoldirishingiz mumkin.":"After delivery, you can rate the product and leave a review from the product row in Profile → Orders.",
      "Hozircha tasdiqlangan sharh yo‘q":"No approved reviews yet",
      "Sharhlar faqat yetkazilgan buyurtmalardagi mahsulotlardan yoziladi.":"Reviews can only be written for products from delivered orders.",
      "Sharhlar yuklanmoqda...":"Loading reviews...",
      "Tekshiruvda":"Under review",
      "E’lon qilingan":"Published",
      "Baho bering":"Rate product",
      "Mahsulot haqida fikringizni yozing":"Write your opinion about the product",
      "Baholash hali yopiq":"Rating is not available yet",
      "Buyurtma yetkazilgandan keyin ochiladi":"Available after order delivery",
      "Mahsulotlar topilmadi.":"Products not found.",
      "xil":"types",
      "dona":"pcs",
      "Chek":"Receipt",
      "Qayta buyurtma":"Reorder",
      "Bekor qilish":"Cancel",
      "Tasdiqlangan xarid":"Verified purchase",
      "Variant tanlanmagan":"No variant selected",
      "Buyurtmani bekor qilish":"Cancel order",
      "Eng mos sababni tanlang. Kerak bo‘lsa “Boshqa sabab” orqali o‘zingiz yozishingiz mumkin. Buyurtma balansdan to‘langan bo‘lsa mablag‘ avtomatik qaytariladi.":"Choose the most suitable reason. If necessary, enter your own under “Other reason”. If the order was paid from balance, the funds will be refunded automatically.",
      "Bekor qilish sababi":"Cancellation reason",
      "Masalan: adashib buyurtma berdim":"For example: I ordered by mistake",
      "Mahsulotni baholash":"Rate product",
      "Faqat yetkazib berilgan ushbu mahsulot uchun baho va sharh yozing. Fikringiz admin tekshiruvidan keyin mahsulot sahifasida ko‘rinadi.":"Rate and review only this delivered product. Your review will appear on the product page after admin approval.",
      "Fikringiz":"Your review",
      "Mahsulot va xizmat haqida fikringizni yozing":"Write your opinion about the product and service",
      "Fikrni saqlash":"Save review",
      "Bahoni tanlang":"Choose a rating",
      "Yoqmadi":"Did not like it",
      "Qoniqarsiz":"Unsatisfactory",
      "Yaxshi":"Good",
      "Juda yaxshi":"Very good",
      "A’lo":"Excellent",
      "Tasdiqlangan xaridor fikri":"Verified buyer review",
      "Sizning bahoyingiz boshqa xaridorlarga to‘g‘ri tanlov qilishda yordam beradi.":"Your rating helps other buyers make the right choice.",
      "Mahsulotni qanday baholaysiz?":"How would you rate the product?",
      "Yulduzchani bosing":"Tap a star",
      "Tezkor fikrlar":"Quick feedback",
      "Sifatli":"Good quality",
      "Sifatli mahsulot":"Good quality product",
      "Qadoqlanishi yaxshi":"Well packaged",
      "Narxiga arziydi":"Worth the price",
      "Tavsiya qilaman":"I recommend it",
      "Sabab yoki izoh":"Reason or comment",
      "Mahsulot sifati, qadoqlanishi va foydalanish taassurotingizni yozing...":"Write about product quality, packaging and your experience using it...",
      "Qisqa, aniq va foydali fikr yozing":"Write a short, clear and useful review",
      "Yuborish":"Send",
      "Buyurtma amali":"Order action",
      "Buyurtma cheki":"Order receipt",
      "Bekor qilish sababini tanlang":"Choose cancellation reason",
      "Sababni tanlang":"Choose a reason",
      "Adashib buyurtma berdim":"I ordered by mistake",
      "Mahsulotni noto‘g‘ri tanladim":"I selected the wrong product",
      "Yetkazib berish muddati menga to‘g‘ri kelmadi":"Delivery time did not suit me",
      "Yetkazib berish narxi menga to‘g‘ri kelmadi":"Delivery price did not suit me",
      "To‘lov usulini o‘zgartirmoqchiman":"I want to change the payment method",
      "Manzil yoki telefon raqamini noto‘g‘ri kiritdim":"I entered the wrong address or phone number",
      "Boshqa joydan xarid qildim":"I purchased elsewhere",
      "Boshqa sabab":"Other reason",
      "Boshqa sababni yozing":"Write another reason",
      "Sababni qisqacha yozing...":"Briefly describe the reason...",
      "Fikr bildirildi":"Review submitted",
      "admin tasdig‘i kutilmoqda":"waiting for admin approval",
      "OrzuMall javobi":"OrzuMall reply",
      "Chek topilmadi.":"Receipt not found.",
      "Buyurtma topilmadi.":"Order not found.",
      "Mahsulot topilmadi.":"Product not found.",
      "Fikringizni yozing.":"Write your review.",
      "Sababni batafsil yozing.":"Describe the reason in more detail.",
      "Fikringiz yuborildi. Admin tasdiqlagach namoyish qilinadi.":"Your review has been sent. It will be shown after admin approval.",
      "Sharh faqat yetkazib berilgan buyurtmadagi mahsulotga yoziladi.":"A review can only be written for a product from a delivered order.",
      "Bu mahsulotga fikr yuborilgan.":"A review has already been sent for this product.",
      "Ertaga":"Tomorrow",
      "2 kun ichida":"Within 2 days",
      "3 kun ichida":"Within 3 days",
      "ko‘rish":"views",
      "savat":"cart",
      "sevimli":"favorites",
      "sotuv":"sales",
      "ball":"score",
      "turi":"type",
      "Hammasi tanlangan":"All selected",
      "Chekni yuklang va yuboring.":"Upload the receipt and send it.",
      "Chek faylini yuklang.":"Upload the receipt file.",
      "Chek Telegram'ga yuborilmoqda...":"Sending receipt to Telegram...",
      "Chek yuborish":"Send receipt",
      "Chek (screenshot/PDF)":"Receipt (screenshot/PDF)",
      "Chekni yuklang va so‘rovni yuboring.":"Upload the receipt and submit the request.",
      "sharh":"reviews",
      "popular":"popularity",
      "Ko‘rishlar":"Views",
      "Popularlik":"Popularity",
      "Mahsulot statistikasi":"Product statistics",
      "ta sharh":"reviews",
      "Xaridorlar sharhlari":"Customer reviews",
      "Faqat yetkazib berilgan buyurtmalar asosidagi haqiqiy fikrlar.":"Only genuine feedback from delivered orders.",
      "Foydalanuvchi":"User",
      "Yaqinda":"Recently",
      "yulduz":"stars",
      "Baho qoldirilgan.":"Rating submitted.",
      "Buyurtma holati":"Order status",
      "Tanlangan filter bo‘yicha buyurtma topilmadi.":"No orders found for the selected filter.",
      "Avvalgi buyurtma fikri":"Previous order review",
      "Mijoz":"Customer",
      "To‘lov turi":"Payment method",
      "Xaritada ochish":"Open on map",
      "Savolingiz bo‘lsa buyurtma ID sini ko‘rsating":"When contacting support, provide the order ID",
      "Buyurtma harakati":"Order history",
      "Sabab":"Reason",
      "Izoh":"Comment",
      "Qaytarish sababi":"Return reason",
      "Yangi":"New",
      "Yangi • to‘langan":"New • paid",
      "Yig‘ilyapti":"Packing",
      "Yetkazib berishda":"Out for delivery",
      "Yetkazib berildi":"Delivered",
      "Bekor qilindi":"Cancelled",
      "Qaytarish so‘rovi yuborildi":"Return request submitted",
      "Qaytarildi":"Returned",
      "Qaytarish rad etildi":"Return rejected",
      "Muvaffaqiyatsiz":"Failed",
      "Naqd":"Cash",
      "Karta":"Card",
      "Balans":"Balance",
      "Buyurtmalar":"Orders",
      "Buyurtmalarim":"My orders",
      "Yetkazildi":"Delivered",
      "Bekor":"Cancelled",
      "Qaytarish":"Return",
      "Hozircha buyurtmalar yo‘q.":"No orders yet.",
      "Faollik tarixi":"Activity history",
      "Mablag‘lar":"Funds",
      "Mablag‘lar tarixi":"Transaction history",
      "Joriy balans":"Current balance",
      "Joriy hisob":"Current account",
      "Ichki hamyon":"Internal wallet",
      "Balansdan to‘lash":"Pay from balance",
      "To‘ldirish":"Top up",
      "Yetkazib berishni sozlash":"Delivery settings",
      "Yetkazib berishni o‘zgartirish":"Change delivery",
      "Yetkazish usuli":"Delivery method",
      "Yetkazish usulini tanlang":"Choose a delivery method",
      "Kuryer orqali yetkazish":"Courier delivery",
      "Do‘kondan olib ketish":"Store pickup",
      "Topshirish punkti":"Pickup point",
      "Topshirish punktini tanlang":"Choose a pickup point",
      "Lokatsiyani aniqlash":"Detect location",
      "Saqlangan manzil":"Saved address",
      "Asosiy manzil":"Primary address",
      "Nom bering":"Enter a name",
      "Masalan: Uyim / Ishim":"For example: Home / Work",
      "Promokod":"Promo code",
      "Promokodingiz bo‘lsa kiriting.":"Enter a promo code if you have one.",
      "Qo‘llash":"Apply",
      "Yakuniy summa":"Final total",
      "To‘lanadigan jami summa":"Amount due",
      "Rasmiylashtirish":"Checkout",
      "Mahsulot kelib chiqishi bo‘yicha filtr":"Product origin filter",
      "Mahsulotlar soni":"Product count",
      "Savatga qo‘shish":"Add to cart",
      "Mahsulot tafsiloti":"Product details",
      "Mahsulot yuklanmoqda...":"Loading product...",
      "Mahsulot ma'lumotlari":"Product information",
      "Tavsifni ko‘rish":"Show description",
      "Bildirishnomalar":"Notifications",
      "Hozircha bildirishnoma yo‘q.":"No notifications yet.",
      "Hammasini o‘qilgan qilish":"Mark all as read",
      "Siz uchun":"For you",
      "Sizga yoqishi mumkin":"You may also like",
      "Tavsiya mahsulotlari":"Recommended products",
      "Yaqinda ko‘rilganlar":"Recently viewed",
      "Yaqinda ko‘rilgan mahsulotlar":"Recently viewed products",
      "Balans to‘ldirish bosqichlari":"Balance top-up steps",
      "Click orqali":"Via Click",
      "Summa (so‘m)":"Amount (UZS)",
      "Yuboriladigan summa":"Transfer amount",
      "Karta egasi":"Cardholder",
      "Karta raqami":"Card number",
      "Pulni shu kartaga o‘tkazing":"Transfer funds to this card",
      "Davom etish":"Continue",
      "Oldingi":"Previous",
      "Keyingi":"Next",
      "Mahsulot sharhlari":"Product reviews",
      "Xarid qilish":"Purchase",
      "Jami narx":"Total price",
      "Savatchaga":"Add to cart",
      "Reklama":"Advertisement",
      "Popular ball":"Popularity score",
      "Tanlangan":"Selected",
      "Hammasi tanlangan":"All selected",
      "Tanlangan:":"Selected:",
      "Mahsulot tanlanmagan":"No product selected",
      "Mahsulot tanlang":"Select a product",
      "Mahsulot tafsilotlari tayyorlanmoqda...":"Preparing product details...",
      "Do‘kondan olib ketish":"Store pickup",
      "Xaritada":"On map",
      "To‘liq ekran":"Fullscreen",
      "Pochta indeksi":"Postal code",
      "Yetkazish":"Delivery",
      "Boshqa mahsulotlar":"Other products",
      "Rasmni to‘liq ekranda ko‘rish":"View image fullscreen",
      "Shu kategoriyadagi mahsulotlarni ko‘rish":"View products in this category",
      "Tasdiqlangan":"Verified",
      "Tekshirilmoqda":"Under review",
      "Yangi seller":"New seller",
      "Muvaffaqiyatli yetkazilgan":"Successfully delivered",
      "Mahsulotlar hozir sotuvda mavjud emas.":"Products are currently unavailable.",
      "Buyurtma mahsulotlari topilmadi.":"Order products were not found.",
      "Rasm":"Image"
    }
  };

  const dynamicSelectors = [
    ".pname", ".cartTitle", ".favTitle", ".vName", ".catName", ".favTitle",
    "#imgViewerName", "#imgViewerDesc", ".qvTag", ".pbadge.meta",
    ".catCrumbs button", ".ptags", ".miniBody .muted", ".revItemText"
  ];

  let currentLang = normalizeLang(localStorage.getItem(STORAGE_KEY) || document.documentElement.lang || "uz");
  let busy = false;
  let lightObserver = null;
  let applyTimer = null;

  function normalizeLang(lang){
    lang = String(lang || "uz").toLowerCase();
    return SUPPORTED.includes(lang) ? lang : "uz";
  }
  function norm(s){ return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function setText(el, value){
    const v = String(value == null ? "" : value);
    if(el && el.textContent !== v) el.textContent = v;
  }
  function trExact(text, lang){
    if(lang === "uz") return text;
    return exact[lang]?.[norm(text)] || null;
  }
  function isSafeStaticText(text){
    const t = norm(text);
    if(!t) return false;
    if(t.length > 120) return false;
    if(/^[-+]?\d[\d\s.,:+%()/-]*(so['‘’`]?m|сум|sum|uzs)?$/i.test(t)) return false;
    return true;
  }
  function isDynamicText(text){
    const t = norm(text);
    if(t.length < 3 || t.length > 700) return false;
    if(/^[-+]?\d[\d\s.,:%()/-]*(so['‘’`]?m|сум|sum|uzs)?$/i.test(t)) return false;
    if(/^ID[:\s]/i.test(t)) return false;
    if(/^https?:\/\//i.test(t)) return false;
    return /[A-Za-zÀ-ÿЎўҚқҒғҲҳЁёА-Яа-я]/.test(t);
  }
  function root(){ return document.body || document.documentElement; }
  function getCache(){
    try{ return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
    catch(_e){ return {}; }
  }
  function setCache(cache){
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }catch(_e){}
  }
  function cacheKey(lang, text){ return lang + "|" + text; }

  function buildSwitcher(extraClass, mode="buttons"){
    const wrap = document.createElement("div");
    wrap.className = "omLangSwitch" + (extraClass ? " " + extraClass : "");
    wrap.setAttribute("aria-label", "Til / Language");
    if(mode === "select"){
      wrap.classList.add("omLangSelectWrap");
      const select = document.createElement("select");
      select.className = "omLangSelect";
      select.setAttribute("aria-label", "Tilni tanlang / Choose language");
      select.title = "Tilni tanlang";
      SUPPORTED.forEach(lang => {
        const option = document.createElement("option");
        option.value = lang;
        option.textContent = LANG_LABELS[lang];
        select.appendChild(option);
      });
      select.value = currentLang;
      select.addEventListener("change", () => setLang(select.value));
      wrap.appendChild(select);
      return wrap;
    }
    wrap.setAttribute("role", "group");
    SUPPORTED.forEach(lang => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "omLangBtn";
      b.dataset.lang = lang;
      b.textContent = LANG_LABELS[lang];
      b.addEventListener("click", () => setLang(lang));
      wrap.appendChild(b);
    });
    return wrap;
  }

  function createSwitcher(){
    // Desktop header ichida alohida, mobile header ichida alohida ko‘rinadi.
    // Sabab: theme-redwhite.css mobile'da .actionsRight ni yashiradi.
    if(!document.querySelector(".omLangDesktop")){
      const desktop = buildSwitcher("omLangDesktop");
      const host = document.querySelector(".actionsRight") || document.querySelector(".topbar .actions");
      if(host) host.prepend(desktop);
      else { desktop.classList.add("omLangFloating"); root().appendChild(desktop); }
    }

    if(!document.querySelector(".omLangMobile")){
      const mobile = buildSwitcher("omLangMobile", "select");
      const mobileHead = document.querySelector(".mobileSearchHead");
      const topbar = document.querySelector(".topbar");
      if(mobileHead){
        const mobileActions = mobileHead.querySelector(".omcc-mobile-head-actions");
        if(mobileActions) mobileHead.insertBefore(mobile, mobileActions);
        else mobileHead.appendChild(mobile);
      }else if(topbar){
        topbar.appendChild(mobile);
      }else{
        mobile.classList.add("omLangMobileFloat");
        root().appendChild(mobile);
      }
    }
  }

  function updateButtons(){
    document.querySelectorAll(".omLangBtn").forEach(btn => {
      const on = btn.dataset.lang === currentLang;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll(".omLangSelect").forEach(select => {
      if(select.value !== currentLang) select.value = currentLang;
    });
  }

  function collectTextNodes(scope){
    const out = [];
    const walker = document.createTreeWalker(scope || root(), NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        const p = node.parentElement;
        if(!p) return NodeFilter.FILTER_REJECT;
        if(p.closest("script,style,noscript,textarea,code,pre,.omLangSwitch,[data-no-i18n]")) return NodeFilter.FILTER_REJECT;
        const t = norm(node.nodeValue);
        if(!isSafeStaticText(t)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while(walker.nextNode()) out.push(walker.currentNode);
    return out;
  }

  function applyStaticText(scope){
    const nodes = collectTextNodes(scope || root());
    nodes.forEach(node => {
      const p = node.parentElement;
      if(!p) return;
      const original = p.dataset.omI18nTextOrigin || node.nodeValue;
      if(!p.dataset.omI18nTextOrigin) p.dataset.omI18nTextOrigin = original;
      if(currentLang === "uz"){
        node.nodeValue = original;
      }else{
        const translated = trExact(original, currentLang);
        if(translated) node.nodeValue = translated;
      }
    });
  }

  function applyAttrs(scope){
    const attrs = ["placeholder", "title", "aria-label", "alt"];
    const all = (scope || root()).querySelectorAll ? (scope || root()).querySelectorAll("[placeholder],[title],[aria-label],[alt]") : [];
    all.forEach(el => {
      if(el.closest && el.closest(".omLangSwitch,[data-no-i18n]")) return;
      attrs.forEach(attr => {
        if(!el.hasAttribute(attr)) return;
        const key = "omI18n" + attr.replace(/-([a-z])/g, (_,c)=>c.toUpperCase()).replace(/^./, c=>c.toUpperCase());
        const original = el.dataset[key] || el.getAttribute(attr) || "";
        if(!el.dataset[key]) el.dataset[key] = original;
        if(currentLang === "uz") el.setAttribute(attr, original);
        else {
          const translated = trExact(original, currentLang);
          if(translated) el.setAttribute(attr, translated);
        }
      });
    });
  }

  function collectDynamicElements(){
    const set = new Set();
    dynamicSelectors.forEach(sel => document.querySelectorAll(sel).forEach(el => set.add(el)));
    return Array.from(set).filter(el => el && !el.closest(".omLangSwitch,[data-no-i18n]") && isDynamicText(el.textContent));
  }

  async function translateDynamic(){
    // FRONTEND AUTO-TRANSLATE OFF.
    // Mijoz tomonida DeepSeek chaqirilmaydi. Faqat tayyor statik lug‘atdagi matnlar
    // almashtiriladi; mahsulotlar esa app.js orqali name_ru/name_en/description_ru/description_en
    // maydonlaridan olinadi.
    if(currentLang === "uz"){
      collectDynamicElements().forEach(el => {
        if(el.dataset.omDynOrigin) setText(el, el.dataset.omDynOrigin);
      });
      return;
    }
    const elements = collectDynamicElements();
    elements.forEach(el => {
      const original = el.dataset.omDynOrigin || norm(el.textContent || "");
      if(!el.dataset.omDynOrigin) el.dataset.omDynOrigin = original;
      const exactTranslation = trExact(original, currentLang);
      if(exactTranslation) setText(el, exactTranslation);
      // DeepSeek fetch YO‘Q: tayyor field bo‘lmasa o‘zbekcha matn qoldiriladi.
    });
  }


  // ===== Direct product/data translation layer =====
  // DOM kuzatish doim ham mahsulotlarni ushlamaydi. Shuning uchun app.js mahsulot nomlarini
  // bevosita shu API orqali oladi. Avval cache/Firestoredagi tayyor maydonlar, keyin DeepSeek.
  let pendingTexts = new Set();
  let queueTimer = null;
  let queueBusy = false;
  let apiDisabledUntil = 0;
  let lastError = "";

  function cap(s){ s = String(s||""); return s ? s[0].toUpperCase() + s.slice(1) : s; }
  function langCap(lang){ return lang === "ru" ? "Ru" : lang === "en" ? "En" : cap(lang); }

  function maybeNested(p, lang, field){
    const bags = [p?.translations, p?.translation, p?.i18n, p?.lang, p?.langs, p?.locale, p?.locales];
    for(const bag of bags){
      if(!bag || typeof bag !== "object") continue;
      const x = bag[lang] || bag[langCap(lang)] || bag[lang.toUpperCase()];
      if(x && typeof x === "object"){
        const v = x[field] ?? x[cap(field)] ?? (field === "description" ? (x.desc ?? x.fullDesc ?? x.shortDesc) : undefined);
        if(typeof v === "string" && norm(v)) return norm(v);
        if(Array.isArray(v) && v.length) return v.map(norm).filter(Boolean);
      }
    }
    return null;
  }

  function fieldCandidates(field, lang){
    const L = langCap(lang), U = lang.toUpperCase();
    const base = String(field||"");
    const B = cap(base);
    const list = [
      `${base}_${lang}`, `${base}_${U}`, `${base}${L}`, `${base}${U}`,
      `${lang}_${base}`, `${U}_${base}`, `${lang}${B}`, `${U}${B}`
    ];
    if(base === "name") list.push(`title_${lang}`, `title${L}`, `productName_${lang}`, `productName${L}`, `nom_${lang}`);
    if(base === "description") list.push(`desc_${lang}`, `desc${L}`, `shortDescription_${lang}`, `shortDescription${L}`, `longDescription_${lang}`, `longDescription${L}`, `tasnif_${lang}`);
    if(base === "tags") list.push(`tags_${lang}`, `tags${L}`, `categories_${lang}`, `categories${L}`);
    return list;
  }

  function explicitLocalized(p, field, lang){
    if(!p || typeof p !== "object") return null;
    const nested = maybeNested(p, lang, field);
    if(nested) return nested;
    for(const k of fieldCandidates(field, lang)){
      const v = p[k];
      if(typeof v === "string" && norm(v)) return norm(v);
      if(Array.isArray(v) && v.length) return v.map(norm).filter(Boolean);
    }
    return null;
  }

  function baseProductValue(p, field, fallback){
    if(field === "name") return norm(p?.name || p?.title || p?.productName || fallback || "");
    if(field === "description") return norm(p?.description || p?.desc || p?.shortDescription || p?.longDescription || fallback || "");
    if(field === "badge") return norm(p?.badge || fallback || "");
    if(field === "tags") return Array.isArray(p?.tags) ? p.tags.map(norm).filter(Boolean) : [];
    return norm(p?.[field] || fallback || "");
  }

  async function requestTranslations(texts, target){
    // FRONTEND AUTO-TRANSLATE OFF.
    // Bu export mijoz tarafida API chaqirmasligi uchun bo‘sh qoldirildi.
    // Admin paneldagi “UZ dan RU/EN yaratish” tugmasi alohida fetch bilan ishlaydi.
    return [];
  }


  function dispatchUpdated(){
    try{ window.dispatchEvent(new CustomEvent("om-i18n-updated", { detail:{ lang: currentLang } })); }catch(_e){}
  }

  function queueText(text){
    // DeepSeek xarajat chiqmasligi uchun frontend queue o‘chirildi.
    return;
  }


  async function processQueue(){
    // Frontendda avto tarjima ishlamaydi.
    return;
  }


  function translateTextSync(text){
    const original = norm(text);
    if(currentLang === "uz" || !original) return String(text == null ? "" : text);
    const exactTranslation = trExact(original, currentLang);
    if(exactTranslation) return exactTranslation;
    // Dynamic/mahsulot matnlari DeepSeek bilan jonli tarjima qilinmaydi.
    return String(text == null ? "" : text);
  }


  function productText(p, field, fallback){
    const original = baseProductValue(p, field, fallback);
    if(currentLang === "uz") return original;
    const ready = explicitLocalized(p, field, currentLang);
    if(typeof ready === "string" && ready) return ready;
    const exactTranslation = trExact(original, currentLang);
    if(exactTranslation) return exactTranslation;
    // Muhim: tayyor name_ru/name_en/description_ru/description_en bo‘lmasa,
    // mijoz tomonida API chaqirilmaydi va asl o‘zbekcha matn qoladi.
    return original;
  }


  function productTags(p){
    const orig = baseProductValue(p, "tags", []);
    if(currentLang === "uz") return orig;
    const ready = explicitLocalized(p, "tags", currentLang);
    if(Array.isArray(ready) && ready.length) return ready;
    return orig.map(t => trExact(t, currentLang) || t);
  }


  function ensureProducts(products){
    // Avto tarjima o‘chirilgan: mahsulotlar oldindan admin panelda tarjima qilinadi.
    return;
  }


  function countText(n){
    n = Number(n || 0);
    if(currentLang === "ru") return `${n} шт.`;
    if(currentLang === "en") return `${n} pcs`;
    return `${n} ta`;
  }

  function scheduleApply(scope){
    if(currentLang === "uz") return;
    clearTimeout(applyTimer);
    applyTimer = setTimeout(() => {
      try{
        applyStaticText(scope && scope.querySelectorAll ? scope : root());
        applyAttrs(scope && scope.querySelectorAll ? scope : root());
        translateDynamic();
      }catch(_e){}
    }, 220);
  }

  function startLightObserver(){
    if(lightObserver || !window.MutationObserver) return;
    const targets = [
      "#grid", "#catList", "#catCrumbs", "#panelList", "#favPageList", "#cartPageList",
      "#imgViewer", "#variantModal", "#miniModal", "#cartPanel", "main"
    ].map(sel => document.querySelector(sel)).filter(Boolean);
    if(!targets.length) return;
    lightObserver = new MutationObserver((mutations) => {
      if(currentLang === "uz") return;
      let ok = false;
      for(const m of mutations){
        if(m.type === "childList" && (m.addedNodes && m.addedNodes.length)){ ok = true; break; }
      }
      if(ok) scheduleApply(root());
    });
    targets.forEach(t => { try{ lightObserver.observe(t, { childList:true, subtree:true }); }catch(_e){} });
  }

  function stopLightObserver(){
    if(lightObserver){ try{ lightObserver.disconnect(); }catch(_e){} lightObserver = null; }
    clearTimeout(applyTimer);
  }

  function applyNow(){
    if(busy) return;
    busy = true;
    try{
      document.documentElement.lang = currentLang;
      updateButtons();
      if(currentLang !== "uz"){
        applyStaticText(root());
        applyAttrs(root());
      }else{
        // UZ rejimida sahifani keraksiz qayta yozmaymiz — asosiy sayt tezligi saqlanadi.
        applyStaticText(root());
        applyAttrs(root());
      }
    }finally{
      busy = false;
    }
    translateDynamic();
    if(currentLang !== "uz") startLightObserver(); else stopLightObserver();
  }

  function setLang(lang){
    currentLang = normalizeLang(lang);
    try{ localStorage.setItem(STORAGE_KEY, currentLang); }catch(_e){}
    applyNow();
    dispatchUpdated();
    // App render qilib bo'lgandan keyin mahsulot nomlari ham tarjima bo'lishi uchun.
    setTimeout(()=>{ applyNow(); dispatchUpdated(); }, 700);
    setTimeout(()=>{ applyNow(); dispatchUpdated(); }, 2000);
    setTimeout(()=>{ applyNow(); dispatchUpdated(); }, 4500);
  }

  function init(){
    createSwitcher();
    updateButtons();
    // Eski og'ir observer yo'q: sayt qotmaydi. Tarjima faqat tanlangan tilda ishlaydi.
    if(currentLang !== "uz"){
      setTimeout(applyNow, 300);
      setTimeout(applyNow, 1600);
      setTimeout(applyNow, 4200);
      startLightObserver();
    }
    // Oddiy kliklarda DeepSeek/avto tarjima chaqirilmaydi.
    window.addEventListener("hashchange", ()=> currentLang !== "uz" && setTimeout(applyNow, 300));
  }

  window.OM_I18N = {
    setLang,
    getLang: () => currentLang,
    apply: applyNow,
    translateVisible: translateDynamic,
    notify: (scope) => scheduleApply(scope || root()),
    text: translateTextSync,
    productText,
    productTags,
    ensureProducts,
    countText,
    requestTranslations,
    getLastError: () => lastError
  };

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
