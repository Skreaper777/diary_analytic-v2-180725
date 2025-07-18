document.addEventListener("DOMContentLoaded", async function () {
  console.log("🔄 Инициализация страницы...");

  // забираем JSON из data-атрибута
  const VALUES_MAP = JSON.parse(document.body.dataset.valuesMap || "{}");
  window.VALUES_MAP = VALUES_MAP;
  console.log("📦 Значения из бэкенда:", VALUES_MAP);

  // Получаем дату из input
  const dateInput = document.getElementById("date-input");
  const dateValue = dateInput ? dateInput.value : "";
  console.log("📅 Выбранная дата:", dateValue);

  // Все блоки параметров
  const parameterBlocks = document.querySelectorAll(".parameter-block");

  parameterBlocks.forEach((block) => {
    const paramKey = block.getAttribute("data-key");
    const buttons = block.querySelectorAll(".value-button");
    
    // Логируем все кнопки и их значения
    console.log(`\n📊 Параметр ${paramKey}:`);
    console.log(`  🔍 Значение из бэкенда:`, window.VALUES_MAP[paramKey]);
    
    buttons.forEach((btn) => {
      const value = btn.getAttribute("data-value");
      const isSelected = btn.classList.contains("selected");
      console.log(`  - Кнопка ${value}: ${isSelected ? '✅ выбрана' : '❌ не выбрана'}`);
    });

    // Инициализация выбранных кнопок
    buttons.forEach((btn) => {
      btn.addEventListener("click", async function () {
        const selectedValue = parseInt(this.getAttribute("data-value"));
        const isAlreadySelected = this.classList.contains("selected");
        // paramKey всегда берём из блока, а не из кнопки!
        const paramKey = block.getAttribute("data-key");

        if (isAlreadySelected) {
          // Повторный клик — удаляем значение
          const payload = {
            parameter: paramKey,
            value: null,
            date: dateValue,
          };
          console.log("🟡 Отправка запроса на удаление:", payload);
          try {
            const response = await fetch("/update_value/", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken"),
              },
              body: JSON.stringify(payload),
            });
            if (response.ok) {
              console.log(`🗑️ Удалено: ${paramKey}`);
              this.classList.remove("selected");
              loadPredictions();
            } else {
              console.error(`❌ Ошибка удаления ${paramKey}`);
            }
          } catch (error) {
            console.error("Ошибка соединения:", error);
          }
          return;
        }

        // 1. Подсветка активной кнопки
        buttons.forEach((b) => b.classList.remove("selected"));
        this.classList.add("selected");

        // 2. Отправка на сервер
        const payload = {
          parameter: paramKey,
          value: selectedValue,
          date: dateValue,
        };
        console.log("🟢 Отправка запроса на обновление:", payload);
        try {
          const response = await fetch("/update_value/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": getCookie("csrftoken"),
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            console.log(`✅ Обновлено: ${paramKey} = ${selectedValue}`);
            loadPredictions();
          } else {
            console.error(`❌ Ошибка обновления ${paramKey}`);
          }
        } catch (error) {
          console.error("Ошибка соединения:", error);
        }
      });
    });
  });

  // Инициализируем выбранные значения
  parameterBlocks.forEach(block => {
      const key = block.dataset.key;
      const selectedButton = block.querySelector('.value-button.selected');
      console.log(`📊 Параметр ${key}:`, selectedButton ? `выбрано значение ${selectedButton.dataset.value}` : 'нет выбранного значения');
  });

  // Загружаем прогнозы (старый способ)
  loadPredictions();

  // Инициализация графиков истории
  initAllParameterCharts(dateValue);
  setupChartsToggleBtn();
  // Восстанавливаем видимость графиков
  setChartsVisible(loadChartsVisibleState());

  const btn = document.getElementById('retrain-models-btn');
  if (btn) {
    btn.addEventListener('click', async function() {
      btn.disabled = true;
      btn.textContent = '⏳ Обновление...';
      try {
        const res = await fetch('/retrain_models_all/', {
          method: 'POST',
          headers: {
            'X-CSRFToken': getCookie('csrftoken'),
            'Content-Type': 'application/json',
          },
        });
        const data = await res.json();
        if (data.status === 'ok') {
          alert('Модели успешно переобучены!');
        } else if (data.status === 'error') {
          // Можно сделать красивое модальное окно, но пока alert
          alert('Есть ошибки при обучении моделей:\n' + (data.details || []).join('\n'));
        } else {
          alert('Неизвестный ответ от сервера');
        }
      } catch (e) {
        alert('Ошибка соединения');
      }
      btn.disabled = false;
      btn.textContent = '🔁 Обновить прогнозы';
    });
  }

  // При смене даты (если переход по календарю)
  if (dateInput) {
    dateInput.addEventListener('change', function() {
      setTimeout(() => {
        // После перехода по ссылке страница перезагрузится, но если SPA — можно раскомментировать:
        // initAllParameterCharts(this.value);
      }, 100);
    });
  }

  setupPredictionsToggleBtn();
  setPredictionsVisible(loadPredictionsVisibleState());

  setupParamFilterInput();

  setupChartsMinDateInput();

  // --- Фокус ---
  setupFocusToggleBtn();

  // --- Сортировка по сумме ---
  const sortBtnSum = document.querySelector('.sort-btn[data-sort="sum"]');

