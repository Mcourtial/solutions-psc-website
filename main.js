// ── Mobile menu ──
function toggleMenu() {
    document.getElementById('navLinks').classList.toggle('open');
    document.getElementById('burger').classList.toggle('active');
}

// Close menu on link click
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        document.getElementById('navLinks').classList.remove('open');
    });
});

// ── Navbar scroll effect ──
window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    nav.classList.toggle('scrolled', window.scrollY > 20);
});

// ── Scroll animations ──
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.classList.add('visible');
            }, index * 80);
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

// ── Approach line draw animation ──
const approachLine = document.getElementById('approachLine');
const approachSteps = document.querySelectorAll('.approach-step');
const approachObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            approachLine.classList.add('animate');
            const delays = [0, 670, 1460, 2400];
            approachSteps.forEach((step, i) => {
                setTimeout(() => step.classList.add('step-reached'), delays[i]);
            });
            approachObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });
approachObserver.observe(document.querySelector('.approach-grid'));

// ── Active nav link on scroll ──
const sections = document.querySelectorAll('section[id]');
window.addEventListener('scroll', () => {
    const scrollY = window.scrollY + 100;
    sections.forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute('id');
        const link = document.querySelector(`.nav-links a[href="#${id}"]`);
        if (link) {
            link.classList.toggle('active', scrollY >= top && scrollY < top + height);
        }
    });
});

// ── Circles scroll alignment on mobile ──
const circlesContainer = document.querySelector('.hero-circles');
const heroSection = document.getElementById('hero');

function updateMobileCirclesAlignment() {
    if (window.innerWidth > 1024 || !circlesContainer || !heroSection) {
        circlesContainer?.classList.remove('circles-aligned');
        return;
    }

    const triggerOffset = Math.max(160, heroSection.offsetHeight * 0.28);
    circlesContainer.classList.toggle('circles-aligned', window.scrollY > triggerOffset);
}

window.addEventListener('scroll', updateMobileCirclesAlignment, { passive: true });
window.addEventListener('resize', updateMobileCirclesAlignment);
updateMobileCirclesAlignment();

// ── 3D tilt on why-glass-cards ──
const glassCards = document.querySelectorAll('.why-glass-card');
const isDesktop = () => window.innerWidth > 1024;

glassCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        if (!isDesktop()) return;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const rotateY = ((x / rect.width) - 0.5) * 16;
        card.style.transform = `perspective(700px) rotateY(${rotateY}deg) translateY(-4px)`;
    });

    card.addEventListener('mouseleave', () => {
        if (!isDesktop()) return;
        card.style.transition = 'background 0.35s, box-shadow 0.35s, transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)';
        card.style.transform = '';
        card.addEventListener('transitionend', () => {
            card.style.transition = '';
        }, { once: true });
    });

    card.addEventListener('click', () => {
        if (isDesktop()) return;
        card.classList.remove('tilt-wobble');
        void card.offsetWidth;
        card.classList.add('tilt-wobble');
        card.addEventListener('animationend', () => {
            card.classList.remove('tilt-wobble');
        }, { once: true });
    });
});

// ── Form submit ──
function handleSubmit(e) {
    e.preventDefault();
    const nom = document.getElementById('nom').value.trim();
    const entreprise = document.getElementById('entreprise').value.trim();
    const email = document.getElementById('email').value.trim();
    const effectif = document.getElementById('effectif').value;

    const subject = `Demande de contact - ${entreprise || 'Entreprise'}`;
    const body = [
        'Bonjour,',
        '',
        "Je souhaite échanger au sujet de la Protection sociale complémentaire de mon entreprise.",
        "Nous avons un besoin d'accompagnement sur nos régimes collectifs.",
        '',
        `Nom et prénom : ${nom}`,
        `Entreprise : ${entreprise}`,
        `Email : ${email}`,
        `Nombre d'employés : ${effectif}`,
        '',
        'Cordialement,'
    ].join('\n');

    window.location.href = `mailto:contact@solutionspsc.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
