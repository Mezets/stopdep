const queryUrl =
  'https://ru.pinterest.com/search/pins/?q=%D0%BA%D0%BE%D1%82%D0%B8%D0%BA&rs=typed';
let cats = [],
  lastUrl = '',
  loading = false;
const cat = document.getElementById('cat'),
  fallback = document.getElementById('fallback'),
  source = document.getElementById('source');
async function nextCat() {
  const prefs = await chrome.storage.local.get(['blockPicture', 'blockPictureQuery']);
  const label = { cats: 'Котик', dogs: 'Собачка', hamsters: 'Хомяк', custom: 'Картинка' }[
    prefs.blockPicture || 'cats'
  ];
  cat.alt = label;
  source.textContent = label + ' из Pinterest';
  if (loading) return;
  loading = true;
  document.getElementById('another').disabled = true;
  try {
    if (!cats.length) {
      fallback.hidden = false;
      fallback.textContent = 'Загружаем картинки из Pinterest…';
      const result = await chrome.runtime.sendMessage({ type: 'pinterest-cats' });
      if (!result?.cats?.length)
        throw Error(
          'Pinterest не отдал картинки. Нажми «Другая картинка», чтобы повторить'
        );
      cats = result.cats;
    }

    let result = await chrome.runtime.sendMessage({
      type: 'choose-block-picture',
      pictures: cats,
    });
    for (let attempt = 0; result?.exhausted && attempt < 3; attempt++) {
      const next = await chrome.runtime.sendMessage({
        type: 'pinterest-cats',
        more: true,
      });
      if (!next?.cats?.length) break;
      cats = next.cats;
      result = await chrome.runtime.sendMessage({
        type: 'choose-block-picture',
        pictures: cats,
      });
    }
    if (result?.exhausted)
      throw Error(
        'Все доступные картинки уже просмотрены. Выбери другую категорию или попробуй позже'
      );
    if (!result?.picture) throw Error('Не удалось выбрать картинку. Попробуй ещё раз');
    const chosen = result.picture;
    lastUrl = chosen.url;

    cat.hidden = false;
    cat.referrerPolicy = 'no-referrer';
    cat.src = chosen.url;
    source.href = chosen.pin;
    source.textContent = label + ' из Pinterest';
    fallback.hidden = true;
  } catch (error) {
    cat.hidden = true;
    fallback.hidden = false;
    fallback.textContent = error.message;
    source.href = queryUrl;
  } finally {
    loading = false;
    document.getElementById('another').disabled = false;
  }
}
cat.onerror = () => {
  cat.hidden = true;
  fallback.hidden = false;
  fallback.textContent = 'Картинка недоступна. Попробуй другую картинку';
  cats = cats.filter((item) => item.url !== lastUrl);
};
document.getElementById('another').onclick = nextCat;
nextCat();
const depositId = sessionStorage.getItem('depositId') || crypto.randomUUID();
sessionStorage.setItem('depositId', depositId);
const question = document.getElementById('depositQuestion');
const answer = document.getElementById('depositAnswer');
let submitting = false;
function money(kopecks) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(kopecks / 100);
}
async function submitDeposit(kopecks) {
  if (submitting) return;
  submitting = true;
  question.querySelectorAll('button').forEach((button) => (button.disabled = true));
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'save-deposit',
      id: depositId,
      amount: kopecks,
    });
    if (!result?.ok) throw Error('Не удалось сохранить. Попробуй ещё раз');
    question.hidden = true;
    answer.textContent = kopecks
      ? 'Сохранили тебе ' + money(kopecks) + ' :3'
      : 'Бывает :3';
  } catch (error) {
    answer.textContent = error.message;
    question.querySelectorAll('button').forEach((button) => (button.disabled = false));
  } finally {
    submitting = false;
  }
}
document
  .querySelectorAll('[data-amount]')
  .forEach(
    (button) =>
      (button.onclick = () => submitDeposit(Number(button.dataset.amount) * 100))
  );
document.getElementById('customAmountButton').onclick = () => {
  document.getElementById('customAmountForm').hidden = false;
  document.getElementById('customAmount').focus();
};
document.getElementById('customAmountForm').onsubmit = (event) => {
  event.preventDefault();
  const value = document.getElementById('customAmount').value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return;
  const amount = Math.round(Number(value) * 100);
  if (amount > 0 && amount <= 10000000000) submitDeposit(amount);
};
chrome.storage.local.get('saving:' + depositId).then((data) => {
  const prior = data['saving:' + depositId];
  if (prior) {
    question.hidden = true;
    answer.textContent = prior.kopecks
      ? 'Сохранили тебе ' + money(prior.kopecks) + ' :3'
      : 'Бывает :3';
  }
});
