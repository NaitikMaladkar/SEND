class Email {
  final String id;
  final String userId;
  final String from;
  final String to;
  final String subject;
  final String body;
  final String folder;
  final bool isRead;
  final bool isDeleted;
  final bool isStarred;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? replyToId;

  Email({
    required this.id,
    required this.userId,
    required this.from,
    required this.to,
    required this.subject,
    required this.body,
    required this.folder,
    this.isRead = false,
    this.isDeleted = false,
    this.isStarred = false,
    required this.createdAt,
    required this.updatedAt,
    this.replyToId,
  });

  factory Email.fromJson(Map<String, dynamic> json) {
    return Email(
      id: json['id'] as String? ?? '',
      userId: json['user_id'] as String? ?? '',
      from: json['from'] as String? ?? '',
      to: json['to'] as String? ?? '',
      subject: json['subject'] as String? ?? '(No Subject)',
      body: json['body'] as String? ?? '',
      folder: json['folder'] as String? ?? 'inbox',
      isRead: json['is_read'] as bool? ?? false,
      isDeleted: json['is_deleted'] as bool? ?? false,
      isStarred: json['is_starred'] as bool? ?? false,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : DateTime.now(),
      replyToId: json['reply_to_id'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'from': from,
      'to': to,
      'subject': subject,
      'body': body,
      'folder': folder,
      'is_read': isRead ? 1 : 0,
      'is_deleted': isDeleted ? 1 : 0,
      'is_starred': isStarred ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'reply_to_id': replyToId,
    };
  }

  factory Email.fromSqlite(Map<String, dynamic> row) {
    return Email(
      id: row['id'] as String,
      userId: row['user_id'] as String,
      from: row['from_addr'] as String,
      to: row['to_addr'] as String,
      subject: row['subject'] as String,
      body: row['body'] as String,
      folder: row['folder'] as String,
      isRead: (row['is_read'] as int) == 1,
      isDeleted: (row['is_deleted'] as int) == 1,
      isStarred: (row['is_starred'] as int) == 1,
      createdAt: DateTime.parse(row['created_at'] as String),
      updatedAt: DateTime.parse(row['updated_at'] as String),
      replyToId: row['reply_to_id'] as String?,
    );
  }

  Map<String, dynamic> toSqlite() {
    return {
      'id': id,
      'user_id': userId,
      'from_addr': from,
      'to_addr': to,
      'subject': subject,
      'body': body,
      'folder': folder,
      'is_read': isRead ? 1 : 0,
      'is_deleted': isDeleted ? 1 : 0,
      'is_starred': isStarred ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'reply_to_id': replyToId,
    };
  }

  Email copyWith({
    String? id,
    String? userId,
    String? from,
    String? to,
    String? subject,
    String? body,
    String? folder,
    bool? isRead,
    bool? isDeleted,
    bool? isStarred,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? replyToId,
  }) {
    return Email(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      from: from ?? this.from,
      to: to ?? this.to,
      subject: subject ?? this.subject,
      body: body ?? this.body,
      folder: folder ?? this.folder,
      isRead: isRead ?? this.isRead,
      isDeleted: isDeleted ?? this.isDeleted,
      isStarred: isStarred ?? this.isStarred,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      replyToId: replyToId ?? this.replyToId,
    );
  }

  String get senderName {
    final parts = from.split('<');
    if (parts.length > 1) {
      return parts[0].trim();
    }
    return from.split('@').first;
  }

  String get recipientName {
    final parts = to.split('<');
    if (parts.length > 1) {
      return parts[0].trim();
    }
    return to.split('@').first;
  }

  String get senderEmail {
    if (from.contains('<') && from.contains('>')) {
      final match = RegExp(r'<(.+?)>').firstMatch(from);
      return match?.group(1) ?? from;
    }
    return from;
  }

  String get recipientEmail {
    if (to.contains('<') && to.contains('>')) {
      final match = RegExp(r'<(.+?)>').firstMatch(to);
      return match?.group(1) ?? to;
    }
    return to;
  }

  String get preview {
    final cleaned = body.replaceAll(RegExp(r'\s+'), ' ').trim();
    return cleaned.length > 120 ? '${cleaned.substring(0, 120)}...' : cleaned;
  }
}
