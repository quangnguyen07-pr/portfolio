'use strict';
// ============================================================
// PORTFOLIO — Optimized JS (v3)
// Architecture: single rAF loop, visibility API, passive events
// ============================================================

const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
                || window.matchMedia('(hover:none)').matches;

var ENABLE_ANIMATIONS = true;
var PLAY_SOUNDS = true;
var audioCtx = null;

function playClickSound(freq, type, dur) {
  if (!PLAY_SOUNDS) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq || 1000, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.012, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (dur || 0.08));
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + (dur || 0.08));
  } catch(e){}
}

// ============================================================
// 1. LENIS SMOOTH SCROLL
// ============================================================


// ============================================================
// 2. SINGLE RAF LOOP — tất cả animation chạy trong 1 loop
// ============================================================
let rafId = null;
const rafCallbacks = new Map(); // name → fn

function addRaf(name, fn) { rafCallbacks.set(name, fn); }
function removeRaf(name) { rafCallbacks.delete(name); }

let lastFrame = 0;
function masterLoop(ts) {
  rafId = requestAnimationFrame(masterLoop);
  if (document.hidden) return; // pause hoàn toàn khi tab ẩn

  // Chạy tất cả callbacks đã đăng ký
  rafCallbacks.forEach(fn => fn(ts));
  lastFrame = ts;
}

// ============================================================
// 3. DATA STREAM CANVAS — optimized
// ============================================================
function initDataStream() {
  if (IS_MOBILE) return; // skip on mobile entirely

  const canvas = document.getElementById('data-stream-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  const SRC  = '01アイウカキ▓▒░ABCDEF';
  let W, H, cols = [];
  const COL_W    = 26;
  const SPEED_MIN = 0.25, SPEED_MAX = 0.65;
  const DENSITY   = 0.32; // % cột có stream — giảm từ 38%→32%

  function buildCols() {
    cols = [];
    const n = Math.ceil(W / COL_W);
    for (let i = 0; i < n; i++) {
      if (Math.random() > (1 - DENSITY)) {
        cols.push({
          x:     i * COL_W,
          y:     Math.random() * -H,
          speed: SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN),
          len:   12 + Math.floor(Math.random() * 10),
          chars: Array.from({length: 22}, () => SRC[Math.floor(Math.random() * SRC.length)]),
          alpha: 0.05 + Math.random() * 0.08,
          cyan:  Math.random() > 0.65,
        });
      }
    }
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    buildCols();
  }
  resize();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 250);
  }, {passive: true});

  const isDark = () => document.documentElement.getAttribute('data-theme') !== 'light';

  // Cap 24 FPS — data stream không cần 60fps
  const INTERVAL = 1000 / 24;
  let last = 0;

  addRaf('dataStream', ts => {
    if (ts - last < INTERVAL) return;
    last = ts;
    if (!ENABLE_ANIMATIONS) { ctx.clearRect(0, 0, W, H); return; }
    if (!isDark()) { ctx.clearRect(0, 0, W, H); return; }

    ctx.clearRect(0, 0, W, H);

    // Batch draws — set font once per pass
    ctx.font = '10px monospace';

    cols.forEach(col => {
      col.y += col.speed;
      if (col.y > H + 180) {
        col.y    = -Math.random() * 200;
        col.speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
      }
      // Shuffle chars rarely
      if (Math.random() < 0.012) {
        col.chars[Math.floor(Math.random() * col.chars.length)] =
          SRC[Math.floor(Math.random() * SRC.length)];
      }

      const base = col.cyan ? '86,216,248' : '91,138,245';
      const len  = col.len;

      for (let i = 0; i < len; i++) {
        const y = col.y + i * 16;
        if (y < 0 || y > H) continue;
        const isHead = i === len - 1;
        const a = isHead
          ? Math.min(col.alpha * 4, 0.55)
          : col.alpha * (1 - i / len);
        ctx.fillStyle = `rgba(${base},${a.toFixed(3)})`;
        ctx.fillText(col.chars[i], col.x, y);
      }
    });
  });
}

// ============================================================
// 4. PARTICLE CANVAS — simplified, low-cost
// ============================================================
function initParticles() {
  if (IS_MOBILE) return;

  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  let W, H;
  const COUNT    = 28;
  const MAX_DIST = 90;
  const MAX_D2   = MAX_DIST * MAX_DIST;
  const MOUSE_D  = 130;
  const MOUSE_D2 = MOUSE_D * MOUSE_D;

  let mouse = { x: -999, y: -999 };

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', () => { resize(); }, {passive: true});

  // Particles as plain arrays — faster than class instances
  const px = new Float32Array(COUNT);
  const py = new Float32Array(COUNT);
  const vx = new Float32Array(COUNT);
  const vy = new Float32Array(COUNT);
  const pr = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    px[i] = Math.random() * window.innerWidth;
    py[i] = Math.random() * window.innerHeight;
    vx[i] = (Math.random() - 0.5) * 0.35;
    vy[i] = (Math.random() - 0.5) * 0.35;
    pr[i] = 0.6 + Math.random() * 1.2;
  }

  // Mouse: throttle with timestamp
  let lastMouse = 0;
  document.addEventListener('mousemove', e => {
    const now = performance.now();
    if (now - lastMouse < 40) return; // max 25Hz mouse update
    lastMouse = now;
    mouse.x = e.clientX; mouse.y = e.clientY;
  }, {passive: true});

  // Cap 24 FPS
  const INTERVAL = 1000 / 24;
  let last = 0;

  addRaf('particles', ts => {
    if (ts - last < INTERVAL) return;
    last = ts;
    if (!ENABLE_ANIMATIONS) { ctx.clearRect(0, 0, W, H); return; }

    ctx.clearRect(0, 0, W, H);

    // Update + draw dots
    ctx.fillStyle = 'rgba(91,138,245,0.55)';
    for (let i = 0; i < COUNT; i++) {
      px[i] += vx[i]; py[i] += vy[i];
      if (px[i] < 0 || px[i] > W) vx[i] *= -1;
      if (py[i] < 0 || py[i] > H) vy[i] *= -1;
      ctx.beginPath();
      ctx.arc(px[i], py[i], pr[i], 0, 6.283);
      ctx.fill();
    }

    // Connections — squared distance, skip if no intersection possible
    ctx.lineWidth = 0.5;
    for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        const dx = px[i] - px[j], dy = py[i] - py[j];
        const d2 = dx * dx + dy * dy;
        if (d2 < MAX_D2) {
          const a = (1 - Math.sqrt(d2) / MAX_DIST) * 0.15;
          ctx.strokeStyle = `rgba(91,138,245,${a.toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(px[i], py[i]); ctx.lineTo(px[j], py[j]); ctx.stroke();
        }
      }
      // Mouse connections
      const mdx = px[i] - mouse.x, mdy = py[i] - mouse.y;
      const md2 = mdx * mdx + mdy * mdy;
      if (md2 < MOUSE_D2) {
        const a = (1 - Math.sqrt(md2) / MOUSE_D) * 0.2;
        ctx.strokeStyle = `rgba(86,216,248,${a.toFixed(3)})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(px[i], py[i]); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        ctx.lineWidth = 0.5;
      }
    }
  });
}

