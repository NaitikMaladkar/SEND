import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/email.dart';
import '../models/contact.dart';
import 'supabase_service.dart';

class ApiService {
  static const String _baseUrl = 'https://send.dedyn.io/api';

  static Map<String, String> get _headers {
    final token = SupabaseService.accessToken;
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  static Map<String, String> get _jsonHeaders {
    return {
      'Content-Type': 'application/json',
    };
  }

  // ── Emails ───────────────────────────────────────────────────────

  static Future<List<Email>> fetchEmails({String folder = 'inbox'}) async {
    final uri = Uri.parse('$_baseUrl/emails?folder=$folder');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);
      return data.map((json) => Email.fromJson(json as Map<String, dynamic>)).toList();
    } else if (response.statusCode == 401) {
      throw ApiException('Session expired. Please sign in again.', 401);
    } else {
      final body = jsonDecode(response.body);
      final message = body['error'] ?? body['message'] ?? 'Failed to fetch emails';
      throw ApiException(message, response.statusCode);
    }
  }

  static Future<Email> fetchEmailById(String id) async {
    final uri = Uri.parse('$_baseUrl/emails/$id');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      return Email.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
    } else if (response.statusCode == 404) {
      throw ApiException('Email not found', 404);
    } else {
      final body = jsonDecode(response.body);
      final message = body['error'] ?? body['message'] ?? 'Failed to fetch email';
      throw ApiException(message, response.statusCode);
    }
  }

  static Future<Email> markAsRead(String id) async {
    final uri = Uri.parse('$_baseUrl/emails/$id/read');
    final response = await http.patch(uri, headers: _headers);

    if (response.statusCode == 200) {
      return Email.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
    } else {
      final body = jsonDecode(response.body);
      final message = body['error'] ?? body['message'] ?? 'Failed to mark email as read';
      throw ApiException(message, response.statusCode);
    }
  }

  static Future<Email> markAsUnread(String id) async {
    final uri = Uri.parse('$_baseUrl/emails/$id/unread');
    final response = await http.patch(uri, headers: _headers);

    if (response.statusCode == 200) {
      return Email.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
    } else {
      final body = jsonDecode(response.body);
      final message = body['error'] ?? body['message'] ?? 'Failed to mark email as unread';
      throw ApiException(message, response.statusCode);
    }
  }

  static Future<Email> toggleStar(String id) async {
    final uri = Uri.parse('$_baseUrl/emails/$id/star');
    final response = await http.patch(uri, headers: _headers);

    if (response.statusCode == 200) {
      return Email.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
    } else {
      final body = jsonDecode(response.body);
      final message = body['error'] ?? body['message'] ?? 'Failed to star email';
      throw ApiException(message, response.statusCode);
    }
  }

  static Future<void> moveToTrash(String id) async {
    final uri = Uri.parse('$_baseUrl/emails/$id/trash');
    final response = await http.patch(uri, headers: _headers);

    if (response.statusCode != 200) {
      final body = jsonDecode(response.body);
      final message = body['error'] ?? body['message'] ?? 'Failed to move email to trash';
      throw ApiException(message, response.statusCode);
    }
  }

  static Future<void> restoreFromTrash(String id) async {
    final uri = Uri.parse('$_baseUrl/emails/$id/restore');
    final response = await http.patch(uri, headers: _headers);

    if (response.statusCode != 200) {
      final body = jsonDecode(response.body);
      final message = body['error'] ?? body['message'] ?? 'Failed to restore email';
      throw ApiException(message, response.statusCode);
    }
  }

  static Future<void> deleteEmailPermanently(String id) async {
    final uri = Uri.parse('$_baseUrl/emails/$id');
    final response = await http.delete(uri, headers: _headers);

    if (response.statusCode != 200 && response.statusCode != 204) {
      final body = response.body.isNotEmpty ? jsonDecode(response.body) : {};
      final message = body['error'] ?? body['message'] ?? 'Failed to delete email';
      throw ApiException(message, response.statusCode);
    }
  }

  static Future<Email> sendEmail({
    required String to,
    required String subject,
    required String body,
    String? replyToId,
  }) async {
    final uri = Uri.parse('$_baseUrl/emails/send');
    final response = await http.post(
      uri,
      headers: _headers,
      body: jsonEncode({
        'to': to,
        'subject': subject,
        'body': body,
        if (replyToId != null) 'reply_to_id': replyToId,
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return Email.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
    } else {
      final bodyJson = jsonDecode(response.body);
      final message = bodyJson['error'] ?? bodyJson['message'] ?? 'Failed to send email';
      throw ApiException(message, response.statusCode);
    }
  }

  // ── Contacts ─────────────────────────────────────────────────────

  static Future<List<Contact>> fetchContacts() async {
    final uri = Uri.parse('$_baseUrl/contacts');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);
      return data.map((json) => Contact.fromJson(json as Map<String, dynamic>)).toList();
    } else {
      final body = jsonDecode(response.body);
      final message = body['error'] ?? body['message'] ?? 'Failed to fetch contacts';
      throw ApiException(message, response.statusCode);
    }
  }

  static Future<Contact> createContact({
    required String name,
    required String email,
    String? phone,
    String? company,
    String? notes,
  }) async {
    final uri = Uri.parse('$_baseUrl/contacts');
    final response = await http.post(
      uri,
      headers: _headers,
      body: jsonEncode({
        'name': name,
        'email': email,
        if (phone != null) 'phone': phone,
        if (company != null) 'company': company,
        if (notes != null) 'notes': notes,
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return Contact.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
    } else {
      final body = jsonDecode(response.body);
      final message = body['error'] ?? body['message'] ?? 'Failed to create contact';
      throw ApiException(message, response.statusCode);
    }
  }

  static Future<Contact> updateContact({
    required String id,
    required String name,
    required String email,
    String? phone,
    String? company,
    String? notes,
  }) async {
    final uri = Uri.parse('$_baseUrl/contacts/$id');
    final response = await http.put(
      uri,
      headers: _headers,
      body: jsonEncode({
        'name': name,
        'email': email,
        if (phone != null) 'phone': phone,
        if (company != null) 'company': company,
        if (notes != null) 'notes': notes,
      }),
    );

    if (response.statusCode == 200) {
      return Contact.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
    } else {
      final body = jsonDecode(response.body);
      final message = body['error'] ?? body['message'] ?? 'Failed to update contact';
      throw ApiException(message, response.statusCode);
    }
  }

  static Future<void> deleteContact(String id) async {
    final uri = Uri.parse('$_baseUrl/contacts/$id');
    final response = await http.delete(uri, headers: _headers);

    if (response.statusCode != 200 && response.statusCode != 204) {
      final body = response.body.isNotEmpty ? jsonDecode(response.body) : {};
      final message = body['error'] ?? body['message'] ?? 'Failed to delete contact';
      throw ApiException(message, response.statusCode);
    }
  }

  // ── User ─────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> fetchProfile() async {
    final uri = Uri.parse('$_baseUrl/user/profile');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    } else {
      return {};
    }
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;

  const ApiException(this.message, this.statusCode);

  @override
  String toString() => 'ApiException($statusCode): $message';
}
