import os
import sqlite3
import hashlib
from typing import List, Optional, Tuple
from contextlib import contextmanager

# Allow overriding DB path via env var for containerized persistent storage
DATABASE_FILE = os.environ.get("DATABASE_FILE", "sfp_library.db")

@contextmanager
def get_db_connection():
    """
    Establishes a database connection with guaranteed cleanup.
    Use as a context manager to ensure connections are always closed.
    """
    conn = sqlite3.connect(DATABASE_FILE, timeout=10.0)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def setup_database():
    """
    Initializes the database and creates the 'sfp_modules' table
    if it doesn't already exist.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sfp_modules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                vendor TEXT,
                model TEXT,
                serial TEXT,
                eeprom_data BLOB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                sha256 TEXT
            )
        ''')
        # Add sha256 column if missing (SQLite: conditional check)
        cursor.execute("PRAGMA table_info('sfp_modules')")
        cols = {row[1] for row in cursor.fetchall()}
        if 'sha256' not in cols:
            cursor.execute("ALTER TABLE sfp_modules ADD COLUMN sha256 TEXT")
        # Unique index for duplicate detection (by content)
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_sfp_modules_sha256 ON sfp_modules(sha256)")
        conn.commit()

def add_module(name: str, vendor: str, model: str, serial: str, eeprom_data: bytes) -> Tuple[int, bool]:
    """
    Adds a new SFP module's data to the database.
    Uses IMMEDIATE transaction to prevent race conditions.
    
    Returns:
        Tuple of (module_id, is_duplicate)
    """
    digest = hashlib.sha256(eeprom_data).hexdigest()
    
    with get_db_connection() as conn:
        # Use IMMEDIATE transaction to lock the database
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        
        # Check for duplicate first (within the transaction)
        cursor.execute("SELECT id FROM sfp_modules WHERE sha256 = ? LIMIT 1", (digest,))
        existing = cursor.fetchone()
        if existing:
            return int(existing[0]), True
        
        # Insert new module
        cursor.execute(
            "INSERT INTO sfp_modules (name, vendor, model, serial, eeprom_data, sha256) VALUES (?, ?, ?, ?, ?, ?)",
            (name, vendor, model, serial, sqlite3.Binary(eeprom_data), digest)
        )
        return cursor.lastrowid, False

def get_all_modules() -> List[sqlite3.Row]:
    """
    Fetches the list of all saved modules (basic info only).
    We exclude the large 'eeprom_data' blob for this list view.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, vendor, model, serial, created_at FROM sfp_modules ORDER BY name")
        modules = cursor.fetchall()
        return modules

def get_module_eeprom(module_id: int) -> Optional[bytes]:
    """
    Fetches only the raw EEPROM binary data for a specific module ID.
    This is used to get the data for writing to a new module.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT eeprom_data FROM sfp_modules WHERE id = ?", (module_id,))
        row = cursor.fetchone()
        if row:
            return bytes(row['eeprom_data'])
        return None

def delete_module(module_id: int) -> bool:
    """Deletes a module from the database by its ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sfp_modules WHERE id = ?", (module_id,))
        conn.commit()
        return cursor.rowcount > 0
