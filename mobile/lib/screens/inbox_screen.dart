import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../models/email.dart';
import '../services/api_service.dart';
import '../services/database_service.dart';
import '../services/supabase_service.dart';
import '../widgets/email_detail.dart';
import '../widgets/email_list_item.dart';

class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> with TickerProviderStateMixin {
  String _currentFolder = 'inbox';
  List<Email> _emails = [];
  Email? _selectedEmail;
  bool _isLoading = true;
  bool _isOnline = true;
  String? _error;
  String? _searchQuery;
  String _userId = '';
  String _userEmail = '';
  int _inboxUnread = 0;
  int _sentCount = 0;
  int _trashCount = 0;

  final _scaffoldKey = GlobalKey<ScaffoldState>();
  final _searchController = TextEditingController();
  final _listScrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _userId = SupabaseService.currentUserId;
    _userEmail = SupabaseService.currentUserEmail;
    _loadInitialData();
    _listenToConnectivity();
    _setupRealtime();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _listScrollController.dispose();
    SupabaseService.unsubscribeAll();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    _error = null;
    try {
      final emails = await ApiService.fetchEmails(folder: _currentFolder);
      await DatabaseService.upsertEmails(emails);
      if (mounted) {
        setState(() {
          _emails = emails;
          _isLoading = false;
        });
      }
    } catch (e) {
      try {
        final cached = await DatabaseService.getEmails(userId: _userId, folder: _currentFolder);
        if (mounted) {
          setState(() {
            _emails = cached;
            _isLoading = false;
            _isOnline = false;
            _error = 'Showing cached emails. You are offline.';
          });
        }
      } catch (_) {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _error = 'Failed to load emails. Pull down to retry.';
          });
        }
      }
    }
    await _loadFolderCounts();
  }

  Future<void> _loadFolderCounts() async {
    try {
      final inboxEmails = await DatabaseService.getEmails(userId: _userId, folder: 'inbox');
      final sentEmails = await DatabaseService.getEmails(userId: _userId, folder: 'sent');
      final trashEmails = await DatabaseService.getTrashEmails(userId: _userId);
      final inboxUnread = await DatabaseService.getUnreadCount(userId: _userId, folder: 'inbox');
      if (mounted) {
        setState(() {
          _inboxUnread = inboxUnread;
          _sentCount = sentEmails.length;
          _trashCount = trashEmails.length;
        });
      }
    } catch (_) {}
  }

  void _listenToConnectivity() {
    Connectivity().onConnectivityChanged.listen((result) {
      final wasOffline = !_isOnline;
      final nowOnline = result.any((c) => c != ConnectivityResult.none);
      if (wasOffline && nowOnline) {
        setState(() => _isOnline = true);
        _loadInitialData();
      } else if (!nowOnline) {
        setState(() => _isOnline = false);
      }
    });
  }

  void _setupRealtime() {
    SupabaseService.subscribeToEmails(
      userId: _userId,
      onInsert: (data) {
        final email = Email.fromJson(data);
        if (email.folder == _currentFolder) {
          DatabaseService.upsertEmail(email);
          if (mounted) {
            setState(() {
              _emails.insert(0, email);
            });
          }
          _loadFolderCounts();
        } else {
          DatabaseService.upsertEmail(email);
          _loadFolderCounts();
        }
      },
      onUpdate: (data) {
        final updated = Email.fromJson(data);
        DatabaseService.upsertEmail(updated);
        if (mounted) {
          final idx = _emails.indexWhere((e) => e.id == updated.id);
          if (idx >= 0) {
            setState(() {
              _emails[idx] = updated;
              if (_selectedEmail?.id == updated.id) {
                _selectedEmail = updated;
              }
            });
          }
        }
        _loadFolderCounts();
      },
      onDelete: (id) {
        DatabaseService.deleteEmailPermanently(id);
        if (mounted) {
          setState(() {
            _emails.removeWhere((e) => e.id == id);
            if (_selectedEmail?.id == id) {
              _selectedEmail = null;
            }
          });
        }
        _loadFolderCounts();
      },
    );
  }

  Future<void> _switchFolder(String folder) async {
    if (folder == _currentFolder) {
      Navigator.pop(context);
      return;
    }
    Navigator.pop(context);
    setState(() {
      _currentFolder = folder;
      _selectedEmail = null;
      _searchQuery = null;
      _searchController.clear();
    });
    await _loadInitialData();
  }

  Future<void> _refreshEmails() async {
    setState(() => _error = null);
    await _loadInitialData();
  }

  Future<void> _selectEmail(Email email) async {
    setState(() => _selectedEmail = email);
    if (!email.isRead) {
      try {
        final updated = await ApiService.markAsRead(email.id);
        await DatabaseService.markEmailRead(email.id);
        if (mounted) {
          setState(() {
            final idx = _emails.indexWhere((e) => e.id == email.id);
            if (idx >= 0) _emails[idx] = updated;
            _selectedEmail = updated;
          });
          _loadFolderCounts();
        }
      } catch (_) {
        await DatabaseService.markEmailRead(email.id);
        if (mounted) {
          setState(() {
            final idx = _emails.indexWhere((e) => e.id == email.id);
            if (idx >= 0) {
              _emails[idx] = _emails[idx].copyWith(isRead: true);
            }
            _selectedEmail = email.copyWith(isRead: true);
          });
          _loadFolderCounts();
        }
      }
    }
  }

  Future<void> _toggleStar(Email email) async {
    final newState = !email.isStarred;
    setState(() {
      final idx = _emails.indexWhere((e) => e.id == email.id);
      if (idx >= 0) _emails[idx] = _emails[idx].copyWith(isStarred: newState);
      if (_selectedEmail?.id == email.id) {
        _selectedEmail = _selectedEmail!.copyWith(isStarred: newState);
      }
    });
    try {
      await ApiService.toggleStar(email.id);
      await DatabaseService.toggleEmailStar(email.id, newState);
    } catch (_) {}
  }

  Future<void> _moveToTrash(Email email) async {
    final updated = email.copyWith(folder: 'trash', isDeleted: true);
    setState(() {
      _emails.removeWhere((e) => e.id == email.id);
      _selectedEmail = null;
    });
    try {
      await ApiService.moveToTrash(email.id);
    } catch (_) {}
    await DatabaseService.moveEmailToTrash(email.id);
    _loadFolderCounts();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Moved to trash'), duration: Duration(seconds: 2)),
      );
    }
  }

  Future<void> _restoreFromTrash(Email email) async {
    final targetFolder = 'inbox';
    final updated = email.copyWith(folder: targetFolder, isDeleted: false);
    setState(() {
      _emails.removeWhere((e) => e.id == email.id);
      _selectedEmail = null;
    });
    try {
      await ApiService.restoreFromTrash(email.id);
    } catch (_) {}
    await DatabaseService.restoreEmailFromTrash(email.id, targetFolder);
    _loadFolderCounts();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Restored to inbox'), duration: Duration(seconds: 2)),
      );
    }
  }

  Future<void> _deletePermanently(Email email) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.warning_amber_rounded, color: Colors.red),
        title: const Text('Permanently Delete?'),
        content: Text('This will permanently delete "${email.subject}". This action cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete Forever'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() {
      _emails.removeWhere((e) => e.id == email.id);
      _selectedEmail = null;
    });
    try {
      await ApiService.deleteEmailPermanently(email.id);
    } catch (_) {}
    await DatabaseService.deleteEmailPermanently(email.id);
    _loadFolderCounts();
  }

  Future<void> _toggleRead(Email email) async {
    final newRead = !email.isRead;
    setState(() {
      final idx = _emails.indexWhere((e) => e.id == email.id);
      if (idx >= 0) _emails[idx] = _emails[idx].copyWith(isRead: newRead);
      if (_selectedEmail?.id == email.id) {
        _selectedEmail = _selectedEmail!.copyWith(isRead: newRead);
      }
    });
    try {
      if (newRead) {
        await ApiService.markAsRead(email.id);
      } else {
        await ApiService.markAsUnread(email.id);
      }
    } catch (_) {}
    if (newRead) {
      await DatabaseService.markEmailRead(email.id);
    } else {
      await DatabaseService.markEmailUnread(email.id);
    }
    _loadFolderCounts();
  }

  Future<void> _handleSignOut() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out?'),
        content: const Text('You will need to sign in again to access your emails.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Sign Out')),
        ],
      ),
    );
    if (confirmed != true) return;
    await SupabaseService.signOut();
    await DatabaseService.deleteAllEmailsForUser(_userId);
    await DatabaseService.deleteAllContactsForUser(_userId);
    if (mounted) context.go('/login');
  }

  List<Email> get _filteredEmails {
    var emails = _emails;
    if (_searchQuery != null && _searchQuery!.isNotEmpty) {
      final query = _searchQuery!.toLowerCase();
      emails = emails.where((e) {
        return e.subject.toLowerCase().contains(query) ||
            e.from.toLowerCase().contains(query) ||
            e.to.toLowerCase().contains(query) ||
            e.body.toLowerCase().contains(query);
      }).toList();
    }
    return emails;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return PopScope(
      canPop: _selectedEmail == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(() => _selectedEmail = null);
      },
      child: Scaffold(
        key: _scaffoldKey,
        appBar: _buildAppBar(theme, colorScheme),
        drawer: _buildDrawer(theme, colorScheme),
        floatingActionButton: _selectedEmail == null
            ? FloatingActionButton(
                onPressed: () async {
                  final result = await context.push<String>('/compose');
                  if (result == 'sent') _refreshEmails();
                },
                child: const Icon(Icons.edit_rounded),
              )
            : null,
        body: _buildBody(theme, colorScheme),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(ThemeData theme, ColorScheme colorScheme) {
    final folderTitle = _currentFolder == 'inbox'
        ? 'Inbox'
        : _currentFolder == 'sent'
            ? 'Sent'
            : 'Trash';

    if (_selectedEmail != null) {
      return AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => setState(() => _selectedEmail = null),
        ),
        title: Text(
          _selectedEmail!.subject,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.titleMedium,
        ),
        actions: [
          if (_currentFolder == 'trash')
            IconButton(
              icon: const Icon(Icons.restore_rounded),
              tooltip: 'Restore',
              onPressed: () => _restoreFromTrash(_selectedEmail!),
            ),
          IconButton(
            icon: const Icon(Icons.delete_outline),
            tooltip: _currentFolder == 'trash' ? 'Delete Forever' : 'Move to Trash',
            onPressed: () {
              if (_currentFolder == 'trash') {
                _deletePermanently(_selectedEmail!);
              } else {
                _moveToTrash(_selectedEmail!);
              }
            },
          ),
          const SizedBox(width: 4),
        ],
      );
    }

    return AppBar(
      title: Text(folderTitle),
      actions: [
        if (!_isOnline)
          Padding(
            padding: const EdgeInsets.only(right: 4),
            child: Chip(
              avatar: const Icon(Icons.cloud_off, size: 14, color: Colors.orange),
              label: Text('Offline', style: theme.textTheme.labelSmall),
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
        IconButton(
          icon: const Icon(Icons.search_rounded),
          tooltip: 'Search',
          onPressed: () => _showSearchDialog(theme, colorScheme),
        ),
        PopupMenuButton<String>(
          onSelected: (value) {
            if (value == 'refresh') _refreshEmails();
          },
          itemBuilder: (context) => [
            const PopupMenuItem(value: 'refresh', child: ListTile(leading: Icon(Icons.refresh), title: Text('Refresh'), dense: true, contentPadding: EdgeInsets.zero)),
          ],
        ),
        const SizedBox(width: 4),
      ],
    );
  }

  void _showSearchDialog(ThemeData theme, ColorScheme colorScheme) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Search Emails'),
        content: TextField(
          controller: _searchController,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Search by subject, sender, or content...',
            prefixIcon: Icon(Icons.search),
          ),
          onSubmitted: (value) {
            Navigator.pop(ctx);
            setState(() => _searchQuery = value.trim().isNotEmpty ? value.trim() : null);
          },
        ),
        actions: [
          TextButton(
            onPressed: () {
              _searchController.clear();
              Navigator.pop(ctx);
              setState(() => _searchQuery = null);
            },
            child: const Text('Clear'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() => _searchQuery = _searchController.text.trim().isNotEmpty ? _searchController.text.trim() : null);
            },
            child: const Text('Search'),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawer(ThemeData theme, ColorScheme colorScheme) {
    return Drawer(
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildDrawerHeader(theme, colorScheme),
            const SizedBox(height: 8),
            _buildDrawerItem(
              icon: Icons.inbox_rounded,
              label: 'Inbox',
              badge: _inboxUnread > 0 ? _inboxUnread.toString() : null,
              isSelected: _currentFolder == 'inbox',
              colorScheme: colorScheme,
              onTap: () => _switchFolder('inbox'),
            ),
            _buildDrawerItem(
              icon: Icons.send_rounded,
              label: 'Sent',
              badge: _sentCount > 0 ? _sentCount.toString() : null,
              isSelected: _currentFolder == 'sent',
              colorScheme: colorScheme,
              onTap: () => _switchFolder('sent'),
            ),
            _buildDrawerItem(
              icon: Icons.delete_outline_rounded,
              label: 'Trash',
              badge: _trashCount > 0 ? _trashCount.toString() : null,
              isSelected: _currentFolder == 'trash',
              colorScheme: colorScheme,
              onTap: () => _switchFolder('trash'),
            ),
            const Divider(),
            _buildDrawerItem(
              icon: Icons.contacts_outlined,
              label: 'Contacts',
              colorScheme: colorScheme,
              onTap: () {
                Navigator.pop(context);
                context.push('/contacts');
              },
            ),
            const Spacer(),
            _buildDrawerItem(
              icon: Icons.logout_rounded,
              label: 'Sign Out',
              colorScheme: colorScheme,
              onTap: _handleSignOut,
              labelColor: colorScheme.error,
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildDrawerHeader(ThemeData theme, ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: colorScheme.primaryContainer,
            child: Text(
              _userEmail.isNotEmpty ? _userEmail.substring(0, 1).toUpperCase() : '?',
              style: theme.textTheme.headlineSmall?.copyWith(
                color: colorScheme.onPrimaryContainer,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            _userEmail,
            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            'SEND Webmail',
            style: theme.textTheme.bodySmall?.copyWith(color: colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawerItem({
    required IconData icon,
    required String label,
    String? badge,
    bool isSelected = false,
    required ColorScheme colorScheme,
    required VoidCallback onTap,
    Color? labelColor,
  }) {
    return ListTile(
      leading: Icon(
        icon,
        color: isSelected ? colorScheme.primary : (labelColor ?? colorScheme.onSurfaceVariant),
      ),
      title: Text(
        label,
        style: TextStyle(
          fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
          color: isSelected ? colorScheme.primary : (labelColor ?? colorScheme.onSurface),
        ),
      ),
      trailing: badge != null
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: isSelected ? colorScheme.primary : colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                badge,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: isSelected ? colorScheme.onPrimary : colorScheme.onSurfaceVariant,
                ),
              ),
            )
          : null,
      selected: isSelected,
      selectedTileColor: colorScheme.primaryContainer.withOpacity(0.4),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      onTap: onTap,
    );
  }

  Widget _buildBody(ThemeData theme, ColorScheme colorScheme) {
    if (_selectedEmail != null) {
      return EmailDetail(
        email: _selectedEmail!,
        onReply: () async {
          final result = await context.push<String>(
            '/compose',
            extra: {
              'replyTo': _selectedEmail,
            },
          );
          if (result == 'sent') _refreshEmails();
        },
        onForward: () async {
          final result = await context.push<String>(
            '/compose',
            extra: {
              'forward': _selectedEmail,
            },
          );
          if (result == 'sent') _refreshEmails();
        },
        onToggleStar: () => _toggleStar(_selectedEmail!),
        onToggleRead: () => _toggleRead(_selectedEmail!),
        onDelete: () {
          if (_currentFolder == 'trash') {
            _deletePermanently(_selectedEmail!);
          } else {
            _moveToTrash(_selectedEmail!);
          }
        },
      );
    }

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_emails.isEmpty) {
      return _buildEmptyState(theme, colorScheme);
    }

    if (_filteredEmails.isEmpty && _searchQuery != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search_off_rounded, size: 64, color: colorScheme.onSurfaceVariant.withOpacity(0.4)),
            const SizedBox(height: 16),
            Text(
              'No emails match "$_searchQuery"',
              style: theme.textTheme.bodyLarge?.copyWith(color: colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => setState(() => _searchQuery = null),
              child: const Text('Clear Search'),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        if (_error != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: colorScheme.tertiaryContainer,
            child: Row(
              children: [
                Icon(Icons.info_outline, size: 16, color: colorScheme.onTertiaryContainer),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _error!,
                    style: TextStyle(color: colorScheme.onTertiaryContainer, fontSize: 12),
                  ),
                ),
                if (!_isOnline)
                  TextButton(
                    onPressed: _refreshEmails,
                    child: const Text('Retry', style: TextStyle(fontSize: 12)),
                  ),
              ],
            ),
          ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _refreshEmails,
            child: ListView.separated(
              controller: _listScrollController,
              padding: const EdgeInsets.symmetric(vertical: 4),
              itemCount: _filteredEmails.length,
              separatorBuilder: (_, __) => const Divider(height: 1, indent: 76),
              itemBuilder: (context, index) {
                final email = _filteredEmails[index];
                return EmailListItem(
                  email: email,
                  onTap: () => _selectEmail(email),
                  onStarTap: () => _toggleStar(email),
                  onSwipeLeft: _currentFolder != 'trash' ? () => _moveToTrash(email) : null,
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState(ThemeData theme, ColorScheme colorScheme) {
    final icon = _currentFolder == 'inbox'
        ? Icons.inbox_rounded
        : _currentFolder == 'sent'
            ? Icons.send_rounded
            : Icons.delete_outline_rounded;
    final title = _currentFolder == 'inbox'
        ? 'No emails in inbox'
        : _currentFolder == 'sent'
            ? 'No sent emails'
            : 'Trash is empty';
    final subtitle = _currentFolder == 'inbox'
        ? 'When you receive email, it will appear here.'
        : _currentFolder == 'sent'
            ? 'Emails you send will appear here.'
            : 'Deleted emails will appear here.';

    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 80, color: colorScheme.onSurfaceVariant.withOpacity(0.25)),
          const SizedBox(height: 16),
          Text(title, style: theme.textTheme.titleMedium?.copyWith(color: colorScheme.onSurfaceVariant)),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: theme.textTheme.bodyMedium?.copyWith(color: colorScheme.onSurfaceVariant.withOpacity(0.7)),
            textAlign: TextAlign.center,
          ),
          if (_currentFolder == 'inbox') ...[
            const SizedBox(height: 24),
            FilledButton.tonal(
              onPressed: () async {
                final result = await context.push<String>('/compose');
                if (result == 'sent') _refreshEmails();
              },
              child: const Text('Compose Email'),
            ),
          ],
        ],
      ),
    );
  }
}
