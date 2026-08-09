import 'dart:async';
import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  static const String _supabaseUrl = 'https://lmtueeyxkpjtedhelfdp.supabase.co';
  static const String _supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdHVlZXl4a3BqdGVkaGVsZmRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNjQ0NTAsImV4cCI6MjEwMTg0MDQ1MH0.rQMyVNIq6Uw0z_3TtUeU3BzwTWesrQrDdjLz82WW9HA';
  static const String _mailDomain = 'send.dedyn.io';

  static SupabaseClient? _client;
  static GoTrueClient? _auth;
  static RealtimeClient? _realtime;

  static Future<void> initialize() async {
    await Supabase.initialize(
      url: _supabaseUrl,
      anonKey: _supabaseAnonKey,
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.pkce,
      ),
    );
    _client = Supabase.instance.client;
    _auth = _client!.auth;
  }

  static SupabaseClient get client {
    if (_client == null) {
      throw StateError('Supabase has not been initialized. Call initialize() first.');
    }
    return _client!;
  }

  static GoTrueClient get auth {
    if (_auth == null) {
      throw StateError('Supabase Auth has not been initialized.');
    }
    return _auth!;
  }

  static String get supabaseUrl => _supabaseUrl;
  static String get mailDomain => _mailDomain;

  static String get currentUserEmail {
    final user = _client?.auth.currentUser;
    if (user == null) {
      throw StateError('No user is currently signed in.');
    }
    return user.email ?? '';
  }

  static String get currentUserId {
    final user = _client?.auth.currentUser;
    if (user == null) {
      throw StateError('No user is currently signed in.');
    }
    return user.id;
  }

  static bool get isAuthenticated {
    return _client?.auth.currentUser != null;
  }

  static String buildEmail(String username) {
    if (username.contains('@')) {
      return username;
    }
    return '$username@$_mailDomain';
  }

  static String extractUsername(String email) {
    return email.split('@').first;
  }

  static AuthResponse? _lastAuthResponse;

  static Future<AuthResponse> signIn(String username, String password) async {
    final email = buildEmail(username);
    _lastAuthResponse = await auth.signInWithPassword(email: email, password: password);
    return _lastAuthResponse!;
  }

  static Future<AuthResponse> signUp(String username, String password) async {
    final email = buildEmail(username);
    _lastAuthResponse = await auth.signUp(email: email, password: password);
    return _lastAuthResponse!;
  }

  static Future<void> signOut() async {
    await auth.signOut();
  }

  static String? get accessToken {
    return _client?.auth.currentSession?.accessToken;
  }

  static Stream<AuthState> get authStateChanges {
    return _client!.auth.onAuthStateChange;
  }

  static RealtimeChannel subscribeToEmails({
    required String userId,
    required Function(Map<String, dynamic>) onInsert,
    required Function(Map<String, dynamic>) onUpdate,
    required Function(String) onDelete,
  }) {
    final channel = client
        .channel('emails-realtime-$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'emails',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (payload) {
            if (payload.new != null) {
              onInsert(payload.new! as Map<String, dynamic>);
            }
          },
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'emails',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (payload) {
            if (payload.new != null) {
              onUpdate(payload.new! as Map<String, dynamic>);
            }
          },
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.delete,
          schema: 'public',
          table: 'emails',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (payload) {
            if (payload.old != null) {
              final oldData = payload.old as Map<String, dynamic>;
              final id = oldData['id']?.toString() ?? '';
              if (id.isNotEmpty) {
                onDelete(id);
              }
            }
          },
        )
        .subscribe();
    return channel;
  }

  static Future<void> unsubscribeChannel(String channelName) async {
    try {
      await client.removeChannel(client.channel(channelName));
    } catch (_) {}
  }

  static Future<void> unsubscribeAll() async {
    try {
      await client.removeAllChannels();
    } catch (_) {}
  }
}
