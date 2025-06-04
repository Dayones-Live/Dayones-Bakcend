export const NOTIFICATION_TITLE = {
  LIKE_POST: 'Like Post',
  DISLIKE_POST: 'Dislike Post',
  REACTION: 'Reaction',
  COMMENT: 'Comment',
  MESSAGE: 'Message',
  LIKE_COMMENT: 'Like Comment',
  DISLIKE_COMMENT: 'Dislike Comment',
  INVITE: 'Invite',
} as const;

export const NOTIFICATION_TYPE = {
  LIKE_POST: 'reaction',
  DISLIKE_POST: 'reaction',
  REACTION: 'reaction',
  COMMENT: 'comment',
  LIKE_COMMENT: 'reaction',
  DISLIKE_COMMENT: 'reaction',
  INVITE: 'invite',
  MESSAGE: 'message',
} as const; 