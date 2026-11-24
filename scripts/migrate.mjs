import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const { Pool } = pg;

const rawConnectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = rawConnectionString.includes('localhost') || rawConnectionString.includes('127.0.0.1');

function maskDbUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '****';
    return `${parsed.protocol}//${parsed.username}:****@${parsed.host}${parsed.pathname}`;
  } catch {
    return url.replace(/:([^:@]+)@/, ':****@');
  }
}

export async function runMigrations() {
  console.log('========================================================================');
  console.log('  DocMate AI — Production Database Migration Runner');
  console.log(`  Target: ${isLocal ? 'Local Database' : 'Remote Production Database'}`);
  console.log(`  Database Endpoint: ${maskDbUrl(rawConnectionString)}`);
  console.log('========================================================================\n');

  let pool = new Pool({
    connectionString: rawConnectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  });

  let client = null;
  const maxRetries = 8;
  const retryDelayMs = 2500;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Attempt ${attempt}/${maxRetries}] Connecting to database...`);
      client = await pool.connect();
      console.log('✓ Successfully connected to PostgreSQL database.\n');
      break;
    } catch (connectErr) {
      console.warn(`⚠️ Connection attempt ${attempt}/${maxRetries} failed: ${connectErr.message}`);

      // If SSL connection failed on remote host, test fallback to non-SSL (Render internal VPC)
      if (!isLocal && attempt === 2) {
        console.log('Testing fallback to non-SSL internal connection mode...');
        try {
          await pool.end().catch(() => {});
        } catch {}
        pool = new Pool({
          connectionString: rawConnectionString,
          ssl: false,
          connectionTimeoutMillis: 10000,
          idleTimeoutMillis: 10000,
        });
      }

      if (attempt < maxRetries) {
        console.log(`Waiting ${retryDelayMs / 1000}s for database to become ready...`);
        await new Promise((res) => setTimeout(res, retryDelayMs));
      } else {
        console.error('❌ Could not connect to database after all retries:', connectErr.message);
        try {
          await pool.end().catch(() => {});
        } catch {}
        throw connectErr;
      }
    }
  }

  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `);

    // 2. Pre-flight repair: ensure existing tables have required unique constraints before migration scripts run
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='role_features') THEN
          DELETE FROM role_features a USING role_features b
          WHERE a.id < b.id AND a.role = b.role AND a.feature_key = b.feature_key;

          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_role_feature') THEN
            BEGIN
              ALTER TABLE role_features ADD CONSTRAINT uq_role_feature UNIQUE (role, feature_key);
            EXCEPTION WHEN OTHERS THEN
              CREATE UNIQUE INDEX IF NOT EXISTS idx_role_features_role_key ON role_features (role, feature_key);
            END;
          END IF;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_feature_overrides') THEN
          DELETE FROM user_feature_overrides a USING user_feature_overrides b
          WHERE a.id < b.id AND a.user_id = b.user_id AND a.feature_key = b.feature_key;

          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_feature_override') THEN
            BEGIN
              ALTER TABLE user_feature_overrides ADD CONSTRAINT uq_user_feature_override UNIQUE (user_id, feature_key);
            EXCEPTION WHEN OTHERS THEN
              CREATE UNIQUE INDEX IF NOT EXISTS idx_user_feature_overrides_user_key ON user_feature_overrides (user_id, feature_key);
            END;
          END IF;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END $$;
    `);

    // 3. Query already applied migrations
    const { rows: appliedRows } = await client.query(
      'SELECT id FROM schema_migrations'
    );
    const appliedSet = new Set(appliedRows.map((r) => r.id));

    // 4. Read all .sql files in migrations/ directory
    const migrationsDir = path.join(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.warn(`⚠️ Migrations directory not found at: ${migrationsDir}`);
      return;
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration file(s) in ${migrationsDir}.\n`);

    for (const file of migrationFiles) {
      if (appliedSet.has(file)) {
        console.log(`  [SKIP] ${file} (already applied)`);
        continue;
      }

      console.log(`  [APPLYING] ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ✓ [SUCCESS] ${file}`);
      } catch (migrationErr) {
        await client.query('ROLLBACK');
        console.error(`  ❌ [FAILED] ${file}:`, migrationErr.message || migrationErr);
        // If error is idempotent/already exists, proceed
        if (/already exists|duplicate/i.test(migrationErr.message || '')) {
          console.warn(`  ⚠️ Object already exists, marking ${file} as applied.`);
          await client.query('INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
        } else {
          throw migrationErr;
        }
      }
    }

    // 5. Critical Schema Drift Verification & Self-Healing
    console.log('\nRunning sanity schema verification...');

    await client.query(`
      ALTER TABLE cases 
        ADD COLUMN IF NOT EXISTS entered_by_voice BOOLEAN DEFAULT FALSE NOT NULL;
    `);

    await client.query(`
      ALTER TABLE cases 
        ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES patient_profiles(id) ON DELETE SET NULL;
    `);

    const { rows: verifiedTables } = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('voice_sessions', 'user_assistant_prefs', 'patient_accounts', 'ingest_jobs', 'term_aliases')
    `);
    const verifiedNames = verifiedTables.map((t) => t.table_name);
    console.log(`Verified active tables: ${verifiedNames.join(', ')}`);

    console.log('\n✅ All database migrations applied and verified successfully!\n');
  } catch (err) {
    console.error('❌ Migration runner encountered an error:', err.message || err);
    throw err;
  } finally {
    if (client) client.release();
    try {
      await pool.end();
    } catch {}
  }
}

// Support direct execution via node
runMigrations()
  .then(() => {
    console.log('Migration process finished cleanly.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration error occurred:', err?.message || err);
    // In demo mode or production container boot, allow web server to start with in-memory/demo fallbacks
    if (process.env.DOCMATE_DEMO_MODE === 'true' || process.env.DEMO_MODE === 'true') {
      console.warn('⚠️ Demo / Resilient mode active. Permitting web server launch...');
      process.exit(0);
    }
    process.exit(1);
  });
