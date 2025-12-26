import { Link } from 'react-router-dom';
import './LandingPage.css';

function LandingPage() {
  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="nav-logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">The Membrane</span>
        </div>
        <Link to="/login" className="nav-cta">
          Enter the Surface →
        </Link>
      </nav>

      <main className="landing-hero">
        <div className="hero-content">
          <div className="hero-badge">Context Engine for Accelerated Thinking</div>
          <h1 className="hero-title">
            Your thoughts deserve
            <span className="title-gradient"> persistent memory</span>
          </h1>
          <p className="hero-description">
            The Membrane fuses document editing with semantic memory. Every insight you capture 
            becomes part of an evolving context that grows smarter with each session—bridging 
            the gap between creation and cognition.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="action-primary">
              Begin Your Surface
            </Link>
            <button className="action-secondary">
              Watch Demo
            </button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-membrane">
            <div className="membrane-layer layer-1"></div>
            <div className="membrane-layer layer-2"></div>
            <div className="membrane-layer layer-3"></div>
            <div className="membrane-core">
              <span>◈</span>
            </div>
          </div>
        </div>
      </main>

      <section className="landing-features">
        <h2 className="features-title">The Architecture of Thought</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>Living Document Engine</h3>
            <p>
              Ghost-writing suggestions appear as you type. Accept with Tab, 
              or continue your own path. The membrane learns your style.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🧠</div>
            <h3>Semantic Memory</h3>
            <p>
              Your patterns, preferences, and past insights are vectorized 
              and retrievable—context that compounds over time.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Surgical Precision</h3>
            <p>
              Highlight any block for AI assistance. Non-destructive diffs 
              let you audit every suggestion before committing.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Multi-tenant Isolation</h3>
            <p>
              Your membrane is yours alone. Row-level security ensures 
              complete data isolation across the platform.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-manifesto">
        <blockquote className="manifesto-quote">
          "The best interface is no interface—just the pure surface of thought, 
          amplified by memory that never forgets."
        </blockquote>
      </section>

      <footer className="landing-footer">
        <div className="footer-content">
          <span className="footer-logo">◈ The Membrane</span>
          <span className="footer-copy">© 2024 · Accelerated Thinking</span>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
