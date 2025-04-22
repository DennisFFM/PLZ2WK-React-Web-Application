import Navbar from '../components/Navbar.jsx';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 p-6">{children}</main>
      <footer className="bg-gray-100 text-center text-sm text-gray-500 py-4">
        © {new Date().getFullYear()} Dennis Wörner. All rights reserved.
      </footer>
    </div>
  );
}