// --- Сортировка по процентам ---
const sortBtnPercent = document.querySelector('.sort-btn[data-sort="sum-percent"]');
const sortArrowPercent = sortBtnPercent ? sortBtnPercent.querySelector('.sort-arrow') : null;
let sortStatePercent = 0;

function getPercentValue(block) {
  const percentBlock = block.querySelector('.param-sum-block-range');
  if (!percentBlock) return -1;
  const val = percentBlock.textContent.trim().replace('%', '');
  const num = parseFloat(val.replace(',', '.'));
  return isNaN(num) ? -1 : num;
}

function sortByPercent(direction) {
  const blocks = Array.from(document.querySelectorAll('.parameter-block'));
  blocks.sort((a, b) => {
    const aVal = getPercentValue(a);
    const bVal = getPercentValue(b);
    return direction === 1 ? bVal - aVal : aVal - bVal;
  });

  const container = document.querySelector('.parameters-list');
  blocks.forEach((block) => container.appendChild(block));
}

if (sortBtnPercent) {
  sortBtnPercent.addEventListener('click', () => {
    sortStatePercent = (sortStatePercent + 1) % 3;
    if (sortArrowPercent) {
      sortArrowPercent.innerHTML = sortStatePercent === 1 ? '↓' : sortStatePercent === 2 ? '↑' : '';
    }

    if (sortStatePercent === 0) return;

    const maxWaitMs = 7000;
    const checkIntervalMs = 300;
    let waited = 0;

    const interval = setInterval(() => {
      const ready = Array.from(document.querySelectorAll('.param-sum-block-range'))
        .every(el => el.textContent.trim().endsWith('%'));

      if (ready || waited >= maxWaitMs) {
        clearInterval(interval);
        sortByPercent(sortStatePercent === 1 ? 1 : -1);
      }

      waited += checkIntervalMs;
    }, checkIntervalMs);
  });
}
  const sortArrowSum = sortBtnSum ? sortBtnSum.querySelector('.sort-arrow') : null;
  let sortStateSum = 0;

  function getSumValue(block) {
    const sumBlock = block.querySelector('.param-sum-block');
    if (!sumBlock) return -1;
    const val = sumBlock.textContent.trim();
    const num = parseFloat(val.replace(',', '.'));
    return isNaN(num) ? -1 : num;
  }

  function sortBySum(direction) {
    const blocks = Array.from(document.querySelectorAll('.parameter-block'));
    blocks.sort((a, b) => {
      const valA = getSumValue(a);
      const valB = getSumValue(b);
      if (valA < valB) return direction === 1 ? -1 : 1;
      if (valA > valB) return direction === 1 ? 1 : -1;
      return 0;
    });
    const firstBlock = blocks[0];
    const parent = firstBlock.parentNode;
    blocks.forEach(block => parent.appendChild(block));
    // Переместить форму комментария вниз
    const form = parent.querySelector('form[method="post"]');
    if (form) parent.appendChild(form);
  }

  function updateArrowSum() {
    if (!sortArrowSum) return;
    if (sortStateSum === 1) {
      sortArrowSum.textContent = '▲';
      sortBtnSum.classList.add('active');
    } else if (sortStateSum === 2) {
      sortArrowSum.textContent = '▼';
      sortBtnSum.classList.add('active');
    } else {
      sortArrowSum.textContent = '';
      sortBtnSum.classList.remove('active');
    }
  }

  if (sortBtnSum) {
    sortBtnSum.addEventListener('click', function() {
      resetAllSortStates('sum');
      sortStateSum = (sortStateSum + 1) % 3;
      // Сбросить состояние у других кнопок
      sortState = 0;
      sortStateValue = 0;
      sortStatePred = 0;
      updateArrow();
      updateArrowValue();
      updateArrowPred();
      if (sortStateSum === 1) {
        sortBySum(1);
        saveSortState('sum', 1);
      } else if (sortStateSum === 2) {
        sortBySum(-1);
        saveSortState('sum', -1);
      } else {
        window.location.reload();
        clearSortState();
      }
      updateArrowSum();
      updateParameterSums();
    });
  }

  // --- Сброс всех сортировок (добавляем sum) ---
  function resetAllSortStates(except) {
    if (except !== 'name') {
      sortState = 0;
      if (typeof updateArrow === 'function') updateArrow();
      if (typeof sortBtn !== 'undefined') sortBtn.classList.remove('active');
    }
    if (except !== 'value') {
      sortStateValue = 0;
      if (typeof updateArrowValue === 'function') updateArrowValue();
      if (typeof sortBtnValue !== 'undefined') sortBtnValue.classList.remove('active');
    }
    if (except !== 'prediction') {
      sortStatePred = 0;
      if (typeof updateArrowPred === 'function') updateArrowPred();
      if (typeof sortBtnPred !== 'undefined') sortBtnPred.classList.remove('active');
    }
    if (except !== 'sum') {
      sortStateSum = 0;
      if (typeof updateArrowSum === 'function') updateArrowSum();
      if (typeof sortBtnSum !== 'undefined') sortBtnSum.classList.remove('active');
    }
  }

  // --- Восстановление сортировки при загрузке страницы (добавляем sum) ---
  document.addEventListener('DOMContentLoaded', function() {
    const state = loadSortState && loadSortState();
    if (!state) return;
    if (state.type === 'name') {
      sortState = state.direction === 1 ? 1 : 2;
      if (typeof sortByName === 'function') sortByName(state.direction);
      if (typeof updateArrow === 'function') updateArrow();
    } else if (state.type === 'value') {
      sortStateValue = state.direction === 1 ? 1 : 2;
      if (typeof sortByValue === 'function') sortByValue(state.direction);
      if (typeof updateArrowValue === 'function') updateArrowValue();
    } else if (state.type === 'prediction') {
      sortStatePred = state.direction === 1 ? 1 : 2;
      if (typeof sortByPrediction === 'function') sortByPrediction(state.direction);
      if (typeof updateArrowPred === 'function') updateArrowPred();
    } else if (state.type === 'sum') {
      sortStateSum = state.direction === 1 ? 1 : 2;
      if (typeof sortBySum === 'function') sortBySum(state.direction);
      if (typeof updateArrowSum === 'function') updateArrowSum();
    }
  });

  // --- Глобальные переменные для сортировки по имени ---
  window.sortBtn = document.querySelector('.sort-btn[data-sort="name"]');
  window.sortArrow = sortBtn ? sortBtn.querySelector('.sort-arrow') : null;
  // --- Глобальные переменные для сортировки по значению ---
  window.sortBtnValue = document.querySelector('.sort-btn[data-sort="value"]');
  window.sortArrowValue = sortBtnValue ? sortBtnValue.querySelector('.sort-arrow') : null;
  // --- Глобальные переменные для сортировки по прогнозу ---
  window.sortBtnPred = document.querySelector('.sort-btn[data-sort="prediction"]');
  window.sortArrowPred = sortBtnPred ? sortBtnPred.querySelector('.sort-arrow') : null;

  // --- Кнопка def ---
  const defBtn = document.getElementById('def-btn');
  if (defBtn) {
    defBtn.addEventListener('click', async function() {
      defBtn.disabled = true;
      defBtn.textContent = '⏳ def...';
      try {
        let count = 0;
        for (const block of document.querySelectorAll('.parameter-block')) {
          const paramKey = block.getAttribute('data-key');
          const paramTitle = block.querySelector('.param-title').textContent;
          // Ищем "def" и число после него
          const match = paramTitle.match(/def\s*(\d+)/i);
          if (match) {
            const defValue = parseInt(match[1], 10);
            // Проверяем, есть ли уже значение
            const selectedBtn = block.querySelector('.value-button.selected');
            if (!selectedBtn) {
              // Отправляем на сервер
              const payload = {
                parameter: paramKey,
                value: defValue,
                date: dateValue,
              };
              try {
                const response = await fetch('/update_value/', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                  },
                  body: JSON.stringify(payload),
                });
                if (response.ok) {
                  // Подсвечиваем кнопку
                  const btn = block.querySelector(`.value-button[data-value="${defValue}"]`);
                  if (btn) btn.classList.add('selected');
                  count++;
                }
              } catch (e) {
                console.error('Ошибка при установке дефолтного значения:', e);
              }
            }
          }
        }
        if (count > 0) {
          loadPredictions();
          alert(`Установлено дефолтных значений: ${count}`);
        } else {
          alert('Нет параметров с def или все уже заполнены.');
        }
      } finally {
        defBtn.disabled = false;
        defBtn.textContent = 'def';
      }
    });
  }
});

