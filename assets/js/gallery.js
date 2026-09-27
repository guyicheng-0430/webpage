/* ==========================================================================
   HELPing · 作品画廊
   筛选 / 搜索 / 详情弹层
   ========================================================================== */

(function () {
  'use strict';

  var grid = document.querySelector('[data-gallery]');
  if (!grid) return;

  var filterBar = document.querySelector('[data-filters]');
  var searchBox = document.querySelector('[data-search]');
  var countEl = document.querySelector('[data-count]');
  var emptyEl = document.querySelector('[data-gallery-empty]');

  /* 对外展示只取「已通过审核」的作品：用户上传默认待审核，后台通过后才出现在这里 */
  var all = HELP.artworks.published();
  var active = 'all';
  var query = '';

  /* ------------------------------------------------------------ 筛选条 */

  function buildFilters() {
    var cats = [];
    all.forEach(function (a) {
      if (a.category && cats.indexOf(a.category) === -1) cats.push(a.category);
    });
    var html = '<button class="chip is-active" type="button" data-filter="all">全部作品</button>';
    cats.forEach(function (c) {
      html += '<button class="chip" type="button" data-filter="' + HELP.escapeHtml(c) + '">' + HELP.escapeHtml(c) + '</button>';
    });
    if (all.some(function (a) { return /授权/.test(a.status || ''); })) {
      html += '<button class="chip" type="button" data-filter="__license">可申请授权</button>';
    }
    filterBar.innerHTML = html;
  }

  /* -------------------------------------------------------------- 过滤 */

  function match(a) {
    if (active === '__license') {
      if (!/授权/.test(a.status || '')) return false;
    } else if (active !== 'all' && a.category !== active) {
      return false;
    }
    if (query) {
      var hay = [
        a.title, a.author, a.school, a.medium, a.category,
        (a.tags || []).join(' '), a.story
      ].join(' ').toLowerCase();
      if (hay.indexOf(query) === -1) return false;
    }
    return true;
  }

  /* -------------------------------------------------------------- 渲染 */

  function cardHtml(a) {
    var metaBits = [a.medium, a.age ? a.age + ' 岁' : '', a.school].filter(Boolean);
    var tags = (a.tags || []).slice(0, 2).map(function (t) {
      return '<span class="tag tag--sage">' + HELP.escapeHtml(t) + '</span>';
    }).join('');

    return '' +
      '<button class="art" type="button" data-art="' + a.id + '" aria-label="查看作品详情：' + HELP.escapeHtml(a.title) + '">' +
        '<div class="art__wrap">' +
          '<div class="art__media"><img src="' + a.image + '" alt="' + HELP.escapeHtml(a.title) + '" loading="lazy"></div>' +
          '<span class="art__badge">' + HELP.escapeHtml(a.status || '待审核') + '</span>' +
        '</div>' +
        '<div class="art__body">' +
          '<div class="art__title">' + HELP.escapeHtml(a.title) + '</div>' +
          '<div class="art__meta">' + HELP.escapeHtml(a.author) + ' · ' + metaBits.map(HELP.escapeHtml).join(' · ') + '</div>' +
          (tags ? '<div class="art__tags">' + tags + '</div>' : '') +
        '</div>' +
      '</button>';
  }

  function render() {
    var items = all.filter(match);
    grid.innerHTML = items.map(cardHtml).join('');
    if (countEl) countEl.textContent = items.length + ' / ' + all.length + ' 件';
    if (emptyEl) emptyEl.hidden = items.length > 0;

    var EASE = 'cubic-bezier(.22,.61,.36,1)';
    Array.prototype.forEach.call(grid.children, function (el, i) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(16px)';
      el.style.transition = 'opacity .6s ' + EASE + ' ' + (i * 45) + 'ms, transform .6s ' + EASE + ' ' + (i * 45) + 'ms';
      requestAnimationFrame(function () {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    });
  }

  /* -------------------------------------------------------------- 事件 */

  if (filterBar) {
    filterBar.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-filter]');
      if (!chip) return;
      active = chip.getAttribute('data-filter');
      Array.prototype.forEach.call(filterBar.children, function (c) {
        c.classList.toggle('is-active', c === chip);
      });
      render();
    });
  }

  if (searchBox) {
    var t = null;
    searchBox.addEventListener('input', function () {
      clearTimeout(t);
      var v = searchBox.value.trim().toLowerCase();
      t = setTimeout(function () { query = v; render(); }, 160);
    });
  }

  /* ------------------------------------------------------------ 详情弹层 */

  var lb = document.querySelector('[data-lightbox]');
  var lbImg = document.querySelector('[data-lb-img]');
  var lbBody = document.querySelector('[data-lb-body]');

  function openLightbox(id) {
    var a = HELP.artworks.get(id);
    if (!a || !lb) return;

    lbImg.src = a.image;
    lbImg.alt = a.title;

    var facts = [
      ['创作类型', a.category],
      ['使用材质', a.medium],
      ['作者', a.author + (a.age ? ' · ' + a.age + ' 岁' : '')],
      ['学校 / 地区', a.school],
      ['投稿时间', a.createdAt],
      ['授权状态', a.status]
    ].filter(function (r) { return r[1]; });

    lbBody.innerHTML = '' +
      '<span class="eyebrow eyebrow--plain">' + HELP.escapeHtml(a.category || '原创作品') + '</span>' +
      '<h2 class="h2" style="margin-top:12px">' + HELP.escapeHtml(a.title) + '</h2>' +
      (a.story
        ? '<blockquote class="small" style="margin-top:18px;padding-left:16px;border-left:2px solid var(--sand);color:var(--ink-2);line-height:1.85">'
            + HELP.escapeHtml(a.story) + '</blockquote>'
        : '') +
      '<dl style="margin-top:24px;display:grid;gap:10px">' +
        facts.map(function (r) {
          return '<div style="display:flex;justify-content:space-between;gap:16px;padding-bottom:10px;border-bottom:1px solid var(--line)">' +
            '<dt class="small muted">' + HELP.escapeHtml(r[0]) + '</dt>' +
            '<dd class="small" style="font-weight:600;text-align:right">' + HELP.escapeHtml(r[1]) + '</dd>' +
          '</div>';
        }).join('') +
      '</dl>' +
      (a.tags && a.tags.length
        ? '<div class="art__tags" style="margin-top:18px">' + a.tags.map(function (t) {
            return '<span class="tag">' + HELP.escapeHtml(t) + '</span>';
          }).join('') + '</div>'
        : '') +
      '<div class="btn-row" style="margin-top:26px">' +
        '<button class="btn btn--sm" type="button" data-license>申请商用授权</button>' +
        '<a class="btn btn--ghost btn--sm" href="messages.html">给 TA 留一句话</a>' +
      '</div>' +
      '<p class="tiny muted" style="margin-top:16px">作品著作权归创作者本人所有。授权申请将由社团转达创作者及其监护人。</p>';

    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
  }

  function closeLightbox() {
    if (!lb) return;
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
  }

  grid.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-art]');
    if (!btn) return;
    openLightbox(btn.getAttribute('data-art'));
  });

  if (lb) {
    lb.addEventListener('click', function (e) {
      if (e.target.closest('[data-lb-close]')) { closeLightbox(); return; }
      if (e.target.closest('[data-license]')) {
        HELP.toast('授权申请已记录，社团会尽快与你联系（演示）');
        return;
      }
      if (e.target === lb) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  buildFilters();
  render();
})();
