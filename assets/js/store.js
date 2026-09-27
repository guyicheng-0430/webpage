/* ==========================================================================
   HELPing · 数据层与通用工具
   --------------------------------------------------------------------------
   说明：当前站点为纯前端演示版，所有用户产生的数据（上传作品、购物车、
   留言）保存在浏览器 localStorage 中，不会上传到任何服务器。
   接入后端时，把下面 Store 里各方法的读写替换为接口调用即可，
   页面层无需改动（页面只依赖 HELP.artworks / HELP.cart / HELP.messages 这几个门面）。
   ========================================================================== */

window.HELP = (function () {
  'use strict';

  var KEY = {
    uploads: 'help.uploads.v1',
    cart: 'help.cart.v1',
    messages: 'help.messages.v1',
    likes: 'help.likes.v1',
    orders: 'help.orders.v1',
    admin: 'help.admin.v1'
  };

  /* 旧版前缀（社团改名前的 ph.*）。仅用于读取回退，不写入。 */
  var LEGACY_PREFIX = 'ph.';
  var PREFIX = 'help.';

  /* ---------------------------------------------------------------- utils */

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 7);
  }

  function money(n) {
    return '\u00A5' + Number(n || 0).toFixed(2).replace(/\.00$/, '');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDate(ts) {
    var d = new Date(ts);
    var p = function (x) { return String(x).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      /* 兼容社团改名前的 ph.* 旧键，避免用户此前存的数据丢失 */
      if (!raw && key.indexOf(PREFIX) === 0) {
        raw = localStorage.getItem(LEGACY_PREFIX + key.slice(PREFIX.length));
      }
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      toast('本地存储空间不足，请先清理部分已上传作品');
      return false;
    }
  }

  /* --------------------------------------------------------------- toast */

  var toastEl = null;
  var toastTimer = null;

  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  /* ----------------------------------------------------- image downscale */

  /* 把用户选择的图片压缩成适合网页的尺寸，避免 localStorage 爆掉 */
  function fileToDataUrl(file, maxSide, quality) {
    maxSide = maxSide || 1280;
    quality = quality || 0.82;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('not-an-image'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('read-failed')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('decode-failed')); };
        img.onload = function () {
          var w = img.naturalWidth, h = img.naturalHeight;
          var scale = Math.min(1, maxSide / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(img, 0, 0, cw, ch);
          try {
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch (e) {
            resolve(reader.result);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------------------------------------------------------------- seed */

  var IMG = 'assets/img/';

  /* 演示作品：创作者姓名已做匿名化处理 */
  var SEED_ARTWORKS = [
    {
      id: 'seed-a1', seed: true, image: IMG + 'art-01.jpg',
      title: '山那边的家', author: '小禾', age: 9, school: '安徽 · 合作学校',
      medium: '蜡笔', category: '绘画', tags: ['山川', '家'],
      story: '我说山的那边还是山，老师说山的那边有好多人在看着我们。',
      status: '已被选中做周边', createdAt: '2026-03-12'
    },
    {
      id: 'seed-a2', seed: true, image: IMG + 'art-02.jpg',
      title: '星星掉进村子', author: '阿岩', age: 11, school: '安徽 · 合作学校',
      medium: '水彩', category: '绘画', tags: ['星空', '夜晚'],
      story: '晚上我们那里能看见特别多的星星，我想把它们留下来。',
      status: '开放授权', createdAt: '2026-03-18'
    },
    {
      id: 'seed-a3', seed: true, image: IMG + 'art-03.jpg',
      title: '开花的树', author: '小满', age: 8, school: '安徽 · 合作学校',
      medium: '蜡笔 / 马克笔', category: '绘画', tags: ['植物', '春天'],
      story: '春天的时候，教室外面那棵树会开白色的花。',
      status: '已被选中做周边', createdAt: '2026-04-02'
    },
    {
      id: 'seed-a4', seed: true, image: IMG + 'art-04.jpg',
      title: '一起放风筝', author: '乐乐', age: 10, school: '安徽 · 合作学校',
      medium: '彩色铅笔', category: '绘画', tags: ['家人', '风筝'],
      story: '爸爸说过年回来带我去放风筝，我先把那天的样子画下来了。',
      status: '开放授权', createdAt: '2026-04-15'
    },
    {
      id: 'seed-a5', seed: true, image: IMG + 'art-05.jpg',
      title: '第一次写毛笔字', author: '小禾', age: 9, school: '安徽 · 合作学校',
      medium: '毛笔 / 宣纸', category: '书法', tags: ['书法', '汉字'],
      story: '老师说我这一笔比上一笔稳了。',
      status: '开放授权', createdAt: '2026-04-28'
    },
    {
      id: 'seed-a6', seed: true, image: IMG + 'art-06.jpg',
      title: '我要去太空', author: '石头', age: 7, school: '安徽 · 合作学校',
      medium: '蜡笔', category: '绘画', tags: ['宇宙', '梦想'],
      story: '长大了我要坐这个去找那颗带圈圈的星星。',
      status: '已被选中做周边', createdAt: '2026-05-09'
    },
    {
      id: 'seed-a7', seed: true, image: IMG + 'art-07.jpg',
      title: '海底的一天', author: '苗苗', age: 8, school: '安徽 · 合作学校',
      medium: '水彩', category: '绘画', tags: ['海洋', '动物'],
      story: '我没见过海，但是从电视里看来的海是这样的。',
      status: '开放授权', createdAt: '2026-05-21'
    },
    {
      id: 'seed-a8', seed: true, image: IMG + 'art-08.jpg',
      title: '操场上的下午', author: '阿岩', age: 11, school: '安徽 · 合作学校',
      medium: '彩色铅笔', category: '绘画', tags: ['校园', '运动'],
      story: '那天我们踢球踢到天黑才回家。',
      status: '开放授权', createdAt: '2026-06-03'
    }
  ];

  /* 商品目录：按要求全量下架（2026-09-28）。
     商店页会显示「暂无商品」，购物车与结算入口随之不可达。
     重新上架：在本数组内按原有字段结构添加商品对象即可，
     字段为 id / name / price / original / image / stock / flag / desc / artwork / share。 */
  var PRODUCTS = [];

  /* 演示留言：真实上线时由后台审核后展示 */
  var SEED_MESSAGES = [
    { id: 'm1', name: '林同学', role: '平和学校 · 高一', text: '你画的山真的很有力量，像是能挡住所有风。希望你一直画下去。', tone: 'sage', likes: 24, createdAt: '2026-06-02' },
    { id: 'm2', name: '一位过路人', role: '网站访客', text: '把星星留下来这个想法太浪漫了。我买了那本笔记本，每天都要翻开看一眼。', tone: 'mist', likes: 41, createdAt: '2026-06-05' },
    { id: 'm3', name: '陈老师', role: '平和学校 · 美术组', text: '看得出你很认真地观察过那棵树。真正的画家都是从认真看开始的。', tone: 'clay', likes: 33, createdAt: '2026-06-07' },
    { id: 'm4', name: '王同学', role: '平和学校 · 高二', text: '你说没见过海，但你画的海比我见过的还好看。等你有机会来上海，我带你去看真的。', tone: 'sand', likes: 56, createdAt: '2026-06-11' },
    { id: 'm5', name: '匿名', role: '', text: '我刚上初中的时候也很想学画画，但大人都说没用。看到你的画我有点后悔了，也有点被鼓励到。', tone: 'lilac', likes: 19, createdAt: '2026-06-15' },
    { id: 'm6', name: '阿牧', role: '志愿者', text: '那一笔比上一笔稳了——这句话我记了很久。愿你写的每一个字都越来越稳。', tone: 'sage', likes: 28, createdAt: '2026-06-19' },
    { id: 'm7', name: '来自深圳的姐姐', role: '网站访客', text: '我也想去太空。你的火箭我贴在电脑上了，写作业的时候一抬头就能看到。', tone: 'mist', likes: 37, createdAt: '2026-06-24' },
    { id: 'm8', name: '小周', role: '平和学校 · 高三', text: '踢球踢到天黑才回家，这种下午我也有过。谢谢你把它画下来，不然我快忘了。', tone: 'clay', likes: 22, createdAt: '2026-07-01' }
  ];

  /* ------------------------------------------------------------- storage */

  /* 作品 = 演示作品 + 用户上传（用户上传存 localStorage） */
  var artworks = {
    list: function () {
      var mine = read(KEY.uploads, []);
      return mine.concat(SEED_ARTWORKS);
    },
    uploads: function () { return read(KEY.uploads, []); },
    get: function (id) {
      return this.list().filter(function (a) { return a.id === id; })[0] || null;
    },
    add: function (item) {
      var mine = read(KEY.uploads, []);
      mine.unshift(item);
      return write(KEY.uploads, mine);
    },
    remove: function (id) {
      var mine = read(KEY.uploads, []);
      return write(KEY.uploads, mine.filter(function (a) { return a.id !== id; }));
    },
    categories: function () {
      var set = {};
      this.list().forEach(function (a) { if (a.category) set[a.category] = 1; });
      return Object.keys(set);
    },

    /* ---- 审核：对外展示只包含演示作品 + 已通过的用户上传 ---- */
    published: function () {
      return read(KEY.uploads, [])
        .filter(function (a) { return reviewOf(a) === REVIEW.APPROVED; })
        .concat(SEED_ARTWORKS);
    },
    byReview: function (state) {
      return read(KEY.uploads, []).filter(function (a) {
        return reviewOf(a) === state;
      });
    },
    setReview: function (id, state) {
      if (!REVIEW_LABEL[state]) return false;
      var mine = read(KEY.uploads, []);
      var hit = mine.filter(function (a) { return a.id === id; })[0];
      if (!hit) return false;
      hit.review = state;
      hit.reviewedAt = HELP_DATE(new Date());
      write(KEY.uploads, mine);
      return true;
    },
    reviewCounts: function () {
      var mine = read(KEY.uploads, []);
      var c = { pending: 0, approved: 0, rejected: 0, total: mine.length };
      mine.forEach(function (a) { c[reviewOf(a)]++; });
      return c;
    }
  };

  var catalog = {
    list: function () { return PRODUCTS.slice(); },
    get: function (id) {
      return PRODUCTS.filter(function (p) { return p.id === id; })[0] || null;
    }
  };

  /* 购物车 [{id, qty}] */
  var cart = {
    items: function () {
      var raw = read(KEY.cart, []);
      return raw.map(function (line) {
        var p = catalog.get(line.id);
        return p ? { product: p, qty: line.qty } : null;
      }).filter(Boolean);
    },
    raw: function () { return read(KEY.cart, []); },
    /* 必须基于 items()（已过滤下架商品），不能用 raw()：
       raw() 里可能残留已下架商品的条目，那样角标会显示数字、
       点开抽屉却是「购物车是空的」——两处口径打架。 */
    count: function () {
      return this.items().reduce(function (n, l) { return n + l.qty; }, 0);
    },
    subtotal: function () {
      return this.items().reduce(function (n, l) { return n + l.product.price * l.qty; }, 0);
    },
    add: function (id, qty) {
      qty = Math.max(1, parseInt(qty, 10) || 1);
      /* 商品已下架或不存在时直接拒绝，避免在本地留下渲染不出来的幽灵条目 */
      if (!catalog.get(id)) return this.count();
      var raw = read(KEY.cart, []);
      var hit = raw.filter(function (l) { return l.id === id; })[0];
      if (hit) { hit.qty += qty; } else { raw.push({ id: id, qty: qty }); }
      write(KEY.cart, raw);
      syncBadge();
      return this.count();
    },
    setQty: function (id, qty) {
      qty = parseInt(qty, 10) || 0;
      var raw = read(KEY.cart, []);
      if (qty <= 0) { raw = raw.filter(function (l) { return l.id !== id; }); }
      else { raw.forEach(function (l) { if (l.id === id) l.qty = qty; }); }
      write(KEY.cart, raw);
      syncBadge();
    },
    remove: function (id) {
      write(KEY.cart, read(KEY.cart, []).filter(function (l) { return l.id !== id; }));
      syncBadge();
    },
    clear: function () { write(KEY.cart, []); syncBadge(); }
  };

  /* 留言 = 用户留言 + 演示留言 */
  var messages = {
    list: function () {
      return read(KEY.messages, []).concat(SEED_MESSAGES);
    },
    add: function (item) {
      var mine = read(KEY.messages, []);
      mine.unshift(item);
      return write(KEY.messages, mine);
    },
    /* 只管本机提交的留言，不含演示数据 —— 后台审核用 */
    stored: function () { return read(KEY.messages, []); },

    /* ---- 审核 ----
       墙上展示：演示留言 + 本机提交且未被驳回的留言。
       待审核的也照常展示，但会打上「待审核」标记 —— 否则访客刚写完就看不到自己的话。
       被驳回的立即从墙上撤下。 */
    visible: function () {
      return read(KEY.messages, [])
        .filter(function (m) { return reviewOf(m) !== REVIEW.REJECTED; })
        .concat(SEED_MESSAGES);
    },
    byReview: function (state) {
      return read(KEY.messages, []).filter(function (m) {
        return reviewOf(m) === state;
      });
    },
    setReview: function (id, state) {
      if (!REVIEW_LABEL[state]) return false;
      var mine = read(KEY.messages, []);
      var hit = mine.filter(function (m) { return m.id === id; })[0];
      if (!hit) return false;
      hit.review = state;
      hit.reviewedAt = HELP_DATE(new Date());
      write(KEY.messages, mine);
      return true;
    },
    reviewCounts: function () {
      var mine = read(KEY.messages, []);
      var c = { pending: 0, approved: 0, rejected: 0, total: mine.length };
      mine.forEach(function (m) { c[reviewOf(m)]++; });
      return c;
    },

    likes: function () { return read(KEY.likes, {}); },
    toggleLike: function (id) {
      var map = read(KEY.likes, {});
      if (map[id]) { delete map[id]; } else { map[id] = 1; }
      write(KEY.likes, map);
      return !!map[id];
    },
    isLiked: function (id) { return !!read(KEY.likes, {})[id]; }
  };

  /* ========================================================== 审核状态 */

  /* 统一的三态：待审核 / 已通过 / 已驳回。
     作品与留言共用同一套取值，后台可以按同一逻辑处理。 */
  var REVIEW = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
  };

  var REVIEW_LABEL = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已驳回'
  };

  function reviewOf(item) {
    return (item && item.review) || REVIEW.PENDING;
  }

  /* ============================================================== 订单 */

  var ORDER_STATUS = {
    PENDING: 'pending',      // 待发货
    SHIPPED: 'shipped',      // 已发货
    DONE: 'done',            // 已完成
    CANCELLED: 'cancelled'   // 已取消
  };

  var ORDER_LABEL = {
    pending: '待发货',
    shipped: '已发货',
    done: '已完成',
    cancelled: '已取消'
  };

  var COURIERS = ['顺丰速运', '中通快递', '圆通速递', '韵达快递', '京东物流', '邮政 EMS'];

  function pad2(n) { return String(n).padStart(2, '0'); }

  /* 订单号：HE + 年月日 + 4 位流水，例 HE20260921-0003 */
  function makeOrderNo(seq) {
    var d = new Date();
    return 'HE' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
      '-' + String(seq).padStart(4, '0');
  }

  /* 演示订单：首次打开后台时写入，之后可自由改状态、填单号 */
  var SEED_ORDERS = [
    {
      id: 'seed-o1', no: 'HE20260905-0001', createdAt: '2026-09-05',
      items: [
        { id: 'p-tote', name: '「山那边的家」帆布袋', price: 68, qty: 2, image: IMG + 'product-tote.jpg', artwork: '山那边的家' },
        { id: 'p-sticker', name: '「操场上的下午」贴纸包', price: 22, qty: 1, image: IMG + 'art-08.jpg', artwork: '操场上的下午' }
      ],
      total: 158, shipping: 0,
      buyer: { name: '周晓岚', phone: '138****4207', address: '上海市浦东新区华夏中路 1288 号 3 号楼 502 室' },
      note: '希望用礼盒包装，谢谢',
      status: 'pending', courier: '', tracking: '', shippedAt: ''
    },
    {
      id: 'seed-o2', no: 'HE20260911-0002', createdAt: '2026-09-11',
      items: [
        { id: 'p-notebook', name: '「星星掉进村子」精装笔记本', price: 42, qty: 3, image: IMG + 'product-notebook.jpg', artwork: '星星掉进村子' }
      ],
      total: 126, shipping: 0,
      buyer: { name: '李文轩', phone: '139****8813', address: '北京市朝阳区望京西园四区 412 号楼 1801' },
      note: '',
      status: 'pending', courier: '', tracking: '', shippedAt: ''
    },
    {
      id: 'seed-o3', no: 'HE20260828-0003', createdAt: '2026-08-28',
      items: [
        { id: 'p-postcards', name: '「小小画廊」明信片套装', price: 36, qty: 5, image: IMG + 'product-postcards.jpg', artwork: '多位创作者' },
        { id: 'p-magnet', name: '「海底的一天」冰箱贴组', price: 28, qty: 2, image: IMG + 'art-07.jpg', artwork: '海底的一天' }
      ],
      total: 236, shipping: 0,
      buyer: { name: '陈敏', phone: '137****2210', address: '广东省深圳市南山区科技园南路 18 号 A 座 907' },
      note: '寄到学校，工作日送达',
      status: 'shipped', courier: '顺丰速运', tracking: 'SF1348209157762', shippedAt: '2026-08-30'
    },
    {
      id: 'seed-o4', no: 'HE20260812-0004', createdAt: '2026-08-12',
      items: [
        { id: 'p-print', name: '「我要去太空」艺术微喷', price: 88, qty: 1, image: IMG + 'art-06.jpg', artwork: '我要去太空' }
      ],
      total: 88, shipping: 0,
      buyer: { name: '黄启铭', phone: '135****6642', address: '浙江省杭州市西湖区文三路 199 号 2 单元 601' },
      note: '',
      status: 'done', courier: '中通快递', tracking: 'ZT7712849003', shippedAt: '2026-08-14'
    }
  ];

  /* 订单是可编辑实体（要改状态、填单号），所以首次读取时落盘，
     之后一律以 localStorage 为准，不再每次拼接种子数据。 */
  function ensureOrders() {
    var cur = read(KEY.orders, null);
    if (!Array.isArray(cur)) {
      write(KEY.orders, SEED_ORDERS);
      return SEED_ORDERS.slice();
    }
    return cur;
  }

  var orders = {
    all: function () { return ensureOrders(); },

    list: function (opts) {
      opts = opts || {};
      var arr = ensureOrders().slice();
      if (opts.status && opts.status !== 'all') {
        arr = arr.filter(function (o) { return o.status === opts.status; });
      }
      if (opts.q) {
        var q = String(opts.q).toLowerCase();
        arr = arr.filter(function (o) {
          return (o.no + ' ' + o.buyer.name + ' ' + o.buyer.phone + ' ' + o.buyer.address +
            ' ' + (o.tracking || '')).toLowerCase().indexOf(q) !== -1;
        });
      }
      // 默认待发货在前、其次按日期倒序
      var rank = { pending: 0, shipped: 1, done: 2, cancelled: 3 };
      arr.sort(function (a, b) {
        var r = (rank[a.status] === undefined ? 9 : rank[a.status]) -
                (rank[b.status] === undefined ? 9 : rank[b.status]);
        if (r !== 0) return r;
        return String(b.createdAt).localeCompare(String(a.createdAt));
      });
      return arr;
    },

    get: function (id) {
      return ensureOrders().filter(function (o) { return o.id === id; })[0] || null;
    },

    /* 结算流程调用 */
    create: function (payload) {
      var arr = ensureOrders();
      var today = new Date();
      var prefix = 'HE' + today.getFullYear() + pad2(today.getMonth() + 1) + pad2(today.getDate());
      var seq = arr.filter(function (o) {
        return String(o.no).indexOf(prefix) === 0;
      }).length + 1;

      var order = {
        id: uid('order'),
        no: makeOrderNo(seq),
        createdAt: HELP_DATE(today),
        items: (payload.items || []).map(function (l) {
          var p = l.product || l;
          return {
            id: p.id, name: p.name, price: p.price, qty: l.qty || 1,
            image: p.image, artwork: p.artwork
          };
        }),
        total: payload.total || 0,
        shipping: payload.shipping || 0,
        buyer: payload.buyer || { name: '', phone: '', address: '' },
        note: payload.note || '',
        status: ORDER_STATUS.PENDING,
        courier: '',
        tracking: '',
        shippedAt: ''
      };

      arr.unshift(order);
      write(KEY.orders, arr);
      return order;
    },

    setStatus: function (id, status) {
      if (!ORDER_LABEL[status]) return false;
      var arr = ensureOrders();
      var hit = arr.filter(function (o) { return o.id === id; })[0];
      if (!hit) return false;
      hit.status = status;
      write(KEY.orders, arr);
      return true;
    },

    /* 发货：写承运商 + 运单号，并自动把状态推进到「已发货」 */
    ship: function (id, courier, tracking) {
      var arr = ensureOrders();
      var hit = arr.filter(function (o) { return o.id === id; })[0];
      if (!hit) return false;
      hit.courier = String(courier || '').trim();
      hit.tracking = String(tracking || '').trim().toUpperCase();
      hit.status = ORDER_STATUS.SHIPPED;
      hit.shippedAt = HELP_DATE(new Date());
      write(KEY.orders, arr);
      return true;
    },

    remove: function (id) {
      write(KEY.orders, ensureOrders().filter(function (o) { return o.id !== id; }));
    },

    stats: function () {
      var arr = ensureOrders();
      var by = { pending: 0, shipped: 0, done: 0, cancelled: 0 };
      var revenue = 0;
      var units = 0;
      arr.forEach(function (o) {
        if (by[o.status] !== undefined) by[o.status]++;
        if (o.status !== 'cancelled') revenue += o.total || 0;
        (o.items || []).forEach(function (it) { units += it.qty || 0; });
      });
      return {
        count: arr.length,
        by: by,
        revenue: revenue,
        units: units,
        share: Math.round(revenue * 0.3)
      };
    },

    statusLabel: function (s) { return ORDER_LABEL[s] || s; },
    /* 注意要写成函数：直接写 COURIERS.slice() 会在对象创建时求值成数组，
       调用 couriers() 就会抛错（曾因此让发货表单渲染不出来） */
    couriers: function () { return COURIERS.slice(); }
  };

  function HELP_DATE(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function syncBadge() {
    var n = cart.count();
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = n > 99 ? '99+' : String(n);
      el.hidden = n === 0;
    });
  }

  return {
    uid: uid,
    money: money,
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    dateStr: HELP_DATE,
    fileToDataUrl: fileToDataUrl,
    toast: toast,
    syncBadge: syncBadge,
    artworks: artworks,
    catalog: catalog,
    cart: cart,
    messages: messages,
    orders: orders,
    review: {
      PENDING: REVIEW.PENDING,
      APPROVED: REVIEW.APPROVED,
      REJECTED: REVIEW.REJECTED,
      label: function (s) { return REVIEW_LABEL[s] || s; },
      of: reviewOf
    }
  };
})();
