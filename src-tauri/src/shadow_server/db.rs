//! SQLite database setup and **Install database migrations** for the shadow Desktop Local API.
//!
//! Opens SQLite with WAL journal mode + foreign-key enforcement, then applies all pending
//! `V{n}__{name}.sql` migrations tracked in `_rust_schema_migrations` (Rust-owned; independent
//! of Drizzle's `__drizzle_migrations` ledger).

use std::path::Path;

use rusqlite::Connection;

const MIGRATIONS_TABLE: &str = "_rust_schema_migrations";

struct Migration {
    version: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: "V1__initial_schema",
        sql: include_str!("../../migrations/V1__initial_schema.sql"),
    },
    Migration {
        version: "V2__install_settings",
        sql: include_str!("../../migrations/V2__install_settings.sql"),
    },
];

/// Opens SQLite with WAL + FK, creates the migrations table, and applies all pending migrations.
pub fn open_and_migrate(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("create data dir: {e}"))?;
    }

    let conn = Connection::open(path).map_err(|e| format!("open database {}: {e}", path.display()))?;

    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;",
    )
    .map_err(|e| format!("apply pragmas: {e}"))?;

    run_migrations(&conn)
}

fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(&format!(
        "CREATE TABLE IF NOT EXISTS {MIGRATIONS_TABLE} (
            version TEXT PRIMARY KEY NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )"
    ))
    .map_err(|e| format!("create migrations table: {e}"))?;

    for migration in MIGRATIONS {
        let applied: bool = conn
            .query_row(
                &format!(
                    "SELECT COUNT(*) > 0 FROM {MIGRATIONS_TABLE} WHERE version = ?1"
                ),
                [migration.version],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !applied {
            conn.execute_batch(migration.sql)
                .map_err(|e| format!("run migration {}: {e}", migration.version))?;
            conn.execute(
                &format!(
                    "INSERT INTO {MIGRATIONS_TABLE} (version) VALUES (?1)"
                ),
                [migration.version],
            )
            .map_err(|e| format!("record migration {}: {e}", migration.version))?;
        }
    }

    Ok(())
}