// 🔐 Получение CSRF-токена из cookie
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith(name + "=")) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}
// 📡 Функция загрузки прогнозов с сервера
async function loadPredictions() {
  // 🕓 1. Получаем дату, выбранную в поле <input type="date">
  const date = document.getElementById("date-input")?.value;
  console.log("[loadPredictions] Выбранная дата:", date);
  if (!date) {
    console.warn("[loadPredictions] Нет даты, прогнозы не будут загружены");
    return; // если даты нет — прекращаем
  }

  try {
    // 🌐 2. Отправляем GET-запрос на /get_predictions/?date=...
    console.log(`[loadPredictions] Отправляю запрос: /get_predictions/?date=${encodeURIComponent(date)}`);
    const res = await fetch(`/get_predictions/?date=${encodeURIComponent(date)}`);

    // 🧾 3. Разбираем JSON-ответ с прогнозами
    const data = await res.json();
    console.log("[loadPredictions] Ответ от сервера:", data);

    // Пример: data = { "ustalost_base": 3.4, "toshn_base": 1.2 }

    // 🔁 4. Перебираем каждый параметр и его предсказанное значение
    Object.entries(data).forEach(([key, value]) => {
      console.log(`[loadPredictions] Обрабатываю ключ: ${key}, значение: ${value}`);
      // Убираем суффикс "_base" → получаем чистый параметр (например: "ustalost")
      const paramKey = key.replace("_base", "");
      console.log(`[loadPredictions] paramKey: ${paramKey}`);

      // 🎯 Ищем блоки для вставки значений
      const target = document.getElementById(`predicted-${paramKey}`);          // основной прогноз
      const deltaTarget = document.getElementById(`predicted-delta-${paramKey}`); // дельта

      if (!target) {
        console.warn(`[loadPredictions] Не найден элемент predicted-${paramKey}`);
      }
      if (!deltaTarget) {
        console.warn(`[loadPredictions] Не найден элемент predicted-delta-${paramKey}`);
      }

      if (target) {
        // 📌 5. Проверяем — есть ли уже сохранённое значение у пользователя
        const selectedButton = document
          .querySelector(`.parameter-block[data-key="${paramKey}"] .value-button.selected`);
        if (!selectedButton) {
          console.log(`[loadPredictions] Для ${paramKey} не выбрано значение пользователем`);
        }

        // Преобразуем значение в число (или NaN, если ничего не выбрано)
        const current = parseFloat(selectedButton?.getAttribute("data-value") || "NaN");
        console.log(`[loadPredictions] Текущее значение пользователя для ${paramKey}:`, current);

        // 🔁 6. Считаем дельту, если возможно
        const delta = isNaN(current) ? null : value - current;
        const absDelta = delta !== null ? Math.abs(delta) : null;
        console.log(`[loadPredictions] Прогноз: ${value}, Дельта: ${delta}, Абс. дельта: ${absDelta}`);

        // 📥 7. Вставляем текст прогноза и дельты
        target.textContent = `Прогноз: ${value.toFixed(1)}`;
        if (deltaTarget) {
          deltaTarget.textContent = delta !== null ? `Δ ${delta.toFixed(1)}` : "";
        }

        // 🎨 8. Вычисляем цвет подсказки
        let color = "gray";
        if (absDelta !== null) {
          if (absDelta < 1) color = "green";
          else if (absDelta <= 2) color = "yellow";
          else color = "red";
        }
        console.log(`[loadPredictions] Цвет для ${paramKey}:`, color);

        // 🟢 9. Вставляем цвет как data-атрибут (для CSS-стилизации)
        target.dataset.color = color;
      }
    });

    // ✅ Лог в консоль: успех
    console.log("[loadPredictions] Прогнозы успешно обработаны:", data);

  } catch (err) {
    // ❌ Если ошибка — логируем в консоль
    console.error("[loadPredictions] ❌ Ошибка загрузки прогнозов", err);
  }
}

