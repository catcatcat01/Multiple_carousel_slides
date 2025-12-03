import './style.scss';
import React, { useMemo } from 'react';
import { dashboard, bitable, DashboardState, FieldType, IAttachmentField, IFieldMeta, ITable } from "@lark-base-open/js-sdk";
import { Button, Select, InputNumber, Switch, Input } from '@douyinfe/semi-ui';
import { useState, useEffect, useRef, useCallback } from 'react';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Item } from '../Item';
import { ColorPicker } from '../ColorPicker';
import { useConfig } from '../../hooks';
import dayjs from 'dayjs';

interface ICarouselConfig {
  tableId?: string;
  viewId?: string;
  titleFieldId?: string;
  descFieldId?: string;
  imageFieldId?: string;
  timeFieldId?: string;
  latestFirst?: boolean;
  preferViewOrder?: boolean;
  limit: number;
  intervalMs: number;
  refreshMs: number;
  color: string;
  showIndicators: boolean;
}

interface IPageConfig extends ICarouselConfig {
  id: string;
  name: string;
}

interface IAppConfig {
  pages: IPageConfig[];
  groupIntervalMs?: number;
}

interface ISlide {
  id: string;
  title: string;
  desc?: string;
  imageUrl?: string;
}

export default function Carousel(props: { bgColor: string }) {
  const { t } = useTranslation();
  
  // Initialize with a default page to prevent blank screen
  const [appConfig, setAppConfig] = useState<IAppConfig>(() => {
    const themeMode = (document.body.getAttribute('theme-mode') || '').toLowerCase();
    const defaultColor = themeMode === 'dark' ? 'var(--ccm-chart-W500)' : 'var(--ccm-chart-N700)';
    return {
      pages: [{
        id: `page-${Date.now()}`,
        name: t('carousel.page') || '页面1',
        limit: 10,
        intervalMs: 3000,
        refreshMs: 8000,
        color: defaultColor,
        showIndicators: true,
        latestFirst: true,
        preferViewOrder: true,
      }]
      ,
      groupIntervalMs: 5000
    };
  });
  
  const [currentPageId, setCurrentPageId] = useState<string | undefined>(appConfig.pages[0].id);

  const isCreate = dashboard && dashboard.state === DashboardState.Create;

  const timer = useRef<any>();
  const updateConfig = useCallback((res: any) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    const { customConfig } = res || {};
    // Only update if customConfig exists and has pages. 
    // If it's a new dashboard (no config), we keep our default initialization.
    if (customConfig && customConfig.pages && customConfig.pages.length > 0) {
      const themeMode = (document.body.getAttribute('theme-mode') || '').toLowerCase();
      const defaultColor = themeMode === 'dark' ? 'var(--ccm-chart-W500)' : 'var(--ccm-chart-N700)';
      const normalize = (v?: string) => (v === 'undefined' || v === 'null' || v === '' ? undefined : v);
      const toPage = (raw: any, idx: number): IPageConfig => {
        const base: ICarouselConfig = {
          limit: raw?.limit ?? 10,
          intervalMs: raw?.intervalMs ?? 3000,
          refreshMs: raw?.refreshMs ?? 8000,
          color: raw?.color ?? defaultColor,
          showIndicators: raw?.showIndicators ?? true,
          latestFirst: raw?.latestFirst ?? true,
          preferViewOrder: raw?.preferViewOrder ?? true,
          tableId: normalize(raw?.tableId),
          viewId: normalize(raw?.viewId),
          titleFieldId: normalize(raw?.titleFieldId),
          descFieldId: normalize(raw?.descFieldId),
          imageFieldId: normalize(raw?.imageFieldId),
          timeFieldId: normalize(raw?.timeFieldId),
        } as ICarouselConfig;
        return {
          id: String(raw?.id || `page-${idx + 1}`),
          name: String(raw?.name || t('carousel.page') || `页面${idx + 1}`),
          ...base,
        } as IPageConfig;
      };

      let pages: IPageConfig[] = [];
      if (Array.isArray(customConfig?.pages)) {
        pages = (customConfig.pages as any[]).map((p, i) => toPage(p, i));
      } else {
        pages = [toPage(customConfig, 0)];
      }
      const groupIntervalMs = Number((customConfig as any).groupIntervalMs) || 5000;
      setAppConfig({ pages, groupIntervalMs });
      // If current page is not in the new list, switch to the first one
      // Use a callback to ensure we use the latest currentPageId state if needed, 
      // but here we are inside a callback so we rely on the closure or dependency.
      // Ideally we should check against the new pages.
      setCurrentPageId(prevId => {
          if (!prevId || !pages.find(p => p.id === prevId)) {
              return pages[0].id;
          }
          return prevId;
      });
      
      // Timer removed here, moved to useEffect
    }
  }, [t]);

  useConfig(updateConfig);

  // Ensure setRendered is called to avoid "Unknown Plugin" or timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      dashboard.setRendered();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const currentPage = useMemo(() => (appConfig.pages && appConfig.pages.find(p => p.id === currentPageId)) || (appConfig.pages && appConfig.pages[0]), [appConfig, currentPageId]);
  
  // Config mode indicator and grid display decision
  const inConfigMode = (dashboard && (dashboard.state === DashboardState.Config || dashboard.state === DashboardState.Create)) || isCreate;
  const hasAnyConfiguredPage = useMemo(() => (appConfig.pages && appConfig.pages.some(p => !!p.tableId)) || false, [appConfig.pages]);
  const shouldShowGrid = !!(appConfig.pages && appConfig.pages.length) && hasAnyConfiguredPage;

  // Removed the useEffect that added default page, as we now initialize with it.

  return (
    <main style={{ backgroundColor: props.bgColor }} className={classnames({ 'main-config': inConfigMode, 'main': true })}>
      <div className='content'>
        {shouldShowGrid ? (
          <GridView pages={appConfig.pages || []} intervalMs={appConfig.groupIntervalMs || 5000} />
        ) : (
          <CarouselView config={currentPage || {
            limit: 10,
            intervalMs: 3000,
            refreshMs: 8000,
            color: (document.body.getAttribute('theme-mode') || '').toLowerCase() === 'dark' ? 'var(--ccm-chart-W500)' : 'var(--ccm-chart-N700)',
            showIndicators: true,
            latestFirst: true,
            preferViewOrder: true,
          } as ICarouselConfig} isConfig={true} />
        )}
      </div>
      {inConfigMode && (
        <div className='config-panel'>
          <PagesManagerPanel
            t={t}
            appConfig={appConfig}
            setAppConfig={setAppConfig}
            currentPageId={currentPageId}
            setCurrentPageId={setCurrentPageId}
          />
          {currentPage ? (
            <ConfigPanel
              t={t}
              config={currentPage}
              setConfig={(updater) => {
                setAppConfig(prev => {
                  const pages = prev.pages.map(p => {
                    if (p.id !== currentPage.id) return p;
                    const next = typeof updater === 'function' ? (updater as any)(p) : updater;
                    return { ...p, ...next } as IPageConfig;
                  });
                  return { pages, groupIntervalMs: prev.groupIntervalMs };
                });
              }}
              onSave={(cfg) => {
                setAppConfig(prev => {
                  const pages = prev.pages.map(p => (p.id === currentPage!.id ? { ...p, ...cfg } : p));
                  dashboard.saveConfig({ customConfig: { pages, groupIntervalMs: prev.groupIntervalMs }, dataConditions: [] } as any);
                  return { pages, groupIntervalMs: prev.groupIntervalMs };
                });
              }}
            />
          ) : null}
        </div>
      )}
    </main>
  );
}

