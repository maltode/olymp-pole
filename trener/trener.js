// Страница тренера Olymp Pole по личной ссылке …/trener/#t=<код> (выдаёт София в кабинете, «Расписание»).
// Только просмотр: свои группы на 14 дней с именами записанных (без телефонов) и свои брони зала.
(function () {
  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://127.0.0.1:8797' : 'https://d5dodm8kkkc2e00be9sq.y0g3kng5.apigw.yandexcloud.net';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var DN = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var MES = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var d = function (iso) { return new Date(iso + 'T00:00:00Z'); };
  var addDays = function (iso, n) { return new Date(d(iso).getTime() + n * 864e5).toISOString().slice(0, 10); };
  var bezNulya = function (t) { return String(t).replace(/^0/, ''); };
  var mins = function (t) { var p = String(t).split(':'); return +p[0] * 60 + +p[1]; };

  // код из адреса; запоминаем, чтобы страница открывалась и с ярлыка без кода
  var m = location.hash.match(/t=([A-Za-z0-9_-]{20,64})/);
  var kod = m ? m[1] : '';
  try { if (kod) localStorage.setItem('olymp-trener', kod); else kod = localStorage.getItem('olymp-trener') || ''; } catch (e) { /* без хранилища */ }

  function oshibka() { $('#zagruzka').hidden = true; $('#oshibka').hidden = false; try { localStorage.removeItem('olymp-trener'); } catch (e) { /* ничего */ } }
  if (!kod) { oshibka(); return; }

  function denZag(iso, today) {
    var x = d(iso), s = DN[x.getUTCDay()] + ', ' + x.getUTCDate() + ' ' + MES[x.getUTCMonth()];
    if (iso === today) return 'Сегодня, ' + s;
    if (iso === addDays(today, 1)) return 'Завтра, ' + s;
    return s;
  }
  // цвет вида занятия как в «Зале» кабинета: 1,5 часа, растяжка, начинающие, продолжающие и профи
  function vid(g) { return mins(g.end) - mins(g.start) >= 90 ? 'k15' : /растяж/i.test(g.title) ? 'kr' : /(^|,)nach(,|$)/.test(g.lv || '') ? 'kn' : 'ku'; }

  function kartaGr(g) {
    var lyudi = g.names.length ? '<p>Записаны: ' + g.names.map(esc).join(', ') + '</p>' : '<p class="prim">Пока никто не записан</p>';
    if (g.wait.length) lyudi += '<p class="prim">Лист ожидания: ' + g.wait.map(esc).join(', ') + '</p>';
    return '<div class="zan ' + vid(g) + (g.cancelled ? ' otm' : '') + '"><div class="zan-shapka"><b>' + bezNulya(g.start) + '–' + bezNulya(g.end) + ' ' + esc(g.title) + '</b>' +
      '<span class="schet">' + (g.cancelled ? 'отменено' : g.zan + ' из ' + g.mest) + '</span></div>' +
      '<div class="imena"><div class="metki"><span class="mt">' + esc(g.level) + '</span></div>' + (g.cancelled ? '' : lyudi) + '</div></div>';
  }
  function kartaZal(z) {
    var ar = z.kind === 'arenda';
    return '<div class="zan ' + (ar ? 'ar' : 'pe') + '"><div class="zan-shapka"><b>' + bezNulya(z.start) + '–' + bezNulya(z.end) + ' ' + (ar ? 'Аренда зала' : 'Персональное') + '</b>' +
      '<span class="schet">' + (z.paid ? 'оплачено' : 'не оплачено') + '</span></div>' +
      (z.who ? '<div class="imena"><p>' + esc(z.who) + '</p></div>' : '') + '</div>';
  }

  fetch(API + '/trener', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kod: kod }) })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (x) {
      if (!x.ok || !x.j.ok) { oshibka(); return; }
      var j = x.j;
      $('#kto').textContent = 'тренер · ' + j.name;
      document.title = j.name + ' · занятия Olymp Pole';
      var dni = {};
      j.groups.forEach(function (g) { (dni[g.date] = dni[g.date] || []).push({ t: g.start, html: kartaGr(g) }); });
      j.zal.forEach(function (z) { (dni[z.date] = dni[z.date] || []).push({ t: z.start, html: kartaZal(z) }); });
      var daty = Object.keys(dni).sort();
      $('#dni').innerHTML = daty.length ? daty.map(function (iso) {
        return '<div class="den"><h2 class="den-zag">' + denZag(iso, j.today) + '</h2>' +
          dni[iso].sort(function (a, b) { return mins(a.t) - mins(b.t); }).map(function (x) { return x.html; }).join('') + '</div>';
      }).join('') : '<p class="pusto">На ближайшие 2 недели у вас нет занятий и броней зала.</p>';
      $('#zagruzka').hidden = true; $('#spisok').hidden = false;
    })
    .catch(function () { $('#zagruzka').innerHTML = '<p>Не получилось загрузить. Проверьте интернет и обновите страницу.</p>'; });
})();
