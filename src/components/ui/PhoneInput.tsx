import { useState, useEffect } from 'react'

const countryCodes = [
  { code: '47', country: 'Norge', flag: '🇳🇴' },
  { code: '45', country: 'Danmark', flag: '🇩🇰' },
  { code: '46', country: 'Sverige', flag: '🇸🇪' },
  { code: '358', country: 'Finland', flag: '🇫🇮' },
  { code: '354', country: 'Island', flag: '🇮🇸' },
  { code: '44', country: 'UK', flag: '🇬🇧' },
  { code: '49', country: 'Tyskland', flag: '🇩🇪' },
  { code: '33', country: 'Frankrike', flag: '🇫🇷' },
  { code: '34', country: 'Spania', flag: '🇪🇸' },
  { code: '39', country: 'Italia', flag: '🇮🇹' },
  { code: '31', country: 'Nederland', flag: '🇳🇱' },
  { code: '32', country: 'Belgia', flag: '🇧🇪' },
  { code: '43', country: 'Østerrike', flag: '🇦🇹' },
  { code: '41', country: 'Sveits', flag: '🇨🇭' },
  { code: '48', country: 'Polen', flag: '🇵🇱' },
  { code: '420', country: 'Tsjekkia', flag: '🇨🇿' },
  { code: '36', country: 'Ungarn', flag: '🇭🇺' },
  { code: '30', country: 'Hellas', flag: '🇬🇷' },
  { code: '351', country: 'Portugal', flag: '🇵🇹' },
  { code: '353', country: 'Irland', flag: '🇮🇪' },
  { code: '1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '61', country: 'Australia', flag: '🇦🇺' },
  { code: '64', country: 'New Zealand', flag: '🇳🇿' },
  { code: '81', country: 'Japan', flag: '🇯🇵' },
  { code: '82', country: 'Sør-Korea', flag: '🇰🇷' },
  { code: '86', country: 'Kina', flag: '🇨🇳' },
  { code: '91', country: 'India', flag: '🇮🇳' },
  { code: '55', country: 'Brasil', flag: '🇧🇷' },
  { code: '52', country: 'Mexico', flag: '🇲🇽' },
  { code: '27', country: 'Sør-Afrika', flag: '🇿🇦' },
  { code: '971', country: 'UAE', flag: '🇦🇪' },
  { code: '966', country: 'Saudi-Arabia', flag: '🇸🇦' },
  { code: '90', country: 'Tyrkia', flag: '🇹🇷' },
  { code: '7', country: 'Russland', flag: '🇷🇺' },
  { code: '380', country: 'Ukraina', flag: '🇺🇦' },
  { code: '372', country: 'Estland', flag: '🇪🇪' },
  { code: '371', country: 'Latvia', flag: '🇱🇻' },
  { code: '370', country: 'Litauen', flag: '🇱🇹' },
]

interface PhoneInputProps {
  value: string
  onChange: (fullNumber: string) => void
  language: 'no' | 'en'
  label?: string
  required?: boolean
  error?: string
}

export function PhoneInput({ value, onChange, language, label, required, error }: PhoneInputProps) {
  // Norwegian gets default +47, English gets no default (must choose)
  const defaultCode = language === 'no' ? '47' : ''
  const [countryCode, setCountryCode] = useState(defaultCode)
  const [localNumber, setLocalNumber] = useState('')
  const [countryCodeError, setCountryCodeError] = useState('')

  useEffect(() => {
    if (value) {
      const matchedCode = countryCodes.find(c => value.startsWith(c.code))
      if (matchedCode) {
        setCountryCode(matchedCode.code)
        setLocalNumber(value.slice(matchedCode.code.length))
      } else {
        setLocalNumber(value)
      }
    }
  }, [])

  useEffect(() => {
    // Reset country code when language changes
    setCountryCode(language === 'no' ? '47' : '')
    setCountryCodeError('')
  }, [language])

  function handleCountryChange(newCode: string) {
    setCountryCode(newCode)
    setCountryCodeError('')
    if (newCode) {
      onChange(newCode + localNumber)
    } else {
      onChange('')
    }
  }

  function handleNumberChange(newNumber: string) {
    const digitsOnly = newNumber.replace(/\D/g, '')
    setLocalNumber(digitsOnly)
    
    // Validate country code is selected for English
    if (!countryCode && language === 'en') {
      setCountryCodeError(language === 'en' ? 'Please select a country code' : 'Velg landskode')
      onChange('')
      return
    }
    
    onChange(countryCode + digitsOnly)
  }

  const selectedCountry = countryCodes.find(c => c.code === countryCode)

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="flex gap-2">
        <select
          value={countryCode}
          onChange={(e) => handleCountryChange(e.target.value)}
          className={`px-3 py-2 border rounded-lg bg-white text-sm min-w-[120px] ${
            countryCodeError ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          {!countryCode && (
            <option value="">
              {language === 'en' ? 'Choose' : 'Velg'}
            </option>
          )}
          {countryCodes.map(c => (
            <option key={c.code} value={c.code}>
              {c.flag} +{c.code}
            </option>
          ))}
        </select>
        <input
          type="tel"
          value={localNumber}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder={language === 'no' ? 'Mobilnummer' : 'Mobile number'}
          className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          required={required}
        />
      </div>
      {selectedCountry && (
        <p className="text-xs text-gray-500">
          {selectedCountry.flag} {selectedCountry.country} (+{selectedCountry.code})
        </p>
      )}
      {countryCodeError && <p className="text-sm text-red-500">{countryCodeError}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
