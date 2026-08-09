import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;
import '../models/email.dart';
import '../models/contact.dart';

class DatabaseService {
  static Database? _database;
  static const String _databaseName = 'send_webmail.db';
  static const int _databaseVersion = 3;

  static Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  static Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, _databaseName);
    return openDatabase(
      path,
      version: _databaseVersion,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
    );
  }

  static Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE emails (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        from_addr TEXT NOT NULL,
        to_addr TEXT NOT NULL,
        subject TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        folder TEXT NOT NULL DEFAULT 'inbox',
        is_read INTEGER NOT NULL DEFAULT 0,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        is_starred INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        reply_to_id TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE contacts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL,
        phone TEXT,
        company TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE INDEX idx_emails_user_folder ON emails(user_id, folder)
    ''');

    await db.execute('''
      CREATE INDEX idx_emails_user_deleted ON emails(user_id, is_deleted)
    ''');

    await db.execute('''
      CREATE INDEX idx_contacts_user ON contacts(user_id)
    ''');
  }

  static Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      await db.execute('ALTER TABLE emails ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0');
    }
    if (oldVersion < 3) {
      await db.execute('ALTER TABLE emails ADD COLUMN reply_to_id TEXT');
    }
  }

  // ── Email Operations ─────────────────────────────────────────────

  static Future<void> upsertEmail(Email email) async {
    final db = await database;
    await db.insert(
      'emails',
      email.toSqlite(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  static Future<void> upsertEmails(List<Email> emails) async {
    final db = await database;
    final batch = db.batch();
    for (final email in emails) {
      batch.insert(
        'emails',
        email.toSqlite(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  static Future<List<Email>> getEmails({
    required String userId,
    required String folder,
  }) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'emails',
      where: 'user_id = ? AND folder = ? AND is_deleted = 0',
      whereArgs: [userId, folder],
      orderBy: 'created_at DESC',
    );
    return maps.map((map) => Email.fromSqlite(map)).toList();
  }

  static Future<List<Email>> getTrashEmails({required String userId}) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'emails',
      where: 'user_id = ? AND is_deleted = 1',
      whereArgs: [userId],
      orderBy: 'created_at DESC',
    );
    return maps.map((map) => Email.fromSqlite(map)).toList();
  }

  static Future<Email?> getEmailById(String id) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'emails',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return Email.fromSqlite(maps.first);
  }

  static Future<void> markEmailRead(String id) async {
    final db = await database;
    final now = DateTime.now().toIso8601String();
    await db.update(
      'emails',
      {'is_read': 1, 'updated_at': now},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> markEmailUnread(String id) async {
    final db = await database;
    final now = DateTime.now().toIso8601String();
    await db.update(
      'emails',
      {'is_read': 0, 'updated_at': now},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> toggleEmailStar(String id, bool isStarred) async {
    final db = await database;
    final now = DateTime.now().toIso8601String();
    await db.update(
      'emails',
      {'is_starred': isStarred ? 1 : 0, 'updated_at': now},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> moveEmailToTrash(String id) async {
    final db = await database;
    final now = DateTime.now().toIso8601String();
    await db.update(
      'emails',
      {'is_deleted': 1, 'folder': 'trash', 'updated_at': now},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> restoreEmailFromTrash(String id, String originalFolder) async {
    final db = await database;
    final now = DateTime.now().toIso8601String();
    await db.update(
      'emails',
      {'is_deleted': 0, 'folder': originalFolder, 'updated_at': now},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> deleteEmailPermanently(String id) async {
    final db = await database;
    await db.delete(
      'emails',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<int> getUnreadCount({
    required String userId,
    required String folder,
  }) async {
    final db = await database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as count FROM emails WHERE user_id = ? AND folder = ? AND is_read = 0 AND is_deleted = 0',
      [userId, folder],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  static Future<void> deleteAllEmailsForUser(String userId) async {
    final db = await database;
    await db.delete(
      'emails',
      where: 'user_id = ?',
      whereArgs: [userId],
    );
  }

  // ── Contact Operations ───────────────────────────────────────────

  static Future<void> upsertContact(Contact contact) async {
    final db = await database;
    await db.insert(
      'contacts',
      contact.toSqlite(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  static Future<void> upsertContacts(List<Contact> contacts) async {
    final db = await database;
    final batch = db.batch();
    for (final contact in contacts) {
      batch.insert(
        'contacts',
        contact.toSqlite(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  static Future<List<Contact>> getContacts({required String userId}) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'contacts',
      where: 'user_id = ?',
      whereArgs: [userId],
      orderBy: 'name ASC',
    );
    return maps.map((map) => Contact.fromSqlite(map)).toList();
  }

  static Future<Contact?> getContactById(String id) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'contacts',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return Contact.fromSqlite(maps.first);
  }

  static Future<void> deleteContact(String id) async {
    final db = await database;
    await db.delete(
      'contacts',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> deleteAllContactsForUser(String userId) async {
    final db = await database;
    await db.delete(
      'contacts',
      where: 'user_id = ?',
      whereArgs: [userId],
    );
  }

  // ── Utility ──────────────────────────────────────────────────────

  static Future<void> clearAll() async {
    final db = await database;
    await db.delete('emails');
    await db.delete('contacts');
  }

  static Future<void> close() async {
    if (_database != null) {
      await _database!.close();
      _database = null;
    }
  }
}
