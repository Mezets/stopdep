const english = {
"Переместить выбранные…":"Move selected…","Переместить выбранные":"Move selected","Выбрано":"Selected","Выбрать область":"Select area","Выбрать все / снять":"Select all / clear",
"Название папки":"Folder name","Добавить папку":"Add folder","Папка":"Folder","Все области":"All areas","Без папки":"Unfiled","Переименовать":"Rename","Удалить папку":"Delete folder","Название области":"Area name","Переместить в папку":"Move to folder",
"Дата добавления неизвестна":"Added date unknown",
"Обрабатывать страницы Twitch":"Process Twitch pages",
"Убрать маски этого сайта":"Remove this site’s masks",
"Вернуть удалённые маски":"Restore removed masks",
"Маски сайта удалены":"Site masks removed",
  "СтопДЕП": "StopDEP",
  "Фильтр рекламы": "Ad filter",
  "Включить СтопДЕП": "Enable StopDEP",
  "Разделы": "Sections",
  "Фильтры": "Filters",
  "Области": "Areas",
  "Настройки": "Settings",
  "Изменения": "What's new",
  "Букмекеры, включая Winline": "Sportsbooks, including Winline",
  "Казино и азартные сайты": "Casinos and gambling sites",
  "Кейсы и скин-гэмблинг": "Case opening and skin gambling",
  "Баннеры и ссылки стримеров": "Streamer banners and links",
  "Закрасить": "Solid cover",
  "Размытие": "Blur",
  "Моя картинка": "My image",
  "Цвет заливки": "Cover color",
  "Сила размытия": "Blur strength",
  "Картинка до 600 КБ": "Image up to 600 KB",
  "Выделить на фото или видео": "Select on an image or video",
  "Выделить на странице": "Select on the page",
  "Загруженные изображения": "Loaded images",
  "Скрыть предпросмотр": "Hide preview",
  "Файл": "File",
  "Предпросмотр": "Preview",
  "Следующий кадр": "Next frame",
  "Сохранить выделение на изображении": "Save image area",
  "Сохранённые области": "Saved areas",
  "Задержка исчезновения, мс": "Hide delay, ms",
  "0 — убрать размытие сразу после исчезновения фото или видео.": "0 hides the blur as soon as the image or video disappears.",
  "Экспорт настроек и областей": "Export settings and areas",
  "Импорт из JSON": "Import JSON",
  "Показать": "Show",
  "Скрыть": "Hide",
  "Удалить": "Delete",
  "Править": "Edit",
  "Область": "Area",
  "размытие": "blur",
  "картинка": "image",
  "заливка": "solid cover",
  "Сохранить изменения": "Save changes",
  "Отмена": "Cancel",
  "Редактирование области": "Editing area",
  "Режим": "Mask type",
  "Язык интерфейса": "Interface language",
  "Область сохранена.": "Area saved.",
  "Выбери PNG, JPG, WebP или GIF до 600 КБ.": "Choose a PNG, JPG, WebP or GIF up to 600 KB.",
  "Не удалось прочитать картинку.": "Couldn't read the image.",
  "Перезагрузи страницу после обновления СтопДЕП и попробуй снова.": "Reload the page after updating StopDEP and try again.",
  "Открой вкладку с сайтом.": "Open a website tab.",
  "Список пока пуст. Перезагрузи сайт и снова открой «Области».": "The list is empty. Reload the site, then reopen Areas.",
  "Обнови вкладку и открой каталог ещё раз.": "Reload the tab and reopen the catalog.",
  "Сайт не отдал этот файл для предпросмотра. Выбери другое изображение.": "This file could not be loaded for preview. Choose another image.",
  "Файл резервной копии слишком большой.": "The backup file is too large.",
  "Выбери резервную копию СтопДЕП.": "Choose a StopDEP backup file.",
  "В файле нет подходящих настроек или областей.": "This file contains no valid settings or areas.",
  "Импорт завершён · областей: ": "Import complete · areas: ",
  "Импорт не выполнен. ": "Import failed. ",
  "Область выделена на странице.": "Area highlighted on the page.",
  "Эта область сейчас недоступна. Открой нужный кадр или изображение.": "This area is unavailable. Open the matching image or video frame.",
  "Предпросмотр недоступен. Открой страницу или слайд с этим изображением.": "Preview unavailable. Open the page or slide containing this image.",
  "Рамка показывает сохранённую область.": "The outline marks the saved area.",
  "Встроенный SVG": "Inline SVG",
  "Сохранённый файл": "Saved file",
  "Область уже удалена.": "This area has already been deleted."
};
const releases = [
["2.8.3","Включили Twitch по умолчанию. Добавили перенос нескольких областей в папку.","Enabled Twitch by default. Added moving multiple areas into folders."],
["2.8.2","Добавили папки и переименование областей. Папки сохраняются в резервной копии.","Added folders and area names. Folders are included in backups."],
["2.8.1","Убрали остатки фиолетового оформления. Обработали потерю контекста в заменах.","Removed remaining purple accents. Handled context loss in text replacements."],
["2.8.0","Обновили дизайн панели: чёрный, бумажный и жёлтый.","Updated the panel with ink, paper and yellow styling."],
["2.7.1","Пофиксили ошибку Extension context invalidated в поиске Google.","Fixed Extension context invalidated errors in Google search."],
["2.7.0","Добавили отмену масок, профили Twitch, поиск областей, предпросмотр замен, диагностику и следующую страницу Pinterest.","Added mask undo, Twitch profiles, area search, replacement previews, diagnostics and Pinterest pagination."],
["2.6.2","Пофиксили название категории и повторы картинок. Убрали повторный круг показов.","Fixed category labels and duplicate images. Removed replaying viewed pictures."],
["2.6.1","Перенесли картинки вниз настроек. Обновили список выбора и поле своего запроса.","Moved picture settings to the bottom. Refined the dropdown and custom query field."],
["2.6.0","Добавили выбор картинок и историю показов без повторов до конца набора.","Added picture categories and viewing history to avoid repeats until the set is exhausted."],
["2.5.1","Добавили строки для замен и сайтов. Добавили повторный запрос поиска Pinterest.","Added row editors for replacements and sites, plus a Pinterest search fallback."],
["2.5.0","Добавили автозагрузку случайных котиков из поиска Pinterest и варианты Кейс-батл.","Added random cats from Pinterest search and Case Battle spelling variants."],
["2.4.2","Расширили замены кейс-сайтов и Rust. Добавили winline.kz. Исправили смену котиков.","Expanded case-site and Rust replacements. Added winline.kz and fixed cat rotation."],
["2.4.1","Пофиксили замены в подгружаемом тексте и обзорах Google.","Fixed replacements in dynamically loaded text and Google summaries."],
["2.4.0","Убрали размытие заменённых названий. Расширили словарь, обновили списки и резервные копии.","Removed blur from renamed brands. Expanded replacements, refined editors and backups."],
["2.3.0","Добавили счётчик сохранённых денег, выбор суммы и 10k.win.","Added a saved-money counter, deposit amounts and 10k.win."],
["2.1.0","Добавили страницу блокировки с котиками и ссылкой на автора.","Added a block page with cats and a creator link."],
["2.0.13","Добавили дату и время создания масок. Режимы разместили в один ряд.","Added mask creation timestamps. Placed mask modes in one row."],
  [
    "2.0.12",
    "Пофиксили привязку к плееру Twitch. Дописали историю версий.",
    "Fixed Twitch player tracking. Updated release history."
  ],
  [
    "2.0.11",
    "Пофиксили запуск выделения на Twitch.",
    "Fixed selection on Twitch."
  ],
  [
    "2.0.10",
    "Обновили иконку расширения.",
    "Updated the extension icon."
  ],
  [
    "2.0.9",
    "Обновили дизайн по twitch-ambient.",
    "Updated the design to match twitch-ambient."
  ],
  [
    "2.0.8",
    "Добавили отключение обработки Twitch.",
    "Added a Twitch processing switch."
  ],
  [
    "2.0.7",
    "Добавили очистку масок сайта и отмену удаления.",
    "Added site mask removal and undo."
  ],
  [
    "2.0.6",
    "Пофиксили изменение фильтра видео для совместимости.",
    "Stopped changing video filters for compatibility."
  ],
  [
    "2.0.5",
    "Уменьшили нагрузку на Twitch.",
    "Reduced Twitch processing."
  ],
  [
    "2.0.4",
    "Оптимизировали обработку прокрутки.",
    "Optimized scroll handling."
  ],
  [
    "2.0.3",
    "Сократили повторное сканирование страниц.",
    "Reduced repeated page scans."
  ],
  [
    "2.0.2",
    "Пофиксили редактор и список файлов. Обновили RU/EN.",
    "Fixed the editor and file list. Updated RU/EN."
  ],
  [
    "2.0.1",
    "Обновили дизайн и перевод панели.",
    "Updated panel design and translation."
  ],
  [
    "2.0.0",
    "Редактирование сохранённых масок, RU/EN и история версий. Разделены команды выделения страницы и медиа, стабилизированы слои каталога.",
    "Edit saved masks, switch RU/EN and browse release history. Separate page and media picker commands, with more stable catalog layers."
  ],
  [
    "1.9.0",
    "Непрозрачная заливка, выбор цвета, настраиваемая задержка, импорт и экспорт настроек.",
    "Solid cover with a color picker, configurable hide delay, and settings import/export."
  ],
  [
    "1.8.0",
    "Отметки сохранённых областей в списке файлов и предпросмотре, исправление прозрачности размытия, выделение страницы.",
    "Saved-area markers in the file list and preview, a blur transparency fix, and page selection."
  ],
  [
    "1.7.5",
    "Кнопка «Скрыть» сворачивает весь предпросмотр.",
    "Hide closes the entire preview."
  ],
  [
    "1.7.4",
    "Переключатель «Показать / Скрыть» для рамки области.",
    "Show/Hide toggle for area outlines."
  ],
  [
    "1.7.3",
    "Компактные кнопки в списке и исправление размеров предпросмотра.",
    "More compact list buttons and corrected preview sizing."
  ],
  [
    "1.7.2",
    "Кнопка «Показать» для поиска области на странице или в файле.",
    "Show locates an area on the page or in the source file."
  ],
  [
    "1.7.1",
    "Усиленное размытие и расширенный диапазон ползунка.",
    "Stronger blur and a wider strength range."
  ],
  [
    "1.7.0",
    "Привязка ручных масок к изображениям и потоковым видеоплеерам.",
    "Manual masks attach to images and streaming video players."
  ],
  [
    "1.6.5",
    "Задержка исчезновения размытия сокращена до 500 мс.",
    "Blur hide delay reduced to 500 ms."
  ],
  [
    "1.6.4",
    "Убран отдельный переключатель привязки к изображению.",
    "Removed the separate image binding toggle."
  ],
  [
    "1.6.3",
    "Добавлена двухсекундная задержка исчезновения размытия.",
    "Added a two-second blur hide delay."
  ],
  [
    "1.6.2",
    "Исправлены координаты на обрезанных фоновых фото, ограничено плавающее размытие.",
    "Fixed coordinates on cropped backgrounds and restricted floating blur."
  ],
  [
    "1.6.1",
    "Размытие перенесено на слой изображения, чтобы сохранить резкость текста поверх него.",
    "Blur applied to the image layer so text above it stays sharp."
  ],
  [
    "1.6.0",
    "Привязка маски к фото карусели и экспорт областей в JSON.",
    "Carousel image binding and JSON export for areas."
  ],
  [
    "1.5.0",
    "Список реально загруженных изображений, ручной ввод ссылки и выделение при загрузке убраны.",
    "Loaded image list replaced manual URL entry and picking during reload."
  ],
  [
    "1.4.1",
    "Поиск WebP и других изображений в сетевых ресурсах.",
    "WebP and other images discovered through network resources."
  ],
  [
    "1.4.0",
    "Каталог изображений и SVG, размытие названий букмекеров в Google.",
    "Image and SVG catalog, with sportsbook names blurred in Google results."
  ],
  [
    "1.3.0",
    "Маски, сохраняемые по адресу исходного изображения.",
    "Masks saved by source image URL."
  ],
  [
    "1.2.1",
    "Своя картинка растягивается на область без обрезки.",
    "Replacement images stretch to fill the area."
  ],
  [
    "1.2.0",
    "Название СтопДЕП и расширенный список казино и азартных сайтов HaGeZi.",
    "Renamed to StopDEP and added the HaGeZi gambling list."
  ],
  [
    "1.1.2",
    "Caser, DogDrop и дополнительные зеркала Case-Battle, скрытие карточек Google.",
    "Added Caser, DogDrop, and Case-Battle mirrors, plus hiding Google result cards."
  ],
  [
    "1.1.1",
    "Исправлена привязка маски к фоновому изображению при прокрутке.",
    "Fixed masks tracking background images while scrolling."
  ],
  [
    "1.1.0",
    "Панель фильтров, блокировка кейс-сайтов, размытие и замена области своей картинкой.",
    "Filter panel, case site blocking, blur and image replacement."
  ],
  [
    "1.0.0",
    "Первая версия с блокировкой букмекеров и баннеров.",
    "Initial sportsbook and banner blocking release."
  ]
];
let locale = 'ru';
const staticTranslations = [];
function t(text) {
  return locale === 'en' ? english[text] || text : text;
}
function localizedStatus(message) {
  if (english[message]) return t(message);
  const prefix = ['Импорт завершён · областей: ', 'Импорт не выполнен. '].find(key => message.startsWith(key));
  return prefix ? t(prefix) + message.slice(prefix.length) : message;
}
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (walker.nextNode()) {
  const node = walker.currentNode;
  if (english[node.data.trim()]) staticTranslations.push([node, 'data', node.data]);
}
for (const node of document.querySelectorAll('[aria-label], [alt]')) {
  for (const attr of ['aria-label', 'alt']) {
    const value = node.getAttribute(attr);
    if (english[value]) staticTranslations.push([node, attr, value]);
  }
}
function setLanguage(language) {
  locale = language === 'en' ? 'en' : 'ru';
  document.documentElement.lang = locale;
  document.title = t('СтопДЕП');
  for (const button of document.querySelectorAll('[data-language]')) {
    button.setAttribute('aria-pressed', String(button.dataset.language === locale));
  }
  for (const [node, attr, value] of staticTranslations) {
    const key = value.trim();
    if (attr === 'data') node.data = value.replace(key, t(key));
    else node.setAttribute(attr, t(key));
  }
  document.getElementById('releaseList').replaceChildren(...releases.map(([version, ru, en]) => {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = version;
    const description = document.createElement('p');
    description.textContent = locale === 'en' ? en : ru;
    item.append(title, description);
    return item;
  }));
}
