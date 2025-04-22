import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const { pathname } = useLocation();

  const linkStyle = (path) =>
    `px-3 py-2 rounded hover:bg-blue-100 ${
      pathname === path ? 'text-blue-600 font-semibold' : 'text-gray-700'
    }`;

  return (
    <header className="bg-white shadow-md px-6 py-4 mb-4">
      <nav className="max-w-5xl mx-auto flex gap-4 flex-wrap">
        <Link to="/" className={linkStyle('/')}>Start</Link>
        <Link to="/mapping" className={linkStyle('/mapping')}>Mapping</Link>
        <Link to="/karte" className={linkStyle('/karte')}>Karte</Link>
        <Link to="/karte/ebenen" className={linkStyle('/karte/ebenen')}>Karte mit Ebenen</Link>
        <Link to="/karte/turf" className={linkStyle('/karte/turf')}>Karte mit Turf</Link>
        <Link to="/karte/sidebar" className={linkStyle('/karte/sidebar')}>Karte mit Sidebar</Link>
        <Link to="/about" className={linkStyle('/about')}>Über</Link>
      </nav>
    </header>
  );
}
