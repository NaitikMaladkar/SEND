import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/email.dart';

class EmailListItem extends StatelessWidget {
  final Email email;
  final VoidCallback onTap;
  final VoidCallback? onStarTap;
  final VoidCallback? onSwipeLeft;
  final VoidCallback? onSwipeRight;

  const EmailListItem({
    super.key,
    required this.email,
    required this.onTap,
    this.onStarTap,
    this.onSwipeLeft,
    this.onSwipeRight,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Dismissible(
      key: ValueKey(email.id),
      direction: DismissDirection.endToStart,
      onDismissed: onSwipeLeft != null
          ? (_) => onSwipeLeft!()
          : null,
      confirmDismiss: onSwipeLeft != null
          ? (_) async {
              return await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Move to Trash?'),
                  content: Text(
                    'Move "${email.subject}" to trash?',
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(ctx).pop(false),
                      child: const Text('Cancel'),
                    ),
                    FilledButton(
                      onPressed: () => Navigator.of(ctx).pop(true),
                      child: const Text('Move to Trash'),
                    ),
                  ],
                ),
              );
            }
          : null,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 24),
        color: colorScheme.error,
        child: Icon(
          Icons.delete_outline,
          color: colorScheme.onError,
          size: 28,
        ),
      ),
      child: Card(
        margin: EdgeInsets.zero,
        elevation: 0,
        shape: const RoundedRectangleBorder(),
        color: email.isRead
            ? Colors.transparent
            : colorScheme.primaryContainer.withOpacity(0.3),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildAvatar(theme, colorScheme),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              email.senderName,
                              style: theme.textTheme.titleSmall?.copyWith(
                                fontWeight: email.isRead
                                    ? FontWeight.w400
                                    : FontWeight.w700,
                                color: email.isRead
                                    ? colorScheme.onSurfaceVariant
                                    : colorScheme.onSurface,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _formatDate(email.createdAt),
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        email.subject,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: email.isRead
                              ? FontWeight.w400
                              : FontWeight.w600,
                          color: email.isRead
                              ? colorScheme.onSurfaceVariant
                              : colorScheme.onSurface,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        email.preview,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant.withOpacity(0.7),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 4),
                _buildTrailing(colorScheme),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAvatar(ThemeData theme, ColorScheme colorScheme) {
    return CircleAvatar(
      radius: 22,
      backgroundColor: email.isRead
          ? colorScheme.surfaceContainerHighest
          : colorScheme.primary,
      child: Text(
        email.senderName.isNotEmpty
            ? email.senderName.substring(0, 1).toUpperCase()
            : '?',
        style: theme.textTheme.titleMedium?.copyWith(
          color: email.isRead
              ? colorScheme.onSurfaceVariant
              : colorScheme.onPrimary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildTrailing(ColorScheme colorScheme) {
    return Column(
      children: [
        if (!email.isRead)
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: colorScheme.primary,
            ),
          ),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: onStarTap,
          child: Icon(
            email.isStarred ? Icons.star : Icons.star_border,
            size: 20,
            color: email.isStarred
                ? Colors.amber.shade600
                : colorScheme.onSurfaceVariant.withOpacity(0.4),
          ),
        ),
      ],
    );
  }

  String _formatDate(DateTime dateTime) {
    final now = DateTime.now();
    final diff = now.difference(dateTime);

    if (diff.inDays == 0) {
      return DateFormat.jm().format(dateTime);
    } else if (diff.inDays == 1) {
      return 'Yesterday';
    } else if (diff.inDays < 7) {
      return DateFormat.EEEE().format(dateTime);
    } else {
      return DateFormat.Md().format(dateTime);
    }
  }
}
