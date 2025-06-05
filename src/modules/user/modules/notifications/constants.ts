export const NOTIFICATION_TITLE = {
  LIKE_POST: 'DayOnes',
  DISLIKE_POST: 'DayOnes',
  REACTION: 'DayOnes',
  COMMENT: 'DayOnes',
  MESSAGE: 'DayOnes',
  LIKE_COMMENT: 'DayOnes',
  DISLIKE_COMMENT: 'DayOnes',
  INVITE: 'DayOnes',
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