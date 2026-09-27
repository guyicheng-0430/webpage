/* ==========================================================================
   HELPing · 公益商店
   商品渲染 / 排序 / 加入购物车
   ========================================================================== */

(function () {
  'use strict';

  var grid = document.querySelector('[data-shop]');
  if (!grid) return;

  var sortEl = document.querySelector('[data-sort]');
  var countEl = document.querySelector('[data-count]');

  function sorted() {
    var list = HELP.catalog.list();
    var mode = sortEl ? sortEl.value : 'default';
    if (mode === 'price-asc') list.sort(function (a, b) { return a.price - b.price; });
    else if (mode === 'price-desc') list.sort(function (a, b) { return b.price - a.price; });
    else if (mode === 'stock') list.sort(function (a, b) { return b.stock - a.stock; });
    return list;
  }

  function cardHtml(p) {
    var price = '<b>' + HELP.money(p.price) + '</b>' +
      (p.original && p.original > p.price ? '<s>' + HELP.money(p.original) + '</s>' : '');

    return '' +
      '<article class="card product" data-product="' + p.id + '">' +
        '<div class="product__media">' +
          '<img src="' + p.image + '" alt="' + HELP.escapeHtml(p.name) + '" loading="lazy">' +
          (p.flag ? '<span class="product__flag">' + HELP.escapeHtml(p.flag) + '</span>' : '') +
        '</div>' +
        '<div class="product__body">' +
          '<div class="product__origin">原作 · ' + HELP.escapeHtml(p.artwork) + '</div>' +
          '<h3 class="product__name">' + HELP.escapeHtml(p.name) + '</h3>' +
          '<p class="product__desc">' + HELP.escapeHtml(p.desc) + '</p>' +
          '<div class="product__price">' + price + '</div>' +
          '<div class="tiny muted">' + HELP.escapeHtml(p.share) +
            ' · 库存 ' + p.stock + ' 件</div>' +
          '<button class="btn btn--block" type="button" data-add="' + p.id + '" style="margin-top:6px">加入购物车</button>' +
        '</div>' +
      '</article>';
  }

  /* 空状态：全站没有任何在售商品时，网格里只有它一个，需要跨满整行。
     文案要给出下一步去处，避免用户停在一个死页面上。 */
  function emptyHtml() {
    return '' +
      '<div class="empty-state shop-empty">' +
        '<div class="h3" style="margin-bottom:10px">暂无商品</div>' +
        '<p class="small muted shop-empty__desc">' +
          '文创周边正在打样与排期，暂未开放购买。' +
          '在那之前，欢迎先去看看孩子们的作品，或者给他们留一句话。' +
        '</p>' +
        '<div class="shop-empty__acts">' +
          '<a class="btn btn--ghost" href="gallery.html">逛逛作品画廊</a>' +
          '<a class="btn btn--ghost" href="messages.html">去留言墙</a>' +
        '</div>' +
      '</div>';
  }

  function render() {
    var list = sorted();

    /* 没有在售商品：显示空状态，并收起无意义的排序控件 */
    if (!list.length) {
      grid.innerHTML = emptyHtml();
      if (countEl) countEl.textContent = '0 件商品';
      if (sortEl) sortEl.hidden = true;
      return;
    }
    if (sortEl) sortEl.hidden = false;

    grid.innerHTML = list.map(cardHtml).join('');
    if (countEl) countEl.textContent = list.length + ' 件商品';

    var EASE = 'cubic-bezier(.22,.61,.36,1)';
    Array.prototype.forEach.call(grid.children, function (el, i) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(16px)';
      el.style.transition = 'opacity .6s ' + EASE + ' ' + (i * 50) + 'ms, transform .6s ' + EASE + ' ' + (i * 50) + 'ms';
      requestAnimationFrame(function () {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    });
  }

  grid.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add]');
    if (!btn) return;
    var id = btn.getAttribute('data-add');
    var p = HELP.catalog.get(id);
    if (!p) return;

    HELP.cart.add(id, 1);
    HELP.toast('已加入购物车：' + p.name);

    // 让已经打开的购物车抽屉同步刷新
    window.dispatchEvent(new Event('ph:cart-changed'));

    var old = btn.textContent;
    btn.textContent = '已加入 ✓';
    btn.setAttribute('aria-disabled', 'true');
    setTimeout(function () {
      btn.textContent = old;
      btn.removeAttribute('aria-disabled');
    }, 1400);
  });

  if (sortEl) sortEl.addEventListener('change', render);

  render();
})();
