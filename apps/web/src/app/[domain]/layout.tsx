import Header from "@/components/header/Header";

export default function DomainLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { domain: "esg" | "credit" };
}) {
  return (
    <>
      <Header domain={params.domain} />
      <div className="min-h-[calc(100vh-64px)]">{children}</div>
    </>
  );
}