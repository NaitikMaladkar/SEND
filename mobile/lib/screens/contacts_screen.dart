import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../models/contact.dart';
import '../services/api_service.dart';
import '../services/database_service.dart';
import '../services/supabase_service.dart';

class ContactsScreen extends StatefulWidget {
  const ContactsScreen({super.key});

  @override
  State<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends State<ContactsScreen> {
  List<Contact> _contacts = [];
  bool _isLoading = true;
  String? _error;
  String _userId = '';
  String? _searchQuery;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _userId = SupabaseService.currentUserId;
    _loadContacts();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadContacts() async {
    setState(() => _isLoading = true);
    _error = null;
    try {
      final contacts = await ApiService.fetchContacts();
      await DatabaseService.upsertContacts(contacts);
      if (mounted) {
        setState(() {
          _contacts = contacts;
          _isLoading = false;
        });
      }
    } catch (e) {
      try {
        final cached = await DatabaseService.getContacts(userId: _userId);
        if (mounted) {
          setState(() {
            _contacts = cached;
            _isLoading = false;
            _error = 'Showing cached contacts.';
          });
        }
      } catch (_) {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _error = 'Failed to load contacts.';
          });
        }
      }
    }
  }

  Future<void> _showAddContactDialog({Contact? contact}) async {
    final isEdit = contact != null;
    final nameController = TextEditingController(text: contact?.name ?? '');
    final emailController = TextEditingController(text: contact?.email ?? '');
    final phoneController = TextEditingController(text: contact?.phone ?? '');
    final companyController = TextEditingController(text: contact?.company ?? '');
    final notesController = TextEditingController(text: contact?.notes ?? '');
    final formKey = GlobalKey<FormState>();

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text(isEdit ? 'Edit Contact' : 'New Contact'),
          content: SingleChildScrollView(
            child: Form(
              key: formKey,
              child: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: nameController,
                      autofocus: true,
                      decoration: const InputDecoration(
                        labelText: 'Name',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Name is required.' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: emailController,
                      keyboardType: TextInputType.emailAddress,
                      textCapitalization: TextCapitalization.none,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        prefixIcon: Icon(Icons.email_outlined),
                      ),
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) return 'Email is required.';
                        if (!RegExp(r'^[\w.-]+@[\w.-]+\.[a-z]{2,}$', caseSensitive: false).hasMatch(v.trim())) {
                          return 'Enter a valid email address.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Phone (optional)',
                        prefixIcon: Icon(Icons.phone_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: companyController,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(
                        labelText: 'Company (optional)',
                        prefixIcon: Icon(Icons.business_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: notesController,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Notes (optional)',
                        alignLabelWithHint: true,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
            FilledButton(
              onPressed: () {
                if (!formKey.currentState!.validate()) return;
                Navigator.of(ctx).pop(true);
              },
              child: Text(isEdit ? 'Save' : 'Create'),
            ),
          ],
        );
      },
    );

    if (result != true) return;

    try {
      if (isEdit) {
        final updated = await ApiService.updateContact(
          id: contact!.id,
          name: nameController.text.trim(),
          email: emailController.text.trim(),
          phone: phoneController.text.trim().isEmpty ? null : phoneController.text.trim(),
          company: companyController.text.trim().isEmpty ? null : companyController.text.trim(),
          notes: notesController.text.trim().isEmpty ? null : notesController.text.trim(),
        );
        await DatabaseService.upsertContact(updated);
      } else {
        final created = await ApiService.createContact(
          name: nameController.text.trim(),
          email: emailController.text.trim(),
          phone: phoneController.text.trim().isEmpty ? null : phoneController.text.trim(),
          company: companyController.text.trim().isEmpty ? null : companyController.text.trim(),
          notes: notesController.text.trim().isEmpty ? null : notesController.text.trim(),
        );
        await DatabaseService.upsertContact(created);
      }
      _loadContacts();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isEdit ? 'Contact updated.' : 'Contact created.'),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  Future<void> _deleteContact(Contact contact) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.warning_amber_rounded, color: Colors.red),
        title: const Text('Delete Contact?'),
        content: Text('Delete "${contact.displayName}" from your contacts?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ApiService.deleteContact(contact.id);
    } catch (_) {}
    await DatabaseService.deleteContact(contact.id);
    _loadContacts();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Contact deleted.'),
          behavior: SnackBarBehavior.floating,
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _composeToContact(Contact contact) async {
    final result = await context.push<String>(
      '/compose',
      extra: {'to': contact.email},
    );
    if (result == 'sent' && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Email sent!'),
          behavior: SnackBarBehavior.floating,
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  List<Contact> get _filteredContacts {
    if (_searchQuery == null || _searchQuery!.isEmpty) return _contacts;
    final query = _searchQuery!.toLowerCase();
    return _contacts.where((c) {
      return c.name.toLowerCase().contains(query) ||
          c.email.toLowerCase().contains(query) ||
          (c.company?.toLowerCase().contains(query) ?? false);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Contacts'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search_rounded),
            tooltip: 'Search',
            onPressed: () {
              showSearch(
                context: context,
                delegate: _ContactSearchDelegate(_contacts),
              );
            },
          ),
          const SizedBox(width: 4),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddContactDialog(),
        child: const Icon(Icons.person_add_rounded),
      ),
      body: _buildBody(theme, colorScheme),
    );
  }

  Widget _buildBody(ThemeData theme, ColorScheme colorScheme) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_contacts.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.contacts_outlined, size: 80, color: colorScheme.onSurfaceVariant.withOpacity(0.25)),
            const SizedBox(height: 16),
            Text('No contacts yet', style: theme.textTheme.titleMedium?.copyWith(color: colorScheme.onSurfaceVariant)),
            const SizedBox(height: 4),
            Text(
              'Tap + to add your first contact.',
              style: theme.textTheme.bodyMedium?.copyWith(color: colorScheme.onSurfaceVariant.withOpacity(0.7)),
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
                Text(_error!, style: TextStyle(color: colorScheme.onTertiaryContainer, fontSize: 12)),
              ],
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text(
            '${_contacts.length} contact${_contacts.length != 1 ? 's' : ''}',
            style: theme.textTheme.labelMedium?.copyWith(color: colorScheme.onSurfaceVariant),
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            itemCount: _filteredContacts.length,
            separatorBuilder: (_, __) => const Divider(height: 1, indent: 72, endIndent: 16),
            itemBuilder: (context, index) {
              final contact = _filteredContacts[index];
              return _buildContactTile(theme, colorScheme, contact);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildContactTile(ThemeData theme, ColorScheme colorScheme, Contact contact) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: colorScheme.primaryContainer,
        child: Text(
          contact.initials,
          style: theme.textTheme.titleMedium?.copyWith(
            color: colorScheme.onPrimaryContainer,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      title: Text(
        contact.displayName,
        style: theme.textTheme.bodyLarge?.copyWith(
          fontWeight: FontWeight.w500,
        ),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            contact.email,
            style: theme.textTheme.bodySmall?.copyWith(color: colorScheme.onSurfaceVariant),
          ),
          if (contact.company != null && contact.company!.isNotEmpty)
            Text(
              contact.company!,
              style: theme.textTheme.labelSmall?.copyWith(color: colorScheme.onSurfaceVariant.withOpacity(0.7)),
            ),
        ],
      ),
      trailing: PopupMenuButton<String>(
        onSelected: (value) {
          switch (value) {
            case 'compose':
              _composeToContact(contact);
              break;
            case 'edit':
              _showAddContactDialog(contact: contact);
              break;
            case 'delete':
              _deleteContact(contact);
              break;
          }
        },
        itemBuilder: (context) => [
          const PopupMenuItem(value: 'compose', child: ListTile(leading: Icon(Icons.email_outlined), title: Text('Send Email'), dense: true, contentPadding: EdgeInsets.zero)),
          const PopupMenuItem(value: 'edit', child: ListTile(leading: Icon(Icons.edit_outlined), title: Text('Edit'), dense: true, contentPadding: EdgeInsets.zero)),
          const PopupMenuItem(value: 'delete', child: ListTile(leading: Icon(Icons.delete_outline, color: Colors.red), title: Text('Delete', style: TextStyle(color: Colors.red)), dense: true, contentPadding: EdgeInsets.zero)),
        ],
      ),
      onTap: () => _composeToContact(contact),
    );
  }
}

