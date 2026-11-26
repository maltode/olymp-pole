// Olymp Pole: расписание со свободными местами, запись, проверка абонемента, заявка на персональное.
// Данные берём с сервера студии (Cloudflare Worker). Расписание София меняет в кабинете бота, сайт обновляется сам.
(function () {
  'use strict';
  // На компьютере разработчика (localhost) — локальная копия сервера с тестовой базой
  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://127.0.0.1:8797' : 'https://olymp-pole-bot.capybaria-bot.workers.dev';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  var html = document.documentElement;
  // ?vse — показать все блоки сразу (для скриншотов-проверок)
  if (location.search.indexOf('vse') > -1) html.classList.add('vse');

  // плавное появление блоков
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
  }, { threshold: 0.1 }) : null;
  $$('.rv').forEach(function (el) { io ? io.observe(el) : el.classList.add('in'); });

  // ---------- справочники ----------
  var DN = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var DN_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  var MES = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var LV = { nach: 'начинающие', prod: 'продолжающие', profi: 'профи' };
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  var URS = {
    nach: { num: 'I', imya: 'Начинающие', opis: 'Для тех, кто пришёл впервые или занимался совсем немного. Ставим хват, первые вращения и элементы у пилона, укрепляем тело.', esli: ['ни разу не занимались', 'нет силы и растяжки, но хочется начать'] },
    prod: { num: 'II', imya: 'Продолжающие', opis: 'Для тех, кто освоил базу. Подъёмы на пилон, вращения, трюки в воздухе и связки. Есть занятия СФП + Pole sport по 1,5 часа.', esli: ['уверенно делаете базовые вращения', 'хотите подниматься выше и пробовать трюки'] },
    profi: { num: 'III', imya: 'Профи', opis: 'Силовые элементы, сложные трюки и связки pole sport. Занятия идут в смешанных группах вместе с продолжающими.', esli: ['занимаетесь давно', 'хотите сложные элементы и свои связки'] }
  };

  function levelText(lv) { return lv ? lv.split(',').map(function (x) { return LV[x] || x; }).join(' и ') : 'все уровни'; }
  function d(iso) { return new Date(iso + 'T00:00:00Z'); }
  function dataLong(iso) { var x = d(iso); return DN[x.getUTCDay()] + ', ' + x.getUTCDate() + ' ' + MES[x.getUTCMonth()]; }
  function dataKor(iso) { var x = d(iso); return x.getUTCDate() + ' ' + MES[x.getUTCMonth()]; }
  function addDays(iso, n) { var x = d(iso); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function vremya(t) { return t.replace(/^0/, ''); }
  function mest(n) { var a = n % 10, b = n % 100; return (a === 1 && b !== 11) ? 'место' : (a >= 2 && a <= 4 && (b < 12 || b > 14)) ? 'места' : 'мест'; }
  function ostalos(n) { return n === 1 ? 'осталось 1 место' : 'осталось ' + n + ' ' + mest(n); }
  // неразрывные пробелы: «1 500 ₽» не переносится по частям
  function rub(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cifry(v) { var c = String(v).replace(/\D/g, ''); if (c.length === 10 && c[0] === '9') c = '7' + c; return c; }
  function telOk(v) { return /^[78]9\d{9}$/.test(cifry(v)) || /^[78]\d{10}$/.test(cifry(v)); }

  // время Петербурга, где бы ни открыли страницу
  var NOW = new Date(Date.now() + 3 * 3600e3);
  var nowMin = NOW.getUTCHours() * 60 + NOW.getUTCMinutes();
  var st = $('#seychas');
  if (nowMin >= 480 && nowMin < 1320) { st.textContent = 'Открыто до 22:00'; st.classList.add('on'); }
  else st.textContent = 'Откроемся в 8:00';

  // ---------- состояние ----------
  var D = null, lv = '', den = 0, vybor = null, dni = [], oshibkaSeti = false;

  function podhodit(i) { return !lv || !i.level || i.level.split(',').indexOf(lv) > -1; }
  function naDen(iso) { return D.items.filter(function (i) { return i.date === iso; }); }

  function zagruzit(cb) {
    fetch(API + '/raspisanie', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { D = j; oshibkaSeti = false; cb && cb(); })
      .catch(function () {
        oshibkaSeti = true;
        if (!D) $('#zanyatiya').innerHTML = '<li class="pustoj">Не получилось загрузить расписание. Обновите страницу или напишите студии во <a class="ssylka" href="https://vk.ru/olymppole" target="_blank" rel="noopener">ВКонтакте</a>.</li>';
      });
  }

  // ---------- уровни ----------
  function gruppyUrovnya(code) {
    return D ? D.groups.filter(function (g) { return g.level && g.level.split(',').indexOf(code) > -1; }) : [];
  }
  function kratkoGruppy(gg) {
    return gg.map(function (g) { return DN[g.dow] + ' ' + vremya(g.time) + (g.trainer ? ' (' + esc(g.trainer) + ')' : ''); }).join(', ');
  }
  function risovatUroven() {
    $$('.st').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.lv === lv); });
    var opis = $('#opis');
    if (lv) {
      var u = URS[lv], gg = gruppyUrovnya(lv);
      opis.innerHTML = '<p class="kik">' + u.num + ' уровень</p><h3>' + u.imya + '</h3><p>' + u.opis + '</p><p class="kik">Подойдёт, если</p><ul>' +
        u.esli.map(function (x) { return '<li>' + CHECK + '<span>' + x + '</span></li>'; }).join('') + '</ul>' +
        (gg.length ? '<p class="kik">Группы</p><p>' + kratkoGruppy(gg) + '</p>' : '') +
        '<a class="ssylka" href="#raspisanie">Записаться в группу</a>';
    } else {
      opis.innerHTML = '<p class="kik">Все уровни</p><h3>Всё расписание</h3><p>Сейчас показаны группы всех уровней. Если сомневаетесь, начните с группы начинающих: тренер на занятии подскажет, куда двигаться дальше.</p>';
    }
    $('#filtr').innerHTML = lv ? 'Показаны группы: <b>' + LV[lv] + '</b> и для всех уровней <button type="button" class="ssylka" data-lv-set="">Показать все</button>'
      : 'Показаны <b>все группы</b>. Выберите уровень выше, чтобы оставить только свои.';
  }

  // ---------- дни ----------
  function risovatDni() {
    $('#dni').innerHTML = dni.map(function (iso, i) {
      var n = naDen(iso).filter(function (x) { return podhodit(x) && !x.cancelled; }).length;
      var x = d(iso);
      return '<button type="button" class="den' + (n ? '' : ' pusto') + '" role="tab" aria-selected="' + (i === den) + '" data-den="' + i + '" aria-label="' + dataLong(iso) + ', групп: ' + n + '">' +
        '<small>' + (i === 0 ? 'сег' : DN[x.getUTCDay()]) + '</small><b>' + x.getUTCDate() + '</b><span class="tochki">' + new Array(Math.min(n, 4) + 1).join('<i></i>') + '</span></button>';
    }).join('');
    $('#den-zag').textContent = (den === 0 ? 'Сегодня, ' : den === 1 ? 'Завтра, ' : '') + dataLong(dni[den]);
  }

  // ---------- занятия выбранного дня ----------
  function risovatGruppy() {
    var gg = naDen(dni[den]).filter(podhodit);
    var el = $('#zanyatiya');
    if (!gg.length) {
      el.innerHTML = '<li class="pustoj">' + (den === 0 ? 'На сегодня подходящих групп больше нет.' : 'В этот день подходящих групп нет.') +
        ' <button type="button" class="ssylka" data-blizh>Ближайшее занятие</button></li>';
      return;
    }
    el.innerHTML = gg.map(function (g) {
      var tochki = '', zan = g.mest - g.free;
      if (g.mest <= 12) for (var k = 0; k < g.mest; k++) tochki += '<i class="m' + (k < zan ? ' z' : '') + '"></i>';
      var moya = vybor && vybor.gid === g.gid && vybor.date === g.date;
      var knopka = g.cancelled ? '<button type="button" class="btn btn--kontur" disabled>Отменено</button>'
        : '<button type="button" class="btn' + (g.free ? '' : ' btn--kontur') + '" data-id="' + g.gid + '|' + g.date + '">' + (moya ? 'Выбрано' : g.free ? 'Записаться' : 'В лист ожидания') + '</button>';
      var mestaTxt = g.cancelled ? 'занятие отменено' : g.free ? ostalos(g.free) : 'мест нет';
      return '<li class="zn' + (g.cancelled ? ' otm' : g.free ? '' : ' polno') + (moya ? ' vybrano' : '') + '">' +
        '<time>' + vremya(g.time) + '<small>' + (g.dur === 60 ? '1 час' : 'до ' + vremya(g.end)) + '</small></time>' +
        '<div class="zn-o"><b>' + esc(g.title) + '</b><span>' + levelText(g.level) + (g.trainer ? ' · ' + esc(g.trainer) : '') + (g.price !== 1200 ? ' · ' + rub(g.price) : '') + '</span>' +
        '<span class="mesta" aria-label="Занято ' + zan + ' из ' + g.mest + '">' + tochki + '<em>' + mestaTxt + '</em></span></div>' + knopka + '</li>';
    }).join('');
  }

  // ближайшее занятие со свободными местами: сначала именно выбранного уровня, потом для всех уровней
  function blizhajshee() {
    var proverki = [function (x) { return !lv || (x.level && x.level.split(',').indexOf(lv) > -1); }, podhodit];
    for (var p = 0; p < 2; p++) {
      for (var i = 0; i < dni.length; i++) {
        var g = naDen(dni[i]).filter(function (x) { return proverki[p](x) && x.free > 0 && !x.cancelled; })[0];
        if (g) return { i: i, g: g };
      }
    }
    return null;
  }
  function najti(id) {
    var p = id.split('|');
    return D.items.filter(function (g) { return g.gid === +p[0] && g.date === p[1]; })[0];
  }

  // ---------- неделя списком, тренеры, вопросы ----------
  function risovatNedelyu() {
    var po = [1, 2, 3, 4, 5, 6, 0], out = '';
    po.forEach(function (dw) {
      var gg = D.groups.filter(function (g) { return g.dow === dw; });
      if (!gg.length) return;
      out += '<div><h3>' + DN_FULL[dw] + '</h3><ul>' + gg.map(function (g) {
        return '<li><b>' + vremya(g.time) + (g.dur !== 60 ? '–' + vremya(endT(g.time, g.dur)) : '') + '</b><span>' + esc(g.title) + ', ' + levelText(g.level) + (g.trainer ? ', ' + esc(g.trainer) : '') + '</span></li>';
      }).join('') + '</ul></div>';
    });
    $('#nedelya').innerHTML = out;
    $$('[data-trener]').forEach(function (p) {
      var gg = D.groups.filter(function (g) { return g.trainer === p.dataset.trener; });
      p.textContent = gg.length ? 'Ведёт: ' + gg.map(function (g) { return DN[g.dow] + ' ' + vremya(g.time); }).join(', ') : '';
    });
    var nach = gruppyUrovnya('nach');
    $('#faq-nach').textContent = nach.length ? ': ' + nach.map(function (g) { return DN[g.dow] + ' ' + vremya(g.time); }).join(' и ') : '';
    var maxM = Math.max.apply(null, D.groups.map(function (g) { return g.mest; }).concat([0]));
    if (maxM) $('#faq-mest').textContent = maxM;
  }
  function endT(t, dur) { var m = +t.slice(0, 2) * 60 + +t.slice(3) + dur; return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2); }

  // ---------- выбранное занятие в форме ----------
  var imyaEl = $('#imya'), telEl = $('#tel');
  function risovatVybor() {
    if (!vybor) return;
    var g = najti(vybor.gid + '|' + vybor.date) || vybor;
    $('#vybrano').innerHTML = '<b>' + dataLong(g.date) + ', ' + vremya(g.time) + '</b><span>' + esc(g.title) + ' · ' + levelText(g.level) +
      (g.trainer ? ' · ' + esc(g.trainer) : '') + ' · ' + (g.free ? ostalos(g.free) : 'мест нет, лист ожидания') + '</span>';
    $('#go').textContent = g.free ? 'Записаться' : 'Встать в лист ожидания';
    $('#cena-raz').textContent = rub(g.price) + ' на месте';
    var r = document.querySelectorAll('input[name=oplata]');
    var bezAbon = !g.abon;
    r[1].disabled = bezAbon; r[2].disabled = bezAbon;
    if (bezAbon && !r[0].checked) r[0].checked = true;
    $('#abon-prim').textContent = bezAbon ? 'на занятия 1,5 часа не действует' : 'спишем одно занятие';
    var imya = imyaEl.value.trim();
    $('#puzyr').textContent = 'Здравствуйте' + (imya ? ', ' + imya : '') + '! Напоминаем: завтра, ' + dataKor(g.date) + ', в ' + vremya(g.time) +
      ' занятие ' + g.title + (g.trainer ? ' (тренер ' + g.trainer + ')' : '') + '.\nOlymp Pole, Боровая ул., 116, 3 этаж, офис 312.\nС собой шорты, топ и вода. Кремом в этот день лучше не мазаться.';
  }

  function vseRisovat() { risovatUroven(); risovatDni(); risovatGruppy(); risovatVybor(); }
  function vybratUroven(code) {
    lv = code;
    var b = blizhajshee();
    if (b) den = b.i;
    vseRisovat();
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-lv],[data-lv-set],[data-den],[data-id],[data-blizh]');
    if (!t || !D) return;
    if (t.dataset.lv) vybratUroven(t.dataset.lv === lv ? '' : t.dataset.lv);
    else if (t.hasAttribute('data-lv-set')) vybratUroven(t.dataset.lvSet);
    else if (t.dataset.den) { den = +t.dataset.den; risovatDni(); risovatGruppy(); }
    else if (t.hasAttribute('data-blizh')) { var b = blizhajshee(); if (b) { den = b.i; risovatDni(); risovatGruppy(); } }
    else if (t.dataset.id) {
      vybor = najti(t.dataset.id);
      risovatGruppy(); risovatVybor(); pokazatFormu();
      $('#zapis').scrollIntoView({ behavior: 'smooth' });
      setTimeout(function () { imyaEl.focus({ preventScroll: true }); }, 600);
    }
  });

  // ---------- отправка записи ----------
  function oshibka(pole, id, est) { pole.setAttribute('aria-invalid', est); $(id).hidden = !est; }
  imyaEl.addEventListener('input', function () { if (imyaEl.value.trim()) oshibka(imyaEl, '#o-imya', false); risovatVybor(); });
  telEl.addEventListener('input', function () { if (telOk(telEl.value)) oshibka(telEl, '#o-tel', false); });
  function soobshenie(id, txt) { var e = $(id); e.textContent = txt || ''; e.hidden = !txt; }

  var idet = false;
  $('#forma').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (idet) return;
    soobshenie('#o-otpr', '');
    var okImya = !!imyaEl.value.trim(), okTel = telOk(telEl.value);
    oshibka(imyaEl, '#o-imya', !okImya); oshibka(telEl, '#o-tel', !okTel);
    if (!okImya) { imyaEl.focus(); return; }
    if (!okTel) { telEl.focus(); return; }
    if (!vybor) { soobshenie('#o-otpr', 'Сначала выберите занятие в расписании.'); $('#raspisanie').scrollIntoView({ behavior: 'smooth' }); return; }
    var g = vybor;
    var oplata = (document.querySelector('input[name=oplata]:checked') || {}).value || 'razovoe';
    idet = true; $('#go').disabled = true; $('#go').textContent = 'Отправляем…';
    fetch(API + '/zapis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gid: g.gid, date: g.date, name: imyaEl.value.trim(), phone: telEl.value.trim(), oplata: oplata, site: $('#site').value })
    }).then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (res) {
        var j = res.j;
        if (res.s === 200 && j.ok) {
          var wait = j.status === 'wait';
          $('#gotovo-zag').textContent = j.dup ? 'Вы уже записаны' : wait ? 'Вы в листе ожидания' : 'Вы записаны';
          $('#itog').textContent = dataLong(g.date) + ', ' + vremya(g.time) + ', ' + g.title + (g.trainer ? ' (' + g.trainer + ')' : '') + '. ' +
            (wait ? 'Если место освободится, студия напишет.' : 'Студия уже получила запись. Адрес: Боровая ул., 116, 3 этаж, офис 312.');
          var tk = $('#tg-knopka');
          if (j.tg) { tk.href = j.tg; tk.hidden = false; $('#tg-prim').hidden = false; } else { tk.hidden = true; $('#tg-prim').hidden = true; }
          $('#forma').hidden = true; $('#gotovo').hidden = false;
          document.body.classList.add('zapisan'); lipkaya();
          zagruzit(function () { risovatDni(); risovatGruppy(); });
        } else if (j.error === 'slot') {
          soobshenie('#o-otpr', 'Это занятие уже недоступно: оно началось или отменено. Выберите другое.');
          vybor = null; zagruzit(vseRisovat);
        } else if (j.error === 'limit') {
          soobshenie('#o-otpr', 'Слишком много записей с этого устройства. Попробуйте через час или напишите студии.');
        } else {
          soobshenie('#o-otpr', 'Проверьте имя и телефон и попробуйте ещё раз.');
        }
      })
      .catch(function () { soobshenie('#o-otpr', 'Не получилось отправить. Проверьте интернет или напишите студии во ВКонтакте.'); })
      .then(function () { idet = false; $('#go').disabled = false; risovatVybor(); });
  });
  function pokazatFormu() { $('#forma').hidden = false; $('#gotovo').hidden = true; document.body.classList.remove('zapisan'); lipkaya(); }
  $('#snova').addEventListener('click', function () { pokazatFormu(); vybor = null; $('#vybrano').innerHTML = '<b>Занятие не выбрано</b><span>Выберите его в расписании выше</span>'; $('#raspisanie').scrollIntoView({ behavior: 'smooth' }); });

  // ---------- заявка на персональное ----------
  $('#perso-forma').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var im = $('#p-imya'), tl = $('#p-tel');
    var a = !!im.value.trim(), b = telOk(tl.value);
    oshibka(im, '#o-p-imya', !a); oshibka(tl, '#o-p-tel', !b);
    if (!a) { im.focus(); return; } if (!b) { tl.focus(); return; }
    soobshenie('#o-p-otpr', '');
    fetch(API + '/perso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: im.value.trim(), phone: tl.value.trim(), msg: $('#p-msg').value.trim(), site: $('#p-site').value }) })
      .then(function (r) { if (!r.ok) throw r.status; $('#perso-forma').hidden = true; $('#perso-gotovo').hidden = false; })
      .catch(function (s) { soobshenie('#o-p-otpr', s === 429 ? 'Заявка уже отправлена, студия свяжется с вами.' : 'Не получилось отправить. Напишите студии во ВКонтакте.'); });
  });

  // ---------- мой абонемент ----------
  $('#abon-forma').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var nomer = $('#a-nomer').value.replace(/\D/g, ''), tel = $('#a-tel').value;
    var itog = $('#abon-itog');
    if (!nomer || !telOk(tel)) { soobshenie('#o-abon', 'Нужны номер абонемента и телефон из 11 цифр.'); return; }
    soobshenie('#o-abon', '');
    fetch(API + '/abonement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nomer: +nomer, phone: tel }) })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (res) {
        if (res.s !== 200) { itog.hidden = true; soobshenie('#o-abon', 'Не нашли абонемент с таким номером и телефоном. Проверьте или спросите тренера.'); return; }
        var a = res.j, tochki = '';
        for (var k = 0; k < a.total; k++) tochki += '<i' + (k < a.used ? ' class="z"' : '') + '></i>';
        var istek = a.until && a.until < (D ? D.today : '');
        itog.innerHTML = '<b>' + esc(a.name) + ', абонемент №' + a.nomer + '</b><div class="tochki" aria-label="Отмечено ' + a.used + ' из ' + a.total + '">' + tochki + '</div>' +
          '<p>Осталось ' + a.left + ' из ' + a.total + (a.until ? ' · ' + (istek ? 'срок закончился ' : 'действует до ') + dataKor(a.until) : '') + (a.closed ? ' · закрыт' : '') + '</p>' +
          (a.dates.length ? '<p>Отмечены: ' + a.dates.map(dataKor).join(', ') + '</p>' : '<p>Посещений пока нет.</p>');
        itog.hidden = false;
      })
      .catch(function () { soobshenie('#o-abon', 'Не получилось проверить. Попробуйте позже.'); });
  });

  // ---------- кнопка внизу телефона: видна между первым экраном и формой записи ----------
  var lip = $('#lipkaya'), vidHero = true, vidZap = false, vidRasp = false;
  function lipkaya() { lip.classList.toggle('vidno', !vidHero && !vidZap && !vidRasp && !document.body.classList.contains('zapisan')); }
  if ('IntersectionObserver' in window) {
    var heroKn = $('.hero-knopki'), zap = $('#zapis'), rasp = $('#raspisanie');
    var io2 = new IntersectionObserver(function (es) {
      es.forEach(function (x) {
        if (x.target === heroKn) vidHero = x.isIntersecting;
        else if (x.target === zap) vidZap = x.isIntersecting;
        else vidRasp = x.isIntersecting;
      });
      lipkaya();
    });
    io2.observe(heroKn); io2.observe(zap); io2.observe(rasp);
    // карта грузится, только когда до неё доскроллили
    var karta = $('#karta');
    var io3 = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { karta.src = karta.dataset.src; io3.disconnect(); }
    }, { rootMargin: '400px' });
    io3.observe(karta);
  } else {
    $('#karta').src = $('#karta').dataset.src;
  }

  // ---------- старт ----------
  zagruzit(function () {
    for (var i = 0; i < 14; i++) dni.push(addDays(D.today, i));
    var b = blizhajshee();
    if (b) den = b.i;
    risovatNedelyu();
    vseRisovat();
  });
  risovatUroven();
})();
