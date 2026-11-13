/* Interações compartilhadas: navegação, microanimações, galeria e acessibilidade. */
(() => {
  'use strict';
  document.documentElement.classList.add('has-js');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const config = window.SITE_CONFIG || {};

  // 1. Textos editáveis sem precisar alterar todos os arquivos HTML.
  document.querySelectorAll('[data-credit]').forEach((node) => {
    const value = config.credits?.[node.dataset.credit];
    if (typeof value === 'string' && value.trim()) node.textContent = value;
  });
  const teacher = config.credits?.teacher;
  if (typeof teacher === 'string' && teacher.trim()) {
    document.querySelectorAll('.footer-bottom').forEach(footer => {
      const credit = document.createElement('span');
      credit.textContent = `Docente: ${teacher}`;
      footer.insertBefore(credit, footer.querySelector('a'));
    });
  }
  document.querySelectorAll('[data-project-title]').forEach((node) => {
    const project = config.projects?.[Number(node.dataset.projectTitle)];
    if (project?.title) node.textContent = project.title;
  });

  // 2. Menu responsivo com suporte a teclado.
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  const closeMenu = () => {
    if (!menu || !nav) return;
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Abrir menu');
    nav.classList.remove('is-open');
  };
  if (menu && nav) {
    menu.addEventListener('click', () => {
      const opened = menu.getAttribute('aria-expanded') === 'true';
      menu.setAttribute('aria-expanded', String(!opened));
      menu.setAttribute('aria-label', opened ? 'Abrir menu' : 'Fechar menu');
      nav.classList.toggle('is-open', !opened);
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && !nav.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', e => {if (e.key === 'Escape') closeMenu();});
    window.addEventListener('resize', () => {if (window.innerWidth > 900) closeMenu();});
  }


  // Navegação ao topo: tratamento explícito, inclusive para links dentro do rodapé.
  document.querySelectorAll('a[href="#topo"]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      closeMenu();
      window.scrollTo({top:0, behavior: reducedMotion ? 'auto' : 'smooth'});
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    });
  });

  // 3. Revelação no scroll: discreta, alternada com transições próprias de cada hero.
  const revealNodes = [...document.querySelectorAll('.reveal')];
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealNodes.forEach(el => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    }, {threshold: 0.09, rootMargin: '0px 0px -25px 0px'});
    revealNodes.forEach(el => revealObserver.observe(el));
  }

  // 4. Linha de progresso + paralaxe sutil somente quando faz sentido.
  const progress = document.querySelector('.scroll-progress');
  const parallaxImages = reducedMotion ? [] : [...document.querySelectorAll('[data-parallax] img')];
  let rafPending = false;
  function scrollPaint() {
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (progress) progress.style.width = `${Math.min(100, window.scrollY / scrollable * 100)}%`;
    for (const img of parallaxImages) {
      const parent = img.parentElement;
      const bounds = parent.getBoundingClientRect();
      if (bounds.bottom < -50 || bounds.top > window.innerHeight + 50) continue;
      const speed = Number(parent.dataset.parallax || 0.08);
      const distance = (bounds.top + bounds.height / 2 - window.innerHeight / 2) * speed;
      img.style.translate = `0 ${Math.max(-44, Math.min(44, -distance))}px`;
    }
    rafPending = false;
  }
  function requestScrollPaint() {
    if (rafPending) return;
    rafPending = true;
    window.requestAnimationFrame(scrollPaint);
  }
  window.addEventListener('scroll', requestScrollPaint, {passive:true});
  window.addEventListener('resize', requestScrollPaint, {passive:true});
  requestScrollPaint();

  // 5. Botões magnéticos — o botão segue o mouse, sem animar em dispositivos touch.
  if (finePointer && !reducedMotion) {
    document.querySelectorAll('.magnetic').forEach(el => {
      el.addEventListener('pointermove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        el.style.translate = `${x * .1}px ${y * .14}px`;
      });
      el.addEventListener('pointerleave', () => {el.style.translate = '0 0';});
    });
  }

  // 6. Transição de página em forma de cortina violeta (links HTML internos).
  const wipe = document.querySelector('.page-transition');
  if (wipe && !reducedMotion) {
    let navigating = false;
    document.querySelectorAll('a[href]').forEach(link => link.addEventListener('click', e => {
      if (navigating || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const rawHref = link.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#') || link.hasAttribute('download') || link.target === '_blank') return;
      const target = new URL(rawHref, window.location.href);
      if (target.origin !== window.location.origin || !/\.html$/i.test(target.pathname)) return;
      if (target.pathname === location.pathname && !target.hash) return;
      e.preventDefault();
      navigating = true;
      closeMenu();
      wipe.classList.add('is-animating');
      setTimeout(() => {window.location.href = target.href;}, 465);
    }));
    // Voltar via histórico do navegador: não deixar o overlay ocultando a página.
    window.addEventListener('pageshow', () => {wipe.classList.remove('is-animating');navigating = false;});
  }

  // 7. Galeria acessível: fotos selecionadas, clique para ampliar, setas e Esc.
  const gallery = [...document.querySelectorAll('[data-gallery] .gallery-tile')];
  const lightbox = document.querySelector('.lightbox');
  if (gallery.length && lightbox) {
    let activeIndex = 0;
    let triggerButton = null;
    const photo = lightbox.querySelector('.lightbox__figure img');
    const caption = lightbox.querySelector('.lightbox__figure figcaption');
    const counter = lightbox.querySelector('.lightbox__counter');
    const closeButton = lightbox.querySelector('.lightbox__close');
    const previous = lightbox.querySelector('.lightbox__prev');
    const next = lightbox.querySelector('.lightbox__next');
    const show = index => {
      activeIndex = (index + gallery.length) % gallery.length;
      const item = gallery[activeIndex];
      photo.src = item.dataset.full;
      photo.alt = item.querySelector('img').alt;
      caption.textContent = item.dataset.caption;
      counter.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(gallery.length).padStart(2, '0')}`;
    };
    const close = () => {
      if (!lightbox.classList.contains('is-open')) return;
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('lightbox-lock');
      photo.src = '';
      if (triggerButton) triggerButton.focus({preventScroll:true});
    };
    const open = (index, item) => {
      triggerButton = item;
      show(index);
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lightbox-lock');
      closeButton.focus({preventScroll:true});
    };
    gallery.forEach((item, i) => item.addEventListener('click', () => open(i,item)));
    closeButton.addEventListener('click', close);
    previous.addEventListener('click', () => show(activeIndex - 1));
    next.addEventListener('click', () => show(activeIndex + 1));
    lightbox.addEventListener('click', e => {if (e.target === lightbox) close();});
    document.addEventListener('keydown', e => {
      if (!lightbox.classList.contains('is-open')) return;
      if (e.key === 'Escape') {e.preventDefault();close();}
      else if (e.key === 'ArrowRight') {e.preventDefault();show(activeIndex + 1);}
      else if (e.key === 'ArrowLeft') {e.preventDefault();show(activeIndex - 1);}
      else if (e.key === 'Tab') {
        const controls = [closeButton, previous, next];
        const i = controls.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) {e.preventDefault();controls[controls.length-1].focus();}
        else if (!e.shiftKey && i === controls.length - 1) {e.preventDefault();controls[0].focus();}
      }
    });
    // Mobile: gesto horizontal dentro da foto.
    let startX = null;
    lightbox.addEventListener('touchstart', e => {startX = e.changedTouches[0]?.clientX ?? null;}, {passive:true});
    lightbox.addEventListener('touchend', e => {
      if (startX === null) return;
      const delta = (e.changedTouches[0]?.clientX ?? startX) - startX;
      if (Math.abs(delta) > 60) show(activeIndex + (delta < 0 ? 1 : -1));
      startX = null;
    }, {passive:true});
  }
})();
