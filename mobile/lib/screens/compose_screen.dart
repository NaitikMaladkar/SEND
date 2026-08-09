import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../models/email.dart';
import '../services/api_service.dart';
import '../services/supabase_service.dart';

class ComposeScreen extends StatefulWidget {
  const ComposeScreen({super.key});

  @override
  State<ComposeScreen> createState() => _ComposeScreenState();
}

class _ComposeScreenState extends State<ComposeScreen> {
  final _toController = TextEditingController();
  final _subjectController = TextEditingController();
  final _bodyController = TextEditingController();
  final _focusNode = FocusNode();

  bool _isSending = false;
  bool _showCcBcc = false;
  String? _errorMessage;
  String? _replyToId;
  bool _isForward = false;
  bool _hasUnsavedChanges = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _parseExtra(context);
    });
    _toController.addListener(_onFieldChanged);
    _subjectController.addListener(_onFieldChanged);
    _bodyController.addListener(_onFieldChanged);
  }

  void _parseExtra(BuildContext context) {
    final extra = GoRouterState.of(context).extra as Map<String, dynamic>?;
    if (extra == null) return;

    if (extra['replyTo'] != null) {
      final replyEmail = extra['replyTo'] as Email;
      _replyToId = replyEmail.id;
      _subjectController.text = replyEmail.subject.startsWith('Re: ')
          ? replyEmail.subject
          : 'Re: ${replyEmail.subject}';
      _toController.text = replyEmail.from;
      _bodyController.text = '\n\n---\nOn ${replyEmail.createdAt.toString().substring(0, 16)} ${replyEmail.senderName} wrote:\n\n${replyEmail.body}';
      setState(() {});
      _focusNode.requestFocus();
    } else if (extra['forward'] != null) {
      final fwdEmail = extra['forward'] as Email;
      _isForward = true;
      _subjectController.text = fwdEmail.subject.startsWith('Fwd: ')
          ? fwdEmail.subject
          : 'Fwd: ${fwdEmail.subject}';
      _bodyController.text = '\n\n--- Forwarded message ---\nFrom: ${fwdEmail.from}\nDate: ${fwdEmail.createdAt.toString().substring(0, 16)}\nSubject: ${fwdEmail.subject}\nTo: ${fwdEmail.to}\n\n${fwdEmail.body}';
      setState(() {});
      _toController.focus();
    } else if (extra['to'] != null) {
      _toController.text = extra['to'] as String;
      setState(() {});
      _subjectController.focus();
    }
  }

  void _onFieldChanged() {
    if (!_hasUnsavedChanges) {
      setState(() => _hasUnsavedChanges = true);
    }
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      // Could auto-save draft here
    });
  }

  @override
  void dispose() {
    _toController.dispose();
    _subjectController.dispose();
    _bodyController.dispose();
    _focusNode.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _sendEmail() async {
    final to = _toController.text.trim();
    final subject = _subjectController.text.trim();
    final body = _bodyController.text.trim();

    if (to.isEmpty) {
      setState(() => _errorMessage = 'Recipient is required.');
      return;
    }

    if (!_isValidEmail(to)) {
      setState(() => _errorMessage = 'Please enter a valid email address.');
      return;
    }

    if (subject.isEmpty) {
      setState(() => _errorMessage = 'Subject is required.');
      return;
    }

    if (body.isEmpty) {
      setState(() => _errorMessage = 'Email body is required.');
      return;
    }

    setState(() {
      _isSending = true;
      _errorMessage = null;
    });

    try {
      await ApiService.sendEmail(
        to: to,
        subject: subject,
        body: body,
        replyToId: _replyToId,
      );
      if (mounted) {
        context.pop('sent');
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Email sent successfully!'),
            behavior: SnackBarBehavior.floating,
            duration: Duration(seconds: 2),
          ),
        );
      }
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } catch (e) {
      setState(() => _errorMessage = 'Failed to send email. Please try again.');
    } finally {
      if (mounted) {
        setState(() => _isSending = false);
      }
    }
  }

  bool _isValidEmail(String email) {
    return RegExp(r'^[\w.-]+@[\w.-]+\.[a-z]{2,}$', caseSensitive: false).hasMatch(email);
  }

  Future<bool> _onWillPop() async {
    if (!_hasUnsavedChanges || _toController.text.trim().isEmpty &&
        _subjectController.text.trim().isEmpty &&
        _bodyController.text.trim().isEmpty) {
      return true;
    }
    final discard = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Discard draft?'),
        content: const Text('You have unsaved changes. Are you sure you want to discard this email?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Keep Editing')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
    return discard ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return PopScope(
      canPop: !_hasUnsavedChanges,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop) {
          final shouldPop = await _onWillPop();
          if (shouldPop && mounted) context.pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.close_rounded),
            tooltip: 'Discard',
            onPressed: () async {
              final shouldPop = await _onWillPop();
              if (shouldPop && mounted) context.pop();
            },
          ),
          title: Text(
            _replyToId != null ? 'Reply' : _isForward ? 'Forward' : 'Compose',
          ),
          actions: [
            TextButton.icon(
              onPressed: _isSending ? null : _sendEmail,
              icon: _isSending
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.send_rounded, size: 18),
              label: const Text('Send'),
            ),
            const SizedBox(width: 8),
          ],
        ),
        body: Column(
          children: [
            if (_errorMessage != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                color: colorScheme.errorContainer,
                child: Row(
                  children: [
                    Icon(Icons.error_outline, size: 18, color: colorScheme.error),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: TextStyle(color: colorScheme.onErrorContainer, fontSize: 13),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 16),
                      onPressed: () => setState(() => _errorMessage = null),
                      color: colorScheme.onErrorContainer,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Column(
                  children: [
                    _buildRecipientField(theme, colorScheme, 'To', _toController, Icons.person_outline, false),
                    _buildRecipientField(theme, colorScheme, 'Subject', _subjectController, Icons.subject, false),
                    const SizedBox(height: 8),
                    Container(
                      constraints: const BoxConstraints(minHeight: 300),
                      child: TextField(
                        controller: _bodyController,
                        focusNode: _focusNode,
                        maxLines: null,
                        minLines: 15,
                        keyboardType: TextInputType.multiline,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: InputDecoration(
                          hintText: 'Write your message...',
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.all(12),
                        ),
                        style: theme.textTheme.bodyLarge?.copyWith(height: 1.6),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecipientField(
    ThemeData theme,
    ColorScheme colorScheme,
    String label,
    TextEditingController controller,
    IconData icon,
    bool enabled,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 56,
            child: Text(
              label,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          Expanded(
            child: TextField(
              controller: controller,
              enabled: enabled,
              keyboardType: _isRecipientField(label) ? TextInputType.emailAddress : TextInputType.text,
              textCapitalization: TextCapitalization.none,
              autocorrect: false,
              decoration: InputDecoration(
                hintText: label,
                border: const UnderlineInputBorder(),
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
              ),
              style: theme.textTheme.bodyMedium,
              textInputAction: label == 'To' ? TextInputAction.next : TextInputAction.next,
            ),
          ),
        ],
      ),
    );
  }

  bool _isRecipientField(String label) => label == 'To';
}