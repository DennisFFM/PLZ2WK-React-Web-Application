import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout.jsx';
import Home from './pages/Home.jsx';
import Mapping from './pages/Mapping.jsx';
import Karte from './pages/Karte.jsx';
import About from './pages/About.jsx';
import KarteEbenen from './pages/karte/ebenen.jsx';
import KarteMitTurf from './pages/karte/turf.jsx';
import KarteMitSidebar from './pages/karte/sidebar.jsx';

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mapping" element={<Mapping />} />
          <Route path="/karte" element={<Karte />} />
          <Route path="/about" element={<About />} />
          <Route path="/karte/sidebar" element={<KarteMitSidebar />} />
          <Route path="/karte/turf" element={<KarteMitTurf />} />
          <Route path="/karte/ebenen" element={<KarteEbenen />} />
        </Routes>
      </Layout>
    </Router>
  );
}
