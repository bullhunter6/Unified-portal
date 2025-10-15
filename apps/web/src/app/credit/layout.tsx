import Header from "@/components/header/Header";

export default function CreditLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header domain="credit" />
      <div className="min-h-[calc(100vh-64px)]">{children}</div>
    </>
  );
}
