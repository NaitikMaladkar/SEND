import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/email.dart';

class EmailDetail extends StatelessWidget {
  final Email email;
  final VoidCallback? onReply;
  final VoidCallback? onDelete;
  final VoidCallback? onToggleRead;
  final VoidCallback? onToggleStar;
  final VoidCallback? onForward;

  const EmailDetail({
    super.key,
    required this.email,
    this.onReply,
    this.onDelete,
    this.onToggleRead,
    this.onToggleStar,
    this.onForward,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(context, theme, colorScheme),
          const SizedBox(height: 16),
          _buildActions(theme, colorScheme),
          const SizedBox(height: 16),
          Divider(color: colorScheme.outlineVariant.withOpacity(0.5)),
          const SizedBox(height: 16),
          _buildBody(theme, colorScheme),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context, ThemeData theme, ColorScheme colorScheme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                email.subject,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: colorScheme.onSurface,
                ),
              ),
            ),
            if (email.folder == 'trash')
              Padding(
                padding: const EdgeInsets.only(left: 8),
                child: Icon(
                  Icons.delete_outline,
                  color: colorScheme.error,
                  size: 20,
                ),
              ),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: colorScheme.primaryContainer,
              child: Text(
                email.senderName.isNotEmpty
                    ? email.senderName.substring(0, 1).toUpperCase()
                    : '?',
                style: theme.textTheme.titleMedium?.copyWith(
                  color: colorScheme.onPrimaryContainer,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    email.senderName,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    email.from,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Padding(
          padding: const EdgeInsets.only(left: 60),
          child: Row(
            children: [
              Icon(Icons.arrow_forward_rounded,
                  size: 14, color: colorScheme.onSurfaceVariant),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'To: ${email.to}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Padding(
          padding: const EdgeInsets.only(left: 60),
          child: Text(
            DateFormat.yMMMMd().add_jm().format(email.createdAt),
            style: theme.textTheme.labelSmall?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActions(ThemeData theme, ColorScheme colorScheme) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        if (onReply != null)
          ActionChip(
            avatar: Icon(Icons.reply, size: 18, color: colorScheme.onSurfaceVariant),
            label: const Text('Reply'),
            onPressed: onReply,
          ),
        if (onForward != null)
          ActionChip(
            avatar: Icon(Icons.forward, size: 18, color: colorScheme.onSurfaceVariant),
            label: const Text('Forward'),
            onPressed: onForward,
          ),
        if (onToggleStar != null)
          ActionChip(
            avatar: Icon(
              email.isStarred ? Icons.star : Icons.star_border,
              size: 18,
              color: email.isStarred ? Colors.amber.shade600 : colorScheme.onSurfaceVariant,
            ),
            label: Text(email.isStarred ? 'Unstar' : 'Star'),
            onPressed: onToggleStar,
          ),
        if (onToggleRead != null)
          ActionChip(
            avatar: Icon(
              email.isRead ? Icons.mark_email_unread : Icons.mark_email_read,
              size: 18,
              color: colorScheme.onSurfaceVariant,
            ),
            label: Text(email.isRead ? 'Mark Unread' : 'Mark Read'),
            onPressed: onToggleRead,
          ),
        if (onDelete != null)
          ActionChip(
            avatar: Icon(Icons.delete_outline, size: 18, color: colorScheme.error),
            label: Text('Delete', style: TextStyle(color: colorScheme.error)),
            onPressed: onDelete,
          ),
      ],
    );
  }

  Widget _buildBody(ThemeData theme, ColorScheme colorScheme) {
    return SelectionArea(
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: colorScheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colorScheme.outlineVariant.withOpacity(0.3)),
        ),
        child: Text(
          email.body,
          style: theme.textTheme.bodyLarge?.copyWith(
            height: 1.6,
            color: colorScheme.onSurface,
            letterSpacing: 0.2,
          ),
        ),
      ),
    );
  }
}
