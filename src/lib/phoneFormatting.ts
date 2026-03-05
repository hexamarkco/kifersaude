const COUNTRY_CALLING_CODES = new Set<string>([
  '1', '7', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49',
  '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90',
  '91', '92', '93', '94', '95', '98', '211', '212', '213', '216', '218', '220', '221', '222', '223', '224', '225', '226',
  '227', '228', '229', '230', '231', '232', '233', '234', '235', '236', '237', '238', '239', '240', '241', '242', '243',
  '244', '245', '246', '247', '248', '249', '250', '251', '252', '253', '254', '255', '256', '257', '258', '260', '261',
  '262', '263', '264', '265', '266', '267', '268', '269', '290', '291', '297', '298', '299', '350', '351', '352', '353',
  '354', '355', '356', '357', '358', '359', '370', '371', '372', '373', '374', '375', '376', '377', '378', '380', '381',
  '382', '383', '385', '386', '387', '389', '420', '421', '423', '500', '501', '502', '503', '504', '505', '506', '507',
  '508', '509', '590', '591', '592', '593', '594', '595', '596', '597', '598', '599', '670', '672', '673', '674', '675',
  '676', '677', '678', '679', '680', '681', '682', '683', '685', '686', '687', '688', '689', '690', '691', '692', '850',
  '852', '853', '855', '856', '880', '886', '960', '961', '962', '963', '964', '965', '966', '967', '968', '970', '971',
  '972', '973', '974', '975', '976', '977', '992', '993', '994', '995', '996', '998',
]);

const groupInternationalNationalNumber = (digits: string) => {
  const length = digits.length;
  if (length <= 4) return digits;
  if (length <= 7) return `${digits.slice(0, length - 4)}-${digits.slice(-4)}`;
  if (length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  if (length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  if (length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (length === 11) return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  if (length === 12) return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;

  const tail = digits.slice(-4);
  const head = digits.slice(0, -4);
  const chunks = head.match(/.{1,3}/g) || [head];
  return `${chunks.join(' ')} ${tail}`.trim();
};

const formatBrazilNationalNumber = (local: string) => {
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return groupInternationalNationalNumber(local);
};

const isLikelyBrazilLocalNumber = (digits: string) => {
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = Number(digits.slice(0, 2));
  if (!Number.isFinite(ddd) || ddd < 11 || ddd > 99) return false;
  if (digits.length === 11) return digits[2] === '9';
  return true;
};

const resolveInternationalPhoneParts = (digits: string): { countryCode: string; national: string } | null => {
  const normalized = digits.replace(/^00+/, '');
  if (!normalized) return null;

  for (let size = 3; size >= 1; size -= 1) {
    if (normalized.length <= size + 3) continue;
    const code = normalized.slice(0, size);
    if (!COUNTRY_CALLING_CODES.has(code)) continue;
    return { countryCode: code, national: normalized.slice(size) };
  }

  if (normalized.length > 10) {
    const inferredSize = Math.min(3, Math.max(1, normalized.length - 10));
    return {
      countryCode: normalized.slice(0, inferredSize),
      national: normalized.slice(inferredSize),
    };
  }

  return null;
};

export const formatPhoneDisplay = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return phone;

  if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
    return `+55 ${formatBrazilNationalNumber(cleaned.slice(2))}`;
  }

  if (isLikelyBrazilLocalNumber(cleaned)) {
    return formatBrazilNationalNumber(cleaned);
  }

  if (cleaned.startsWith('54') && cleaned.length >= 11) {
    const rest = cleaned.slice(2);
    const isMobile = rest.startsWith('9');
    const restDigits = isMobile ? rest.slice(1) : rest;
    let area = restDigits.slice(0, 3);
    let local = restDigits.slice(3);
    if (restDigits.length === 10) {
      area = restDigits.slice(0, 4);
      local = restDigits.slice(4);
    }
    const localLeft = local.slice(0, 2);
    const localRight = local.slice(2);
    return `+54 ${isMobile ? '9 ' : ''}${area} ${localLeft}-${localRight}`.trim();
  }

  const international = resolveInternationalPhoneParts(cleaned);
  if (international && international.national) {
    if (international.countryCode === '55') {
      return `+55 ${formatBrazilNationalNumber(international.national)}`;
    }
    if (international.countryCode === '86' && international.national.length === 11) {
      return `+86 ${international.national.slice(0, 3)} ${international.national.slice(3, 7)} ${international.national.slice(7)}`;
    }
    if (international.countryCode === '1' && international.national.length === 10) {
      return `+1 (${international.national.slice(0, 3)}) ${international.national.slice(3, 6)}-${international.national.slice(6)}`;
    }
    return `+${international.countryCode} ${groupInternationalNationalNumber(international.national)}`.trim();
  }

  return cleaned;
};
