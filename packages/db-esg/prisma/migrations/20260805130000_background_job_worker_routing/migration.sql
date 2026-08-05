-- Obsolete ESG-driver-only workers used an unfiltered queue claim and could
-- steal PDF/workbook jobs. New generic claims carry a namespaced fencing token;
-- reject incompatible claims at the database boundary so stale deployments
-- cannot poison unrelated work while they are being retired.
CREATE OR REPLACE FUNCTION enforce_background_job_worker_routing()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'processing'
       AND (
           OLD.status IS DISTINCT FROM 'processing'
           OR OLD.lease_owner IS DISTINCT FROM NEW.lease_owner
       )
       AND NEW.job_type <> 'esg_driver'
       AND COALESCE(NEW.lease_owner, '') NOT LIKE 'generic:%'
    THEN
        RAISE EXCEPTION 'background_job_worker_routing_mismatch'
          USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS background_jobs_worker_routing ON background_jobs;
CREATE TRIGGER background_jobs_worker_routing
BEFORE UPDATE OF status, lease_owner ON background_jobs
FOR EACH ROW EXECUTE FUNCTION enforce_background_job_worker_routing();
