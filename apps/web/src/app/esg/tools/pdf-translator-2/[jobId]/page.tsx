import PdfTranslator2Job from './PdfTranslator2Job';

export default async function PdfTranslator2JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <PdfTranslator2Job jobId={jobId} />;
}
