import { TanzanianPhoneNumber, TanzaniaCity } from '../types';

/**
 * Validate and format Tanzanian phone numbers
 */
export function validateTanzanianPhone(phoneNumber: string): TanzanianPhoneNumber {
  const cleaned = phoneNumber.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  
  let formatted = cleaned;
  let isValid = false;
  let operator: TanzanianPhoneNumber['operator'];

  // Remove country code if present
  if (cleaned.startsWith('+255')) {
    formatted = cleaned.substring(4);
  } else if (cleaned.startsWith('255')) {
    formatted = cleaned.substring(3);
  } else if (cleaned.startsWith('0')) {
    formatted = cleaned.substring(1);
  }

  // Check if it's a valid Tanzanian mobile number
  if (formatted.length === 9) {
    const prefix = formatted.substring(0, 3);
    
    // Vodacom: 074, 075, 076
    if (['074', '075', '076'].includes(prefix)) {
      operator = 'Vodacom';
      isValid = true;
    }
    // Airtel: 067, 068, 069, 078
    else if (['067', '068', '069', '078'].includes(prefix)) {
      operator = 'Airtel';
      isValid = true;
    }
    // Tigo: 065, 071, 077
    else if (['065', '071', '077'].includes(prefix)) {
      operator = 'Tigo';
      isValid = true;
    }
    // Halotel: 062
    else if (['062'].includes(prefix)) {
      operator = 'Halotel';
      isValid = true;
    }
    // TTCL: 073
    else if (['073'].includes(prefix)) {
      operator = 'TTCL';
      isValid = true;
    }
  }

  return {
    raw: phoneNumber,
    formatted: isValid ? `+255${formatted}` : phoneNumber,
    isValid,
    operator: isValid ? operator : undefined,
  };
}

/**
 * Format currency for Tanzania (TZS)
 */
export function formatTanzanianCurrency(amount: number, showCurrency = true): string {
  const formatted = new Intl.NumberFormat('sw-TZ', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

  return showCurrency ? `TZS ${formatted}` : formatted;
}

/**
 * Convert city enum to human readable format
 */
export function formatCityName(city: TanzaniaCity): string {
  const cityNames: Record<TanzaniaCity, string> = {
    [TanzaniaCity.DAR_ES_SALAAM]: 'Dar es Salaam',
    [TanzaniaCity.ARUSHA]: 'Arusha',
    [TanzaniaCity.ZANZIBAR]: 'Zanzibar',
    [TanzaniaCity.MWANZA]: 'Mwanza',
    [TanzaniaCity.DODOMA]: 'Dodoma',
    [TanzaniaCity.TANGA]: 'Tanga',
    [TanzaniaCity.MOROGORO]: 'Morogoro',
    [TanzaniaCity.MBEYA]: 'Mbeya',
    [TanzaniaCity.IRINGA]: 'Iringa',
    [TanzaniaCity.KILIMANJARO]: 'Kilimanjaro',
  };

  return cityNames[city] || city;
}

/**
 * Get timezone for East Africa Time
 */
export function getTanzanianTimezone(): string {
  return 'Africa/Dar_es_Salaam';
}

/**
 * Format date and time for Tanzania
 */
export function formatTanzanianDateTime(date: Date, includeTime = true): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: getTanzanianTimezone(),
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = false;
  }

  return new Intl.DateTimeFormat('sw-TZ', options).format(date);
}

/**
 * Get business hours for Tanzania
 */
export function getTanzanianBusinessHours(): { open: string; close: string } {
  return {
    open: '08:00',
    close: '17:00',
  };
}

/**
 * Check if time is within business hours
 */
export function isWithinBusinessHours(time: string): boolean {
  const businessHours = getTanzanianBusinessHours();
  return time >= businessHours.open && time <= businessHours.close;
}

/**
 * Get popular safari destinations in Tanzania
 */
