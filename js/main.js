document.addEventListener('DOMContentLoaded', function() {
    // 1. Sticky header
    const header = document.getElementById('header');
    if (header) {
        window.addEventListener('scroll', function() {
            header.classList.toggle('scrolled', window.scrollY > 20);
        });
    }

    // 2. Mobile nav
    const mobileBtn = document.getElementById('mobileBtn');
    const mobileNav = document.getElementById('mobileNav');
    const mobileClose = document.getElementById('mobileClose');

    if (mobileBtn && mobileNav) {
        mobileBtn.addEventListener('click', function() {
            mobileNav.classList.add('nav-open');
            document.body.style.overflow = 'hidden';
        });

        if (mobileClose) {
            mobileClose.addEventListener('click', function() {
                mobileNav.classList.remove('nav-open');
                document.body.style.overflow = '';
            });
        }

        mobileNav.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                mobileNav.classList.remove('nav-open');
                document.body.style.overflow = '';
            });
        });
    }

    // 3. Scroll reveal
    const revealElements = document.querySelectorAll('.reveal');
    if (revealElements.length > 0) {
        const revealObserver = new IntersectionObserver(function(entries, observer) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -20px 0px' });

        revealElements.forEach(function(el) {
            revealObserver.observe(el);
        });
    }

    // 4. FAQ accordion
    // Exposed globally
});

// FAQ toggle - global function
function toggleFaq(btn) {
    var item = btn.parentElement;
    var answer = btn.nextElementSibling;
    var isOpen = item.classList.contains('faq-open');
    document.querySelectorAll('.faq-item').forEach(function(fi) {
        fi.classList.remove('faq-open');
        fi.querySelector('.faq-answer').style.maxHeight = null;
    });
    if (!isOpen) {
        item.classList.add('faq-open');
        answer.style.maxHeight = answer.scrollHeight + 'px';
    }
}