// ============================================================
// 5. SCROLL PROGRESS + NAV ACTIVE + BACK TO TOP
// ============================================================
function initScrollHandlers() {
  const progressEl = document.getElementById('scroll-progress');
  const backTop    = document.getElementById('back-to-top');
  const sections   = Array.from(document.querySelectorAll('section[id]'));
  const navLinks   = Array.from(document.querySelectorAll('.nav-links a'));

  addRaf('scroll', () => {
    // Only recalc on actual scroll (flag-based)
    if (!scrollDirty) return;
    scrollDirty = false;

    const sy    = window.scrollY;
    const total = document.body.scrollHeight - window.innerHeight;
    if (progressEl) progressEl.style.width = ((sy / total) * 100).toFixed(1) + '%';
    if (backTop)    backTop.classList.toggle('visible', sy > 400);

    // Nav active
    sections.forEach(s => {
      const lk = navLinks.find(a => a.getAttribute('href') === '#' + s.id);
      if (lk) lk.classList.toggle('active',
        sy >= s.offsetTop - 140 && sy < s.offsetTop + s.offsetHeight - 140);
    });
  });

  let scrollDirty = false;
  window.addEventListener('scroll', () => { scrollDirty = true; }, {passive: true});
}

// ============================================================
// 6. INTERSECTION OBSERVER — reveal animations
// ============================================================
function initReveal() {
  const revealOpts = { threshold: 0.07, rootMargin: '0px 0px -20px 0px' };
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      // Delay from class
      const delayMap = {d1:0,d2:70,d3:140,d4:210,d5:280,d6:350};
      let delay = 0;
      for (const [cls, ms] of Object.entries(delayMap)) {
        if (el.classList.contains(cls)) { delay = ms; break; }
      }
      setTimeout(() => el.classList.add('vis'), delay);
      revealIO.unobserve(el);
    });
  }, revealOpts);

  document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale').forEach(el => {
    if (!el.closest('#hero')) revealIO.observe(el);
  });

  // Project cards stagger
  const projIO = new IntersectionObserver(entries => {
    let delay = 0;
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      setTimeout(() => e.target.classList.add('vis'), delay);
      delay += 70;
      projIO.unobserve(e.target);
    });
  }, {threshold: 0.06});
  document.querySelectorAll('.proj-card').forEach(el => projIO.observe(el));

  // Skill bars — trigger once
  const skillIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.querySelectorAll('.skill-bar-fill,.lang-bar-fill').forEach(b => {
        b.style.width = b.dataset.w + '%';
      });
      skillIO.unobserve(e.target);
    });
  }, {threshold: 0.2});
  const sk = document.getElementById('skills');
  if (sk) skillIO.observe(sk);
}

// ============================================================
// 7. TYPING ANIMATION
// ============================================================
function initTyping() {
  const el = document.getElementById('typing-role');
  if (!el) return;
  const roles = [
    'Sinh viên năm nhất · Kỹ thuật Máy tính',
    'Trường Đại học Công nghệ — ĐHQGHN',
    'Đam mê AI · Lập trình · Công nghệ số'
  ];
  let ri = 0, ci = 0, del = false;

  function tick() {
    const cur = roles[ri];
    if (del) { ci--; } else { ci++; }
    el.innerHTML = cur.slice(0, ci) + '<span class="typing-cursor"></span>';
    let wait = del ? 32 : 62;
    if (!del && ci === cur.length) { wait = 1700; del = true; }
    else if (del && ci === 0)      { del = false; ri = (ri + 1) % roles.length; wait = 260; }
    setTimeout(tick, wait);
  }
  tick();
}