export function getSafariDestinations(): Array<{ name: string; city: TanzaniaCity; description: string }> {
  return [
    {
      name: 'Serengeti National Park',
      city: TanzaniaCity.ARUSHA,
      description: 'Famous for the Great Migration and abundant wildlife',
    },
    {
      name: 'Ngorongoro Crater',
      city: TanzaniaCity.ARUSHA,
      description: 'UNESCO World Heritage Site with incredible wildlife density',
    },
    {
      name: 'Tarangire National Park',
      city: TanzaniaCity.ARUSHA,
      description: 'Known for large elephant herds and baobab trees',
    },
    {
      name: 'Lake Manyara National Park',
      city: TanzaniaCity.ARUSHA,
      description: 'Famous for tree-climbing lions and flamingos',
    },
    {
      name: 'Selous Game Reserve',
      city: TanzaniaCity.DAR_ES_SALAAM,
      description: 'One of the largest game reserves in Africa',
    },
    {
      name: 'Ruaha National Park',
      city: TanzaniaCity.IRINGA,
      description: 'Tanzania\'s largest national park with diverse wildlife',
    },
  ];
}

/**
 * Get cultural sites in Tanzania
 */
export function getCulturalSites(): Array<{ name: string; city: TanzaniaCity; description: string }> {
  return [
    {
      name: 'Stone Town',
      city: TanzaniaCity.ZANZIBAR,
      description: 'Historic center of Zanzibar with Swahili culture',
    },
    {
      name: 'Olduvai Gorge',
      city: TanzaniaCity.ARUSHA,
      description: 'Cradle of mankind with important archaeological findings',
    },
    {
      name: 'Mount Kilimanjaro',
      city: TanzaniaCity.KILIMANJARO,
      description: 'Africa\'s highest peak and cultural symbol',
    },
    {
      name: 'Maasai Villages',
      city: TanzaniaCity.ARUSHA,
      description: 'Traditional Maasai communities and culture',
    },
  ];
}

/**
 * Validate Tanzanian business registration number
 */
export function validateBusinessRegistration(registrationNumber: string): boolean {
  // Simplified validation - in real implementation, you'd validate against actual format
  const cleaned = registrationNumber.replace(/\s+/g, '');
  return cleaned.length >= 8 && cleaned.length <= 15 && /^[A-Z0-9]+$/.test(cleaned);
}

/**
 * Get major regions of Tanzania
 */
export function getTanzanianRegions(): Array<{ name: string; cities: TanzaniaCity[] }> {
  return [
    {
      name: 'Northern Tanzania',
      cities: [TanzaniaCity.ARUSHA, TanzaniaCity.KILIMANJARO, TanzaniaCity.TANGA],
    },
    {
      name: 'Central Tanzania',
      cities: [TanzaniaCity.DODOMA],
    },
    {
      name: 'Eastern Tanzania',
      cities: [TanzaniaCity.DAR_ES_SALAAM, TanzaniaCity.MOROGORO],
    },
    {
      name: 'Western Tanzania',
      cities: [TanzaniaCity.MWANZA],
    },
    {
      name: 'Southern Tanzania',
      cities: [TanzaniaCity.MBEYA, TanzaniaCity.IRINGA],
    },
    {
      name: 'Zanzibar',
      cities: [TanzaniaCity.ZANZIBAR],
    },
  ];
}

/**
 * Get vehicle types common in Tanzania
 */
export function getCommonVehicleTypes(): Array<{ type: string; description: string; suitableFor: string[] }> {
  return [
    {
      type: 'SUV',
      description: 'Sport Utility Vehicle suitable for both city and safari',
      suitableFor: ['safari', 'city', 'long_distance'],
    },
    {
      type: 'SEDAN',
      description: 'Comfortable car for city travel and short distances',
      suitableFor: ['city', 'business', 'airport'],
    },
    {
      type: 'VAN',
      description: 'Large vehicle for group transportation',
      suitableFor: ['groups', 'events', 'cargo'],
    },
    {
      type: 'PICKUP',
      description: 'Utility vehicle for cargo and rough terrain',
      suitableFor: ['cargo', 'rural', 'construction'],
    },
    {
      type: 'BUS',
      description: 'Large passenger vehicle for group travel',
      suitableFor: ['large_groups', 'tours', 'events'],
    },
    {
      type: 'MOTORCYCLE',
      description: 'Two-wheeler for quick city transportation',
      suitableFor: ['city', 'quick_trips', 'delivery'],
    },
  ];
}
