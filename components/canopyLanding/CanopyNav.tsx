"use client";

interface Props {
  onLogin: () => void;
}

export function CanopyNav({ onLogin }: Props) {
  return (
    <nav>
      <div className="wrap nav-in">
        <a href="#top" className="nav-logo font-display lowercase">canopy</a>
        <div className="nav-links">
          <a href="#market">Marketplace</a>
          <a href="#build">Build</a>
          <a href="#record">Track record</a>
          <a href="#pricing">Pricing</a>
          <button className="nav-cta" onClick={onLogin}>Launch app</button>
        </div>
      </div>
    </nav>
  );
}