// --- Графики истории значений параметров ---
async function loadParameterHistory(paramKey, dateStr) {
  const chartId = `history-chart-${paramKey}`;
  const emptyId = `history-chart-empty-${paramKey}`;
  const ctx = document.getElementById(chartId);
  const emptyDiv = document.getElementById(emptyId);
  if (!ctx) return;

  // Удаляем старый график, если есть
  if (ctx._chartInstance) {
    ctx._chartInstance.destroy();
    ctx._chartInstance = null;
  }

  try {
    const res = await fetch(`/api/parameter_history/?param=${encodeURIComponent(paramKey)}&date=${encodeURIComponent(dateStr)}`);
    const data = await res.json();
    if (!data.dates || !data.values || data.dates.length === 0) {
      ctx.style.display = 'none';
      if (emptyDiv) emptyDiv.style.display = '';
      return;
    }
    ctx.style.display = '';
    if (emptyDiv) emptyDiv.style.display = 'none';

    // Фильтрация по минимальной дате
    const minDate = loadChartsMinDate();
    let filteredDates = data.dates;
    let filteredValues = data.values;
    if (minDate) {
      const idx = data.dates.findIndex(date => date >= minDate);
      if (idx !== -1) {
        filteredDates = data.dates.slice(idx);
        filteredValues = data.values.slice(idx);
      } else {
        filteredDates = [];
        filteredValues = [];
      }
    }
    const monthsRu = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const labels = filteredDates.map(d => {
      const [y, m, d2] = d.split('-');
      return `${parseInt(d2,10)} ${monthsRu[parseInt(m,10)-1]}`;
    });
    ctx._chartInstance = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '',
          data: filteredValues,
          borderColor: '#28a745',
          backgroundColor: 'rgba(40,167,69,0.10)',
          pointRadius: 2.5,
          pointBackgroundColor: '#28a745',
          pointBorderColor: '#222',
          borderWidth: 2,
          tension: 0.25,
          fill: true,
          spanGaps: true,
          segment: {
            borderColor: ctx => {
              const v = ctx.p0.parsed.y;
              // Проверяем, содержит ли paramKey "pos" (регистронезависимо)
              const isPositiveParam = paramKey.toLowerCase().includes('pos');
              // Инвертируем логику цвета, если параметр "позитивный"
              if (isPositiveParam) {
                  return v >= 3 ? '#28a745' : '#e0a800'; // Инвертированный цвет
              } else {
                  return v >= 3 ? '#e0a800' : '#28a745'; // Оригинальный цвет
              }
            },
            backgroundColor: ctx => {
              const v = ctx.p0.parsed.y;
              // Проверяем, содержит ли paramKey "pos" (регистронезависимо)
              const isPositiveParam = paramKey.toLowerCase().includes('pos');
              // Инвертируем логику цвета заливки, если параметр "позитивный"
               if (isPositiveParam) {
                  return v >= 3 ? 'rgba(40,167,69,0.10)' : 'rgba(224,168,0,0.10)'; // Инвертированная заливка
               } else {
                  return v >= 3 ? 'rgba(224,168,0,0.10)' : 'rgba(40,167,69,0.10)'; // Оригинальная заливка
               }
            }
          }
        },
        // --- Линия тренда ---
        {
          label: 'Тренд',
          data: (function() {
            // Линейная регрессия по filteredValues
            const n = filteredValues.length;
            if (n < 2) return Array(n).fill(null);
            let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
            for (let i = 0; i < n; i++) {
              sumX += i;
              sumY += filteredValues[i];
              sumXY += i * filteredValues[i];
              sumXX += i * i;
            }
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;
            return Array.from({length: n}, (_, i) => Math.round((slope * i + intercept) * 100) / 100);
          })(),
          borderColor: 'rgba(0,123,255,1)',
          backgroundColor: 'rgba(255,152,0,0.10)',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0,
          spanGaps: true,
          order: 2,
        }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true }
        },
        scales: {
          x: {
            ticks: { color: '#aaa', font: { size: 8 } },
            grid: { color: '#222' }
          },
          y: {
            min: 0, max: 5,
            ticks: { color: '#aaa', font: { size: 8 }, stepSize: 1 },
            grid: { color: '#222' }
          }
        }
      }
    });
  } catch (e) {
    ctx.style.display = 'none';
    if (emptyDiv) emptyDiv.style.display = '';
  }
}

