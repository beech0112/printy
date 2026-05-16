/**
 * Shared form validation and formatting utilities.
 * Covers names, phone, address, birthday, gender, and profile validators.
 * For auth-specific validation (email, password, signup steps) see @auth/utils/validation.
 */

/* --------------------------------------------------
 * NAME VALIDATION & FORMATTING
 * -------------------------------------------------- */

const NAME_REGEX = /^[A-Za-zÀ-ÿ\u00C0-\u017F\s]+$/;
const MAX_NAME_LENGTH = 50;

export function isProperNounFormat(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  let hasLetterWord = false;
  for (const word of words) {
    const firstChar = word.charAt(0);
    if (/[A-Za-zÀ-ÿ\u00C0-\u017F]/.test(firstChar)) {
      hasLetterWord = true;
      if (!/[A-ZÀ-ÖØ-Þ]/.test(firstChar)) return false;
    }
  }
  return hasLetterWord;
}

export function isAddressProperNounFormat(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  let hasLetterWord = false;
  for (const word of words) {
    const firstChar = word.charAt(0);
    if (/[A-Za-zÀ-ÿ\u00C0-\u017F]/.test(firstChar)) {
      hasLetterWord = true;
      if (!/[A-ZÀ-ÖØ-Þ]/.test(firstChar)) return false;
    }
  }
  return hasLetterWord;
}

export function isBuildingNumberFormat(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  for (const word of words) {
    const firstChar = word.charAt(0);
    if (/[A-Za-zÀ-ÿ\u00C0-\u017F]/.test(firstChar)) {
      if (!/[A-ZÀ-ÖØ-Þ]/.test(firstChar)) return false;
    }
  }
  return true;
}

export function isValidFirstName(firstName: string): boolean {
  const trimmed = firstName.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 50) return false;
  if (!NAME_REGEX.test(trimmed)) return false;
  if (!isProperNounFormat(trimmed)) return false;
  return true;
}

export function isValidLastName(lastName: string): boolean {
  const trimmed = lastName.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 50) return false;
  if (!NAME_REGEX.test(trimmed)) return false;
  if (!isProperNounFormat(trimmed)) return false;
  return true;
}

/** @deprecated Use isValidFirstName() or isValidLastName() instead */
export function isValidName(name: string): boolean {
  return isValidFirstName(name);
}

export function formatToProperNoun(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      let firstLetterIndex = -1;
      for (let i = 0; i < word.length; i++) {
        if (/[A-Za-zÀ-ÿ\u00C0-\u017F]/.test(word[i])) {
          firstLetterIndex = i;
          break;
        }
      }
      if (firstLetterIndex === -1) return word;
      const beforeLetter = word.slice(0, firstLetterIndex);
      const firstLetter = word[firstLetterIndex].toUpperCase();
      const afterLetter = word
        .slice(firstLetterIndex + 1)
        .split('')
        .map(char =>
          /[A-Za-zÀ-ÿ\u00C0-\u017F]/.test(char) ? char.toLowerCase() : char
        )
        .join('');
      return beforeLetter + firstLetter + afterLetter;
    })
    .filter(word => word.length > 0)
    .join(' ');
}

