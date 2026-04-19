/* Runway Fuel style note: Operational Ledger design system with chapter-based flow, directional hierarchy, and restrained systems-like interactions. */
import './styles.css';

const publicFunctions = [
  {
    title: 'Operational visibility',
    description:
      'We make important activity easier to see, understand, and monitor so that operating risk is surfaced earlier and decisions are made with better context.',
  },
  {
    title: 'Workflow coordination',
    description:
      'We support execution across processes involving multiple steps, dependencies, or teams, reducing friction between scattered information and real follow-through.',
  },
  {
    title: 'Structured execution support',
    description:
      'We turn operational complexity into repeatable digital pathways that increase clarity, consistency, and execution discipline.',
  },
  {
    title: 'Monitoring and reporting',
    description:
      'We establish a clearer operational record for review, control, improvement, and long-term governance.',
  },
  {
    title: 'Scalable infrastructure',
    description:
      'We design the operating layer for disciplined growth so that visibility and coordination improve as the environment expands.',
  },
];

const stakeholderViews = [
  {
    key: 'operators',
    label: 'Operators and teams',
    title: 'A clearer day-to-day operating surface',
    description:
      'Runway Fuel gives execution teams a more structured environment for follow-through, status visibility, and cross-functional coordination in high-friction settings.',
    focus: ['Shared context', 'Reduced manual follow-up', 'Cleaner execution pathways'],
  },
  {
    key: 'assets',
    label: 'Assets and systems',
    title: 'Better visibility into activity and dependencies',
    description:
      'Asset and system owners gain a more legible view of what is happening across the operating environment, how dependencies connect, and where interventions are required.',
    focus: ['Status clarity', 'Dependency awareness', 'Operational transparency'],
  },
  {
    key: 'leadership',
    label: 'Leadership and oversight',
    title: 'Stronger reporting surfaces and operational control',
    description:
      'Leadership roles benefit from cleaner operational oversight, more dependable reporting surfaces, and a stronger basis for governing execution quality at scale.',
    focus: ['Executive visibility', 'Governance support', 'Scalable control'],
  },
  {
    key: 'partners',
    label: 'Partners and stakeholders',
    title: 'Structured coordination across organizational boundaries',
    description:
      'External stakeholders and coordinating partners gain a more reliable structure for alignment, status interpretation, and shared execution around outcomes.',
    focus: ['Shared expectations', 'Coordination discipline', 'Dependable communication'],
  },
];

const executionPrinciples = [
  'Clear operational surfaces rather than opaque coordination chains.',
  'Structured sequence between raw inputs and dependable outcomes.',
  'Deliberate separation between public explanation and private implementation.',
  'Scalable operating discipline designed for complex environments.',
];

const app = document.querySelector('#app');
const year = new Date().getFullYear();

