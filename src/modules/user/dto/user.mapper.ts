import { UserUpdateInput } from './types';
import { User } from '../entities/user.entity';
import { CreateUserInput } from '@app/modules/libs/modules/aws/cognito/dto/types';
export class UserMapper {
  dtoToEntityUpdate(
    existingUser: User,
    updateUserInput: UserUpdateInput,
  ): User {
    // Update the properties manually to retain the User entity structure
    existingUser.full_name = updateUserInput.fullName || existingUser.full_name;
    existingUser.role = updateUserInput.role
      ? [updateUserInput.role]
      : [existingUser.role[0]]; // Ensure role is always an array
    existingUser.phone_number =
      updateUserInput.phoneNumber || existingUser.phone_number;
    existingUser.avatar_url =
      updateUserInput.avatarUrl !== undefined ? updateUserInput.avatarUrl : existingUser.avatar_url;
    existingUser.is_confirmed =
      updateUserInput.isConfirmed ?? existingUser.is_confirmed;
    existingUser.is_deleted =
      updateUserInput.isDeleted ?? existingUser.is_deleted;

    // Any additional properties can be updated similarly
    return existingUser;
  }

  dtoToEntity(createUserInput: CreateUserInput): User {
    const newUser = new User();
    newUser.email = createUserInput.email;
    newUser.full_name = createUserInput.name; // Map name to full_name
    newUser.phone_number = createUserInput.phoneNumber;
    newUser.user_sub = createUserInput.userSub;
    newUser.is_confirmed = createUserInput.isConfirmed;
    newUser.role = [createUserInput.role]; // Wrap the role in an array
    newUser.pending_approval = createUserInput.pendingApproval || false;

    return newUser;
  }
}
