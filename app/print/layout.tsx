export default function PrintLayout({ children }: LayoutProps<"/print">) {
  return <div className="min-h-dvh bg-gray-100 py-6 print:bg-white print:py-0">{children}</div>;
}
