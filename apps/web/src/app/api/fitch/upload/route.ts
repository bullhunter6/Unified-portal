import { NextResponse } from "next/server";
import { JOBS, Job } from "./jobstore";
import * as XLSX from "xlsx";

export const runtime = "nodejs";         // ensure Node runtime (not Edge)
export const dynamic = "force-dynamic";  // disable static optimization

function uid() {
  return Math.random().toString(36).slice(2, 12);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const job: Job = { id: uid(), status: "queued", createdAt: Date.now() };
  JOBS.set(job.id, job);

  // process asynchronously
  (async () => {
    try {
      job.status = "processing";

      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" });

      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];

      // header row as array
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
      if (rows.length === 0) throw new Error("Empty sheet");

      const headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
      // accept Company or Company Name
      const companyIdx = headers.findIndex((h: string) =>
        ["company", "company name"].includes(h)
      );
      if (companyIdx === -1) {
        throw new Error('Missing "Company" or "Company Name" column');
      }

      // TODO: call your Fitch API functions here and add columns, e.g.:
      // add columns if they don't exist
      const outputHeaders = [...rows[0]];
      const ensureCol = (name: string) => {
        if (!outputHeaders.includes(name)) outputHeaders.push(name);
      };
      ensureCol("Fitch Rating");
      ensureCol("RAC Title");

      const ratingColIndex = outputHeaders.indexOf("Fitch Rating");
      const racColIndex = outputHeaders.indexOf("RAC Title");

      const output = [outputHeaders];

      // Example filling; replace with real API lookups
      for (let i = 1; i < rows.length; i++) {
        const r = [...rows[i]];
        const companyName = String(r[companyIdx]).trim();
        if (!companyName) { output.push(r); continue; }

        // ---- call your logic (slug + details) here ----
        // const slug = await getSlug(companyName) ...
        // const details = await getCompanyDetails(slug.slug) ...
        // const rating = details?.ratings?.[0]?.ratingCode ?? "";
        // const racTitle = details?.latestRAC?.rows?.[0]?.title ?? "";

        const rating = r[ratingColIndex] ?? ""; // placeholder: keep existing if any
        const racTitle = r[racColIndex] ?? "";  // placeholder

        r[ratingColIndex] = rating;
        r[racColIndex] = racTitle;

        output.push(r);
      }

      const outWs = XLSX.utils.aoa_to_sheet(output);
      const outWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(outWb, outWs, wsName || "Sheet1");

      // WRITE TO BUFFER (not file system)
      const outBuffer = XLSX.write(outWb, { type: "buffer", bookType: "xlsx" }) as Buffer;

      job.buffer = outBuffer;
      job.filename = `fitch_updated_${Date.now()}.xlsx`;
      job.status = "done";
    } catch (err: any) {
      job.status = "error";
      job.error = `Excel processing error: ${err?.message || String(err)}`;
      console.error("Excel processing error:", err);
    }
  })();

  return NextResponse.json({ jobId: job.id });
}