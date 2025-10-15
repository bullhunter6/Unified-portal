import PdfSideBySide from "@/components/pdfx/PdfSideBySide";

interface ViewPageProps {
  params: {
    jobId: string;
  };
}

export default function PdfViewPage({ params }: ViewPageProps) {
  return <PdfSideBySide jobId={params.jobId} brand="credit" />;
}