export function formatNameInput(input: string): string {
  if (!input) return '';
  let cleaned = input.replace(/[^A-Za-zÀ-ÿ\u00C0-\u017F\s]/g, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  return cleaned.slice(0, MAX_NAME_LENGTH);
}

export function getFirstNameValidationMessage(firstName: string): string {
  const trimmed = firstName.trim();
  if (!trimmed) return 'First name cannot be empty.';
  if (trimmed.length < 2) return 'First name must be at least 2 characters long.';
  if (trimmed.length > 50) return 'First name cannot exceed 50 characters.';
  if (!NAME_REGEX.test(trimmed)) {
    if (/[0-9]/.test(trimmed)) return 'First name cannot contain numbers.';
    if (/[^A-Za-zÀ-ÿ\u00C0-\u017F\s]/.test(trimmed))
      return 'First name can only contain letters and spaces.';
    return 'First name is invalid.';
  }
  if (!isProperNounFormat(trimmed))
    return 'First name must start with a capital letter (e.g., "John Michael").';
  if (!isValidFirstName(trimmed)) return 'First name is invalid.';
  return '';
}

export function getLastNameValidationMessage(lastName: string): string {
  const trimmed = lastName.trim();
  if (!trimmed) return 'Last name cannot be empty.';
  if (trimmed.length < 2) return 'Last name must be at least 2 characters long.';
  if (trimmed.length > 50) return 'Last name cannot exceed 50 characters.';
  if (!NAME_REGEX.test(trimmed)) {
    if (/[0-9]/.test(trimmed)) return 'Last name cannot contain numbers.';
    if (/[^A-Za-zÀ-ÿ\u00C0-\u017F\s]/.test(trimmed))
      return 'Last name can only contain letters and spaces.';
    return 'Last name is invalid.';
  }
  if (!isProperNounFormat(trimmed))
    return 'Last name must start with a capital letter (e.g., "Delos Santos").';
  if (!isValidLastName(trimmed)) return 'Last name is invalid.';
  return '';
}

/** @deprecated Use getFirstNameValidationMessage() or getLastNameValidationMessage() instead */
export function getNameValidationMessage(name: string): string {
  return getFirstNameValidationMessage(name);
}

/* --------------------------------------------------
 * PHONE VALIDATION (PH FORMAT)
 * -------------------------------------------------- */

export function normalizePhone(raw: string): string {
  let v = raw.trim();
  if (!v) return '';
  if (!v.startsWith('+63'))
    v = '+63' + v.replace(/^\+?63/, '').replace(/^0+/, '');
  v = '+63' + v.slice(3).replace(/\D/g, '');
  return v;
}

export function isValidPhone(phone: string): boolean {
  return /^\+639\d{9}$/.test(normalizePhone(phone));
}

export function getPhoneValidationMessage(phone: string): string {
  if (!phone.trim()) return 'Phone number cannot be empty.';
  if (!isValidPhone(phone))
    return 'Enter a valid PH mobile number (e.g., +639XXXXXXXXX).';
  return '';
}

/* --------------------------------------------------
 * BIRTHDAY VALIDATION
 * -------------------------------------------------- */

const MIN_BIRTHDAY_YEAR = new Date().getFullYear() - 150;
const MAX_BIRTHDAY_YEAR = new Date().getFullYear();
const MIN_AGE = 18;

function parseBirthdayDate(dateString: string): Date | null {
  if (!dateString || !dateString.trim()) return null;
  const trimmed = dateString.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed + 'T00:00:00');
    if (!isNaN(date.getTime())) return date;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const parts = trimmed.split('/');
    const part1 = parseInt(parts[0], 10);
    const part2 = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (part1 >= 1 && part1 <= 12 && part2 >= 1 && part2 <= 31) {
      const date = new Date(year, part1 - 1, part2);
      if (
        !isNaN(date.getTime()) &&
        date.getFullYear() === year &&
        date.getMonth() === part1 - 1 &&
        date.getDate() === part2
      )
        return date;
    }

    if (part1 > 12 && part1 <= 31 && part2 >= 1 && part2 <= 12) {
      const date = new Date(year, part2 - 1, part1);
      if (
        !isNaN(date.getTime()) &&
        date.getFullYear() === year &&
        date.getMonth() === part2 - 1 &&
        date.getDate() === part1
      )
        return date;
    }
  }

  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    const test = new Date(y, m, d);
    if (test.getFullYear() === y && test.getMonth() === m && test.getDate() === d)
      return date;
  }

  return null;
}

export function isValidBirthday(date: string): boolean {
  if (!date || !date.trim()) return false;
  const birthDate = parseBirthdayDate(date);
  if (!birthDate) return false;
  const year = birthDate.getFullYear();
  if (year < MIN_BIRTHDAY_YEAR || year > MAX_BIRTHDAY_YEAR) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normalized = new Date(birthDate);
  normalized.setHours(0, 0, 0, 0);
  if (normalized > today) return false;
  const age =
    today.getFullYear() -
    birthDate.getFullYear() -
    (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0);
  return age >= MIN_AGE;
}

export function getBirthdayValidationMessage(date: string): string {
  if (!date || !date.trim()) return 'Birthday cannot be empty.';
  const birthDate = parseBirthdayDate(date);
  if (!birthDate) return 'Please enter a valid date (e.g., MM/DD/YYYY or YYYY-MM-DD).';
  const year = birthDate.getFullYear();
  const today = new Date();
  if (year < MIN_BIRTHDAY_YEAR) return `Birth year cannot be before ${MIN_BIRTHDAY_YEAR}.`;
  if (year > MAX_BIRTHDAY_YEAR) return 'Birth date cannot be in the future.';
  const todayNorm = new Date(today);
  todayNorm.setHours(0, 0, 0, 0);
  const birthNorm = new Date(birthDate);
  birthNorm.setHours(0, 0, 0, 0);
  if (birthNorm > todayNorm) return 'Birth date cannot be in the future.';
  const age =
    today.getFullYear() -
    birthDate.getFullYear() -
    (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0);
  if (age < MIN_AGE) return `You must be at least ${MIN_AGE} years old.`;
  const m = birthDate.getMonth(), d = birthDate.getDate();
  const test = new Date(year, m, d);
  if (test.getFullYear() !== year || test.getMonth() !== m || test.getDate() !== d)
    return 'Please enter a valid date.';
  return '';
}

/* --------------------------------------------------
 * ADDRESS VALIDATION
 * -------------------------------------------------- */

const MAX_ADDRESS_FIELD_LENGTH = 100;

export function isRequiredFieldFilled(value: string): boolean {
  return value.trim().length > 0;
}

export function getRequiredFieldMessage(label: string, value: string): string {
  if (!isRequiredFieldFilled(value)) return `${label} cannot be empty.`;
  return '';
}