// ============================================================
// 8. THEME TOGGLE
// ============================================================
function initTheme() {
  const html = document.documentElement;
  const btn  = document.getElementById('themeBtn');
  const txt  = document.getElementById('themeText');
  const icon = btn?.querySelector('.theme-icon');

  function update() {
    const dark = html.getAttribute('data-theme') === 'dark';
    if (icon) icon.textContent = dark ? '🌙' : '☀️';
    if (txt)  txt.textContent  = dark ? 'Dark' : 'Light';
  }

  btn?.addEventListener('click', () => {
    html.setAttribute('data-theme',
      html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    update();
  });
  update();
}

// ============================================================
// 9. TILT CARDS — rAF throttled, desktop only
// ============================================================
function initTilt() {
  if (IS_MOBILE) return;

  document.querySelectorAll('.proj-card,.sum-card').forEach(card => {
    if (!card.querySelector('.tilt-shine')) {
      const shine = document.createElement('div');
      shine.className = 'tilt-shine';
      card.appendChild(shine);
    }

    let pending = null;
    card.addEventListener('mousemove', e => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = null;
        const r  = card.getBoundingClientRect();
        const x  = e.clientX - r.left, y = e.clientY - r.top;
        const rx = ((y - r.height/2) / r.height) * -3;
        const ry = ((x - r.width/2)  / r.width)  *  3;
        card.style.transform    = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.018) translateZ(0)`;
        card.style.transition   = 'transform 0.06s linear';
        const sh = card.querySelector('.tilt-shine');
        if (sh) { sh.style.setProperty('--mx', (x/r.width*100)+'%'); sh.style.setProperty('--my', (y/r.height*100)+'%'); }
      });
    }, {passive: true});

    card.addEventListener('mouseleave', () => {
      if (pending) { cancelAnimationFrame(pending); pending = null; }
      card.style.transform  = 'perspective(900px) rotateX(0) rotateY(0) scale(1) translateZ(0)';
      card.style.transition = 'transform 0.45s cubic-bezier(0.23,1,0.32,1)';
    });
  });
}

// ============================================================
// 10. MAGNETIC BUTTONS — desktop only
// ============================================================
function initMagnetic() {
  if (IS_MOBILE) return;
  document.querySelectorAll('.cib,#back-to-top,.theme-btn,.preview-modal-close,.theory-modal-close,.contact-modal-close').forEach(el => {
    let raf = null;
    el.addEventListener('mousemove', e => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const r  = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width/2);
        const dy = e.clientY - (r.top  + r.height/2);
        el.style.transform = `translate(${dx*0.35}px,${dy*0.35}px) scale(1.1) translateZ(0)`;
      });
    }, {passive: true});
    el.addEventListener('mouseleave', () => {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      el.style.transition = 'transform 0.5s cubic-bezier(0.23,1,0.32,1)';
      el.style.transform  = 'translate(0,0) scale(1) translateZ(0)';
      setTimeout(() => { el.style.transition = ''; }, 500);
    });
    el.addEventListener('mouseenter', () => { el.style.transition = ''; });
  });
}

// ============================================================
// 11. SMOOTH NAV ANCHOR SCROLL
// ============================================================
function initNavScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href === '#' || !href.startsWith('#')) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({behavior: 'smooth', block: 'start'});
    });
  });
  document.getElementById('back-to-top')?.addEventListener('click', () => {
    window.scrollTo({top: 0, behavior: 'smooth'});
  });
}

// ============================================================
// 12. INTRO SCREEN
// ============================================================
function runIntro() {
  document.body.style.overflow = 'hidden';

  // Fallback: nếu sau 4 giây window.load chưa fire (CDN chậm), vẫn ẩn preloader
  const preloaderFallback = setTimeout(() => {
    const p = document.getElementById('preloader');
    if (p && !p.classList.contains('loaded')) p.classList.add('loaded');
  }, 4000);

  window.addEventListener('load', () => {
    clearTimeout(preloaderFallback);
    const p = document.getElementById('preloader');
    if (p) p.classList.add('loaded');

    setTimeout(() => {
      document.getElementById('intro')?.classList.add('gone');
      document.body.style.overflow = '';

      // Hero lines
      setTimeout(() => {
        document.querySelector('.hero-eyebrow')?.classList.add('vis');
        document.querySelector('.hero-greeting')?.classList.add('vis');
      }, 80);
      document.querySelectorAll('.hero-name .word').forEach((w, i) => {
        setTimeout(() => w.classList.add('vis'), 180 + i * 110);
      });
      document.querySelectorAll('#hero .reveal,#hero .reveal-scale').forEach((el, i) => {
        setTimeout(() => el.classList.add('vis'), 320 + i * 80);
      });
      const heroR = document.querySelector('#hero .reveal-right');
      if (heroR) setTimeout(() => heroR.classList.add('vis'), 180);

      // Start everything
      masterLoop(0);
      initTyping();
      initDataStream();
      initParticles();
      initScrollHandlers();
      initReveal();
    }, 1600);
  }, {once: true});
}

// ============================================================
// 13. COPY EMAIL + TOAST
// ============================================================
function copyEmail(e) {
  if (e) e.preventDefault();
  navigator.clipboard.writeText('quangnguyen301007@gmail.com').then(() => {
    showToast('✅ Đã sao chép email!');
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ============================================================
// 14. MODALS — preview + theory + contact
// ============================================================


const REPORT_FILES = [
  { 
    id: 'https://raw.githubusercontent.com/quangnguyen07-pr/portfolio/main/files/Bai%201.pdf', 
    title: 'Máy tính & Thiết bị ngoại vi',
    outline: [
      { title: '1. Mở File Explorer', page: 1 },
      { title: '2. Truy cập ổ đĩa/thư mục', page: 1 },
      { title: '3. Tạo thư mục mới', page: 2 },
      { title: '4. Vào thư mục vừa tạo', page: 3 },
      { title: '5. Tạo tệp tin văn bản', page: 3 },
      { title: '6. Đổi tên tệp tin', page: 4 },
      { title: '7. Tạo thư mục con', page: 4 },
      { title: '8. Sao chép tệp tin (Copy & Paste)', page: 4 },
      { title: '9. Di chuyển tệp tin (Cut & Paste)', page: 5 },
      { title: '10. Xóa tệp tin', page: 6 },
      { title: '11. Xóa vĩnh viễn', page: 6 },
      { title: '12. Khôi phục từ Thùng rác (Tùy chọn)', page: 7 }
    ]
  },
  { 
    id: 'https://raw.githubusercontent.com/quangnguyen07-pr/portfolio/main/files/Bai%202.pdf', 
    title: 'Khai thác & Đánh giá Thông tin',
    outline: [
      { title: 'I. GIỚI THIỆU VÀ LÝ DO CHỌN CHỦ ĐỀ', page: 1 },
      { title: 'II. PHƯƠNG PHÁP VÀ KẾT QUẢ TÌM KIẾM THÔNG TIN', page: 1 },
      { title: 'III. ĐÁNH GIÁ ĐỘ TIN CẬY CÁC NGUỒN THÔNG TIN', page: 2 },
      { title: 'IV. BẢNG TỔNG HỢP CÁC NGUỒN THÔNG TIN', page: 2 },
      { title: 'V. KẾT LUẬN', page: 3 }
    ]
  },
  { 
    id: 'https://raw.githubusercontent.com/quangnguyen07-pr/portfolio/main/files/Bai%203.pdf', 
    title: 'Tổng quan về Trí tuệ Nhân tạo',
    outline: [
      { title: 'I. PHÂN TÍCH TÁC VỤ HỌC TẬP', page: 1 },
      { title: 'II. CÁC PHIÊN BẢN PROMPT VÀ SO SÁNH KẾT QUẢ', page: 1 },
      { title: 'III. PHÂN TÍCH HIỆU QUẢ CÁC PHIÊN BẢN PROMPT', page: 3 },
      { title: 'IV. TỔNG HỢP NGUYÊN TẮC VIẾT PROMPT HIỆU QUẢ', page: 3 },
      { title: '1. Chỉ định Ai - Cho Ai - Làm Gì - Theo Cách Nào', page: 4 },
      { title: '2. Chia nhỏ nhiệm vụ phức tạp thành bước tuần tự', page: 4 },
      { title: '3. Đặt ràng buộc đầu ra', page: 4 },
      { title: '4. Dùng role prompting cho tác vụ đòi hỏi chuyên môn', page: 4 },
      { title: '5. Lặp và tinh chỉnh', page: 4 }
    ]
  },
  { 
    id: 'https://raw.githubusercontent.com/quangnguyen07-pr/portfolio/main/files/Bai%204.pdf', 
    title: 'Giao tiếp & Hợp tác Số',
    outline: [
      { title: 'I. GIỚI THIỆU', page: 1 },
      { title: 'II. CÔNG CỤ SỬ DỤNG VÀ KẾT QUẢ HOẠT ĐỘNG', page: 1 },
      { title: 'III. ẢNH MINH CHỨNG', page: 2 },
      { title: 'IV. THÁCH THỨC VÀ GIẢI PHÁP', page: 5 },
      { title: 'V. TỰ ĐÁNH GIÁ THEO RUBRIC', page: 6 }
    ]
  },
  { 
    id: 'https://raw.githubusercontent.com/quangnguyen07-pr/portfolio/main/files/Bai%205.pdf', 
    title: 'Sáng tạo Nội dung Số',
    outline: [
      { title: 'I. GIỚI THIỆU DỰ ÁN', page: 2 },
      { title: 'II. QUÁ TRÌNH SỬ DỤNG CÔNG CỤ AI', page: 2 },
      { title: '1. Claude - AI tạo văn bản', page: 2 },
      { title: '2. DALL-E 3 - AI tạo hình ảnh', page: 3 },
      { title: '3. Canva AI - AI hỗ trợ thiết kế', page: 3 },
      { title: 'III. SO SÁNH VÀ PHÂN TÍCH CÁC CÔNG CỤ AI', page: 5 },
      { title: 'IV. PHÂN TÍCH VAI TRÒ AI VÀ VẤN ĐỀ ĐẠO ĐỨC', page: 5 },
      { title: 'V. KẾT LUẬN', page: 5 }
    ]
  },
  { 
    id: 'https://raw.githubusercontent.com/quangnguyen07-pr/portfolio/main/files/Bai%206.pdf', 
    title: 'An toàn & Liêm chính Học thuật',
    outline: [
      { title: 'I. CHÍNH SÁCH CỦA TRƯỜNG VỀ SỬ DỤNG AI', page: 2 },
      { title: 'II. THỰC HIỆN NHIỆM VỤ HỌC TẬP VỚI AI', page: 2 },
      { title: 'III. PHÂN TÍCH CÁC VẤN ĐỀ ĐẠO ĐỨC', page: 3 },
      { title: 'IV. BỘ 7 NGUYÊN TẮC CÁ NHÂN SỬ DỤNG AI CÓ TRÁCH NHIỆM', page: 3 },
      { title: 'V. INFOGRAPHIC: SỬ DỤNG AI CÓ TRÁCH NHIỆM TRONG HỌC THUẬT', page: 4 },
      { title: 'VI. KẾT LUẬN', page: 4 }
    ]
  },
  { 
    id: 'https://raw.githubusercontent.com/quangnguyen07-pr/portfolio/main/files/Bai%207.pdf', 
    title: 'AI trong Khoa hoc & Ky thuat',
    outline: [
      { title: 'I. CHỦ ĐỀ VÀ CÂU HỎI NGHIÊN CỨU', page: 2 },
      { title: 'II. PHƯƠNG PHÁP TÌM KIẾM VÀ LỰA CHỌN TÀI LIỆU', page: 2 },
      { title: 'III. NHẬN XÉT TỔNG HỢP', page: 2 },
      { title: '1. Xu hướng chung', page: 2 },
      { title: '2. Điểm mạnh và hạn chế', page: 2 },
      { title: '3. Khoảng trống nghiên cứu', page: 2 },
      { title: 'IV. BẢNG SO SÁNH 5 BÀI BÁO KHOA HỌC', page: 3 }
    ]
  },
];

let currentIdx = 0;

function openTheory(id) {
  const m = document.getElementById('theory-modal-' + id.replace('theory-',''));
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeTheory(id) {
  const m = document.getElementById('theory-modal-' + id.replace('theory-',''));
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}
function openContactModal() {
  document.getElementById('contactModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeContactModal() {
  document.getElementById('contactModal').classList.remove('open');
  document.body.style.overflow = '';
}

// Global ESC + overlay click handlers
document.addEventListener('keydown', e => {
  // Arrow keys để chuyển báo cáo khi preview modal đang mở
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if (document.getElementById('previewModal')?.classList.contains('open')) {
      e.preventDefault();
      navigateReport(e.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
  }
  if (e.key !== 'Escape') return;
  closePreview();
  document.querySelectorAll('.theory-modal.open').forEach(m => {
    m.classList.remove('open');
    document.body.style.overflow = '';
  });
  closeContactModal();
});

document.getElementById('previewModal')?.addEventListener('click', e => {
  if (e.target.classList.contains('preview-modal-overlay')) closePreview();
});
document.getElementById('contactModal')?.addEventListener('click', e => {
  if (e.target.id === 'contactModal' || e.target.classList.contains('contact-modal-overlay')) closeContactModal();
});

// ============================================================
// 15. SPRING BUTTONS — simple CSS class
// ============================================================
function initSpringButtons() {
  document.querySelectorAll('.doc-btn,.cta-btn,.contact-modal-btn').forEach(el => {
    el.classList.add('spring-btn');
  });
}

// ============================================================
// 16. MOBILE TOUCH FEEDBACK
// ============================================================
function initTouchFeedback() {
  if (!IS_MOBILE) return;
  document.querySelectorAll('.proj-card,.contact-card,.skill-item').forEach(el => {
    el.addEventListener('touchstart', () => {
      el.style.transform = 'scale(0.97) translateZ(0)';
    }, {passive: true});
    el.addEventListener('touchend', () => {
      el.style.transform = '';
    }, {passive: true});
  });
}

// ============================================================
// START
// ============================================================
initTheme();
initNavScroll();
initMagnetic();
initTilt();
initSpringButtons();
initTouchFeedback();
runIntro(); // kicks off masterLoop after intro

// Khởi tạo sau khi DOM sẵn sàng — chạy đúng 1 lần
var _extraInitDone = false;
function _runExtraInits() {
  if (_extraInitDone) return;
  _extraInitDone = true;
  initControlCenter();
  initContactForm();
  initAudioSFX();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _runExtraInits);
} else {
  _runExtraInits();
}

// ============================================================
// ENHANCED PDF VIEWER — PDF.js Integration (overrides)
// ============================================================
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

var pdfDoc_ = null, pdfScale_ = 1.0, pdfPageCount_ = 0;
var pdfCache_ = new Map();
var pvPageObs_ = null;

// Rebuild modal with enhanced UI
(function() {
  var m = document.getElementById('previewModal');
  if (!m) return;
  m.innerHTML =
    '<div class="preview-modal-overlay" onclick="closePreview()"></div>' +
    '<div class="pv-content" >' +
    '  <div class="pv-header">' +
    '    <button class="pv-nav" id="pvPrev" onclick="navigateReport(-1)" title="Báo cáo trước">\u2190</button>' +
    '    <div class="pv-header-center">' +
    '      <div class="pv-title" id="pvTitle">Xem trước tài liệu</div>' +
    '      <div class="pv-counter" id="pvCounter">1 / 7</div>' +
    '    </div>' +
    '    <button class="pv-nav" id="pvNext" onclick="navigateReport(1)" title="Báo cáo tiếp">\u2192</button>' +
    '    <div class="pv-actions">' +
    '      <a id="pvOpenLink" href="" target="_blank" class="pv-act" title="Mở trong Google Docs (Tab mới)">' +
    '        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
    '      </a>' +
    '      <div style="width:1px;height:18px;background:var(--border2);margin:0 4px;"></div>' +
    '      <a id="pvDlLink" href="" class="pv-act" title="Tải file PDF" download>' +
    '        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
    '      </a>' +
    '      <div style="width:1px;height:18px;background:var(--border2);margin:0 4px;"></div>' +
    '      <button class="pv-close" onclick="closePreview()" title="Đóng (Esc)">\u2715</button>' +
    '    </div>' +
    '  </div>' +
    '  <div class="pv-body" id="pvBody">' +
    '    <div class="pv-sidebar" id="pvSidebar">' +
    '      <div class="pv-sidebar-header">' +
    '        <div class="pv-sidebar-title">\u2630 Mục lục</div>' +
    '        <button class="pv-sidebar-close" onclick="togglePvSidebar()" title="Đóng mục lục">\u2715</button>' +
    '      </div>' +
    '      <div class="pv-search-container">' +
    '        <input type="text" id="pvSearchInput" class="pv-search-input" placeholder="🔍 Tìm trong tài liệu...">' +
    '        <div class="pv-search-results" id="pvSearchResults"></div>' +
    '      </div>' +
    '      <div class="pv-outline-list" id="pvOutline"></div>' +
    '    </div>' +
    '    <div class="pv-main" id="pvMain">' +
    '      <button class="pv-toggle-sidebar" onclick="togglePvSidebar()" title="Mở mục lục" id="pvToggleSb">\u2630</button>' +
    '      <button class="pv-page-btn pv-page-prev" onclick="scrollPdfPage(-1)" id="pvBtnPrevPage" style="display:none;" title="Trang trước">‹</button>' +
    '      <button class="pv-page-btn pv-page-next" onclick="scrollPdfPage(1)" id="pvBtnNextPage" style="display:none;" title="Trang sau">›</button>' +
    '      <div class="pv-loading" id="pvLoading">' +
    '        <div class="pv-loading-inner">' +
    '          <div class="pv-spinner"></div>' +
    '          <span class="pv-load-text" id="pvLoadText">Đang tải tài liệu...</span>' +
    '          <div class="pv-progress"><div class="pv-progress-fill" id="pvProgressFill"></div></div>' +
    '        </div>' +
    '      </div>' +
    '      <div class="pv-scroll" id="pvScroll"></div>' +
    '      <div class="pv-error pv-hidden" id="pvError">' +
    '        <span style="font-size:2.5rem">\uD83D\uDCC4</span>' +
    '        <p>Không thể tải tài liệu</p>' +
    '        <button onclick="retryPreview()">\uD83D\uDD04 Thử lại</button>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="pv-toolbar">' +
    '    <div class="pv-zoom">' +
    '      <button class="pv-zoom-btn" onclick="zoomPdf(-0.2)" title="Thu nhỏ (Ctrl -)">&minus;</button>' +
    '      <span class="pv-zoom-lv" id="pvZoom">100%</span>' +
    '      <button class="pv-zoom-btn" onclick="zoomPdf(0.2)" title="Phóng to (Ctrl +)">+</button>' +
    '      <button class="pv-zoom-btn" onclick="fitPdf()" title="Vừa trang (Ctrl 0)" style="font-size:0.7rem">\u229E</button>' +
    '    </div>' +
    '    <div class="pv-page-info" id="pvPageInfo"></div>' +
    '    <div class="pv-dots" id="pvDots"></div>' +
    '  </div>' +
    '</div>';
})();

// --- Override preview functions ---
function openPreview(fileId, title) {
  var modal = document.getElementById('previewModal');
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(function() {
    requestAnimationFrame(function() { loadPreviewFile(fileId, title); });
  });
}

async function loadPreviewFile(fileId, title, idx, direction) {
  currentIdx = (idx !== undefined) ? idx : REPORT_FILES.findIndex(function(f){ return f.id === fileId; });
  if (currentIdx < 0) currentIdx = 0;
  var file = REPORT_FILES[currentIdx];
  var url = fileId || file.id;
  var ttl = title || file.title;

  // Update header
  var pvTitle = document.getElementById('pvTitle');
  var pvCounter = document.getElementById('pvCounter');
  if (pvTitle) pvTitle.textContent = ttl;
  if (pvCounter) pvCounter.textContent = (currentIdx + 1) + ' / ' + REPORT_FILES.length;

  // Update links
  var ol = document.getElementById('pvOpenLink');
  var dl = document.getElementById('pvDlLink');
  if (ol) ol.href = 'https://docs.google.com/viewer?url=' + encodeURIComponent(decodeURIComponent(url));
  if (dl) dl.href = url;

  // Update nav buttons
  var prev = document.getElementById('pvPrev');
  var next = document.getElementById('pvNext');
  if (prev) prev.disabled = (currentIdx === 0);
  if (next) next.disabled = (currentIdx === REPORT_FILES.length - 1);

  // Dots
  var dotsEl = document.getElementById('pvDots');
  if (dotsEl) {
    dotsEl.innerHTML = REPORT_FILES.map(function(f, i) {
      return '<button class="pv-dot' + (i === currentIdx ? ' active' : '') +
        '" onclick="loadPreviewFile(\'' + f.id + '\',\'' + f.title.replace(/'/g, "\\'") + '\',' + i + ')" title="' + f.title + '"></button>';
    }).join('');
  }

  var loading = document.getElementById('pvLoading');
  var error = document.getElementById('pvError');
  var scroll = document.getElementById('pvScroll');
  var progressFill = document.getElementById('pvProgressFill');
  var loadText = document.getElementById('pvLoadText');

  if (loading) loading.classList.remove('pv-hidden');
  if (error) error.classList.add('pv-hidden');
  if (progressFill) progressFill.style.width = '0%';
  if (loadText) loadText.textContent = 'Đang tải tài liệu...';

  // Reset search
  var searchInput = document.getElementById('pvSearchInput');
  var searchResults = document.getElementById('pvSearchResults');
  if (searchInput) searchInput.value = '';
  if (searchResults) searchResults.innerHTML = '';
  var olContainer = document.getElementById('pvOutline');
  if (olContainer) olContainer.style.display = 'block';

  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = "true";
    searchInput.addEventListener('input', function(e) {
      var q = e.target.value.toLowerCase().trim();
      var resultsEl = document.getElementById('pvSearchResults');
      var olContainer = document.getElementById('pvOutline');
      
      if (searchInput.dataset.timer) {
        clearTimeout(parseInt(searchInput.dataset.timer));
      }
      
      if (q.length < 2) {
        if (olContainer) olContainer.style.display = 'block';
        if (resultsEl) resultsEl.innerHTML = '';
        return;
      }
      if (olContainer) olContainer.style.display = 'none';
      if (resultsEl) resultsEl.innerHTML = '<div class="pv-search-empty">Đang tìm kiếm...</div>';
      
      var searchTimeout = setTimeout(async function() {
        if (!pdfDoc_) return;
        var matches = [];
        for (var pg = 1; pg <= pdfPageCount_; pg++) {
          try {
            var page = await pdfDoc_.getPage(pg);
            var tc = await page.getTextContent();
            var text = tc.items.map(function(item){ return item.str; }).join(' ');
            var idx = text.toLowerCase().indexOf(q);
            if (idx !== -1) {
              var start = Math.max(0, idx - 16);
              var end = Math.min(text.length, idx + q.length + 24);
              var snippet = text.substring(start, end).replace(/\s+/g, ' ');
              var regex = new RegExp('(' + q.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + ')', 'gi');
              var highlightedSnippet = snippet.replace(regex, '<mark>$1</mark>');
              matches.push({
                page: pg,
                snippet: '...' + highlightedSnippet + '...'
              });
            }
          } catch(err){}
        }
        
        if (searchInput.value.toLowerCase().trim() !== q) return;
        
        if (matches.length === 0) {
          if (resultsEl) resultsEl.innerHTML = '<div class="pv-search-empty">Không có kết quả</div>';
        } else {
          if (resultsEl) {
            resultsEl.innerHTML = matches.map(function(m) {
              return '<button class="pv-search-item" onclick="jumpToPageAndHighlight(' + m.page + ')">' +
                '<strong>Trang ' + m.page + '</strong><br>' + m.snippet +
                '</button>';
            }).join('');
          }
        }
      }, 250);
      
      searchInput.dataset.timer = searchTimeout;
    });
  }

  // Slide animation
  if (scroll) {
    scroll.className = 'pv-scroll ' + (direction ? (direction > 0 ? 'pv-slide-in' : 'pv-slide-in-rev') : 'pv-slide-in');
    scroll.innerHTML = '';
    scroll.style.padding = '';
  }

  pdfDoc_ = null;
  pdfPageCount_ = 0;
  pvUpdatePageInfo_();

  var sb = document.getElementById('pvSidebar');
  var olContainer = document.getElementById('pvOutline');
  if (sb) sb.classList.remove('active');
  if (olContainer) olContainer.innerHTML = '';
  
  var btnP = document.getElementById('pvBtnPrevPage');
  var btnN = document.getElementById('pvBtnNextPage');
  if (btnP) btnP.style.display = 'none';
  if (btnN) btnN.style.display = 'none';

  // Fallback: Google Docs Viewer if PDF.js not loaded
  if (typeof pdfjsLib === 'undefined') {
    var encodedUrl = encodeURIComponent(url);
    var viewerUrl = 'https://docs.google.com/viewer?embedded=true&url=' + encodedUrl;
    if (scroll) {
      scroll.innerHTML = '<iframe src="' + viewerUrl + '" allowfullscreen></iframe>';
      scroll.style.padding = '0';
    }
    if (loading) loading.classList.add('pv-hidden');
    return;
  }

  try {
    // Check cache
    if (pdfCache_.has(url)) {
      pdfDoc_ = pdfCache_.get(url);
    } else {
      var task = pdfjsLib.getDocument({
        url: url,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true,
      });
      task.onProgress = function(p) {
        if (p.total > 0 && progressFill) {
          var pct = Math.round((p.loaded / p.total) * 100);
          progressFill.style.width = pct + '%';
          if (loadText) loadText.textContent = 'Đang tải... ' + pct + '%';
        }
      };
      pdfDoc_ = await task.promise;
      pdfCache_.set(url, pdfDoc_);
    }

    pdfPageCount_ = pdfDoc_.numPages;
    if (loadText) loadText.textContent = 'Đang render trang...';
    if (progressFill) progressFill.style.width = '100%';

    // Auto-fit width
    var p1 = await pdfDoc_.getPage(1);
    var vp = p1.getViewport({ scale: 1 });
    var cw = (scroll ? scroll.clientWidth : 800) - 48;
    pdfScale_ = Math.min(Math.max(cw / vp.width, 0.35), 2.5);
    pvUpdateZoom_();

    await pvRenderAll_(scroll);
    pvSetupObs_(scroll);
    
    // Build sidebar: use hardcoded outline or fallback
    if (sb && olContainer) {
      if (file.outline && file.outline.length > 0) {
        file.outline.forEach(function(item) {
          var isHeading = item.title.match(/^(I|II|III|IV|V|DANH SÁCH)\b/);
          var el = document.createElement('a');
          el.className = 'pv-outline-item' + (isHeading ? ' pv-outline-heading' : '');
          el.dataset.page = item.page;
          el.innerHTML = '<span class="pv-oi-icon">' + (isHeading ? '\u{1F4D6}' : '\u{1F4C4}') + '</span>' + item.title + '<span class="pv-oi-page">' + item.page + '</span>';
          el.title = item.title;
          el.onclick = function(e) {
            e.preventDefault();
            var target = document.querySelector('#pvScroll .pv-page[data-page="' + item.page + '"]');
            if (!target) return;
            
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            if (pdfDoc_) {
              pdfDoc_.getPage(item.page).then(function(p) {
                return p.getTextContent().then(function(tc) {
                  if (!tc.items) return;
                  var cleanTitle = item.title.replace(/^[ivxlcdm0-9]+\.\s*/i, '').toLowerCase().trim();
                  var searchStr = cleanTitle.substring(0, 30);
                  var matchY = -1;
                  for (var k = 0; k < tc.items.length; k++) {
                    var str = tc.items[k].str.toLowerCase().trim();
                    if (str && (str.includes(searchStr) || searchStr.includes(str))) {
                      matchY = tc.items[k].transform[5];
                      break;
                    }
                  }
                  if (matchY !== -1) {
                    var vp = p.getViewport({ scale: pdfScale_ || 1 });
                    var yFromTop = vp.height - (matchY * (pdfScale_ || 1));
                    var scrollContainer = document.getElementById('pvScroll');
                    setTimeout(function() {
                      scrollContainer.scrollTo({
                        top: target.offsetTop + yFromTop - 80,
                        behavior: 'smooth'
                      });
                    }, 50);
                  }
                });
              }).catch(function(){});
            }
          };
          olContainer.appendChild(el);
        });
      } else {
        // Fallback: simple page list
        for (var pg = 1; pg <= pdfPageCount_; pg++) {
          (function(pageNum) {
            var el = document.createElement('a');
            el.className = 'pv-outline-item';
            el.dataset.page = pageNum;
            el.innerHTML = '<span class="pv-oi-icon">\u{1F4C3}</span>Trang ' + pageNum + '<span class="pv-oi-page">' + pageNum + '</span>';
            el.title = 'Đi tới trang ' + pageNum;
            el.onclick = function(e) {
              e.preventDefault();
              var target = document.querySelector('#pvScroll .pv-page[data-page="' + pageNum + '"]');
              if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };
            olContainer.appendChild(el);
          })(pg);
        }
      }
      sb.classList.add('active');
    }

    if (btnP && pdfPageCount_ > 1) btnP.style.display = 'flex';
    if (btnN && pdfPageCount_ > 1) btnN.style.display = 'flex';

    if (loading) loading.classList.add('pv-hidden');
    pvPreloadAdj_();

  } catch (err) {
    console.error('PDF load error:', err);
    if (loading) loading.classList.add('pv-hidden');
    if (error) error.classList.remove('pv-hidden');
  }
}

async function pvRenderAll_(container) {
  if (!pdfDoc_ || !container) return;
  container.innerHTML = '';
  var dpr = window.devicePixelRatio || 1;

  var firstPage = await pdfDoc_.getPage(1);
  var dvp1 = firstPage.getViewport({ scale: pdfScale_ });

  if (window.pvRenderObs_) window.pvRenderObs_.disconnect();
  window.pvRenderObs_ = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        var wrap = e.target;
        if (wrap.dataset.rendered) return;
        wrap.dataset.rendered = "true";
        var pg = parseInt(wrap.dataset.page);
        var canvas = wrap.querySelector('canvas');
        pdfDoc_.getPage(pg).then(function(page) {
          var vpx = page.getViewport({ scale: pdfScale_ * dpr });
          var dvpx = page.getViewport({ scale: pdfScale_ });
          canvas.width = vpx.width;
          canvas.height = vpx.height;
          canvas.style.width = dvpx.width + 'px';
          canvas.style.height = dvpx.height + 'px';
          wrap.style.width = dvpx.width + 'px';
          wrap.style.height = dvpx.height + 'px';
          wrap.style.background = '#fff';
          page.render({ canvasContext: canvas.getContext('2d'), viewport: vpx });
        }).catch(function(err){ console.warn(err); });
      }
    });
  }, { root: container, rootMargin: '100% 0px' });

  for (var i = 1; i <= pdfDoc_.numPages; i++) {
    var wrap = document.createElement('div');
    wrap.className = 'pv-page';
    wrap.dataset.page = i;
    wrap.style.width = dvp1.width + 'px';
    wrap.style.height = dvp1.height + 'px';
    wrap.style.background = '#f8f9fc';
    var canvas = document.createElement('canvas');
    canvas.style.width = dvp1.width + 'px';
    canvas.style.height = dvp1.height + 'px';
    var num = document.createElement('div');
    num.className = 'pv-page-num';
    num.textContent = i + ' / ' + pdfDoc_.numPages;
    wrap.appendChild(canvas);
    wrap.appendChild(num);
    container.appendChild(wrap);

    if (i === 1) {
      wrap.dataset.rendered = "true";
      var vp1 = firstPage.getViewport({ scale: pdfScale_ * dpr });
      canvas.width = vp1.width;
      canvas.height = vp1.height;
      wrap.style.background = '#fff';
      firstPage.render({ canvasContext: canvas.getContext('2d'), viewport: vp1 });
    } else {
      window.pvRenderObs_.observe(wrap);
    }
  }
}

function pvSetupObs_(container) {
  if (pvPageObs_) pvPageObs_.disconnect();
  if (!container) return;
  pvPageObs_ = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting && e.intersectionRatio > 0.2) {
        var pg = parseInt(e.target.dataset.page);
        pvUpdatePageInfo_(pg);
        pvHighlightSidebarItem_(pg);
      }
    });
  }, { root: container, threshold: [0.2, 0.5] });
  container.querySelectorAll('.pv-page').forEach(function(p) { pvPageObs_.observe(p); });
  pvUpdatePageInfo_(1);
  pvHighlightSidebarItem_(1);
}

function pvHighlightSidebarItem_(pageNum) {
  var items = document.querySelectorAll('#pvOutline .pv-outline-item');
  items.forEach(function(el) { el.classList.remove('active'); });
  var target = document.querySelector('#pvOutline .pv-outline-item[data-page="' + pageNum + '"]');
  if (target) {
    target.classList.add('active');
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function togglePvSidebar() {
  var sb = document.getElementById('pvSidebar');
  if (sb) sb.classList.toggle('active');
}

function pvUpdatePageInfo_(p) {
  var el = document.getElementById('pvPageInfo');
  if (el) el.textContent = pdfPageCount_ > 0 ? ('Trang ' + (p || 1) + ' / ' + pdfPageCount_) : '';
}

function pvUpdateZoom_() {
  var el = document.getElementById('pvZoom');
  if (el) el.textContent = Math.round(pdfScale_ * 100) + '%';
}

async function zoomPdf(delta) {
  var ns = Math.max(0.3, Math.min(3.5, pdfScale_ + delta));
  if (Math.abs(ns - pdfScale_) < 0.01) return;
  pdfScale_ = ns;
  pvUpdateZoom_();
  var sc = document.getElementById('pvScroll');
  if (!sc || !pdfDoc_) return;
  var ratio = sc.scrollTop / Math.max(sc.scrollHeight - sc.clientHeight, 1);
  await pvRenderAll_(sc);
  pvSetupObs_(sc);
  requestAnimationFrame(function() { sc.scrollTop = ratio * (sc.scrollHeight - sc.clientHeight); });
}

async function fitPdf() {
  if (!pdfDoc_) return;
  var sc = document.getElementById('pvScroll');
  if (!sc) return;
  var p1 = await pdfDoc_.getPage(1);
  var vp = p1.getViewport({ scale: 1 });
  pdfScale_ = Math.min((sc.clientWidth - 48) / vp.width, 2.5);
  pvUpdateZoom_();
  await pvRenderAll_(sc);
  pvSetupObs_(sc);
  sc.scrollTop = 0;
}

function retryPreview() {
  var f = REPORT_FILES[currentIdx];
  if (f) { pdfCache_.delete(f.id); loadPreviewFile(f.id, f.title, currentIdx); }
}

function pvPreloadAdj_() {
  function ld(i) {
    if (i < 0 || i >= REPORT_FILES.length) return;
    var u = REPORT_FILES[i].id;
    if (pdfCache_.has(u) || typeof pdfjsLib === 'undefined') return;
    pdfjsLib.getDocument({ url: u, cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/', cMapPacked: true })
      .promise.then(function(d) { pdfCache_.set(u, d); }).catch(function(){});
  }
  setTimeout(function() { ld(currentIdx - 1); ld(currentIdx + 1); }, 700);
}

function navigateReport(dir) {
  var n = currentIdx + dir;
  if (n < 0 || n >= REPORT_FILES.length) return;
  var f = REPORT_FILES[n];
  loadPreviewFile(f.id, f.title, n, dir);
}

function closePreview() {
  var modal = document.getElementById('previewModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  var sc = document.getElementById('pvScroll');
  if (sc) sc.innerHTML = '';
  if (pvPageObs_) pvPageObs_.disconnect();
  pdfDoc_ = null;
  pdfPageCount_ = 0;
}

// Navigation for Outline
async function navigateToDest(dest) {
  if (!pdfDoc_ || !dest) return;
  var destArray = typeof dest === 'string' ? await pdfDoc_.getDestination(dest) : dest;
  if (!destArray || !destArray[0]) return;
  try {
    var pageIndex = await pdfDoc_.getPageIndex(destArray[0]);
    var scroll = document.getElementById('pvScroll');
    if (!scroll) return;
    var pageEl = scroll.querySelector('.pv-page[data-page="' + (pageIndex + 1) + '"]');
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch(e) { console.warn('Navigation error:', e); }
}

// Scroll PDF Page
function scrollPdfPage(dir) {
  var scroll = document.getElementById('pvScroll');
  if (!scroll || pdfPageCount_ === 0) return;
  var pages = scroll.querySelectorAll('.pv-page');
  if (pages.length === 0) return;
  var currentIdx = 0;
  var minDiff = Infinity;
  var st = scroll.scrollTop;
  pages.forEach(function(p, i) {
    var diff = Math.abs(p.offsetTop - st - 16);
    if (diff < minDiff) { minDiff = diff; currentIdx = i; }
  });
  var targetIdx = Math.max(0, Math.min(pages.length - 1, currentIdx + dir));
  pages[targetIdx].scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Zoom keyboard shortcuts
document.addEventListener('keydown', function(e) {
  var pm = document.getElementById('previewModal');
  if (!pm || !pm.classList.contains('open')) return;
  if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
    e.preventDefault(); zoomPdf(0.2);
  } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
    e.preventDefault(); zoomPdf(-0.2);
  } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
    e.preventDefault(); fitPdf();
  }
});

// Control Center Initialization
function initControlCenter() {
  var btn = document.getElementById('settingsBtn');
  var drop = document.getElementById('settingsDropdown');
  if (!btn || !drop) return;

  // Toggle dropdown khi click nút
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    drop.classList.toggle('open');
    playClickSound(1400, 'sine', 0.04);
  });

  // Chặn click bên trong dropdown bubble lên document (quan trọng để checkbox hoạt động!)
  drop.addEventListener('click', function(e) {
    e.stopPropagation();
  });

  // Đóng dropdown khi click ra ngoài
  document.addEventListener('click', function(e) {
    if (!drop.contains(e.target) && e.target !== btn) {
      drop.classList.remove('open');
    }
  });

  var contrastToggle = document.getElementById('contrastToggle');
  var perfToggle = document.getElementById('performanceToggle');
  var soundToggle = document.getElementById('soundToggle');

  if (contrastToggle) {
    contrastToggle.addEventListener('change', function(e) {
      if (e.target.checked) {
        document.documentElement.classList.add('projector-mode');
      } else {
        document.documentElement.classList.remove('projector-mode');
      }
      showToast(e.target.checked ? '🖥️ Chế độ Trình chiếu đã bật' : '🖥️ Chế độ bình thường');
      playClickSound(1100, 'sine', 0.05);
    });
  }

  if (perfToggle) {
    perfToggle.addEventListener('change', function(e) {
      ENABLE_ANIMATIONS = !e.target.checked;
      var c1 = document.getElementById('data-stream-canvas');
      var c2 = document.getElementById('particle-canvas');
      if (c1) c1.style.display = e.target.checked ? 'none' : '';
      if (c2) c2.style.display = e.target.checked ? 'none' : '';
      showToast(e.target.checked ? '🔋 Hiệu ứng nền đã tắt' : '✨ Hiệu ứng nền đã bật');
      playClickSound(1100, 'sine', 0.05);
    });
  }

  if (soundToggle) {
    soundToggle.addEventListener('change', function(e) {
      PLAY_SOUNDS = e.target.checked;
      if (PLAY_SOUNDS) playClickSound(1100, 'sine', 0.05);
    });
  }
}

// Font Size Adjuster
var currentFontScale = 1.0;
window.changeFontSize = function(dir) {
  var btns = document.querySelectorAll('.fs-btn');
  btns.forEach(b => b.classList.remove('font-active'));
  
  if (dir === 0) {
    currentFontScale = 1.0;
    document.getElementById('fs-normal-btn')?.classList.add('font-active');
  } else {
    currentFontScale = Math.max(0.8, Math.min(1.3, currentFontScale + dir * 0.1));
    if (dir === 1) {
      btns[2].classList.add('font-active');
    } else {
      btns[0].classList.add('font-active');
    }
  }
  document.documentElement.style.fontSize = (currentFontScale * 100) + '%';
  playClickSound(1300, 'sine', 0.04);
};

// AJAX Contact Form Submission
function initContactForm() {
  var form = document.querySelector('.modern-form');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    playClickSound(900, 'triangle', 0.08);
    var submitBtn = form.querySelector('.submit-btn');
    var btnSpan = submitBtn?.querySelector('span');
    var origText = btnSpan ? btnSpan.textContent : 'Gửi Tin Nhắn';
    if (btnSpan) btnSpan.textContent = 'Đang gửi...';
    if (submitBtn) submitBtn.disabled = true;

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    }).then(function(res) {
      if (res.ok) {
        showToast('✅ Gửi tin nhắn thành công!');
        form.reset();
      } else {
        showToast('❌ Có lỗi xảy ra. Hãy thử lại!');
      }
    }).catch(function() {
      showToast('❌ Lỗi kết nối mạng!');
    }).finally(function() {
      if (btnSpan) btnSpan.textContent = origText;
      if (submitBtn) submitBtn.disabled = false;
    });
  });
}

// Micro-interaction Audio SFX Binding
function initAudioSFX() {
  document.querySelectorAll('a, button, .cib, .skill-item, .lang-item, .about-info-item, .proj-card, .ptheory-hd').forEach(el => {
    el.addEventListener('mouseenter', function() {
      playClickSound(2000, 'sine', 0.015);
    }, {passive: true});
    el.addEventListener('click', function() {
      playClickSound(1000, 'sine', 0.05);
    }, {passive: true});
  });
}

// PDF Search Page Navigation Jump
window.jumpToPageAndHighlight = function(pageNumber) {
  var target = document.querySelector('#pvScroll .pv-page[data-page="' + pageNumber + '"]');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.style.transition = 'box-shadow 0.3s, border-color 0.3s';
    target.style.boxShadow = '0 0 24px rgba(91,138,245,0.6)';
    target.style.borderColor = 'var(--accent)';
    setTimeout(function() {
      target.style.boxShadow = '';
      target.style.borderColor = '';
    }, 1500);
    playClickSound(1200, 'sine', 0.04);
  }
};

/* ===== PORTFOLIO EXTRAS (10/10 ACADEMIC & BONUS) ===== */

// 2. Radar Chart cho Kỹ năng (Chart.js) — Premium Edition
document.addEventListener('DOMContentLoaded', () => {
  const ctx = document.getElementById('skillsRadar');
  if(ctx && typeof Chart !== 'undefined') {
    Chart.defaults.color = '#8b9bb4';
    Chart.defaults.font.family = "'Be Vietnam Pro', sans-serif";

    // Tạo gradient fill cho vùng bên trong radar
    const canvasCtx = ctx.getContext('2d');
    const gradientFill = canvasCtx.createLinearGradient(0, 0, 0, 400);
    gradientFill.addColorStop(0,   'rgba(86,216,248,0.28)');
    gradientFill.addColorStop(0.5, 'rgba(91,138,245,0.20)');
    gradientFill.addColorStop(1,   'rgba(176,148,255,0.10)');

    new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Lập trình\n(Python/C++)', 'Trí tuệ\nNhân tạo', 'Phần cứng\n& Hệ thống', 'Giao tiếp\n& Nhóm', 'Nghiên cứu\n& Đánh giá', 'Sáng tạo\nNội dung Số'],
        datasets: [{
          label: 'Mức độ thông thạo',
          data: [85, 75, 90, 80, 85, 70],
          backgroundColor: gradientFill,
          borderColor: 'rgba(91,138,245,1)',
          borderWidth: 2.5,
          pointBackgroundColor: ['#5b8af5','#56d8f8','#b094ff','#5b8af5','#56d8f8','#b094ff'],
          pointBorderColor: 'rgba(5,7,15,0.8)',
          pointBorderWidth: 2,
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#5b8af5',
          pointHoverBorderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 9,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1200, easing: 'easeInOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(13,17,32,0.95)',
            titleColor: '#5b8af5',
            bodyColor: '#f0f4ff',
            titleFont: { size: 12, family: "'Be Vietnam Pro', sans-serif", weight: '700' },
            bodyFont: { size: 14, weight: 'bold', family: "'Be Vietnam Pro', sans-serif" },
            padding: 12,
            cornerRadius: 10,
            borderColor: 'rgba(91,138,245,0.4)',
            borderWidth: 1,
            callbacks: {
              label: ctx => `  ${ctx.raw}%`
            }
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            min: 0,
            max: 100,
            angleLines: {
              color: 'rgba(91,138,245,0.15)',
              lineWidth: 1
            },
            grid: {
              color: ctx => ctx.index === 0
                ? 'transparent'
                : 'rgba(91,138,245,0.12)',
              lineWidth: 1
            },
            pointLabels: {
              color: '#c8d3ec',
              font: { size: 11, family: "'Be Vietnam Pro', sans-serif", weight: '600' },
              padding: 14
            },
            ticks: {
              display: false,
              stepSize: 25
            }
          }
        }
      }
    });
  }
});
// Trứng phục sinh (Easter Egg) cho nhà tuyển dụng
document.addEventListener('DOMContentLoaded', () => {
  console.log("%c🚀 PORTFOLIO NGUYỄN ĐỨC QUANG", "font-weight: bold; font-size: 20px; color: #5B8AF5; text-shadow: 1px 1px 0px #000;");
  console.log("%cXin chào Nhà tuyển dụng / Giảng viên! Mã nguồn này được tối ưu bằng tay với HTML5/CSS3/Vanilla JS thuần, đảm bảo hiệu năng cao và UX mượt mà.", "font-size: 14px; color: #8b9bb4;");
  console.log("Email: quangnguyen301007@gmail.com | Sẵn sàng cho mọi thử thách!");
});


