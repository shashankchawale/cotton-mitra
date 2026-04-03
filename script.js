document.addEventListener('DOMContentLoaded', () => {
  
  const mobileMenu = document.querySelector('.mobile-menu');
  const navLinks = document.querySelector('.nav-links');

  if (mobileMenu && navLinks) {
    mobileMenu.addEventListener('click', () => {
      mobileMenu.classList.toggle('active');
      navLinks.classList.toggle('active');
    });

    // Close mobile menu when a link is clicked
    document.querySelectorAll('.nav-links li a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });
  }

  // Navbar scroll effect
  const navbar = document.getElementById('navbar');
  
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  // Scroll Reveal Animations
  // Add reveal class to elements we want to animate on scroll
  const revealElements = document.querySelectorAll('.card, .split-image, .split-content, .stat-item, .contact-card');
  
  revealElements.forEach(el => {
    el.classList.add('reveal');
  });

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // Add active class with a staggered delay based on child index or data attributes if needed
        entry.target.classList.add('active');
        // Optional: unobserve after revealing once
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15, // Elements trigger when 15% visible
    rootMargin: "0px 0px -50px 0px"
  });

  revealElements.forEach((el) => {
    revealObserver.observe(el);
  });

  // Smooth scrolling for anchor links (safeguard for cross-browser support)
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      // Only process valid anchor sections
      if (targetId !== '#' && targetId.startsWith('#')) {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });
  });

});