app.innerHTML = `
  <div class="site-shell">
    <div class="page-noise" aria-hidden="true"></div>
    <header class="site-header" id="top">
      <div class="container header-inner">
        <a class="brand" href="#top" aria-label="Runway Fuel home">
          <img src="/assets/runway-fuel-mark.png" alt="Runway Fuel mark" class="brand-mark" />
          <span class="brand-wordmark">Runway Fuel</span>
        </a>
        <button class="menu-toggle" aria-expanded="false" aria-controls="site-nav">
          <span></span><span></span><span></span>
          <span class="sr-only">Open navigation</span>
        </button>
        <nav class="site-nav" id="site-nav" aria-label="Primary navigation">
          <a href="#model">Operating layer</a>
          <a href="#functions">Public functions</a>
          <a href="#stakeholders">Stakeholders</a>
          <a href="#value">Value model</a>
          <a href="#boundary">Boundary</a>
          <a href="#contact" class="nav-cta">Engage</a>
        </nav>
      </div>
    </header>

    <main>
      <section class="hero section">
        <div class="container hero-grid">
          <div class="hero-copy reveal">
            <div class="eyebrow-wrap">
              <span class="eyebrow">Public operating layer</span>
              <span class="status-pill">Frankfurt am Main, Germany</span>
            </div>
            <h1>Software and infrastructure for complex operational environments.</h1>
            <p class="hero-lead">
              Runway Fuel builds the digital layer between fragmented inputs and dependable execution.
              The public surface is designed to explain the value clearly, signal operational discipline,
              and establish trust without exposing proprietary implementation detail.
            </p>
            <div class="hero-actions">
              <a class="button button-primary" href="#model">Explore the operating model</a>
              <a class="button button-secondary" href="https://github.com/runway-fuel" target="_blank" rel="noreferrer">Open GitHub organization</a>
            </div>
            <div class="hero-metrics">
              <article>
                <span>Operating focus</span>
                <strong>Visibility, coordination, execution</strong>
              </article>
              <article>
                <span>Public posture</span>
                <strong>Clear, selective, credible</strong>
              </article>
              <article>
                <span>Delivery stance</span>
                <strong>Structured, scalable, dependable</strong>
              </article>
            </div>
          </div>
          <aside class="hero-panel reveal">
            <div class="chapter-card dark-card">
              <p class="chapter-label">Chapter 01</p>
              <h2>The visible problem shape</h2>
              <p>
                High-friction operations become harder when information is scattered, dependencies are difficult
                to track, and execution quality depends on coordination across people, systems, and decisions.
              </p>
            </div>
            <div class="signal-rail">
              <div class="signal-card">
                <span>Public front door</span>
                <strong>Selective operating view</strong>
              </div>
              <div class="signal-card">
                <span>Strategic edge</span>
                <strong>Private implementation remains protected</strong>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section class="section chapter-section" id="model">
        <div class="container chapter-grid">
          <div class="chapter-aside reveal">
            <span class="chapter-number">01</span>
            <div>
              <p class="eyebrow">Operating layer</p>
              <h2>Runway Fuel sits between raw operational inputs and reliable outcomes.</h2>
            </div>
          </div>
          <div class="chapter-content reveal">
            <p>
              The public operating model is intentionally direct. Runway Fuel improves shared visibility,
              supports structured coordination, strengthens workflow execution, and creates a stronger basis
              for monitoring and refinement over time.
            </p>
            <figure class="diagram-frame">
              <img src="/assets/runway-fuel-public-surface.png" alt="Runway Fuel public operating surface diagram" />
              <figcaption>
                The public surface diagram expresses the sequence from operational inputs to monitoring and refinement.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section class="section functions-section" id="functions">
        <div class="container">
          <div class="section-heading reveal">
            <p class="eyebrow">Public functions</p>
            <h2>The value layer exposed publicly is operational, not ornamental.</h2>
            <p>
              The site explains what Runway Fuel does in public terms: create the digital operating surface that makes
              complex environments easier to see, easier to organize, and easier to operate.
            </p>
          </div>
          <div class="function-grid reveal">
            ${publicFunctions
              .map(
                (item, index) => `
                  <article class="function-card">
                    <span class="function-index">0${index + 1}</span>
                    <h3>${item.title}</h3>
                    <p>${item.description}</p>
                  </article>
                `,
              )
              .join('')}
          </div>
        </div>
      </section>

      <section class="section stakeholders-section" id="stakeholders">
        <div class="container stakeholder-layout">
          <div class="section-heading reveal">
            <p class="eyebrow">Stakeholder relevance</p>
            <h2>Operational value has to work across the environment, not for one isolated user alone.</h2>
            <p>
              The public profile makes clear that the operating layer must support the teams executing work,
              the systems holding information, the partners coordinating around outcomes, and the leadership roles
              responsible for oversight.
            </p>
          </div>
          <div class="stakeholder-panel reveal">
            <div class="stakeholder-tabs" role="tablist" aria-label="Stakeholder views">
              ${stakeholderViews
                .map(
                  (item, index) => `
                    <button
                      class="stakeholder-tab ${index === 0 ? 'is-active' : ''}"
                      type="button"
                      role="tab"
                      aria-selected="${index === 0 ? 'true' : 'false'}"
                      data-view="${item.key}"
                    >
                      ${item.label}
                    </button>
                  `,
                )
                .join('')}
            </div>
            <div class="stakeholder-detail dark-card" id="stakeholder-detail">
              <p class="chapter-label">Selected view</p>
              <h3>${stakeholderViews[0].title}</h3>
              <p>${stakeholderViews[0].description}</p>
              <ul class="focus-list">
                ${stakeholderViews[0].focus.map((item) => `<li>${item}</li>`).join('')}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="section value-section" id="value">
        <div class="container value-grid">
          <div class="value-visual reveal">
            <figure class="diagram-frame light-frame">
              <img src="/assets/runway-fuel-value-map.png" alt="Runway Fuel operational value map" />
              <figcaption>
                The public value map links stakeholder groups to clearer visibility, stronger coordination,
                dependable execution, and scalable operations.
              </figcaption>
            </figure>
          </div>
          <div class="value-copy reveal">
            <p class="eyebrow">Operational value view</p>
            <h2>Runway Fuel creates value through visibility, coordination, execution, and scale.</h2>
            <div class="value-list">
              <article>
                <h3>Clearer visibility</h3>
                <p>Important activity becomes easier to interpret before it becomes difficult to control.</p>
              </article>
              <article>
                <h3>Stronger coordination</h3>
                <p>Dependencies, handoffs, and shared execution become more structured across the environment.</p>
              </article>
              <article>
                <h3>Dependable execution</h3>
                <p>Operational quality becomes less dependent on improvisation and more anchored in repeatable flow.</p>
              </article>
              <article>
                <h3>Scalable operations</h3>
                <p>The operating surface is built with growth, discipline, and governance in mind.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section class="section principles-section" id="boundary">
        <div class="container principles-layout">
          <div class="section-heading reveal">
            <p class="eyebrow">Public boundary</p>
            <h2>Clear enough to trust. Disciplined enough to protect what should remain private.</h2>
            <p>
              The public website explains the problem shape, the value layer, and the stakeholder relevance.
              It does not disclose internal systems design, proprietary commercial logic, or protected implementation.
            </p>
          </div>
          <div class="boundary-grid reveal">
            <article class="boundary-card">
              <span>Publicly visible</span>
              <h3>What this site explains</h3>
              <p>
                Public positioning, operating model, value architecture, stakeholder relevance, and the disciplined role
                Runway Fuel plays inside complex environments.
              </p>
            </article>
            <article class="boundary-card dark-card">
              <span>Intentionally protected</span>
              <h3>What this site does not expose</h3>
              <p>
                Internal logic, proprietary workflow architecture, protected systems design, private repositories,
                and implementation details that create strategic edge.
              </p>
            </article>
          </div>
          <div class="principles-strip reveal">
            ${executionPrinciples.map((item) => `<p>${item}</p>`).join('')}
          </div>
        </div>
      </section>

      <section class="section contact-section" id="contact">
        <div class="container contact-layout">
          <div class="contact-copy reveal">
            <p class="eyebrow">Engagement path</p>
            <h2>Use the public surface now. Connect the live contact endpoint when you are ready.</h2>
            <p>
              This first public release is designed to present Runway Fuel with clarity and credibility while keeping the
              contact layer flexible. The intake form below is ready to be connected to your preferred email, CRM,
              or backend workflow during the next implementation step.
            </p>
            <div class="contact-links">
              <a class="button button-primary" href="https://github.com/runway-fuel" target="_blank" rel="noreferrer">Visit the public organization</a>
              <a class="button button-secondary" href="#top">Return to top</a>
            </div>
          </div>
          <form class="contact-form reveal" id="contact-form">
            <label>
              <span>Name</span>
              <input type="text" name="name" placeholder="Your name" required />
            </label>
            <label>
              <span>Organization</span>
              <input type="text" name="organization" placeholder="Your organization" required />
            </label>
            <label>
              <span>Email</span>
              <input type="email" name="email" placeholder="you@example.com" required />
            </label>
            <label>
              <span>Context</span>
              <textarea name="context" rows="5" placeholder="Describe the operational environment, constraint, or coordination problem." required></textarea>
            </label>
            <button class="button button-primary" type="submit">Prepare intake message</button>
            <p class="form-note" id="form-note">Frontend intake surface only. Connect this form to your preferred submission endpoint during deployment hardening.</p>
          </form>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container footer-inner">
        <div>
          <p class="footer-title">Runway Fuel</p>
          <p>Software and infrastructure for complex operational environments.</p>
        </div>
        <div class="footer-links">
          <a href="#model">Operating layer</a>
          <a href="#value">Value model</a>
          <a href="https://github.com/runway-fuel" target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <p class="footer-meta">© ${year} Runway Fuel. Public website package prepared for GitHub and Vercel deployment.</p>
      </div>
    </footer>
  </div>
`;

