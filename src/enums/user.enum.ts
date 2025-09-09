export enum SignInProvider {
  EMAIL = "email",
  GOOGLE = "google",
  PHONENUMBER = "phone",
}

export enum UserRole {
  ADMIN = "admin",
  PUBLIC = "public",
  USER = "user",
  SUPERADMIN = "superadmin",
}

export const ROLE_HIERARCHY = {
  [UserRole.PUBLIC]: 0,
  [UserRole.USER]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.SUPERADMIN]: 3,
};
