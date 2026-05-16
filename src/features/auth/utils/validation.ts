/**
 * Auth-specific validation utilities.
 * Covers email, password, and signup step validators.
 * For shared field validators (name, address, phone) see @shared/utils/formsFormatter.
 */

import {
  isValidPhone,
  getFirstNameValidationMessage,
  getLastNameValidationMessage,
  getBirthdayValidationMessage,
  isValidGender,
  getStreetValidationMessage,
  getBarangayValidationMessage,
  getBuildingNumberValidationMessage,
  isCompleteAddress,
  getZipValidationMessage,
  hasAgreedToTerms,
} from '@shared/utils/formsFormatter';

/* --------------------------------------------------
 * EMAIL VALIDATION
 * -------------------------------------------------- */

const MAX_EMAIL_LENGTH = 254;

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  if (trimmed.length > MAX_EMAIL_LENGTH) return false;
  if (/\s/.test(trimmed)) return false;

  const atIndex = trimmed.indexOf('@');
  if (atIndex === -1 || atIndex === 0) return false;
  if (trimmed.indexOf('@', atIndex + 1) !== -1) return false;

  const localPart = trimmed.substring(0, atIndex);
  const domainPart = trimmed.substring(atIndex + 1);

  if (!localPart || localPart.length > 64) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  if (localPart.includes('..')) return false;

  if (!domainPart || domainPart.length === 0) return false;
  if (!domainPart.includes('.')) return false;
  if (
    domainPart.startsWith('.') ||
    domainPart.endsWith('.') ||
    domainPart.startsWith('-') ||
    domainPart.endsWith('-')
  )
    return false;
  if (domainPart.includes('..')) return false;

  const lastDotIndex = domainPart.lastIndexOf('.');
  const tld = domainPart.substring(lastDotIndex + 1);
  if (tld.length < 2) return false;
  if (!/^[a-zA-Z]+$/.test(tld)) return false;

  const emailRegex =
    /^[a-zA-Z0-9]([a-zA-Z0-9._+-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
  return emailRegex.test(trimmed);
}

export function getEmailValidationMessage(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return 'Email cannot be empty.';
  if (trimmed.length > MAX_EMAIL_LENGTH)
    return `Email cannot exceed ${MAX_EMAIL_LENGTH} characters.`;
  if (/\s/.test(trimmed)) return 'Email cannot contain spaces.';

  const atIndex = trimmed.indexOf('@');
  if (atIndex === -1) return 'Email must contain an @ symbol.';
  if (atIndex === 0)
    return 'Email must have a local part before @ (e.g., name@example.com).';
  if (trimmed.indexOf('@', atIndex + 1) !== -1)
    return 'Email can only contain one @ symbol.';

  const localPart = trimmed.substring(0, atIndex);
  const domainPart = trimmed.substring(atIndex + 1);

  if (!localPart)
    return 'Email must have a local part before @ (e.g., name@example.com).';
  if (localPart.length > 64)
    return 'Email local part (before @) cannot exceed 64 characters.';
  if (localPart.startsWith('.') || localPart.endsWith('.'))
    return 'Email local part cannot start or end with a dot.';
  if (localPart.includes('..')) return 'Email cannot contain consecutive dots.';

  if (!domainPart)
    return 'Email must have a domain after @ (e.g., name@example.com).';
  if (!domainPart.includes('.'))
    return 'Email domain must include a top-level domain (e.g., .com, .org).';
  if (
    domainPart.startsWith('.') ||
    domainPart.endsWith('.') ||
    domainPart.startsWith('-') ||
    domainPart.endsWith('-')
  )
    return 'Email domain cannot start or end with a dot or hyphen.';
  if (domainPart.includes('..'))
    return 'Email domain cannot contain consecutive dots.';

  const lastDotIndex = domainPart.lastIndexOf('.');
  const tld = domainPart.substring(lastDotIndex + 1);
  if (tld.length < 2)
    return 'Email top-level domain (e.g., .com) must be at least 2 characters.';
  if (!/^[a-zA-Z]+$/.test(tld))
    return 'Email top-level domain can only contain letters.';
  if (!isValidEmail(trimmed))
    return 'Please enter a valid email address (e.g., name@example.com).';

  return '';
}

/* --------------------------------------------------
 * PASSWORD VALIDATION
 * -------------------------------------------------- */

const PASSWORD_SPECIAL_CHAR_REGEX =
  /(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/;

export function hasPasswordMinLength(password: string): boolean {
  return password.length >= 8;
}

export function hasPasswordLowercase(password: string): boolean {
  return /(?=.*[a-z])/.test(password);
}

export function hasPasswordUppercase(password: string): boolean {
  return /(?=.*[A-Z])/.test(password);
}

export function hasPasswordNumber(password: string): boolean {
  return /(?=.*\d)/.test(password);
}

export function hasPasswordSpecialChar(password: string): boolean {
  return PASSWORD_SPECIAL_CHAR_REGEX.test(password);
}

export function hasPasswordSpaces(password: string): boolean {
  return /\s/.test(password);
}

export function isValidPassword(password: string): boolean {
  if (!password) return false;
  if (hasPasswordSpaces(password)) return false;
  return (
    hasPasswordMinLength(password) &&
    hasPasswordLowercase(password) &&
    hasPasswordUppercase(password) &&
    hasPasswordNumber(password) &&
    hasPasswordSpecialChar(password)
  );
}

export function formatPasswordInput(input: string): string {
  return input.replace(/\s/g, '');
}

export interface PasswordRequirement {
  text: string;
  isValid: boolean;
}

export function getPasswordRequirements(
  password: string
): PasswordRequirement[] {
  return [
    { text: 'At least 8 characters', isValid: hasPasswordMinLength(password) },
    { text: 'One lowercase letter', isValid: hasPasswordLowercase(password) },
    { text: 'One uppercase letter', isValid: hasPasswordUppercase(password) },
    { text: 'One number', isValid: hasPasswordNumber(password) },
    { text: 'One special character', isValid: hasPasswordSpecialChar(password) },
  ];
}

export function doPasswordsMatch(pw: string, confirm: string): boolean {
  return pw === confirm;
}

export function getPasswordValidationMessage(password: string): string {
  if (!password.trim()) return 'Password cannot be empty.';
  if (hasPasswordSpaces(password)) return 'Password cannot contain spaces.';
  if (!hasPasswordMinLength(password))
    return 'Password must be at least 8 characters.';
  if (!hasPasswordLowercase(password))
    return 'Password must include at least one lowercase letter.';
  if (!hasPasswordUppercase(password))
    return 'Password must include at least one uppercase letter.';
  if (!hasPasswordNumber(password))
    return 'Password must include at least one number.';
  if (!hasPasswordSpecialChar(password))
    return 'Password must include at least one special character.';
  return '';
}

/* --------------------------------------------------
 * SIGNUP STEP VALIDATORS
 * -------------------------------------------------- */

export function validateStep1(data: {
  email: string;
  password: string;
  confirmPassword: string;
}): string {
  if (!isValidEmail(data.email)) return 'Invalid email format.';
  const passwordError = getPasswordValidationMessage(data.password);
  if (passwordError) return passwordError;
  if (!doPasswordsMatch(data.password, data.confirmPassword))
    return 'Passwords do not match.';
  return '';
}

export function validateStep2(data: {
  firstName: string;
  lastName: string;
  phone: string;
  gender: string;
  birthday: string;
}): string {
  const firstNameError = getFirstNameValidationMessage(data.firstName);
  if (firstNameError) return firstNameError;
  const lastNameError = getLastNameValidationMessage(data.lastName);
  if (lastNameError) return lastNameError;
  if (!isValidPhone(data.phone)) return 'Invalid phone number.';
  if (!isValidGender(data.gender)) return 'Please select a valid gender.';
  const birthdayError = getBirthdayValidationMessage(data.birthday);
  if (birthdayError) return birthdayError;
  return '';
}

export function validateStep3(data: {
  street: string;
  barangay: string;
  province: string;
  city: string;
  region: string;
  zipCode: string;
  agreeToTerms: boolean;
  buildingNumber?: string;
}): string {
  const streetError = getStreetValidationMessage(data.street);
  if (streetError) return streetError;
  const barangayError = getBarangayValidationMessage(data.barangay);
  if (barangayError) return barangayError;
  if (data.buildingNumber) {
    const buildingError = getBuildingNumberValidationMessage(data.buildingNumber);
    if (buildingError) return buildingError;
  }
  if (!isCompleteAddress(data))
    return 'All address fields must be filled out correctly.';
  const zipError = getZipValidationMessage(data.zipCode);
  if (zipError) return zipError;
  if (!hasAgreedToTerms(data.agreeToTerms))
    return 'You must agree to the terms and conditions.';
  return '';
}
