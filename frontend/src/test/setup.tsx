import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import React from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
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
