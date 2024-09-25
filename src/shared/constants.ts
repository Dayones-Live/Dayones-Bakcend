export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[@#$%^&+=]).{8,}$/;

export enum ROLES {
  ADMIN = 'ADMIN',
  USER = 'USER',
  ARTIST = 'ARTIST',
}
