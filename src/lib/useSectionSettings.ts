import { useState, useEffect, useCallback } from 'react';
import {
  sectionSettingsService,
  type AppSectionKey,
  type AppSectionSetting,
  type AppSectionSettingsMap,
} from './sectionSettingsService';

export function useSectionSettings() {
  const [settings, setSettings] = useState<AppSectionSettingsMap>(() =>
    sectionSettingsService.getSnapshot()
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshAll = useCallback(async (silent = false): Promise<AppSectionSettingsMap> => {
    if (!silent) setIsLoading(true);
    try {
      const next = await sectionSettingsService.fetchAllSectionSettings();
      setSettings(next);
      return next;
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  const refreshSection = useCallback(async (sectionKey: AppSectionKey): Promise<AppSectionSetting> => {
    const res = await sectionSettingsService.fetchSectionSetting(sectionKey);
    setSettings(sectionSettingsService.getSnapshot());
    return res;
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = sectionSettingsService.subscribe((nextMap) => {
      if (active) {
        setSettings(nextMap);
      }
    });

    setIsLoading(true);
    sectionSettingsService
      .fetchAllSectionSettings()
      .then((next) => {
        if (active) setSettings(next);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return {
    settings,
    isLoading,
    refreshAll,
    refreshSection,
  };
}
