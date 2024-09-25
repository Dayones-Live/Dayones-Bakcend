export const signupUserAttributes = (
  email: string,
  role: string,
  name: string,
  phoneNumber: string,
) => {
  const attributes = [
    {
      Name: 'email', // Standard Cognito attribute for email
      Value: email, // Assuming username is an email
    },
    {
      Name: 'custom:role', // Custom attribute for role
      Value: role,
    },
    {
      Name: 'name',
      Value: name,
    },
    {
      Name: 'phone_number',
      Value: phoneNumber,
    },
  ];
  return attributes;
};
