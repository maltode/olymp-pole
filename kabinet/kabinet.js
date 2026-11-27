// Кабинет Софии: записи по дням, абонементы с отметками, закрытая таблица зала, расписание.
// Открывается из бота (Telegram передаёт подпись) или по ссылке с ключом на компьютере.
(function () {
  'use strict';
  // На компьютере разработчика (localhost) — локальная копия сервера с тестовой базой
  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://127.0.0.1:8797' : 'https://olymp-pole-bot.capybaria-bot.workers.dev';
  var $ = function (s) { return document.querySelector(s); };
  var tgw = window.Telegram && window.Telegram.WebApp;
  if (tgw) { try { tgw.ready(); tgw.expand(); tgw.setHeaderColor('#14100E'); tgw.setBackgroundColor('#14100E'); } catch (e) { /* старый Telegram */ } }

  // ---------- вход ----------
  var init = tgw && tgw.initData;
  var m = location.hash.match(/k=([0-9]+\.[0-9]+\.[0-9a-f]+)/);
  if (m) { localStorage.setItem('olymp_key', m[1]); history.replaceState(null, '', location.pathname); }
  var key = localStorage.getItem('olymp_key');
  function zagolovki() {
    var h = { 'Content-Type': 'application/json' };
    if (init) h['X-Tg-Init'] = init; else if (key) h['X-Key'] = key;
    return h;
  }
  function api(op, body) {
    return fetch(API + '/api/' + op, { method: 'POST', headers: zagolovki(), body: JSON.stringify(body || {}) })
      .then(function (r) {
        if (r.status === 401) { pokazatVhod(); throw new Error('auth'); }
        return r.json();
      })
      .then(function (j) { if (j.error && !j.ok) throw new Error(j.error); return j; })
      .catch(function (e) { if (e.message !== 'auth') tost(e.message === 'bad' ? 'Проверьте поля формы' : 'Не получилось: нет связи или ошибка. Попробуйте ещё раз.'); throw e; });
  }
  function pokazatVhod() {
    document.querySelectorAll('.vkladka').forEach(function (s) { s.hidden = true; });
    $('#niz').hidden = true; $('#vhod').hidden = false;
    if (key && !init) localStorage.removeItem('olymp_key');
  }

  // ---------- помощники ----------
  var DN = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var DN_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  var MES = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var LV = { nach: 'начинающие', prod: 'продолжающие', profi: 'профи' };
  var OPL = { razovoe: 'разовое', abon: 'по абонементу', kupit: 'купит абонемент', kupit4: 'купит абонемент на 4', kupit8: 'купит абонемент на 8', admin: 'добавлена вручную' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function d(iso) { return new Date(iso + 'T00:00:00Z'); }
  function addDays(iso, n) { var x = d(iso); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function dlong(iso) { var x = d(iso); return DN[x.getUTCDay()] + ', ' + x.getUTCDate() + ' ' + MES[x.getUTCMonth()]; }
  function dkor(iso) { var x = d(iso); return x.getUTCDate() + ' ' + MES[x.getUTCMonth()].slice(0, 3); }
  function levelText(lv) { return lv ? lv.split(',').map(function (x) { return LV[x] || x; }).join(' и ') : 'все уровни'; }
  function mins(t) { return +t.slice(0, 2) * 60 + +t.slice(3, 5); }
  function hhmm(n) { return ('0' + Math.floor(n / 60)).slice(-2) + ':' + ('0' + n % 60).slice(-2); }
  function tel(p) { var c = String(p || '').replace(/\D/g, ''); if (c.length === 11) c = c.slice(1); return c.length === 10 ? '+7 ' + c.slice(0, 3) + ' ' + c.slice(3, 6) + '-' + c.slice(6, 8) + '-' + c.slice(8) : (p || ''); }
  function telHref(p) { var c = String(p || '').replace(/\D/g, ''); if (c.length === 11) c = c.slice(1); return c.length === 10 ? 'tel:+7' + c : ''; }
  function rub(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  var tostT;
  function tost(t) { var e = $('#tost'); e.textContent = t; e.hidden = false; clearTimeout(tostT); tostT = setTimeout(function () { e.hidden = true; }, 3200); }
  function sprosit(t) {
    return new Promise(function (ok) {
      if (tgw && tgw.showConfirm && tgw.initData) { try { tgw.showConfirm(t, ok); return; } catch (e) { /* ниже */ } }
      ok(window.confirm(t));
    });
  }
  function tochki(total, used, kr) { var s = ''; for (var i = 0; i < total; i++) s += '<i' + (i < used ? ' class="z"' : '') + '></i>'; return '<div class="tochki' + (kr ? ' kr' : '') + '">' + s + '</div>'; }

  // окно-форма
  function okno(zag, html) { $('#okno-zag').textContent = zag; $('#okno-telo').innerHTML = html; $('#okno').hidden = false; var f = $('#okno-telo input'); if (f && window.innerWidth > 900) f.focus(); }
  function zakryt() { $('#okno').hidden = true; $('#okno-telo').innerHTML = ''; }
  $('#okno-x').addEventListener('click', zakryt);
  $('#okno').addEventListener('click', function (e) { if (e.target.id === 'okno') zakryt(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') zakryt(); });

  var TODAY = null;

  // ---------- вкладки ----------
  var tek = 'zapisi';
  function otkryt(t) {
    tek = t;
    document.querySelectorAll('.vkladka').forEach(function (s) { s.hidden = s.id !== 't-' + t; });
    document.querySelectorAll('.niz button').forEach(function (b) { b.setAttribute('aria-current', b.dataset.t === t ? 'page' : 'false'); });
    ({ zapisi: risDen, abon: risAbon, zal: risZal, rasp: risRasp })[t]();
    window.scrollTo(0, 0);
  }
  $('#niz').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) otkryt(b.dataset.t); });

  // =========== ЗАПИСИ ===========
  var den = null;
  function risDen() {
    $('#den-zag').textContent = dlong(den);
    $('#na-segodnya').hidden = den === TODAY;
    api('den', { date: den }).then(function (j) {
      var out = '';
      if (!j.items.length) out = '<p class="pustaya">Групповых занятий в этот день нет.</p>';
      out += '<div class="zapisi-setka">' + j.items.map(zanyatie).join('') + '</div>';
      if (j.zal.length) {
        out += '<div class="zal-den"><h3>Зал</h3><ul>' + j.zal.map(function (z) {
          return '<li>' + z.start + '–' + z.end + ' · ' + (z.kind === 'arenda' ? 'аренда' : 'персональное') + (z.who ? ', ' + esc(z.who) : '') + ' · ' + (z.paid ? 'оплачено' : '<span class="neopl">не оплачено</span>') + '</li>';
        }).join('') + '</ul></div>';
      }
      $('#den-spisok').innerHTML = out;
    }).catch(function () {});
  }
  function zanyatie(o) {
    var aktiv = o.zapisi.filter(function (z) { return ['new', 'ok', 'byl'].indexOf(z.status) > -1; }).length;
    var head = '<div class="zan-shapka"><div><b>' + o.time.replace(/^0/, '') + ' ' + esc(o.title) + '</b><br><span>' + levelText(o.level) + (o.trainer ? ' · ' + esc(o.trainer) : '') + (o.dur !== 60 ? ' · до ' + o.end : '') + '</span></div>' +
      '<span class="schet">' + (o.cancelled ? 'отменено' : aktiv + ' из ' + o.mest) + '</span></div>';
    if (o.cancelled) {
      return '<div class="zan otm">' + head + '<div class="zan-niz"><span class="prim">Занятие отменено, на сайте записаться нельзя</span><button type="button" class="ssylka" data-otmena="' + o.gid + '" data-on="0">Вернуть занятие</button></div></div>';
    }
    var lyudi = o.zapisi.length ? o.zapisi.map(chelovek).join('') : '<p class="pustaya">Пока никто не записан</p>';
    return '<div class="zan">' + head + lyudi +
      '<div class="zan-niz"><button type="button" class="ssylka" data-dobavit="' + o.gid + '">+ Добавить ученика</button>' +
      '<button type="button" class="ssylka" data-limit="' + o.gid + '" data-mest="' + o.mest + '" data-baza="' + o.mestBase + '">Мест: ' + o.mest + (o.mest !== o.mestBase ? ' (обычно ' + o.mestBase + ')' : '') + '</button>' +
      '<button type="button" class="ssylka" data-otmena="' + o.gid + '" data-on="1">Отменить занятие</button></div></div>';
  }
  function chelovek(z) {
    var mt = [];
    var st = { new: ['новая запись', 'zol'], ok: ['подтверждена', ''], byl: ['пришла', 'ok'], net: ['не пришла', 'err'], wait: ['лист ожидания', 'zol'] }[z.status] || [z.status, ''];
    mt.push('<span class="mt ' + st[1] + '">' + st[0] + '</span>');
    mt.push('<span class="mt">' + (OPL[z.oplata] || z.oplata) + '</span>');
    if (z.abon) mt.push('<span class="mt zol">абонемент №' + z.abon.id + ': осталось ' + z.abon.left + ' из ' + z.abon.total + '</span>');
    if (z.spisano) mt.push('<span class="mt ok">списано с абонемента</span>');
    if (z.tg) mt.push('<span class="mt">напоминание в Telegram</span>');
    var kn = [];
    if (z.status === 'new' || z.status === 'wait') kn.push(['ok', 'Подтвердить', '']);
    if (['new', 'ok', 'wait'].indexOf(z.status) > -1) { kn.push(['byl', 'Пришла', '']); kn.push(['net', 'Не пришла', 'btn--k']); kn.push(['cancel', 'Отменить', 'btn--opas']); }
    if (z.status === 'byl') kn.push(['ok', 'Убрать отметку', 'btn--k']);
    if (z.status === 'net') { kn.push(['byl', 'Всё-таки пришла', 'btn--k']); kn.push(['ok', 'Убрать отметку', 'btn--k']); }
    var th = telHref(z.phone);
    return '<div class="chel"><div class="chel-v"><b>' + esc(z.name) + '</b>' + (th ? '<a href="' + th + '">' + tel(z.phone) + '</a>' : '') + '</div>' +
      '<div class="metki">' + mt.join('') + '</div>' +
      '<div class="deystviya">' + kn.map(function (k) { return '<button type="button" class="btn btn--mal ' + k[2] + '" data-zid="' + z.id + '" data-st="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div></div>';
  }
  $('#t-zapisi').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sdvig) { den = addDays(den, +b.dataset.sdvig); risDen(); return; }
    if (b.id === 'na-segodnya') { den = TODAY; risDen(); return; }
    if (b.dataset.zid) {
      var go = function () {
        b.disabled = true;
        api('zapis_status', { id: +b.dataset.zid, status: b.dataset.st }).then(function (j) {
          if (j.spisano) tost('Списано с абонемента №' + j.spisano.id + ', осталось ' + j.spisano.left + ' из ' + j.spisano.total);
          else if (b.dataset.st === 'byl') tost('Отмечено: пришла');
          risDen();
        }).catch(function () { b.disabled = false; });
      };
      if (b.dataset.st === 'cancel') sprosit('Отменить запись? Место освободится на сайте.').then(function (y) { if (y) go(); });
      else go();
      return;
    }
    if (b.dataset.dobavit) {
      var gid = +b.dataset.dobavit;
      okno('Добавить ученика', '<form id="f-dob"><label for="d-imya">Имя</label><input id="d-imya" required maxlength="60"><label for="d-tel">Телефон (по нему найдётся абонемент)</label><input id="d-tel" type="tel" inputmode="tel" placeholder="+7 900 000-00-00">' +
        '<div class="knopki"><button class="btn" type="submit">Добавить</button></div></form>');
      $('#f-dob').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var name = $('#d-imya').value.trim(); if (!name) return;
        api('zapis_add', { gid: gid, date: den, name: name, phone: $('#d-tel').value.trim() }).then(function () { zakryt(); tost('Добавлено'); risDen(); }).catch(function () {});
      });
      return;
    }
    // Своё число мест на это занятие: например, по двое на пилон по согласованию с ученицами
    if (b.dataset.limit) {
      var lg = +b.dataset.limit, baza = +b.dataset.baza;
      okno('Мест на ' + dlong(den), '<form id="f-lim"><p class="prim">Обычно ' + baza + '. Если договорились заниматься по двое на пилон, поставьте больше: на сайте сразу появятся свободные места. Меняется только это занятие.</p>' +
        '<label for="l-m">Мест на занятии</label><input id="l-m" type="number" min="1" max="50" value="' + b.dataset.mest + '">' +
        '<div class="knopki"><button class="btn" type="submit">Сохранить</button>' + (+b.dataset.mest !== baza ? '<button class="btn btn--k" type="button" id="l-sbros">Вернуть ' + baza + '</button>' : '') + '</div></form>');
      var sohr = function (v) { api('limit', { gid: lg, date: den, mest: v }).then(function (j) { zakryt(); tost('Мест на занятии: ' + j.mest); risDen(); }).catch(function () {}); };
      $('#f-lim').addEventListener('submit', function (ev) { ev.preventDefault(); var v = +$('#l-m').value; if (v >= 1 && v <= 50) sohr(v); });
      var sb = $('#l-sbros'); if (sb) sb.addEventListener('click', function () { sohr(''); });
      return;
    }
    if (b.dataset.otmena) {
      var on = b.dataset.on === '1';
      var go2 = function () {
        api('otmena', { gid: +b.dataset.otmena, date: den, on: on }).then(function (j) {
          if (on && j.zapisi && j.zapisi.length) {
            okno('Занятие отменено', '<p class="prim">Записанным с напоминаниями бот уже написал. Остальных предупредите сами:</p><ul class="otmetki">' +
              j.zapisi.map(function (z) { var th = telHref(z.phone); return '<li><span>' + esc(z.name) + (z.tg ? ' (бот написал)' : '') + '</span>' + (th ? '<a class="ssylka" href="' + th + '">' + tel(z.phone) + '</a>' : '') + '</li>'; }).join('') + '</ul>');
          } else tost(on ? 'Занятие отменено' : 'Занятие снова в расписании');
          risDen();
        }).catch(function () {});
      };
      if (on) sprosit('Отменить это занятие ' + dlong(den) + '? На сайте оно будет помечено «отменено».').then(function (y) { if (y) go2(); });
      else go2();
    }
  });

  // =========== АБОНЕМЕНТЫ ===========
  var abonFiltr = 'act', abonDays = 30, poiskT;
  function risAbon() {
    api('abon_list', { q: $('#abon-poisk').value.trim() }).then(function (j) {
      abonDays = j.abonDays || 30;
      var list = j.list.filter(function (a) { return abonFiltr === 'all' || a.active; });
      $('#abon-spisok').innerHTML = list.length ? list.map(function (a) {
        return '<button type="button" class="ab' + (a.active ? '' : ' neakt') + '" data-ab="' + a.id + '"><div class="ab-v"><b>№' + a.id + ' ' + esc(a.name) + '</b><span>осталось ' + a.left + ' из ' + a.total + '</span></div>' +
          tochki(a.total, a.used) + '<p>' + (a.phone ? tel(a.phone) + ' · ' : '') + (a.until ? (a.until < TODAY ? 'срок вышел ' : 'до ') + dkor(a.until) : 'без срока') + (a.closed ? ' · закрыт' : '') + (a.last ? ' · был(а) ' + dkor(a.last) : '') + '</p></button>';
      }).join('') : '<p class="pustaya">' + (abonFiltr === 'act' ? 'Действующих абонементов нет. «Новый», чтобы оформить.' : 'Ничего не нашлось.') + '</p>';
    }).catch(function () {});
  }
  $('#abon-poisk').addEventListener('input', function () { clearTimeout(poiskT); poiskT = setTimeout(risAbon, 300); });
  document.querySelector('#t-abon .chipy').addEventListener('click', function (e) {
    var b = e.target.closest('[data-af]'); if (!b) return;
    abonFiltr = b.dataset.af;
    document.querySelectorAll('[data-af]').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
    risAbon();
  });
  $('#abon-novyj').addEventListener('click', function () {
    okno('Новый абонемент', '<form id="f-ab"><label for="a-imya">Имя и фамилия</label><input id="a-imya" required maxlength="60">' +
      '<label for="a-tel">Телефон (по нему абонемент найдётся в записях)</label><input id="a-tel" type="tel" inputmode="tel" placeholder="+7 900 000-00-00">' +
      '<label>Занятий</label><div class="dva"><label class="gal"><input type="radio" name="a-n" value="4">4 занятия, 4 200 ₽</label><label class="gal"><input type="radio" name="a-n" value="8" checked>8 занятий, 8 000 ₽</label></div>' +
      '<div class="dva"><div><label for="a-kup">Куплен</label><input id="a-kup" type="date" value="' + TODAY + '"></div><div><label for="a-do">Действует до</label><input id="a-do" type="date" value="' + addDays(TODAY, abonDays - 1) + '"></div></div>' +
      '<label class="gal"><input type="checkbox" id="a-bez">Без срока</label>' +
      '<label for="a-zam">Заметка (необязательно)</label><input id="a-zam" maxlength="300">' +
      '<div class="knopki"><button class="btn" type="submit">Оформить</button></div></form>');
    $('#a-kup').addEventListener('change', function () { if (this.value) $('#a-do').value = addDays(this.value, abonDays - 1); });
    $('#a-bez').addEventListener('change', function () { $('#a-do').disabled = this.checked; });
    $('#f-ab').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = $('#a-imya').value.trim(); if (!name) return;
      api('abon_new', { name: name, phone: $('#a-tel').value.trim(), total: +document.querySelector('input[name=a-n]:checked').value, bought: $('#a-kup').value, until: $('#a-bez').checked ? '' : $('#a-do').value, note: $('#a-zam').value.trim() })
        .then(function (j) { tost('Абонемент №' + j.id + ' оформлен. Скажите номер ученику'); abonKarta(j.id); risAbon(); }).catch(function () {});
    });
  });
  function abonKarta(id) {
    api('abon_get', { id: id }).then(function (j) {
      var a = j.abon;
      okno('Абонемент №' + a.id, '<p><b>' + esc(a.name) + '</b>' + (a.phone ? ' · <a href="' + telHref(a.phone) + '">' + tel(a.phone) + '</a>' : '') + '</p>' +
        '<p class="prim">Осталось ' + a.left + ' из ' + a.total + ' · куплен ' + dkor(a.bought) + ' · ' + (a.until ? 'до ' + dkor(a.until) : 'без срока') + (a.closed ? ' · закрыт' : '') + '</p>' +
        (a.note ? '<p class="prim">' + esc(a.note) + '</p>' : '') +
        (a.total === 8 && a.until ? (a.zam_dni ? '<p class="prim">Заморожено ' + a.zam_dni + ' из 7 дней, срок продлён. <button type="button" class="ssylka" id="e-zam-otm">Отменить заморозку</button></p>' : '') +
          (a.zam_dni < 7 ? '<form id="f-zam" class="dva"><select id="e-zam-dni" aria-label="Дней заморозки">' +
            [1, 2, 3, 4, 5, 6, 7].filter(function (n) { return n <= 7 - a.zam_dni; }).map(function (n) { return '<option value="' + n + '"' + (n === 7 - a.zam_dni ? ' selected' : '') + '>' + n + ' ' + (n === 1 ? 'день' : n < 5 ? 'дня' : 'дней') + '</option>'; }).join('') +
            '</select><button class="btn btn--kontur" type="submit">Заморозить</button></form>' : '') : '') +
        '<div style="margin:16px 0">' + tochki(a.total, a.used, true) + '</div>' +
        '<form id="f-otm" class="dva"><input id="o-data" type="date" value="' + TODAY + '" aria-label="Дата посещения"><button class="btn" type="submit"' + (a.left ? '' : ' disabled') + '>Отметить занятие</button></form>' +
        '<ul class="otmetki" style="margin-top:16px">' + (j.marks.length ? j.marks.map(function (o) {
          return '<li><span>' + dlong(o.date) + (o.title ? ', ' + o.time.replace(/^0/, '') + ' ' + esc(o.title) : '') + '</span><button type="button" class="ssylka" data-otm-del="' + o.id + '">убрать</button></li>';
        }).join('') : '<li class="prim">Посещений пока нет</li>') + '</ul>' +
        '<details style="margin-top:16px"><summary class="ssylka">Изменить абонемент</summary><form id="f-ab-ed">' +
        '<label for="e-imya">Имя</label><input id="e-imya" value="' + esc(a.name) + '"><label for="e-tel">Телефон</label><input id="e-tel" type="tel" value="' + esc(a.phone) + '">' +
        '<div class="dva"><div><label for="e-n">Занятий</label><input id="e-n" type="number" min="1" max="50" value="' + a.total + '"></div><div><label for="e-do">До (пусто = без срока)</label><input id="e-do" type="date" value="' + (a.until || '') + '"></div></div>' +
        '<label for="e-zam">Заметка</label><input id="e-zam" value="' + esc(a.note) + '">' +
        '<div class="knopki"><button class="btn" type="submit">Сохранить</button><button class="btn btn--opas" type="button" id="e-zakr">' + (a.closed ? 'Открыть снова' : 'Закрыть абонемент') + '</button></div></form></details>');
      $('#f-otm').addEventListener('submit', function (ev) {
        ev.preventDefault();
        api('otmetka_add', { abon_id: a.id, date: $('#o-data').value }).then(function (r) { tost('Отмечено, осталось ' + r.left); abonKarta(a.id); risAbon(); }).catch(function () {});
      });
      $('#okno-telo').querySelectorAll('[data-otm-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          sprosit('Убрать эту отметку? Занятие вернётся в абонемент.').then(function (y) {
            if (y) api('otmetka_del', { id: +b.dataset.otmDel }).then(function () { abonKarta(a.id); risAbon(); }).catch(function () {});
          });
        });
      });
      $('#f-ab-ed').addEventListener('submit', function (ev) {
        ev.preventDefault();
        api('abon_edit', { id: a.id, name: $('#e-imya').value.trim(), phone: $('#e-tel').value.trim(), total: +$('#e-n').value, until: $('#e-do').value, note: $('#e-zam').value.trim() })
          .then(function () { tost('Сохранено'); abonKarta(a.id); risAbon(); }).catch(function () {});
      });
      var fz = $('#f-zam'), zo = $('#e-zam-otm');
      if (fz) fz.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var dni = +$('#e-zam-dni').value;
        sprosit('Заморозить абонемент на ' + dni + ' ' + (dni === 1 ? 'день' : dni < 5 ? 'дня' : 'дней') + '? Срок продлится до ' + dkor(addDays(a.until, dni)) + '. Всего на абонемент можно до 7 дней.').then(function (y) {
          if (y) api('abon_freeze', { id: a.id, dni: dni }).then(function (r) { tost('Заморожен, действует до ' + dkor(r.until)); abonKarta(a.id); risAbon(); }).catch(function () {});
        });
      });
      if (zo) zo.addEventListener('click', function () {
        sprosit('Отменить заморозку? Срок вернётся на ' + a.zam_dni + ' ' + (a.zam_dni === 1 ? 'день' : a.zam_dni < 5 ? 'дня' : 'дней') + ' назад.').then(function (y) {
          if (y) api('abon_freeze', { id: a.id, otmena: true }).then(function () { tost('Заморозка отменена'); abonKarta(a.id); risAbon(); }).catch(function () {});
        });
      });
      $('#e-zakr').addEventListener('click', function () {
        api('abon_edit', { id: a.id, closed: !a.closed }).then(function () { abonKarta(a.id); risAbon(); }).catch(function () {});
      });
    }).catch(function () {});
  }
  $('#abon-spisok').addEventListener('click', function (e) { var b = e.target.closest('[data-ab]'); if (b) abonKarta(+b.dataset.ab); });

  // =========== ЗАЛ ===========
  var nedFrom = null, zalDen = 0, zalData = null;
  function nachaloNedeli(iso) { var x = d(iso), dw = (x.getUTCDay() + 6) % 7; return addDays(iso, -dw); }
  function risZal() {
    api('zal_week', { from: nedFrom }).then(function (j) {
      zalData = j;
      var dni = []; for (var i = 0; i < 7; i++) dni.push(addDays(j.from, i));
      $('#ned-zag').textContent = dkor(j.from) + ' – ' + dkor(j.to);
      $('#ned-segodnya').hidden = nedFrom === nachaloNedeli(TODAY);
      $('#dni-zal').innerHTML = dni.map(function (iso, i) {
        var x = d(iso);
        return '<button type="button" class="dz' + (iso === TODAY ? ' segodnya' : '') + '" aria-selected="' + (i === zalDen) + '" data-zd="' + i + '">' + DN[x.getUTCDay()] + '<b>' + x.getUTCDate() + '</b></button>';
      }).join('');
      var ot = mins(j.dayFrom), doo = mins(j.dayTo), H = 48;
      var chasy = '<div class="chasy">'; for (var t = ot; t < doo; t += 60) chasy += '<span>' + hhmm(t).replace(/^0/, '') + '</span>'; chasy += '</div>';
      var kol = dni.map(function (iso, i) {
        var x = d(iso), s = '<div class="kol' + (i === zalDen ? ' vid' : '') + '"><div class="kol-zag' + (iso === TODAY ? ' segodnya' : '') + '">' + DN[x.getUTCDay()] + ' ' + x.getUTCDate() + '</div><div style="position:relative">';
        for (var t2 = ot; t2 < doo; t2 += 60) s += '<button type="button" class="yach" data-novyj="' + iso + '|' + hhmm(t2) + '" aria-label="Занять ' + dlong(iso) + ' ' + hhmm(t2) + '"></button>';
        var poz = function (a, b) { var top = (Math.max(mins(a), ot) - ot) / 60 * H, h = (Math.min(mins(b), doo) - Math.max(mins(a), ot)) / 60 * H; return 'top:' + top + 'px;height:' + Math.max(h - 2, 20) + 'px'; };
        // Все блоки дня: группы и брони. Пересекающиеся ставим рядом, а не друг на друга
        var bl = j.groups.filter(function (g) { return g.date === iso; }).map(function (g) { return { t: 'gr', a: g.start, b: g.end, g: g }; })
          .concat(j.zal.filter(function (z) { return z.date === iso; }).map(function (z) { return { t: 'zal', a: z.start, b: z.end, z: z }; }))
          .sort(function (x, y) { return mins(x.a) - mins(y.a); });
        var konci = [];
        bl.forEach(function (x) {
          var l = 0; while (konci[l] !== undefined && konci[l] > mins(x.a)) l++;
          x.lane = l; konci[l] = mins(x.b);
        });
        bl.forEach(function (x) {
          var n = 1 + Math.max.apply(null, bl.filter(function (y) { return mins(y.a) < mins(x.b) && mins(y.b) > mins(x.a); }).map(function (y) { return y.lane; }));
          var shir = 'left:calc(' + (x.lane * 100 / n) + '% + 4px);right:auto;width:calc(' + (100 / n) + '% - 8px);';
          if (x.t === 'gr') {
            var g = x.g;
            s += '<button type="button" class="blok gr" style="' + shir + poz(g.start, g.end) + '" data-gr="' + g.gid + '|' + iso + '"><b>' + g.start.replace(/^0/, '') + ' ' + esc(g.title) + '</b>' + esc(g.trainer) + ' · ' + g.zan + ' из ' + g.mest + '</button>';
          } else {
            var z = x.z;
            s += '<button type="button" class="blok ' + (z.kind === 'arenda' ? 'ar' : 'pe') + '" style="' + shir + poz(z.start, z.end) + '" data-zal="' + z.id + '"><b>' + z.start.replace(/^0/, '') + '–' + z.end.replace(/^0/, '') + ' ' + (z.kind === 'arenda' ? 'Аренда' : 'Персональное') + '</b>' + esc(z.who) + ' · <span class="opl">' + (z.paid ? 'оплачено' : 'не оплачено') + '</span></button>';
          }
        });
        return s + '</div></div>';
      }).join('');
      $('#setka-zal').innerHTML = chasy + kol;
    }).catch(function () {});
  }
  function vremena(ot, doo, shag) { var o = []; for (var t = mins(ot); t <= mins(doo); t += shag) o.push(hhmm(t)); return o; }
  function zalForma(z) {
    var opts = function (sel, list) { return list.map(function (t) { return '<option' + (t === sel ? ' selected' : '') + '>' + t + '</option>'; }).join(''); };
    var all = vremena(zalData.dayFrom, zalData.dayTo, 30);
    okno(z.id ? 'Бронь зала' : 'Занять зал', '<form id="f-zal">' +
      '<label for="z-data">День</label><input id="z-data" type="date" value="' + z.date + '">' +
      '<div class="dva"><div><label for="z-ot">С</label><select id="z-ot">' + opts(z.start, all) + '</select></div><div><label for="z-do">До</label><select id="z-do">' + opts(z.end, all) + '</select></div></div>' +
      '<div class="dva"><label class="gal"><input type="radio" name="z-vid" value="perso"' + (z.kind !== 'arenda' ? ' checked' : '') + '>Персональное</label><label class="gal"><input type="radio" name="z-vid" value="arenda"' + (z.kind === 'arenda' ? ' checked' : '') + '>Аренда</label></div>' +
      '<label for="z-kto">Кто</label><input id="z-kto" maxlength="60" value="' + esc(z.who || '') + '">' +
      '<label for="z-tel">Телефон</label><input id="z-tel" type="tel" value="' + esc(z.phone || '') + '">' +
      '<label for="z-tr">Тренер</label><input id="z-tr" list="trenery" maxlength="40" value="' + esc(z.trainer || '') + '"><datalist id="trenery"><option>София</option><option>Карина</option><option>Роман</option></datalist>' +
      '<label for="z-zam">Заметка</label><input id="z-zam" maxlength="300" value="' + esc(z.note || '') + '">' +
      '<label>Оплата</label><div class="dva"><label class="gal"><input type="radio" name="z-opl" value="1"' + (z.paid ? ' checked' : '') + '>Оплачено</label><label class="gal"><input type="radio" name="z-opl" value="0"' + (z.paid ? '' : ' checked') + '>Не оплачено</label></div>' +
      '<div id="z-konf"></div>' +
      '<div class="knopki"><button class="btn" type="submit" id="z-save">Сохранить</button>' + (z.id ? '<button class="btn btn--opas" type="button" id="z-del">Удалить</button>' : '') + '</div></form>');
    var force = false;
    $('#f-zal').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var body = { id: z.id, date: $('#z-data').value, start: $('#z-ot').value, end: $('#z-do').value, kind: document.querySelector('input[name=z-vid]:checked').value,
        who: $('#z-kto').value.trim(), phone: $('#z-tel').value.trim(), trainer: $('#z-tr').value.trim(), note: $('#z-zam').value.trim(), paid: document.querySelector('input[name=z-opl]:checked').value === '1', force: force };
      if (mins(body.end) <= mins(body.start)) { $('#z-konf').innerHTML = '<p class="konflikt">Время «до» должно быть позже, чем «с».</p>'; return; }
      api('zal_save', body).then(function (j) {
        if (j.conflict) {
          force = true;
          $('#z-konf').innerHTML = '<p class="konflikt">Пересекается: ' + j.conflict.map(esc).join('; ') + '. Нажмите «Сохранить всё равно», если так и задумано.</p>';
          $('#z-save').textContent = 'Сохранить всё равно';
          return;
        }
        zakryt(); tost('Сохранено'); risZal();
      }).catch(function () {});
    });
    ['#z-ot', '#z-do', '#z-data'].forEach(function (s) { $(s).addEventListener('change', function () { force = false; $('#z-save').textContent = 'Сохранить'; $('#z-konf').innerHTML = ''; }); });
    if (z.id) $('#z-del').addEventListener('click', function () {
      sprosit('Удалить эту бронь?').then(function (y) { if (y) api('zal_del', { id: z.id }).then(function () { zakryt(); tost('Удалено'); risZal(); }).catch(function () {}); });
    });
  }
  $('#t-zal').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ned) { nedFrom = addDays(nedFrom, +b.dataset.ned); risZal(); return; }
    if (b.id === 'ned-segodnya') { nedFrom = nachaloNedeli(TODAY); zalDen = (d(TODAY).getUTCDay() + 6) % 7; risZal(); return; }
    if (b.dataset.zd) {
      zalDen = +b.dataset.zd;
      document.querySelectorAll('.dz').forEach(function (x, i) { x.setAttribute('aria-selected', i === zalDen); });
      document.querySelectorAll('.kol').forEach(function (x, i) { x.classList.toggle('vid', i === zalDen); });
      return;
    }
    if (b.dataset.novyj) { var p = b.dataset.novyj.split('|'); zalForma({ date: p[0], start: p[1], end: hhmm(mins(p[1]) + 60), kind: 'perso' }); return; }
    if (b.dataset.zal) { var z = zalData.zal.filter(function (x) { return x.id === +b.dataset.zal; })[0]; if (z) zalForma(z); return; }
    if (b.dataset.gr) {
      var q = b.dataset.gr.split('|'), g = zalData.groups.filter(function (x) { return x.gid === +q[0] && x.date === q[1]; })[0];
      if (g) okno(g.start.replace(/^0/, '') + ' ' + g.title, '<p>' + dlong(g.date) + ', ' + g.start + '–' + g.end + '</p><p class="prim">' + esc(g.level) + (g.trainer ? ' · ' + esc(g.trainer) : '') + ' · записано ' + g.zan + ' из ' + g.mest + '</p><p class="prim" style="margin-top:16px">Групповое занятие из расписания. Список учеников во вкладке «Записи», время меняется во вкладке «Расписание».</p>' +
        '<div class="knopki"><button class="btn" type="button" id="k-zap">Открыть записи</button></div>');
      if (g) $('#k-zap').addEventListener('click', function () { zakryt(); den = g.date; otkryt('zapisi'); });
    }
  });

  // =========== РАСПИСАНИЕ ===========
  var gruppy = [];
  function risRasp() {
    api('gruppy').then(function (j) {
      gruppy = j.list;
      var po = [1, 2, 3, 4, 5, 6, 0], out = '';
      po.forEach(function (dw) {
        var gg = j.list.filter(function (g) { return g.dow === dw; });
        if (!gg.length) return;
        out += '<div class="zan"><div class="zan-shapka"><b>' + DN_FULL[dw] + '</b></div>' + gg.map(function (g) {
          return '<div class="chel"><div class="chel-v"><b>' + g.time.replace(/^0/, '') + (g.dur !== 60 ? '–' + hhmm(mins(g.time) + g.dur).replace(/^0/, '') : '') + ' ' + esc(g.title) + '</b><button type="button" class="ssylka" data-gr-ed="' + g.id + '">Изменить</button></div>' +
            '<div class="metki"><span class="mt">' + levelText(g.level) + '</span>' + (g.trainer ? '<span class="mt">' + esc(g.trainer) + '</span>' : '') + '<span class="mt">' + g.mest + ' мест</span><span class="mt">' + rub(g.price) + '</span>' + (g.abon ? '' : '<span class="mt zol">без абонемента</span>') + '</div></div>';
        }).join('') + '</div>';
      });
      if (j.otmeny.length) {
        out += '<div class="zal-den"><h3>Отменённые занятия</h3><ul>' + j.otmeny.map(function (o) {
          var g = j.list.filter(function (x) { return x.id === o.gid; })[0];
          return '<li>' + dlong(o.date) + (g ? ', ' + g.time.replace(/^0/, '') + ' ' + esc(g.title) : '') + '</li>';
        }).join('') + '</ul><p class="prim">Вернуть занятие: вкладка «Записи», нужный день.</p></div>';
      }
      $('#rasp-spisok').innerHTML = out || '<p class="pustaya">Групп пока нет.</p>';
    }).catch(function () {});
  }
  function grForma(g) {
    g = g || { dow: 1, time: '18:00', dur: 60, title: 'Pole sport', level: '', trainer: '', mest: 6, price: 1200, abon: 1 };
    var lv = g.level ? g.level.split(',') : [];
    okno(g.id ? 'Изменить группу' : 'Новая группа', '<form id="f-gr">' +
      '<div class="dva"><div><label for="g-dn">День</label><select id="g-dn">' + [1, 2, 3, 4, 5, 6, 0].map(function (x) { return '<option value="' + x + '"' + (x === g.dow ? ' selected' : '') + '>' + DN_FULL[x] + '</option>'; }).join('') + '</select></div>' +
      '<div><label for="g-vr">Начало</label><input id="g-vr" type="time" step="300" value="' + g.time + '"></div></div>' +
      '<div class="dva"><div><label for="g-dl">Длительность, мин</label><input id="g-dl" type="number" min="15" max="300" step="15" value="' + g.dur + '"></div><div><label for="g-m">Мест</label><input id="g-m" type="number" min="1" max="50" value="' + g.mest + '"></div></div>' +
      '<label for="g-nz">Название</label><input id="g-nz" list="nazv" maxlength="60" value="' + esc(g.title) + '"><datalist id="nazv"><option>Pole sport</option><option>СФП + Pole sport</option><option>Растяжка</option></datalist>' +
      '<label>Уровень (ничего не отмечено = для всех)</label><div class="dva">' + ['nach', 'prod', 'profi'].map(function (x) { return '<label class="gal"><input type="checkbox" name="g-lv" value="' + x + '"' + (lv.indexOf(x) > -1 ? ' checked' : '') + '>' + LV[x] + '</label>'; }).join('') + '</div>' +
      '<label for="g-tr">Тренер</label><input id="g-tr" list="trenery2" maxlength="40" value="' + esc(g.trainer) + '"><datalist id="trenery2"><option>София</option><option>Карина</option><option>Роман</option></datalist>' +
      '<label for="g-c">Цена разового, ₽</label><input id="g-c" type="number" min="0" step="100" value="' + g.price + '">' +
      '<label class="gal"><input type="checkbox" id="g-ab"' + (g.abon ? ' checked' : '') + '>Можно по абонементу</label>' +
      '<p class="oshibka" id="g-osh" hidden></p>' +
      '<div class="knopki"><button class="btn" type="submit">Сохранить</button>' + (g.id ? '<button class="btn btn--opas" type="button" id="g-del">Убрать из расписания</button>' : '') + '</div></form>');
    $('#f-gr').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var body = { id: g.id, dow: +$('#g-dn').value, time: $('#g-vr').value, dur: +$('#g-dl').value, mest: +$('#g-m').value, title: $('#g-nz').value.trim(),
        level: [].slice.call(document.querySelectorAll('input[name=g-lv]:checked')).map(function (x) { return x.value; }).join(','),
        trainer: $('#g-tr').value.trim(), price: +$('#g-c').value, abon: $('#g-ab').checked };
      api('gruppa_save', body).then(function (j) {
        if (j.error === 'future') { var e = $('#g-osh'); e.textContent = 'На эту группу уже записано ' + j.future + ' чел. на будущие даты. Чтобы перенести на другой день, добавьте новую группу, а эту отмените по датам или уберите позже.'; e.hidden = false; return; }
        zakryt(); tost('Сохранено, на сайте уже новое расписание'); risRasp();
      }).catch(function () {});
    });
    if (g.id) $('#g-del').addEventListener('click', function () {
      sprosit('Убрать группу из расписания? На сайте она пропадёт.').then(function (y) {
        if (!y) return;
        api('gruppa_del', { id: g.id }).then(function (j) {
          if (j.error === 'future') {
            return sprosit('На неё записано ' + j.future + ' чел. на будущие даты. Всё равно убрать? Предупредите их сами.').then(function (y2) {
              if (y2) return api('gruppa_del', { id: g.id, force: true }).then(function () { zakryt(); tost('Группа убрана'); risRasp(); });
            });
          }
          zakryt(); tost('Группа убрана'); risRasp();
        }).catch(function () {});
      });
    });
  }
  $('#gr-novaya').addEventListener('click', function () { grForma(null); });
  $('#rasp-spisok').addEventListener('click', function (e) {
    var b = e.target.closest('[data-gr-ed]'); if (!b) return;
    grForma(gruppy.filter(function (g) { return g.id === +b.dataset.grEd; })[0]);
  });

  // ---------- старт ----------
  if (!init && !key) { pokazatVhod(); return; }
  api('me').then(function (j) {
    TODAY = j.today; den = TODAY; nedFrom = nachaloNedeli(TODAY); zalDen = (d(TODAY).getUTCDay() + 6) % 7;
    $('#kto').textContent = j.name ? 'кабинет · ' + j.name : 'кабинет';
    $('#niz').hidden = false;
    otkryt('zapisi');
  }).catch(function () {});
})();