// --- Инициализация графиков для всех параметров ---
function initAllParameterCharts(dateStr) {
  document.querySelectorAll('.parameter-block').forEach(block => {
    const paramKey = block.getAttribute('data-key');
    loadParameterHistory(paramKey, dateStr);
  });
  fillChartsMinDateInput(loadChartsMinDate());
}

// --- Управление отображением графиков ---
function setChartsVisible(visible) {
  document.querySelectorAll('.history-chart-block').forEach(block => {
    block.style.display = visible ? '' : 'none';
  });
  const btn = document.getElementById('charts-toggle-btn');
  if (btn) btn.classList.toggle('active', visible);
}

function saveChartsVisibleState(visible) {
  localStorage.setItem('diary_charts_visible', visible ? '1' : '0');
}

function loadChartsVisibleState() {
  const val = localStorage.getItem('diary_charts_visible');
  if (val === null) return true; // по умолчанию графики включены
  return val === '1';
}

function setupChartsToggleBtn() {
  const btn = document.getElementById('charts-toggle-btn');
  if (!btn) return;
  btn.addEventListener('click', function() {
    const nowVisible = !loadChartsVisibleState();
    setChartsVisible(nowVisible);
    saveChartsVisibleState(nowVisible);
  });
}

// --- Управление отображением прогнозов ---
function setPredictionsVisible(visible) {
  document.querySelectorAll('.prediction-wrapper').forEach(block => {
    block.style.display = visible ? '' : 'none';
  });
  const btn = document.getElementById('predictions-toggle-btn');
  if (btn) btn.classList.toggle('active', visible);
}

function savePredictionsVisibleState(visible) {
  localStorage.setItem('diary_predictions_visible', visible ? '1' : '0');
}

function loadPredictionsVisibleState() {
  const val = localStorage.getItem('diary_predictions_visible');
  if (val === null) return true; // по умолчанию прогнозы включены
  return val === '1';
}

function setupPredictionsToggleBtn() {
  const btn = document.getElementById('predictions-toggle-btn');
  if (!btn) return;
  btn.addEventListener('click', function() {
    const nowVisible = !loadPredictionsVisibleState();
    setPredictionsVisible(nowVisible);
    savePredictionsVisibleState(nowVisible);
  });
}

// --- Фильтрация параметров по тексту ---
function filterParameterBlocks(filter) {
  const blocks = document.querySelectorAll('.parameter-block');
  if (!filter || !filter.trim()) {
    blocks.forEach(b => b.style.display = '');
    return;
  }
  const terms = filter.toLowerCase().split(/\s+/).filter(Boolean);
  
  // Разделяем термины на включаемые (AND), исключаемые (NOT) и OR-термины
  const includedTerms = terms.filter(term => !term.startsWith('-') && !term.startsWith('+'));
  const excludedTerms = terms
    .filter(term => term.startsWith('-'))
    .map(term => term.slice(1));
  const orTerms = terms
    .filter(term => term.startsWith('+'))
    .map(term => term.slice(1));

  blocks.forEach(block => {
    const title = block.querySelector('.param-title').textContent.toLowerCase();
    
    // Проверяем, что все включаемые термины присутствуют (AND)
    const hasAllIncluded = includedTerms.length === 0 || 
      includedTerms.every(term => title.includes(term));
    // Проверяем, что ни один исключаемый термин не присутствует (NOT)
    const hasNoExcluded = excludedTerms.length === 0 || 
      !excludedTerms.some(term => title.includes(term));
    // Проверяем, что хотя бы один OR-термин присутствует (OR)
    const hasAnyOr = orTerms.length === 0 || 
      orTerms.some(term => title.includes(term));
    
    // Если есть хотя бы один OR-термин, то он становится обязательным условием
    // (то есть: (AND) и (OR) и (NOT))
    // Если OR-терминов нет, то только (AND) и (NOT)
    const show = hasAllIncluded && hasNoExcluded && hasAnyOr;
    block.style.display = show ? '' : 'none';
  });
}

function saveParamFilterState(val) {
  localStorage.setItem('diary_param_filter', val);
}

function loadParamFilterState() {
  return localStorage.getItem('diary_param_filter') || '';
}

