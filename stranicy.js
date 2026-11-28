// Olymp Pole: страницы «О студии» и «Как нас найти» (28.11): появление блоков, карта по прокрутке, видео, фото крупнее
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var tiho = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var est = 'IntersectionObserver' in window;

  // плавное появление блоков, как на главной
  var io = est ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  $$('.rv').forEach(function (el) { io ? io.observe(el) : el.classList.add('in'); });

  // карта грузится, только когда до неё докрутили (?nokarta — без карты, для снимков-проверок)
  var karta = $('#karta');
  if (karta && location.search.indexOf('nokarta') < 0) {
    if (est) {
      var io3 = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { karta.src = karta.dataset.src; io3.disconnect(); }
      }, { rootMargin: '400px 0px' });
      io3.observe(karta);
    } else karta.src = karta.dataset.src;
  }

  // короткие ролики сами играют без звука, пока видны; звук включается кнопкой в плеере
  if (est && !tiho) {
    var io4 = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else if (!v.paused) v.pause();
      });
    }, { threshold: 0.5 });
    $$('video[data-avto]').forEach(function (v) { v.muted = true; io4.observe(v); });
  }
  // одновременно звучит только один ролик
  $$('video').forEach(function (v) {
    v.addEventListener('play', function () {
      if (v.muted) return;
      $$('video').forEach(function (d) { if (d !== v && !d.muted && !d.paused) d.pause(); });
    });
    v.addEventListener('volumechange', function () {
      if (v.muted) return;
      $$('video').forEach(function (d) { if (d !== v && !d.muted && !d.paused) d.pause(); });
    });
  });

  // фото крупнее
  var okno = $('#prosmotr');
  if (okno && okno.showModal) {
    var img = okno.querySelector('img');
    $$('.foto-knopka').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = b.querySelector('img');
        img.src = i.currentSrc || i.src; img.alt = i.alt;
        okno.showModal();
      });
    });
    $('#prosmotr-x').addEventListener('click', function () { okno.close(); });
    okno.addEventListener('click', function (e) { if (e.target === okno) okno.close(); });
  }
})();
