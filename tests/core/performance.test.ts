import { describe, expect, it } from 'vitest';
import {
  detectIsIOS,
  detectIsMobileDevice,
  resolvePerformanceProfile,
} from '../../src/core/performance';

describe('PerformanceProfile', () => {
  it('detects iPhone Chrome (iOS WebKit) as iOS and mobile', () => {
    const iphoneChromeEnv = {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5,
      innerWidth: 390,
      devicePixelRatio: 3,
      coarsePointer: true,
    };

    expect(detectIsIOS(iphoneChromeEnv)).toBe(true);
    expect(detectIsMobileDevice(iphoneChromeEnv)).toBe(true);

    const profile = resolvePerformanceProfile('auto', iphoneChromeEnv);
    expect(profile.tier).toBe('mobile');
    expect(profile.isIOS).toBe(true);
    expect(profile.cameraWidth).toBe(640);
    expect(profile.cameraHeight).toBe(480);
    expect(profile.stringSegments).toBe(32);
    expect(profile.disableBackdropBlur).toBe(true);
    expect(profile.antialias).toBe(false);
    expect(profile.maxPixelRatio).toBeLessThanOrEqual(1.25);
    expect(profile.audioPolyphony).toBe(6);
  });

  it('detects iPadOS desktop-mode MacIntel with touch points as iOS mobile', () => {
    const ipadEnv = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
      innerWidth: 1024,
      coarsePointer: true,
    };

    expect(detectIsIOS(ipadEnv)).toBe(true);
    expect(resolvePerformanceProfile('auto', ipadEnv).tier).toBe('mobile');
  });

  it('resolves desktop browsers to high quality tier by default', () => {
    const desktopEnv = {
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      platform: 'Linux x86_64',
      maxTouchPoints: 0,
      innerWidth: 1920,
      devicePixelRatio: 1,
      coarsePointer: false,
    };

    expect(detectIsIOS(desktopEnv)).toBe(false);
    expect(detectIsMobileDevice(desktopEnv)).toBe(false);

    const profile = resolvePerformanceProfile('auto', desktopEnv);
    expect(profile.tier).toBe('high');
    expect(profile.stringSegments).toBe(64);
    expect(profile.cameraWidth).toBe(1280);
    expect(profile.disableBackdropBlur).toBe(false);
    expect(profile.antialias).toBe(true);
  });

  it('honors explicit mobile and high mode overrides regardless of device', () => {
    const desktopEnv = {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/124.0.0.0',
      platform: 'Linux x86_64',
      maxTouchPoints: 0,
      innerWidth: 1920,
      coarsePointer: false,
    };
    const iphoneEnv = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
      innerWidth: 390,
      coarsePointer: true,
    };

    expect(resolvePerformanceProfile('mobile', desktopEnv).tier).toBe('mobile');
    expect(resolvePerformanceProfile('high', iphoneEnv).tier).toBe('high');
  });
});
