import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import React from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => {
    const translations: Record<string, string> = {
      'auth.email_or_phone': 'Email or phone',
      'auth.send_reset_code': 'Send reset code',
      'auth.reset_code': 'Reset code',
      'auth.new_password': 'New password',
      'auth.update_password': 'Update password',
      'auth.sending': 'Sending...',
      'validation.provide_title_description': 'Please provide a title and description',
      'validation.select_location': 'Please select a location',
    };
    return {
      t: (key: string) => translations[key] ?? key,
      i18n: { changeLanguage: vi.fn() },
    };
  },
}));

vi.mock('leaflet', () => ({
  default: {
    Icon: {
      Default: class {
        static mergeOptions() {
          return undefined;
        }
      },
    },
  },
  Icon: {
    Default: class {
      static mergeOptions() {
        return undefined;
      }
    },
  },
}));

vi.mock('react-leaflet', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react');
  return {
    MapContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="map">{children}</div>
    ),
    Marker: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="marker">{children}</div>
    ),
    TileLayer: () => <div data-testid="tile-layer" />,
    useMapEvents: () => null,
    ...(actual || {}),
  };
});