function setupParamFilterInput() {
  const input = document.getElementById('param-filter-input');
  if (!input) return;
  input.value = loadParamFilterState();
  filterParameterBlocks(input.value);
  input.addEventListener('input', function() {
    filterParameterBlocks(this.value);
    saveParamFilterState(this.value);
  });
  // --- Кнопка очистки фильтра ---
  const clearBtn = document.querySelector('.filter-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      input.value = '';
      filterParameterBlocks('');
      saveParamFilterState('');
      input.focus();
    });
  }
}

// --- Сортировка: инверсия стрелочек ---
function updateArrow() {
  if (sortState === 1) {
    sortArrow.textContent = '▼'; // ▼ — по возрастанию
    sortBtn.classList.add('active');
  } else if (sortState === 2) {
    sortArrow.textContent = '▲'; // ▲ — по убыванию
    sortBtn.classList.add('active');
  } else {
    sortArrow.textContent = '';
    sortBtn.classList.remove('active');
  }
}

function updateArrowValue() {
  if (sortStateValue === 1) {
    sortArrowValue.textContent = '▼';
    sortBtnValue.classList.add('active');
  } else if (sortStateValue === 2) {
    sortArrowValue.textContent = '▲';
    sortBtnValue.classList.add('active');
  } else {
    sortArrowValue.textContent = '';
    sortBtnValue.classList.remove('active');
  }
}

function updateArrowPred() {
  if (sortStatePred === 1) {
    sortArrowPred.textContent = '▼';
    sortBtnPred.classList.add('active');
  } else if (sortStatePred === 2) {
    sortArrowPred.textContent = '▲';
    sortBtnPred.classList.add('active');
  } else {
    sortArrowPred.textContent = '';
    sortBtnPred.classList.remove('active');
  }
}

// --- Минимальная дата для графиков ---
function saveChartsMinDate(val) {
  localStorage.setItem('diary_charts_min_date', val);
}

function loadChartsMinDate() {
  return localStorage.getItem('diary_charts_min_date') || '';
}

function setupChartsMinDateInput() {
  const input = document.getElementById('charts-min-date');
  if (!input) return;
  // Восстанавливаем выбранную дату из localStorage
  fillChartsMinDateInput(loadChartsMinDate());
  input.addEventListener('change', function() {
    saveChartsMinDate(this.value);
    initAllParameterCharts(document.getElementById('date-input').value);
    updateParameterSums(); // всегда обновлять сумму при смене даты
  });
}

// --- fillChartsMinDateInput: всегда восстанавливаем выбранную дату из localStorage ---
async function fillChartsMinDateInput(selectedDate) {
  const input = document.getElementById('charts-min-date');
  if (!input) return;
  try {
    const firstBlock = document.querySelector('.parameter-block');
    if (!firstBlock) return;
    const paramKey = firstBlock.getAttribute('data-key');
    const dateInput = document.getElementById('date-input');
    const toDate = dateInput ? dateInput.value : '';
    const res = await fetch(`/api/parameter_history/?param=${encodeURIComponent(paramKey)}&date=${encodeURIComponent(toDate)}`);
    const data = await res.json();
    if (!data.dates || data.dates.length === 0) {
      input.value = '';
      input.min = '';
      input.max = '';
      input.disabled = true;
      return;
    }
    input.disabled = false;
    // Восстанавливаем выбранное значение из localStorage или из selectedDate
    const savedMinDate = loadChartsMinDate();
    if (savedMinDate && data.dates.includes(savedMinDate)) {
      input.value = savedMinDate;
    } else if (selectedDate && data.dates.includes(selectedDate)) {
      input.value = selectedDate;
      saveChartsMinDate(selectedDate);
    } else {
      input.value = data.dates[0];
      saveChartsMinDate(data.dates[0]);
    }
  } catch {}
}

