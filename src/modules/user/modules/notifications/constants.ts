export const NOTIFICATION_TITLE = {
  LIKE_POST: 'New Like',
  DISLIKE_POST: 'New Dislike',
  REACTION: 'New Reaction',
  COMMENT: 'New Comment',
  MESSAGE: 'New Message',
  LIKE_COMMENT: 'New Like on Comment',
  DISLIKE_COMMENT: 'New Dislike on Comment',
  INVITE: 'New Invitation',
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