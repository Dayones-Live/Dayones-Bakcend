export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[@#$%^&+=]).{8,}$/;

export enum Roles {
  USER = 'USER',
  ARTIST = 'ARTIST',
}

export enum ERROR_MESSAGES {
  USER_NOT_FOUND = 'User not found',
  MESSAGE_NOT_FOUND = 'Message not found',
  WRONG_PASSWORD = 'Password is incorrect',
  USER_ALREADY_EXISTS = 'User already exists',
  UNABLE_TO_UPDATE_USER = 'Unable to update user',
  CONVERSATION_DONT_EXIST = "Conversation don't exist",
  NOT_AUTHORIZED_ACTION = 'Not authorized for this action',
  INCORRECT_EMAIL_OR_PHONE = 'Incorrect email or phone number',
  UNABLE_TO_PERFORM_ACTION = "User don't have permission to do this action only Artists can do",
}

export enum SUCCESS_MESSAGES {
  USER_UPDATED_SUCCESS = 'User updated successfully',
  USER_SIGNUP_SUCCESS = 'User signed up successfully',
  MESSAGE_SENT_SUCCESS = 'Message sent successfully',
  DISCONNECT_SOCKET_SUCCESS = 'Disconnect from socket successfully',
  CONVERSATION_CREATED_SUCCESS = 'Conversation created successfully',
  CONVERSATION_UPDATED_SUCCESS = 'Conversation updated successfully',
  CONVERSATION_DELETED_SUCCESS = 'Conversation deleted successfully',
  CONVERSATION_FETCHED_SUCCESS = 'Conversations Fetched Successfully',
  MESSAGES_FETCHED_SUCCESS = 'Messages fetched successfully',
  MESSAGE_DELETED_SUCCESS = 'Messages deleted successfully',
}