// --- Сумма значений параметра с выбранной даты ---
async function updateParameterSums() {
  const minDateInput = document.getElementById('charts-min-date');
  const dateInput = document.getElementById('date-input');
  const minDate = minDateInput ? minDateInput.value : '';
  const toDate = dateInput ? dateInput.value : '';

  document.querySelectorAll('.parameter-block').forEach(async (block) => {
    const paramKey = block.getAttribute('data-key');
    const sumBlock = block.querySelector('.param-sum-block');
    const sumBlockRange = block.querySelector('.param-sum-block-range');
    if (!sumBlock) return;

    try {
      const res = await fetch(`/api/parameter_history/?param=${encodeURIComponent(paramKey)}&date=${encodeURIComponent(toDate)}`);
      const data = await res.json();
      if (!data.dates || !data.values || data.dates.length === 0) {
        sumBlock.textContent = '';
        if (sumBlockRange) sumBlockRange.textContent = '';
        return;
      }

      // --- НАЧАЛО: фильтрация по диапазону [minDate - toDate]
      let rangeStartIdx = 0;
      if (minDate) {
        rangeStartIdx = data.dates.findIndex(date => date >= minDate);
        if (rangeStartIdx === -1) rangeStartIdx = data.dates.length; // ничего не попадёт
      }

      const rangeValues = data.values.slice(rangeStartIdx);
      const rangeDates = data.dates.slice(rangeStartIdx);
      // --- КОНЕЦ: фильтрация диапазона

      // Суммируем значения (игнорируем null/NaN)
      const sum = rangeValues.reduce((acc, v) => acc + (typeof v === 'number' && !isNaN(v) ? v : 0), 0);
      sumBlock.textContent = sum ? Math.round(sum) : '0';

      // --- Новый блок: сумма по диапазону дат ---
      if (sumBlockRange) {
        const rangeSum = rangeValues.reduce((acc, v) => acc + (typeof v === 'number' && !isNaN(v) ? v : 0), 0);
        const daysCount = rangeDates.length;
        if (daysCount > 0) {
          const percent = Math.round((rangeSum / (4 * daysCount)) * 100);
          sumBlockRange.textContent = percent + '%';

          // --- Цвет по шкале
          const paramTitle = block.querySelector('.param-title')?.textContent || '';
          let color = '';
          if (/pos/i.test(paramTitle)) {
            if (percent <= 10) color = '#dc3545';
            else if (percent <= 20) color = '#ff3c00';
            else if (percent <= 40) color = '#ff8800';
            else if (percent <= 65) color = '#e0a800';
            else if (percent <= 80) color = '#28a745';
            else color = '#7fd428';
          } else {
            if (percent <= 10) color = '#7fd428';
            else if (percent <= 20) color = '#28a745';
            else if (percent <= 40) color = '#e0a800';
            else if (percent <= 65) color = '#ff8800';
            else if (percent <= 80) color = '#ff3c00';
            else color = '#dc3545';
          }

          sumBlockRange.style.background = color;
          sumBlockRange.style.borderColor = color;
        } else {
          sumBlockRange.textContent = '–';
          sumBlockRange.style.background = '';
          sumBlockRange.style.borderColor = '';
        }
      }
    } catch {
      sumBlock.textContent = '';
      if (sumBlockRange) sumBlockRange.textContent = '';
    }
  });
}


// --- Обновлять сумму при изменении дат и при загрузке страницы ---
document.addEventListener('DOMContentLoaded', function() {
  const minDateInput = document.getElementById('charts-min-date');
  const dateInput = document.getElementById('date-input');
  if (minDateInput) minDateInput.addEventListener('change', updateParameterSums);
  if (dateInput) dateInput.addEventListener('change', updateParameterSums);
  updateParameterSums();
});

// --- Сохранение и восстановление сортировки ---
function saveSortState(type, direction) {
  localStorage.setItem('diary_sort', JSON.stringify({type, direction}));
}
function clearSortState() {
  localStorage.removeItem('diary_sort');
}
function loadSortState() {
  try {
    return JSON.parse(localStorage.getItem('diary_sort'));
  } catch { return null; }
}