class _ContactSearchDelegate extends SearchDelegate<Contact> {
  final List<Contact> contacts;

  _ContactSearchDelegate(this.contacts);

  @override
  List<Widget> buildActions(BuildContext context) {
    return [
      IconButton(
        icon: const Icon(Icons.clear),
        onPressed: () => query = '',
      ),
    ];
  }

  @override
  Widget buildLeading(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.arrow_back),
      onPressed: () => close(context, contacts.first),
    );
  }

  @override
  Widget buildResults(BuildContext context) {
    return _buildSearchResults(context);
  }

  @override
  Widget buildSuggestions(BuildContext context) {
    return _buildSearchResults(context);
  }

  Widget _buildSearchResults(BuildContext context) {
    if (query.isEmpty) {
      return const Center(child: Text('Search contacts...'));
    }
    final q = query.toLowerCase();
    final results = contacts.where((c) {
      return c.name.toLowerCase().contains(q) ||
          c.email.toLowerCase().contains(q) ||
          (c.company?.toLowerCase().contains(q) ?? false);
    }).toList();

    if (results.isEmpty) {
      return const Center(child: Text('No contacts found.'));
    }

    return ListView.builder(
      itemCount: results.length,
      itemBuilder: (context, index) {
        final contact = results[index];
        return ListTile(
          leading: CircleAvatar(
            backgroundColor: Theme.of(context).colorScheme.primaryContainer,
            child: Text(
              contact.initials,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onPrimaryContainer,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          title: Text(contact.displayName),
          subtitle: Text(contact.email),
          onTap: () => close(context, contact),
        );
      },
    );
  }
}