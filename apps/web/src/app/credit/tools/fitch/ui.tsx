"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { FileText, ExternalLink, Building2 } from "lucide-react";

type Company = any;

export default function FitchTool() {
  const [tab, setTab] = useState<"search"|"excel">("search");

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Fitch Tool</h1>
        <p className="text-muted-foreground">
          Search single companies or upload an Excel to enrich with Fitch ratings & RACs.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-border pb-4">
          <button
            className={cn(
              "px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
              tab === "search" 
                ? "bg-primary text-primary-foreground border-primary" 
                : "bg-card text-card-foreground border-border hover:bg-muted"
            )}
            onClick={() => setTab("search")}
          >
            Search
          </button>
          <button
            className={cn(
              "px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
              tab === "excel" 
                ? "bg-primary text-primary-foreground border-primary" 
                : "bg-card text-card-foreground border-border hover:bg-muted"
            )}
            onClick={() => setTab("excel")}
          >
            Excel Update
          </button>
        </div>

        <div>
          {tab === "search" && <SearchSection />}
          {tab === "excel" && <ExcelSection />}
        </div>
      </div>
    </div>
  );
}

/* --------------------- SEARCH --------------------- */
function SearchSection() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<Company|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [fromCache, setFromCache] = useState(false);

  async function doSearch() {
    if (!q.trim()) return;
    
    setLoading(true); 
    setError(null); 
    setCompany(null);
    setFromCache(false);

    try {
      const res = await fetch(`/api/fitch/search?name=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      
      setCompany(data.company);
      setFromCache(data.fromCache);
      if (!data.company) setError("Company not found");
    } catch (e: any) {
      setError(e.message);
    } finally { 
      setLoading(false); 
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      doSearch();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Search a company
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input 
            placeholder="Start typing a company name..." 
            value={q} 
            onChange={(e) => setQ(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />
          <Button onClick={doSearch} disabled={!q.trim() || loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>

        {fromCache && (
          <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
            ℹ️ Result loaded from cache
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {company && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Company Name</div>
              <div className="font-semibold text-lg">{company.name}</div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Latest Rating</div>
                <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
                  {company.ratings?.[0] ? (
                    <div className="space-y-1">
                      <div className="font-medium text-lg">{company.ratings[0].ratingCode}</div>
                      <div className="text-muted-foreground">{company.ratings[0].ratingActionDescription}</div>
                      {company.ratings[0].ratingChangeDate && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(company.ratings[0].ratingChangeDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">No rating available</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Recent RACs</div>
                <div className="rounded-lg border border-border bg-muted/20 p-4 max-h-48 overflow-auto">
                  {company.latestRAC?.rows?.length > 0 ? (
                    <ul className="space-y-2">
                      {company.latestRAC.rows.map((r: any) => (
                        <li key={r.slug} className="flex items-start gap-2 text-sm">
                          <FileText className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <a 
                            className="text-primary hover:underline leading-snug" 
                            href={`https://www.fitchratings.com/research/${r.slug}`} 
                            target="_blank" 
                            rel="noreferrer"
                          >
                            {r.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground italic text-sm">No recent RACs</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------- EXCEL --------------------- */
function ExcelSection() {
  const [file, setFile] = useState<File|null>(null);
  const [jobId, setJobId] = useState<string|null>(null);
  const [status, setStatus] = useState<any|null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Only poll when we have an active job
  useEffect(() => {
    if (!jobId || !isPolling) return;

    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/fitch/status?jobId=${jobId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data);
        if (data.status === "done" || data.status === "error") {
          setIsPolling(false);
          localStorage.removeItem("fitchJobId");
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);

    return () => clearInterval(t);
  }, [jobId, isPolling]);

  async function startUpload() {
    if (!file) return;
    
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/fitch/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setJobId(data.jobId);
        setStatus({ status: "queued" });
        setIsPolling(true);
        localStorage.setItem("fitchJobId", data.jobId);
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (e: any) {
      alert("Upload failed: " + e.message);
    }
  }

  const canDownload = status?.status === "done";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Excel Update
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            Upload an <strong>.xlsx</strong> or <strong>.csv</strong> file with a <em>name</em> or <em>company</em> column.
            We&apos;ll add Fitch columns: <code className="bg-muted px-1 rounded">__fitch_name</code>, <code className="bg-muted px-1 rounded">__fitch_latest_rating</code>, <code className="bg-muted px-1 rounded">__fitch_latest_action</code>, <code className="bg-muted px-1 rounded">__fitch_rac_count</code>.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            You can navigate anywhere while it processes; progress is tracked below.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Input 
            type="file" 
            accept=".xlsx,.xls,.csv" 
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="flex-1 min-w-0"
          />
          <Button onClick={startUpload} disabled={!file || status?.status === "processing"}>
            {status?.status === "processing" ? "Processing..." : "Start"}
          </Button>
          {jobId && (
            <Button 
              variant="outline" 
              onClick={() => {
                setJobId(null);
                setStatus(null);
                setIsPolling(false);
                setFile(null);
                localStorage.removeItem("fitchJobId");
              }}
            >
              Reset
            </Button>
          )}
          {canDownload && (
            <a
              href={`/api/fitch/download?jobId=${jobId}`}
              className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <ExternalLink className="h-4 w-4" />
              Download result
            </a>
          )}
        </div>

        {jobId && (
          <div className="space-y-3 bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Job Status</span>
              <span className="font-mono text-xs">#{jobId}</span>
            </div>
            
            <div className="text-sm space-y-2">
              {status?.status === "queued" && (
                <>
                  <Progress value={0} />
                  <span className="text-muted-foreground">⏳ Queued for processing...</span>
                </>
              )}
              {status?.status === "processing" && (
                <>
                  <Progress value={50} className="animate-pulse" />
                  <span className="text-primary">⚡ Processing your Excel file...</span>
                </>
              )}
              {status?.status === "done" && (
                <>
                  <Progress value={100} />
                  <span className="text-green-600">✅ Done! You can download the updated file.</span>
                </>
              )}
              {status?.status === "error" && (
                <>
                  <Progress value={0} />
                  <span className="text-destructive">❌ Error: {status?.error}</span>
                </>
              )}
              {file && (
                <div className="text-xs text-muted-foreground">
                  File: {file.name}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}