export function formatZipCodeInput(
  input: string | number | null | undefined
): string {
  const inputStr = typeof input === 'number' ? String(input) : String(input || '');
  return inputStr.replace(/\D/g, '').slice(0, 4);
}

export function isValidZipCode(zip: string | number | null | undefined): boolean {
  if (zip === null || zip === undefined) return false;
  const zipStr = typeof zip === 'number' ? String(zip) : String(zip || '');
  return /^\d{4}$/.test(zipStr.trim());
}

export function getZipValidationMessage(zip: string | number | null | undefined): string {
  if (zip === null || zip === undefined) return 'ZIP Code cannot be empty.';
  const zipStr = typeof zip === 'number' ? String(zip) : String(zip || '');
  const trimmed = zipStr.trim();
  if (!trimmed) return 'ZIP Code cannot be empty.';
  if (!/^\d+$/.test(trimmed)) return 'ZIP Code must contain only numbers.';
  if (trimmed.length !== 4) return 'ZIP Code must be exactly 4 digits.';
  return '';
}

export function isCompleteAddress(address: {
  region?: string;
  province?: string;
  city?: string;
  barangay?: string;
  street?: string;
  zipCode?: string;
}): boolean {
  return (
    !!address.region &&
    !!address.province &&
    !!address.city &&
    !!address.barangay &&
    !!address.street &&
    !!address.zipCode
  );
}

export function isValidBuildingName(input: string): boolean {
  return /^[A-Za-z0-9\s\-.,#]*$/.test(input.trim());
}

export function isValidStreet(street: string): boolean {
  const trimmed = street.trim();
  if (!trimmed || trimmed.length > MAX_ADDRESS_FIELD_LENGTH) return false;
  if (!isAddressProperNounFormat(trimmed)) return false;
  return true;
}

export function getStreetValidationMessage(street: string): string {
  const trimmed = street.trim();
  if (!trimmed) return 'Street cannot be empty.';
  if (trimmed.length > MAX_ADDRESS_FIELD_LENGTH)
    return `Street cannot exceed ${MAX_ADDRESS_FIELD_LENGTH} characters.`;
  if (!isAddressProperNounFormat(trimmed))
    return 'Street name must start with a capital letter (e.g., "123 Main Street").';
  return '';
}

export function isValidBarangay(barangay: string): boolean {
  const trimmed = barangay.trim();
  if (!trimmed || trimmed.length > MAX_ADDRESS_FIELD_LENGTH) return false;
  if (!isAddressProperNounFormat(trimmed)) return false;
  return true;
}

export function getBarangayValidationMessage(barangay: string): string {
  const trimmed = barangay.trim();
  if (!trimmed) return 'Barangay cannot be empty.';
  if (trimmed.length > MAX_ADDRESS_FIELD_LENGTH)
    return `Barangay cannot exceed ${MAX_ADDRESS_FIELD_LENGTH} characters.`;
  if (!isAddressProperNounFormat(trimmed))
    return 'Barangay name must start with a capital letter (e.g., "Barangay Poblacion").';
  return '';
}

export function isValidBuildingNumber(buildingNumber: string): boolean {
  const trimmed = buildingNumber.trim();
  if (!trimmed) return true;
  if (trimmed.length > MAX_ADDRESS_FIELD_LENGTH) return false;
  if (!isBuildingNumberFormat(trimmed)) return false;
  return true;
}

export function getBuildingNumberValidationMessage(buildingNumber: string): string {
  const trimmed = buildingNumber.trim();
  if (!trimmed) return '';
  if (trimmed.length > MAX_ADDRESS_FIELD_LENGTH)
    return `Building number cannot exceed ${MAX_ADDRESS_FIELD_LENGTH} characters.`;
  if (!isBuildingNumberFormat(trimmed))
    return 'If building name contains letters, they must start with a capital letter (e.g., "Tower A" or "Building 5-A").';
  return '';
}

/* --------------------------------------------------
 * GENDER & TERMS VALIDATION
 * -------------------------------------------------- */

export function isValidGender(gender: string): boolean {
  return ['male', 'female', 'other', 'prefer-not-to-say'].includes(gender.toLowerCase());
}

export function hasAgreedToTerms(agree: boolean): boolean {
  return agree === true;
}

/* --------------------------------------------------
 * PROFILE VALIDATOR
 * -------------------------------------------------- */

export function validateProfileUpdate(data: {
  first_name: string;
  last_name: string;
  contact_no: string;
  gender: string;
  birthday: string;
}): string {
  const firstNameError = getFirstNameValidationMessage(data.first_name);
  if (firstNameError) return firstNameError;
  const lastNameError = getLastNameValidationMessage(data.last_name);
  if (lastNameError) return lastNameError;
  if (!isValidPhone(data.contact_no)) return 'Invalid phone number.';
  if (!isValidGender(data.gender)) return 'Invalid gender.';
  const birthdayError = getBirthdayValidationMessage(data.birthday);
  if (birthdayError) return birthdayError;
  return '';
}
