import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CroppedImage } from '@/components/common/CroppedImage';

describe('CroppedImage', () => {
  const mockSrc = 'blob:http://localhost/test-image';
  const originalWidth = 1000;
  const originalHeight = 750;

  describe('when crop is null', () => {
    it('renders an img element with object-contain by default', () => {
      const { container } = render(
        <CroppedImage
          src={mockSrc}
          crop={null}
          originalWidth={originalWidth}
          originalHeight={originalHeight}
        />
      );

      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.className).toContain('object-contain');
      expect(img?.getAttribute('src')).toBe(mockSrc);
    });

    it('renders an img element with object-cover when fit="cover"', () => {
      const { container } = render(
        <CroppedImage
          src={mockSrc}
          crop={null}
          originalWidth={originalWidth}
          originalHeight={originalHeight}
          fit="cover"
        />
      );

      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.className).toContain('object-cover');
    });
  });

  describe('when crop is provided', () => {
    const validCrop = { x: 100, y: 50, width: 500, height: 400 };

    it('renders an SVG element instead of img', () => {
      const { container } = render(
        <CroppedImage
          src={mockSrc}
          crop={validCrop}
          originalWidth={originalWidth}
          originalHeight={originalHeight}
        />
      );

      const svg = container.querySelector('svg');
      const img = container.querySelector('img');
      
      expect(svg).toBeTruthy();
      expect(img).toBeFalsy();
    });

    it('sets correct viewBox from crop coordinates', () => {
      const { container } = render(
        <CroppedImage
          src={mockSrc}
          crop={validCrop}
          originalWidth={originalWidth}
          originalHeight={originalHeight}
        />
      );

      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('viewBox')).toBe('100 50 500 400');
    });

    it('uses preserveAspectRatio="xMidYMid meet" for contain', () => {
      const { container } = render(
        <CroppedImage
          src={mockSrc}
          crop={validCrop}
          originalWidth={originalWidth}
          originalHeight={originalHeight}
          fit="contain"
        />
      );

      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    });

    it('uses preserveAspectRatio="xMidYMid slice" for cover', () => {
      const { container } = render(
        <CroppedImage
          src={mockSrc}
          crop={validCrop}
          originalWidth={originalWidth}
          originalHeight={originalHeight}
          fit="cover"
        />
      );

      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid slice');
    });

    it('renders image element with full original dimensions', () => {
      const { container } = render(
        <CroppedImage
          src={mockSrc}
          crop={validCrop}
          originalWidth={originalWidth}
          originalHeight={originalHeight}
        />
      );

      const image = container.querySelector('image');
      expect(image?.getAttribute('width')).toBe(String(originalWidth));
      expect(image?.getAttribute('height')).toBe(String(originalHeight));
      expect(image?.getAttribute('href')).toBe(mockSrc);
    });
  });

  describe('when crop is too small (invalid)', () => {
    it('falls back to img element when crop width < 50', () => {
      const { container } = render(
        <CroppedImage
          src={mockSrc}
          crop={{ x: 0, y: 0, width: 40, height: 100 }}
          originalWidth={originalWidth}
          originalHeight={originalHeight}
        />
      );

      const img = container.querySelector('img');
      const svg = container.querySelector('svg');
      
      expect(img).toBeTruthy();
      expect(svg).toBeFalsy();
    });

    it('falls back to img element when crop height < 50', () => {
      const { container } = render(
        <CroppedImage
          src={mockSrc}
          crop={{ x: 0, y: 0, width: 100, height: 30 }}
          originalWidth={originalWidth}
          originalHeight={originalHeight}
        />
      );

      const img = container.querySelector('img');
      const svg = container.querySelector('svg');
      
      expect(img).toBeTruthy();
      expect(svg).toBeFalsy();
    });
  });

  describe('defensive handling', () => {
    it('renders img when originalWidth is missing', () => {
      const { container } = render(
        <CroppedImage
          src={mockSrc}
          crop={{ x: 0, y: 0, width: 100, height: 100 }}
          originalWidth={0}
          originalHeight={originalHeight}
        />
      );

      const img = container.querySelector('img');
      expect(img).toBeTruthy();
    });

    it('renders img when originalHeight is missing', () => {
      const { container } = render(
        <CroppedImage
          src={mockSrc}
          crop={{ x: 0, y: 0, width: 100, height: 100 }}
          originalWidth={originalWidth}
          originalHeight={0}
        />
      );

      const img = container.querySelector('img');
      expect(img).toBeTruthy();
    });
  });
});
