# Database Performance Optimization Guide

## 🎯 Overview
This guide provides database indexes and optimizations for production performance.

---

## 📊 Recommended Indexes

### ESG Database

```sql
-- Events table indexes
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_end_date ON events(end_date);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
CREATE INDEX IF NOT EXISTS idx_events_date_range ON events(start_date, end_date);

-- Publications table indexes
CREATE INDEX IF NOT EXISTS idx_publications_date ON publications(publication_date);
CREATE INDEX IF NOT EXISTS idx_publications_region ON publications(region);
CREATE INDEX IF NOT EXISTS idx_publications_type ON publications(type);

-- Articles table indexes
CREATE INDEX IF NOT EXISTS idx_articles_published_date ON articles(published_date);
CREATE INDEX IF NOT EXISTS idx_articles_region ON articles(region);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);

-- User activity indexes
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_content_type ON likes(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON likes(created_at);

-- Search optimization
CREATE INDEX IF NOT EXISTS idx_articles_title_gin ON articles USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_events_name_gin ON events USING gin(to_tsvector('english', event_name));
```

### Credit Database

```sql
-- Credit articles indexes
CREATE INDEX IF NOT EXISTS idx_credit_articles_date ON credit_articles(date DESC);
CREATE INDEX IF NOT EXISTS idx_credit_articles_region ON credit_articles(region);
CREATE INDEX IF NOT EXISTS idx_credit_articles_sector ON credit_articles(sector);
CREATE INDEX IF NOT EXISTS idx_credit_articles_source ON credit_articles(source);
CREATE INDEX IF NOT EXISTS idx_credit_articles_region_date ON credit_articles(region, date DESC);
CREATE INDEX IF NOT EXISTS idx_credit_articles_sector_date ON credit_articles(sector, date DESC);
CREATE INDEX IF NOT EXISTS idx_credit_articles_region_sector_date ON credit_articles(region, sector, date DESC);

-- Credit events indexes
CREATE INDEX IF NOT EXISTS idx_credit_events_date ON events(date DESC);
CREATE INDEX IF NOT EXISTS idx_credit_events_source ON events(source);
CREATE INDEX IF NOT EXISTS idx_credit_events_location ON events(location);

-- Alert system indexes
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_unread ON alerts(user_id, is_read, created_at DESC) WHERE is_read = false;

-- Email queue indexes
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled_at ON email_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled ON email_queue(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON email_queue(created_at DESC);

-- User management indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_team ON users(team);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Search optimization
CREATE INDEX IF NOT EXISTS idx_credit_articles_title_gin ON credit_articles USING gin(to_tsvector('english', title));
```

---

## 🔧 Apply Indexes Script

Save this as `apply-indexes.sql` and run it:

```sql
-- ============================================
-- Apply all recommended indexes
-- Run this script on both ESG and Credit databases
-- ============================================

-- Set statement timeout
SET statement_timeout = '5min';

-- Begin transaction
BEGIN;

-- Credit Articles Performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_articles_date 
  ON credit_articles(date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_articles_region 
  ON credit_articles(region);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_articles_sector 
  ON credit_articles(sector);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_articles_region_sector_date 
  ON credit_articles(region, sector, date DESC);

-- Events Performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_date 
  ON events(date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_source 
  ON events(source);

-- Alert System Performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_user_unread 
  ON alerts(user_id, is_read, created_at DESC) 
  WHERE is_read = false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_type 
  ON alerts(type);

-- Email Queue Performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_queue_status_scheduled 
  ON email_queue(status, scheduled_at) 
  WHERE status = 'pending';

-- Full-text search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_articles_title_search 
  ON credit_articles USING gin(to_tsvector('english', title));

COMMIT;

-- Analyze tables to update statistics
ANALYZE credit_articles;
ANALYZE events;
ANALYZE alerts;
ANALYZE email_queue;
ANALYZE users;

-- Show table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Show index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

---

## 📈 Performance Monitoring Queries

### Check Slow Queries
```sql
-- Enable pg_stat_statements (run once)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slow queries
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100 -- queries taking more than 100ms
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Check Index Usage
```sql
-- Find unused indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelname NOT LIKE '%pkey%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Check Table Bloat
```sql
-- Check for table bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  n_dead_tup,
  n_live_tup,
  ROUND((n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0)), 2) AS dead_ratio
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY n_dead_tup DESC
LIMIT 20;
```

---

## 🛠️ Maintenance Tasks

### Regular Maintenance Script
```sql
-- Run weekly
VACUUM ANALYZE credit_articles;
VACUUM ANALYZE events;
VACUUM ANALYZE alerts;
VACUUM ANALYZE email_queue;

-- Run monthly
VACUUM FULL ANALYZE users;
REINDEX DATABASE your_database_name;
```

### Automated Maintenance (Add to cron)
```bash
# Weekly vacuum (every Sunday at 2 AM)
0 2 * * 0 psql -U postgres -d credit_db -c "VACUUM ANALYZE;"

# Monthly full vacuum (first day of month at 3 AM)
0 3 1 * * psql -U postgres -d credit_db -c "VACUUM FULL ANALYZE;"
```

---

## ⚡ Query Optimization Tips

### Use Proper Filtering
```typescript
// ✅ Good - Uses indexes
const articles = await creditPrisma.credit_articles.findMany({
  where: {
    date: '2025-10-15',
    region: 'global',
  },
  orderBy: { date: 'desc' },
  take: 20,
});

// ❌ Bad - No indexes used
const articles = await creditPrisma.credit_articles.findMany({
  where: {
    title: { contains: 'bond' }, // Full scan
  },
});
```

### Select Only Needed Fields
```typescript
// ✅ Good - Only select needed fields
const articles = await creditPrisma.credit_articles.findMany({
  select: {
    id: true,
    title: true,
    date: true,
    region: true,
  },
});

// ❌ Bad - Fetches all fields
const articles = await creditPrisma.credit_articles.findMany();
```

### Use Pagination
```typescript
// ✅ Good - Paginated
const articles = await creditPrisma.credit_articles.findMany({
  take: 20,
  skip: page * 20,
});

// ❌ Bad - Fetches everything
const articles = await creditPrisma.credit_articles.findMany();
```

---

## 🔍 Connection Pooling

### Prisma Connection Pool Settings
```typescript
// packages/db-credit/src/index.ts
import { PrismaClient } from '../generated/client';

const globalForPrisma = global as unknown as {
  creditPrisma: PrismaClient | undefined;
};

export const creditPrisma =
  globalForPrisma.creditPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn']
      : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL_CREDIT,
      },
    },
    // Connection pool settings
    // Adjust based on your server capacity
    // Formula: (number_of_physical_cpus × 2) + effective_spindle_count
    // For most cloud instances: 10-20 is a good start
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.creditPrisma = creditPrisma;
}
```

### Database Connection String with Pool Settings
```bash
# PostgreSQL connection with pool settings
DATABASE_URL_CREDIT="postgresql://user:password@localhost:5432/credit_db?schema=public&connection_limit=20&pool_timeout=10"
```

---

## 📊 Expected Performance Metrics

After applying these optimizations:

- Article listing: < 100ms
- Event listing: < 150ms
- Alert queries: < 50ms
- Email queue processing: < 200ms
- Dashboard analytics: < 500ms
- Search queries: < 300ms

Monitor these with your APM tool and adjust indexes as needed.
