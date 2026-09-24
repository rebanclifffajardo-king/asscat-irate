export function AppFooter() {
  const year = Math.max(2026, new Date().getFullYear());
  return (
    <footer className="no-print border-t border-gray-200 bg-white px-4 py-3 text-center text-sm text-gray-600 sm:text-left">
      Copyright &copy; {year} <strong className="text-gray-800">ASSCAT iRATE</strong>. All rights reserved.
    </footer>
  );
}