const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('.site-nav');
const navLinks = [...document.querySelectorAll('.site-nav a')];
const tabs = [...document.querySelectorAll('.stakeholder-tab')];
const detail = document.querySelector('#stakeholder-detail');
const contactForm = document.querySelector('#contact-form');
const formNote = document.querySelector('#form-note');
const sections = [...document.querySelectorAll('main section[id]')];
const revealTargets = document.querySelectorAll('.reveal');

menuToggle?.addEventListener('click', () => {
  const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!expanded));
  siteNav.classList.toggle('is-open');
});

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    siteNav.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  });
});

const stakeholderLookup = Object.fromEntries(stakeholderViews.map((item) => [item.key, item]));

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const selected = stakeholderLookup[tab.dataset.view];
    tabs.forEach((item) => {
      item.classList.remove('is-active');
      item.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('is-active');
    tab.setAttribute('aria-selected', 'true');
    detail.innerHTML = `
      <p class="chapter-label">Selected view</p>
      <h3>${selected.title}</h3>
      <p>${selected.description}</p>
      <ul class="focus-list">
        ${selected.focus.map((item) => `<li>${item}</li>`).join('')}
      </ul>
    `;
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.18 },
);

revealTargets.forEach((element) => revealObserver.observe(element));

const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => {
        const isActive = link.getAttribute('href') === `#${entry.target.id}`;
        link.classList.toggle('is-current', isActive);
      });
    });
  },
  {
    rootMargin: '-35% 0px -50% 0px',
    threshold: 0.1,
  },
);

sections.forEach((section) => navObserver.observe(section));

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(contactForm);
  const name = data.get('name');
  const organization = data.get('organization');
  const email = data.get('email');
  const context = data.get('context');
  const body = encodeURIComponent(
    `Name: ${name}\nOrganization: ${organization}\nEmail: ${email}\n\nContext:\n${context}`,
  );

  formNote.textContent = 'Intake message prepared. Connect a real submission endpoint, or route this structure to your preferred email or CRM during the next implementation step.';
  formNote.classList.add('is-success');

  window.location.href = `mailto:?subject=Runway Fuel operational inquiry&body=${body}`;
});