(function() {
  // Получаем кнопки сортировки и стрелочки
  const sortBtn = document.querySelector('.sort-btn[data-sort="name"]');
  const sortArrow = sortBtn ? sortBtn.querySelector('.sort-arrow') : null;
  const sortBtnValue = document.querySelector('.sort-btn[data-sort="value"]');
  const sortArrowValue = sortBtnValue ? sortBtnValue.querySelector('.sort-arrow') : null;
  const sortBtnPred = document.querySelector('.sort-btn[data-sort="prediction"]');
  const sortArrowPred = sortBtnPred ? sortBtnPred.querySelector('.sort-arrow') : null;

  let sortState = 0, sortStateValue = 0, sortStatePred = 0;

  function getParamBlocks() {
    return Array.from(document.querySelectorAll('.parameter-block'));
  }

  function moveCommentFormToBottom() {
    const form = document.querySelector('form[method="post"]');
    const container = document.querySelector('.container');
    if (form && container) container.appendChild(form);
  }

  function sortByName(direction) {
    const blocks = getParamBlocks();
    blocks.sort((a, b) => {
      const nameA = a.querySelector('.param-title').textContent.trim().toLowerCase();
      const nameB = b.querySelector('.param-title').textContent.trim().toLowerCase();
      if (nameA < nameB) return direction === 1 ? -1 : 1;
      if (nameA > nameB) return direction === 1 ? 1 : -1;
      return 0;
    });
    const parent = blocks[0].parentNode;
    blocks.forEach(block => parent.appendChild(block));
    moveCommentFormToBottom();
  }

  function getSelectedValue(block) {
    const btn = block.querySelector('.value-button.selected');
    if (!btn) return -1;
    return parseInt(btn.getAttribute('data-value'), 10);
  }

  function sortByValue(direction) {
    const blocks = getParamBlocks();
    blocks.sort((a, b) => {
      const valA = getSelectedValue(a);
      const valB = getSelectedValue(b);
      if (valA < valB) return direction === 1 ? -1 : 1;
      if (valA > valB) return direction === 1 ? 1 : -1;
      return 0;
    });
    const parent = blocks[0].parentNode;
    blocks.forEach(block => parent.appendChild(block));
    moveCommentFormToBottom();
  }

  function getPredictionValue(block) {
    const pred = block.querySelector('.predicted');
    if (!pred) return -Infinity;
    const val = pred.textContent.trim().replace(',', '.');
    const match = val.match(/([\d\.\-]+)/);
    if (!match) return -Infinity;
    const num = parseFloat(match[1]);
    return isNaN(num) ? -Infinity : num;
  }

  function sortByPrediction(direction) {
    const blocks = getParamBlocks();
    blocks.sort((a, b) => {
      const valA = getPredictionValue(a);
      const valB = getPredictionValue(b);
      if (valA < valB) return direction === 1 ? -1 : 1;
      if (valA > valB) return direction === 1 ? 1 : -1;
      return 0;
    });
    const parent = blocks[0].parentNode;
    blocks.forEach(block => parent.appendChild(block));
    moveCommentFormToBottom();
  }

  function resetAllSortStates(except) {
    if (except !== 'name') {
      sortState = 0;
      if (sortArrow) sortArrow.textContent = '';
      if (sortBtn) sortBtn.classList.remove('active');
    }
    if (except !== 'value') {
      sortStateValue = 0;
      if (sortArrowValue) sortArrowValue.textContent = '';
      if (sortBtnValue) sortBtnValue.classList.remove('active');
    }
    if (except !== 'prediction') {
      sortStatePred = 0;
      if (sortArrowPred) sortArrowPred.textContent = '';
      if (sortBtnPred) sortBtnPred.classList.remove('active');
    }
  }

  function updateArrow() {
    if (!sortArrow) return;
    if (sortState === 1) {
      sortArrow.textContent = '▲';
      sortBtn.classList.add('active');
    } else if (sortState === 2) {
      sortArrow.textContent = '▼';
      sortBtn.classList.add('active');
    } else {
      sortArrow.textContent = '';
      sortBtn.classList.remove('active');
    }
  }
  function updateArrowValue() {
    if (!sortArrowValue) return;
    if (sortStateValue === 1) {
      sortArrowValue.textContent = '▲';
      sortBtnValue.classList.add('active');
    } else if (sortStateValue === 2) {
      sortArrowValue.textContent = '▼';
      sortBtnValue.classList.add('active');
    } else {
      sortArrowValue.textContent = '';
      sortBtnValue.classList.remove('active');
    }
  }
  function updateArrowPred() {
    if (!sortArrowPred) return;
    if (sortStatePred === 1) {
      sortArrowPred.textContent = '▲';
      sortBtnPred.classList.add('active');
    } else if (sortStatePred === 2) {
      sortArrowPred.textContent = '▼';
      sortBtnPred.classList.add('active');
    } else {
      sortArrowPred.textContent = '';
      sortBtnPred.classList.remove('active');
    }
  }

  // Навешиваем обработчики
  if (sortBtn) {
    sortBtn.addEventListener('click', function() {
      resetAllSortStates('name');
      sortState = (sortState + 1) % 3;
      if (sortState === 1) {
        sortByName(1);
        saveSortState('name', 1);
      } else if (sortState === 2) {
        sortByName(-1);
        saveSortState('name', -1);
      } else {
        window.location.reload();
        clearSortState();
      }
      updateArrow();
    });
  }
  if (sortBtnValue) {
    sortBtnValue.addEventListener('click', function() {
      resetAllSortStates('value');
      sortStateValue = (sortStateValue + 1) % 3;
      if (sortStateValue === 1) {
        sortByValue(1);
        saveSortState('value', 1);
      } else if (sortStateValue === 2) {
        sortByValue(-1);
        saveSortState('value', -1);
      } else {
        window.location.reload();
        clearSortState();
      }
      updateArrowValue();
    });
  }
  if (sortBtnPred) {
    sortBtnPred.addEventListener('click', function() {
      resetAllSortStates('prediction');
      sortStatePred = (sortStatePred + 1) % 3;
      if (sortStatePred === 1) {
        sortByPrediction(1);
        saveSortState('prediction', 1);
      } else if (sortStatePred === 2) {
        sortByPrediction(-1);
        saveSortState('prediction', -1);
      } else {
        window.location.reload();
        clearSortState();
      }
      updateArrowPred();
    });
  }

  // Восстановление сортировки при загрузке страницы
  document.addEventListener('DOMContentLoaded', function() {
    const state = loadSortState && loadSortState();
    if (!state) return;
    if (state.type === 'name') {
      sortState = state.direction === 1 ? 1 : 2;
      sortByName(state.direction);
      updateArrow();
    } else if (state.type === 'value') {
      sortStateValue = state.direction === 1 ? 1 : 2;
      sortByValue(state.direction);
      updateArrowValue();
    } else if (state.type === 'prediction') {
      sortStatePred = state.direction === 1 ? 1 : 2;
      sortByPrediction(state.direction);
      updateArrowPred();
    }
  });

})();

// --- Фокус: скрытие кнопок для ввода параметров ---
function setFocusMode(enabled) {
  document.querySelectorAll('.parameter-block .rating-buttons').forEach(block => {
    block.style.display = enabled ? 'none' : '';
  });
  const btn = document.getElementById('focus-toggle-btn');
  if (btn) btn.classList.toggle('active', enabled);
}

function saveFocusModeState(enabled) {
  localStorage.setItem('diary_focus_mode', enabled ? '1' : '0');
}

function loadFocusModeState() {
  const val = localStorage.getItem('diary_focus_mode');
  if (val === null) return false; // по умолчанию выключено
  return val === '1';
}

function setupFocusToggleBtn() {
  const btn = document.getElementById('focus-toggle-btn');
  if (!btn) return;
  btn.addEventListener('click', function() {
    const nowEnabled = !loadFocusModeState();
    setFocusMode(nowEnabled);
    saveFocusModeState(nowEnabled);
  });
  // Восстановить состояние при загрузке
  setFocusMode(loadFocusModeState());
}