function PagesManagerPanel({ t, appConfig, setAppConfig, currentPageId, setCurrentPageId }: {
  t: any,
  appConfig: IAppConfig,
  setAppConfig: React.Dispatch<React.SetStateAction<IAppConfig>>,
  currentPageId?: string,
  setCurrentPageId: (id?: string) => void,
}) {
  const pages = appConfig.pages || [];

  const addPage = () => {
    const id = `page-${Date.now()}`;
    const page: IPageConfig = {
      id,
      name: t('carousel.page') || '新页面',
      limit: 10,
      intervalMs: 3000,
      refreshMs: 8000,
      color: 'var(--ccm-chart-N700)',
      showIndicators: true,
      latestFirst: true,
      preferViewOrder: true,
    } as IPageConfig;
    const next = { pages: [...pages, page], groupIntervalMs: appConfig.groupIntervalMs };
    setAppConfig(next);
    dashboard.saveConfig({ customConfig: next, dataConditions: [] } as any);
    setCurrentPageId(id);
  };

  const updatePage = (id: string, patch: Partial<IPageConfig>) => {
    setAppConfig(prev => {
      const prevPages = prev.pages || [];
      const nextPages = prevPages.map(p => (p.id === id ? { ...p, ...patch } : p));
      return { pages: nextPages, groupIntervalMs: prev.groupIntervalMs };
    });
  };

  const removePage = (id: string) => {
    setAppConfig(prev => {
      const prevPages = prev.pages || [];
      const nextPages = prevPages.filter(p => p.id !== id);
      const next = { pages: nextPages, groupIntervalMs: prev.groupIntervalMs };
      dashboard.saveConfig({ customConfig: next, dataConditions: [] } as any);
      if (currentPageId === id) {
        setCurrentPageId(nextPages.length ? nextPages[0].id : undefined);
      }
      return next;
    });
  };

  const saveAll = () => {
    dashboard.saveConfig({ customConfig: appConfig, dataConditions: [] } as any);
  };

  return (
    <div className='form'>
      <div className='label'>页面管理</div>
      <div className='form-item'>
        <Item label={'轮播时间(ms)'}>
          <InputNumber value={appConfig.groupIntervalMs || 5000} min={1000} max={60000} step={500} onChange={(v) => setAppConfig(prev => ({ pages: prev.pages || [], groupIntervalMs: Number(v) || 5000 }))} />
        </Item>
      </div>
      {(!pages || pages.length === 0) ? (
        <div style={{ padding: '12px 0', color: 'var(--semi-color-text-2)' }}>
          {t('carousel.no_pages') || '暂无页面，请添加'}
        </div>
      ) : null}
      {pages.map(p => (
        <div key={p.id} className='form-item'>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => setCurrentPageId(p.id)}>{'进入页面'}</Button>
              <Button type='danger' onClick={() => removePage(p.id)}>{'删除页面'}</Button>
            </div>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button theme='solid' onClick={addPage}>{'新增页面'}</Button>
        <Button onClick={saveAll}>{'保存'}</Button>
      </div>
    </div>
  );
}

function GridView({ pages, intervalMs }: { pages: IPageConfig[], intervalMs: number }) {
  const [start, setStart] = useState(0);
  const n = Math.min(4, pages.length || 0);
  useEffect(() => {
    setStart(0);
  }, [pages.length]);
  useEffect(() => {
    let timer: any;
    if (pages.length > 4) {
      timer = setInterval(() => {
        setStart(s => (s + 1) % pages.length);
      }, Math.max(1000, intervalMs || 5000));
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [pages.length, intervalMs]);
  const visibleIndexSet = useMemo(() => {
    const set = new Set<number>();
    if (!pages.length) return set;
    if (pages.length <= 4) {
      for (let i = 0; i < pages.length; i++) set.add(i);
      return set;
    }
    for (let i = 0; i < 4; i++) set.add((start + i) % pages.length);
    return set;
  }, [pages.length, start]);
  const cls = useMemo(() => {
    if (n === 1) return 'grid-root grid-n-1';
    if (n === 2) return 'grid-root grid-n-2';
    if (n === 3) return 'grid-root grid-n-3';
    return 'grid-root grid-n-4';
  }, [n]);
  return (
    <div className={cls}>
      {pages.map((p, i) => (
        <div key={p.id} className={classnames('grid-item', { 'grid-item-hidden': !visibleIndexSet.has(i) })}>
          <CarouselView config={p} isConfig={false} active={visibleIndexSet.has(i)} />
        </div>
      ))}
    </div>
  );
}

function CarouselView({ config, isConfig, active = true }: { config: ICarouselConfig, isConfig: boolean, active?: boolean }) {
  const { t } = useTranslation();
  const [slides, setSlides] = useState<ISlide[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const playRef = useRef<any>();
  const playTimeout = useRef<any>();
  const refreshRef = useRef<any>();
  const lastIdsRef = useRef<string[]>([]);
  const cacheRef = useRef<Record<string, ISlide>>({});
  const tableRef = useRef<ITable | null>(null);
  const imageFieldRef = useRef<IAttachmentField | null>(null);
  const preloadedRef = useRef<Record<string, boolean>>({});

  const color = config.color || 'var(--ccm-chart-N700)';

  const toPlainText = (val: any): string => {
    if (val === null || val === undefined) return '';
    const type = typeof val;
    if (type === 'string') {
      const s = (val as string).trim();
      if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
        try {
          return toPlainText(JSON.parse(s));
        } catch {
          return s;
        }
      }
      return s;
    }
    if (type === 'number' || type === 'boolean') return String(val);
    if (Array.isArray(val)) {
      const parts = val.map((item) => {
        if (item === null || item === undefined) return '';
        const it = typeof item;
        if (it === 'string' || it === 'number' || it === 'boolean') return String(item);
        if (it === 'object') {
          if ('text' in item && item.text != null) return String((item as any).text);
          if ('name' in item && item.name != null) return String((item as any).name);
          if ('title' in item && item.title != null) return String((item as any).title);
          if ('value' in item && item.value != null) return String((item as any).value);
        }
        return '';
      }).filter(Boolean);
      return parts.join(' ');
    }
    if (type === 'object') {
      const obj = val as any;
      if ('text' in obj && obj.text != null) return String(obj.text);
      if ('name' in obj && obj.name != null) return String(obj.name);
      if ('title' in obj && obj.title != null) return String(obj.title);
      if ('value' in obj && obj.value != null) return String(obj.value);
      try { return JSON.stringify(val); } catch { return ''; }
    }
    return String(val);
  };

  const pickAttachmentUrl = (val: any): string | undefined => {
    if (val == null) return undefined;
    const arr = Array.isArray(val) ? val : [val];
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const cand = (item as any).thumbnailUrl
        || (item as any).thumbnail_url
        || (item as any).previewUrl
        || (item as any).preview_url
        || (item as any).picUrl
        || (item as any).url
        || (item as any).fsUrl
        || (item as any).fs_url;
      if (typeof cand === 'string' && cand) return cand;
    }
    return undefined;
  };

  const toTimestamp = (val: any): number => {
    if (val === null || val === undefined) return 0;
    const type = typeof val;
    if (type === 'number') return val as number;
    if (type === 'string') {
      const s = (val as string).trim();
      const d = dayjs(s);
      if (d.isValid()) return d.valueOf();
      const n = Number(s);
      return isNaN(n) ? 0 : n;
    }
    if (Array.isArray(val)) return toTimestamp(toPlainText(val));
    if (type === 'object') {
      const obj = val as any;
      if ('value' in obj && obj.value != null) return toTimestamp(obj.value);
      if ('text' in obj && obj.text != null) return toTimestamp(obj.text);
      if ('name' in obj && obj.name != null) return toTimestamp(obj.name);
      if ('title' in obj && obj.title != null) return toTimestamp(obj.title);
      return 0;
    }
    return 0;
  };

  const refreshImageUrlFor = useCallback(async (rid: string): Promise<string | undefined> => {
    try {
      const field = imageFieldRef.current;
      if (!field) return undefined;
      let imageUrl: string | undefined = undefined;
      try {
        const raw = await (field as any).getValue(rid);
        imageUrl = pickAttachmentUrl(raw);
      } catch (_) {}
      if (!imageUrl) {
        try {
          const urls: string[] = await (field as any).getAttachmentUrls(rid);
          imageUrl = urls && urls.length ? urls[0] : undefined;
        } catch (_) {}
      }
      if (imageUrl) {
        const prev = cacheRef.current[rid] || { id: rid, title: '', desc: '' };
        const nextSlide = { ...prev, imageUrl } as ISlide;
        cacheRef.current[rid] = nextSlide;
        setSlides((prevList) => prevList.map(s => (s.id === rid ? nextSlide : s)));
      }
      return imageUrl;
    } catch (_) {
      return undefined;
    }
  }, []);

  const preloadWithRefresh = useCallback(async (rid: string, url?: string): Promise<boolean> => {
    const tryLoad = (u: string) => new Promise<boolean>((resolve) => {
      const img = new Image();
      img.decoding = 'async' as any;
      img.onload = () => { preloadedRef.current[u] = true; resolve(true); };
      img.onerror = () => { preloadedRef.current[u] = false; resolve(false); };
      img.src = u as string;
    });
    let candidate = url;
    if (!candidate) candidate = await refreshImageUrlFor(rid);
    if (!candidate) return false;
    const ok = await tryLoad(candidate);
    if (ok) return true;
    const refreshed = await refreshImageUrlFor(rid);
    if (refreshed && refreshed !== candidate) {
      const ok2 = await tryLoad(refreshed);
      return ok2;
    }
    return false;
  }, [refreshImageUrlFor]);

  const loadData = async () => {
    try {
      if (!slides.length) setLoading(true);
      let table: ITable | null = null;
      if (config.tableId) table = await bitable.base.getTableById(config.tableId);
      if (!table) table = await bitable.base.getActiveTable();
      tableRef.current = table;

      const selection = await bitable.base.getSelection();
      const viewId = config.viewId || selection.viewId || undefined;

      let recordIds: string[] = [];
      try {
        if (viewId && (table as any).getView) {
          const view = await (table as any).getView(viewId);
          recordIds = await (view as any).getRecordIdList();
        }
      } catch (_) {}
      if (!recordIds.length) {
        recordIds = await (table as any).getRecordIdList();
      }

      const allFieldMeta: IFieldMeta[] = await (table as any).getFieldMetaList();
      const titleFieldId = config.titleFieldId || allFieldMeta.find(v => v.isPrimary)?.id;
      const descFieldId = config.descFieldId;
      const imageFieldId = config.imageFieldId || allFieldMeta.find(f => f.type === FieldType.Attachment)?.id;
      const timeFieldId = config.timeFieldId;

      let titleField: any = null;
      let descField: any = null;
      let imageField: IAttachmentField | null = null;
      let timeField: any = null;
      try {
        if (titleFieldId) titleField = await (table as any).getField(titleFieldId);
      } catch (e) {}
      try {
        if (descFieldId) descField = await (table as any).getField(descFieldId);
      } catch (e) {}
      try {
        if (imageFieldId) imageField = await (table as any).getField(imageFieldId) as IAttachmentField;
      } catch (e) {}
      imageFieldRef.current = imageField;
      try {
        if (timeFieldId) timeField = await (table as any).getField(timeFieldId);
      } catch (e) {}

      let sortedIds = recordIds.slice();
      const useViewOrderFast = !!config.preferViewOrder && !!viewId;
      if (timeField && !useViewOrderFast) {
        const pairs: { id: string, ts: number }[] = await Promise.all(sortedIds.map(async (rid) => {
          let ts = 0;
          try {
            const v = await (timeField as any).getValue(rid);
            ts = toTimestamp(v);
          } catch (_) {}
          return { id: rid, ts };
        }));
        pairs.sort((a, b) => (config.latestFirst ? b.ts - a.ts : a.ts - b.ts));
        sortedIds = pairs.map(p => p.id);
      } else if (useViewOrderFast) {
        sortedIds = recordIds.slice();
        if (!config.latestFirst) {
          sortedIds.reverse();
        }
      }
      const takeIds = sortedIds.slice(0, Math.max(1, config.limit || 10));

      const idsChanged = !(lastIdsRef.current.length === takeIds.length && lastIdsRef.current.every((id, i) => id === takeIds[i]));
      const cachedNow: ISlide[] = takeIds.map(rid => cacheRef.current[rid]).filter(Boolean) as ISlide[];
      if (cachedNow.length) {
        lastIdsRef.current = takeIds.slice();
        setSlides(cachedNow);
        setIndex(v => idsChanged ? 0 : Math.min(v, cachedNow.length ? cachedNow.length - 1 : 0));
        setLoading(false);
      } else {
        const firstId = takeIds[0];
        let firstSlide: ISlide = { id: firstId, title: '', desc: '', imageUrl: undefined };
        try {
          let title = '';
          let desc = '';
          let imageUrl: string | undefined = undefined;
          if (firstId) {
            const tasks: Promise<void>[] = [];
            tasks.push((async () => {
              if (titleField) {
                try { const val = await (titleField as any).getValue(firstId); title = toPlainText(val); } catch (_) {}
              }
            })());
            tasks.push((async () => {
              if (descField) {
                try { const val = await (descField as any).getValue(firstId); desc = toPlainText(val); } catch (_) {}
              }
            })());
            tasks.push((async () => {
              if (imageField) {
                try {
                  const raw = await (imageField as any).getValue(firstId);
                  imageUrl = pickAttachmentUrl(raw);
                  if (!imageUrl) {
                    try {
                      const urls: string[] = await imageField.getAttachmentUrls(firstId);
                      imageUrl = urls && urls.length ? urls[0] : undefined;
                    } catch (_) {}
                  }
                } catch (_) {}
              }
            })());
            await Promise.all(tasks);
            firstSlide = { id: firstId, title, desc, imageUrl };
            cacheRef.current[firstId] = firstSlide;
          }
        if (firstSlide.imageUrl) {
          const img = new Image();
          img.decoding = 'async' as any;
          img.onload = () => { preloadedRef.current[firstSlide.imageUrl as string] = true; };
          img.onerror = async () => {
            preloadedRef.current[firstSlide.imageUrl as string] = false;
            await refreshImageUrlFor(firstSlide.id);
          };
          img.src = firstSlide.imageUrl as string;
        }
        } catch (_) {}
        lastIdsRef.current = takeIds.slice();
        setSlides(firstSlide.id ? [firstSlide] : []);
        setIndex(0);
        setLoading(false);
      }

      const result: ISlide[] = await Promise.all(takeIds.map(async (rid) => {
        const cached = cacheRef.current[rid];
        if (cached) return cached;
        try {
          let title = '';
          let desc = '';
          let imageUrl: string | undefined = undefined;

          await Promise.all([
            (async () => {
              if (titleField) {
                try {
                  const val = await (titleField as any).getValue(rid);
                  title = toPlainText(val);
                } catch (_) {}
              }
            })(),
            (async () => {
              if (descField) {
                try {
                  const val = await (descField as any).getValue(rid);
                  desc = toPlainText(val);
                } catch (_) {}
              }
            })(),
            (async () => {
              if (imageField) {
                try {
                  const raw = await (imageField as any).getValue(rid);
                  imageUrl = pickAttachmentUrl(raw);
                  if (!imageUrl) {
                    try {
                      const urls: string[] = await imageField.getAttachmentUrls(rid);
                      imageUrl = urls && urls.length ? urls[0] : undefined;
                    } catch (_) {}
                  }
                } catch (_) {}
              }
            })(),
          ]);

          const slide = { id: rid, title, desc, imageUrl };
          cacheRef.current[rid] = slide;
          return slide;
        } catch (_) {
          return { id: rid, title: '', desc: '', imageUrl: undefined };
        }
      }));
      const same = lastIdsRef.current.length === takeIds.length && lastIdsRef.current.every((id, i) => id === takeIds[i]);
      lastIdsRef.current = takeIds.slice();
      setSlides(result);
      if (!same) {
        setIndex(0);
      } else {
        setIndex(v => Math.min(v, result.length ? result.length - 1 : 0));
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (refreshRef.current) clearInterval(refreshRef.current);
    if (active) {
      refreshRef.current = setInterval(loadData, Math.max(3000, config.refreshMs || 8000));
    }
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [config.tableId, config.viewId, config.titleFieldId, config.descFieldId, config.imageFieldId, config.limit, config.refreshMs, active]);

  useEffect(() => {
    if (!slides.length) return;
    const next = (index + 1) % slides.length;
    const next2 = (index + 2) % slides.length;
    const candidates: ISlide[] = [];
    candidates.push(slides[index]);
    candidates.push(slides[next]);
    if (slides.length > 2) candidates.push(slides[next2]);
    candidates.forEach(s => {
      const u = s?.imageUrl;
      if (s && u && preloadedRef.current[u] !== true) {
        preloadWithRefresh(s.id, u);
      }
    });
  }, [slides, index]);

  const planNext = useCallback(() => {
    const delay = Math.max(500, config.intervalMs || 3000);
    if (!slides.length) return;
    const next = (index + 1) % slides.length;
    clearTimeout(playTimeout.current);
    const target = slides[next];
    if (target.imageUrl) {
      const url = target.imageUrl as string;
      if (preloadedRef.current[url]) {
        playTimeout.current = setTimeout(() => {
          setIndex(next);
          planNext();
        }, delay);
      } else {
        preloadWithRefresh(target.id, url).finally(() => {
          playTimeout.current = setTimeout(() => {
            setIndex(next);
            planNext();
          }, delay);
        });
      }
    } else {
      playTimeout.current = setTimeout(() => {
        setIndex(next);
        planNext();
      }, delay);
    }
  }, [slides, index, config.intervalMs]);

  useEffect(() => {
    clearTimeout(playTimeout.current);
    if (slides.length && active) {
      playTimeout.current = setTimeout(planNext, Math.max(500, config.intervalMs || 3000));
    }
    return () => {
      clearTimeout(playTimeout.current);
    };
  }, [slides.length, config.intervalMs, planNext, active]);

  if (loading && !slides.length) {
    return (
      <div className='carousel-loading'>
        <div className='carousel-title' style={{ color }}>加载中...</div>
      </div>
    );
  }
  if (!slides.length) {
    return (
      <div className='carousel-container'>
        <div className='carousel-slide'>
          <div className='carousel-title' style={{ color }}>{t('carousel.preview.empty') || '请在右侧配置数据源'}</div>
        </div>
      </div>
    );
  }

  const current = slides[index];
  const showImage = current?.imageUrl ? preloadedRef.current[current.imageUrl] !== false : false;

  return (
    <div className='carousel-container'>
      <div className='carousel-slide' style={{ color }}>
        {showImage ? <img className='carousel-image' src={current.imageUrl as string} decoding='async' loading='eager' {...({ fetchpriority: 'high' } as any)} onLoad={() => { if (current.imageUrl) preloadedRef.current[current.imageUrl] = true; }} onError={async () => { if (current.imageUrl) preloadedRef.current[current.imageUrl] = false; await refreshImageUrlFor(current.id); }} /> : null}
        {current.title ? <div className='carousel-title'>{current.title}</div> : null}
        {current.desc ? <div className='carousel-desc'>{current.desc}</div> : null}
      </div>
      {config.showIndicators ? (
        <div className='carousel-indicators'>
          {slides.map((_, i) => (
            <div key={i} className={classnames('indicator-dot', { 'indicator-dot-active': i === index })}></div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ConfigPanel({ t, config, setConfig, onSave }: { t: any, config: IPageConfig, setConfig: React.Dispatch<React.SetStateAction<IPageConfig>>, onSave: (cfg: IPageConfig) => void }) {
  const [tables, setTables] = useState<{ label: string, value: string }[]>([]);
  const [views, setViews] = useState<{ label: string, value: string }[]>([]);
  const [fields, setFields] = useState<IFieldMeta[]>([]);

  useEffect(() => {
    bitable.base.getTableList().then(async (list: any[]) => {
      const options = await Promise.all(list.map(async (t) => ({ label: await t.getName(), value: (await t.getMeta()).id })));
      setTables(options);
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      let table: any = null;
      if (config.tableId) table = await bitable.base.getTableById(config.tableId);
      if (!table) table = await bitable.base.getActiveTable();
      try {
        const vList = await (table as any).getViewList();
        const vOpts = await Promise.all(vList.map(async (v: any) => ({ label: await v.getName(), value: await v.id })));
        setViews(vOpts);
      } catch (_) {
        const sel = await bitable.base.getSelection();
        setViews(sel.viewId ? [{ label: sel.viewId, value: sel.viewId }] : []);
      }
      const metas: IFieldMeta[] = await (table as any).getFieldMetaList();
      setFields(metas);
    };
    load();
  }, [config.tableId]);

  const fieldOptions = useMemo(() => fields.map(f => ({ label: f.name, value: f.id })), [fields]);
  const imageFieldOptions = useMemo(() => fields.filter(f => f.type === FieldType.Attachment).map(f => ({ label: f.name, value: f.id })), [fields]);
  const timeFieldOptions = useMemo(() => fields.map(f => ({ label: f.name, value: f.id })), [fields]);

  const onSaveConfig = () => {
    onSave(config);
  };

  return (
    <div className='form'>
      <div className='form'>
        <Item label={'页面名称'}>
          <Input value={(config as any).name} onChange={(v) => setConfig({ ...config, name: String(v) } as any)} />
        </Item>
        <Item label={t('carousel.label.table')}>
          <Select value={config.tableId} optionList={tables} onChange={(v) => setConfig({ ...config, tableId: v == null ? undefined : String(v) })} style={{ width: '100%' }} />
        </Item>
        <Item label={t('carousel.label.view')}>
          <Select value={config.viewId} optionList={views} onChange={(v) => setConfig({ ...config, viewId: v == null ? undefined : String(v) })} style={{ width: '100%' }} />
        </Item>
        <Item label={'遵循视图排序(更快)'}>
          <Switch checked={!!config.preferViewOrder} onChange={(v) => setConfig({ ...config, preferViewOrder: !!v })} />
        </Item>
        <Item label={'时间字段'}>
          <Select value={config.timeFieldId} optionList={timeFieldOptions} onChange={(v) => setConfig({ ...config, timeFieldId: v == null ? undefined : String(v) })} style={{ width: '100%' }} />
        </Item>
        <Item label={'最新优先'}>
          <Switch checked={!!config.latestFirst} onChange={(v) => setConfig({ ...config, latestFirst: !!v })} />
        </Item>
        <Item label={t('carousel.label.titleField')}>
          <Select value={config.titleFieldId} optionList={fieldOptions} onChange={(v) => setConfig({ ...config, titleFieldId: v == null ? undefined : String(v) })} style={{ width: '100%' }} />
        </Item>
        <Item label={t('carousel.label.descField')}>
          <Select value={config.descFieldId} optionList={fieldOptions} onChange={(v) => setConfig({ ...config, descFieldId: v == null ? undefined : String(v) })} style={{ width: '100%' }} />
        </Item>
        <Item label={t('carousel.label.imageField')}>
          <Select value={config.imageFieldId} optionList={imageFieldOptions} onChange={(v) => setConfig({ ...config, imageFieldId: v == null ? undefined : String(v) })} style={{ width: '100%' }} />
        </Item>
        <Item label={t('carousel.label.limit')}>
          <InputNumber value={config.limit} min={1} max={50} onChange={(v) => setConfig({ ...config, limit: Number(v) || 10 })} style={{ width: '100%' }} />
        </Item>
        <Item label={t('carousel.label.interval')}>
          <InputNumber value={config.intervalMs} min={1000} max={60000} step={500} onChange={(v) => setConfig({ ...config, intervalMs: Number(v) || 3000 })} style={{ width: '100%' }} />
        </Item>
        <Item label={t('carousel.label.refresh')}>
          <InputNumber value={config.refreshMs} min={3000} max={120000} step={1000} onChange={(v) => setConfig({ ...config, refreshMs: Number(v) || 8000 })} style={{ width: '100%' }} />
        </Item>
        <Item label={t('label.color')}>
          <ColorPicker value={config.color} onChange={(v) => setConfig({ ...config, color: v })} />
        </Item>
        <Item label={t('carousel.label.indicator')}>
          <Switch checked={config.showIndicators} onChange={(v) => setConfig({ ...config, showIndicators: !!v })} />
        </Item>
      </div>
      <Button className='btn' theme='solid' onClick={onSaveConfig}>{t('confirm')}</Button>
    </div>
  );
}
