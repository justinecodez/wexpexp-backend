/**
 * Normalize phone number for system-wide consistency
 * Handles:
 * - Removing non-digit characters
 * - Removing '+' prefix (handled by \D replacement)
 * - Converting leading '0' to '255' (Tanzania local format)
 * - Prepending '255' to 9-digit numbers (Tanzania mobile format starting with 6 or 7)
 * - Supporting other international country codes (if it doesn't start with 0)
 */
export const normalizePhone = (phone: string | number | undefined | null): string => {
    if (phone === undefined || phone === null) return '';

    // Convert to string
    let phoneStr = String(phone).trim();
    if (!phoneStr) return '';

    // Remove all non-digits
    let cleaned = phoneStr.replace(/\D/g, '');

    // Handle leading 0 (Tanzania local) -> 255
    if (cleaned.startsWith('0')) {
        cleaned = '255' + cleaned.substring(1);
    }

    // Handle 9-digit numbers (assume TZ mobile) -> 255
    // Usually starts with 6 or 7 in TZ
    if (cleaned.length === 9 && /^[67]/.test(cleaned)) {
        cleaned = '255' + cleaned;
    }

    return cleaned;
};

/**
 * Validates if the phone number is in a valid format after normalization
 * Standard E.164 without the plus sign is usually 7-15 digits
 */
export const isValidPhone = (phone: string): boolean => {
    if (!phone) return false;
    // Basic validation: 7 to 15 digits
    return /^\d{7,15}$/.test(phone);
};

export default {
    normalizePhone,
    isValidPhone,
};
