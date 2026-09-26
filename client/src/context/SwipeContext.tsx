"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { ImmichAsset, SwipeAction, Person } from '@/types/immich';
import { useAuth } from './AuthContext';

export interface ImmichAlbum {
    id: string;
    albumName: string;
    assetCount: number;
    albumThumbnailAssetId: string | null;
}

export type ViewMode = 'albums' | 'timeline' | 'people';

export interface MonthGroup {
    key: string; // e.g., "2024-12"
    label: string; // e.g., "December 2024"
    count: number;
    coverAssetId: string | null;
}

interface SwipeContextType {
    queue: ImmichAsset[];
    history: SwipeAction[];
    isLoading: boolean;
    loadMore: () => Promise<void>;
    handleSwipe: (direction: 'left' | 'right') => Promise<void>;
    handleUndo: () => Promise<void>;
    currentAsset: ImmichAsset | null;
    albumId: string | null;
    setAlbumId: (id: string | null) => void;
    albums: ImmichAlbum[];
    fetchAlbums: () => Promise<void>;
    remainingCount: number;
    // New: View mode
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    // New: Timeline
    monthGroups: MonthGroup[];
    selectedMonth: string | null;
    setSelectedMonth: (month: string | null) => void;
    fetchTimeline: () => Promise<void>;
    // New: People
    people: Person[];
    selectedPerson: string | null;
    setSelectedPerson: (id: string | null) => void;
    fetchPeople: () => Promise<void>;
    // New: Review Bin
    trashQueue: ImmichAsset[];
    restoreFromTrash: (assetId: string) => void;
    emptyTrash: () => Promise<void>;
    clearTrash: () => void;
    // New: Stats
    stats: { total: number; thisWeek: number };
    sessionCleanedBytes: number;
}

const SwipeContext = createContext<SwipeContextType>({
    queue: [],
    history: [],
    isLoading: false,
    loadMore: async () => { }, // Placeholder, we expose it but logic is largely internal hook-driven now

    handleSwipe: async () => { },
    handleUndo: async () => { },
    currentAsset: null,
    albumId: null,
    setAlbumId: () => { },
    albums: [],
    fetchAlbums: async () => { },
    remainingCount: 0,
    // New defaults
    viewMode: 'albums',
    setViewMode: () => { },
    monthGroups: [],
    selectedMonth: null,
    setSelectedMonth: () => { },
    fetchTimeline: async () => { },
    people: [],
    selectedPerson: null,
    setSelectedPerson: () => { },
    fetchPeople: async () => { },
    trashQueue: [],
    restoreFromTrash: () => { },
    emptyTrash: async () => { },
    clearTrash: () => { },
    stats: { total: 0, thisWeek: 0 },
    sessionCleanedBytes: 0,
});

const getWeekKey = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const year = d.getUTCFullYear();
    const week = Math.ceil((((d.getTime() - new Date(Date.UTC(year, 0, 1)).getTime()) / 86400000) + 1) / 7);
    return `${year}-W${week}`;
};

export const useSwipe = () => useContext(SwipeContext);

export const SwipeProvider = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated } = useAuth();
    const [queue, setQueue] = useState<ImmichAsset[]>([]);
    const [history, setHistory] = useState<SwipeAction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [albumId, setAlbumId] = useState<string | null>(null);
    const [albums, setAlbums] = useState<ImmichAlbum[]>([]);
    // Master list of ALL assets in the current album
    const [masterAssets, setMasterAssets] = useState<ImmichAsset[]>([]);
    // Pagination State
    const [nextPage, setNextPage] = useState<number | null>(1);
    const loadingRef = useRef(false);

    // New: View mode and timeline
    const [viewMode, setViewMode] = useState<ViewMode>('albums');
    const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [people, setPeople] = useState<Person[]>([]);
    const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
    const [trashQueue, setTrashQueue] = useState<ImmichAsset[]>([]);
    const [stats, setStats] = useState({ total: 0, thisWeek: 0 });
    const [sessionCleanedBytes, setSessionCleanedBytes] = useState(0);

    // Load stats
    useEffect(() => {
        try {
            const raw = localStorage.getItem('immich_swipe_stats');
            if (raw) {
                const data = JSON.parse(raw);
                const currentWeek = getWeekKey(new Date());
                const weekBytes = data.weeks?.[currentWeek] || 0;
                setStats({ total: data.total || 0, thisWeek: weekBytes });
            }
        } catch (e) {
            console.error('Failed to load stats', e);
        }
    }, []);

    const fetchAlbums = useCallback(async () => {
        try {
            const { data } = await api.get('/albums');
            setAlbums(data);
        } catch (e) {
            console.error("Failed to fetch albums", e);
        }
    }, []);
    // Fetch timeline: get ALL photos and group by month (with pagination)
    const fetchTimeline = useCallback(async () => {
        if (monthGroups.length > 0) return; // Already fetched
        setIsLoading(true);
        try {
            let allAssets: ImmichAsset[] = [];
            let page = 1;
            const pageSize = 1000; // Fetch in large batches
            let hasMore = true;

            // Paginate through all assets
            while (hasMore) {
                const { data } = await api.post('/search/metadata', {
                    isTrashed: false,
                    isArchived: false,
                    type: 'IMAGE',
                    withExif: true,
                    isVisible: true,
                    order: 'desc',
                    page: page,
                    size: pageSize,
                });

                // Handle different response formats
                let assets: ImmichAsset[] = [];
                if (Array.isArray(data)) {
                    assets = data;
                } else if (data.assets?.items) {
                    assets = data.assets.items;
                } else if (data.items) {
                    assets = data.items;
                }

                allAssets = [...allAssets, ...assets];
                console.log(`Fetched page ${page}: ${assets.length} assets (total: ${allAssets.length})`);

                // Check if there are more pages
                if (assets.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }

                // Safety limit to prevent infinite loops
                if (page > 100) {
                    console.warn('Reached max page limit');
                    hasMore = false;
                }
            }

            console.log(`Total assets fetched for timeline: ${allAssets.length}`);

            // Group by month
            const groups: Record<string, { assets: ImmichAsset[]; coverAssetId: string | null }> = {};

            for (const asset of allAssets) {
                const date = new Date(asset.localDateTime || asset.fileCreatedAt);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                if (!groups[key]) {
                    groups[key] = { assets: [], coverAssetId: asset.id };
                }
                groups[key].assets.push(asset);
            }

            // Convert to MonthGroup array
            const monthGroupsArr: MonthGroup[] = Object.entries(groups)
                .map(([key, value]) => {
                    const [year, month] = key.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1);
                    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

                    return {
                        key,
                        label,
                        count: value.assets.length,
                        coverAssetId: value.coverAssetId,
                    };
                })
                .sort((a, b) => b.key.localeCompare(a.key)); // Newest first

            setMonthGroups(monthGroupsArr);
        } catch (e) {
            console.error("Failed to fetch timeline", e);
        } finally {
            setIsLoading(false);
        }
    }, [monthGroups.length]);

    // Fetch people
    const fetchPeople = useCallback(async () => {
        if (people.length > 0) return;
        setIsLoading(true);
        try {
            const response = await api.get('/people?isHidden=false');
            let data = response.data;

            // Handle various response shapes
            if (!Array.isArray(data)) {
                if (data.people && Array.isArray(data.people)) {
                    data = data.people;
                } else if (data.items && Array.isArray(data.items)) {
                    data = data.items;
                } else {
                    console.warn('People API returned unexpected format:', data);
                    data = [];
                }
            }

            setPeople(data);
        } catch (e) {
            console.error("Failed to fetch people", e);
        } finally {
            setIsLoading(false);
        }
    }, [people.length]);

    // Load albums on auth
    useEffect(() => {
        if (isAuthenticated) {
            fetchAlbums();
        }
    }, [isAuthenticated, fetchAlbums]);

    // Reset everything when album, month, or person changes
    useEffect(() => {
        setQueue([]);
        setHistory([]);
        setTrashQueue([]);
        setSessionCleanedBytes(0);
        setNextPage(1); // Reset pagination
        loadingRef.current = false;
    }, [albumId, selectedMonth, selectedPerson]);

    // Derived State
    // Use the Album's metadata count if available for accuracy (search might be capped at 250?)
    // Fallback to masterAssets length if album search fails or is weird.
    const currentAlbum = albums.find(a => a.id === albumId);

    // Total count logic:
    // If we have album metadata, use that (it's the Source of Truth from Immich).
    // Otherwise fall back to what we downloaded.
    // Total count logic:
    // 1. Album: metadata count is source of truth.
    // 2. Month: monthGroup count is robust.
    // 3. Person: masterAssets.length is the best we have until full fetch.
    let totalAssetsCount = masterAssets.length;
    if (currentAlbum) totalAssetsCount = currentAlbum.assetCount;
    else if (selectedMonth) {
        const group = monthGroups.find(g => g.key === selectedMonth);
        if (group) totalAssetsCount = group.count;
    }

    // Remaining = Total - Processed(History)
    // Ensure we don't go negative
    const remainingCount = Math.max(0, totalAssetsCount - history.length);

    // Load Initial Batch
    useEffect(() => {
        const loadInitial = async () => {
            // Must have either albumId or selectedMonth or selectedPerson
            if ((!albumId && !selectedMonth && !selectedPerson) || loadingRef.current || masterAssets.length > 0) return;

            await loadMoreAssets();
        };

        loadInitial();
    }, [albumId, selectedMonth, selectedPerson]); // Removed masterAssets.length dependency to avoid loops, explicit check inside

    // Core Fetch Logic
    const loadMoreAssets = async () => {
        if (loadingRef.current || nextPage === null) return;
        if (!albumId && !selectedMonth && !selectedPerson) return;

        loadingRef.current = true;
        setIsLoading(queue.length === 0); // Only show loading spinner on full screen if it's the first load

        try {
            console.log(`Fetching page ${nextPage}...`);
            let newAssets: ImmichAsset[] = [];

            // Common params
            const commonParams = {
                isTrashed: false,
                isArchived: false,
                type: 'IMAGE',
                withExif: true,
                isVisible: true,
                page: nextPage,
                size: 100, // Fetch 100 at a time (reasonable balance)
            };

            if (albumId) {
                const { data } = await api.post('/search/metadata', {
                    ...commonParams,
                    albumIds: [albumId],
                });
                newAssets = Array.isArray(data) ? data : (data.assets?.items || []);
            } else if (selectedMonth) {
                const [year, month] = selectedMonth.split('-').map(Number);
                const startDate = new Date(year, month - 1, 1);
                const endDate = new Date(year, month, 0, 23, 59, 59);

                const { data } = await api.post('/search/metadata', {
                    ...commonParams,
                    takenAfter: startDate.toISOString(),
                    takenBefore: endDate.toISOString(),
                });
                newAssets = Array.isArray(data) ? data : (data.assets?.items || []);
            } else if (selectedPerson) {
                const { data } = await api.post('/search/metadata', {
                    ...commonParams,
                    personIds: [selectedPerson],
                });
                newAssets = Array.isArray(data) ? data : (data.assets?.items || []);
            }

            if (newAssets.length > 0) {
                // Filter out duplicates just in case
                setMasterAssets(prev => {
                    const existingIds = new Set(prev.map(a => a.id));
                    const uniqueNew = newAssets.filter(a => !existingIds.has(a.id));
                    return [...prev, ...uniqueNew];
                });

                // If it's the first load, also populate the queue immediately
                if (queue.length === 0) {
                    setQueue(newAssets.slice(0, 20));
                }

                // Prepare next page
                // If we got fewer than requested, we are done.
                if (newAssets.length < 100) {
                    setNextPage(null);
                } else {
                    setNextPage(nextPage + 1);
                }
            } else {
                setNextPage(null);
            }

        } catch (error) {
            console.error("Failed to fetch assets", error);
        } finally {
            setIsLoading(false);
            loadingRef.current = false;
        }
    };


    // Queue Refill Management
    // As queue gets low, pull next batch from masterAssets
    // Queue Refill Management & Infinite Scroll
    useEffect(() => {
        // 1. Refill Queue from MasterAssets
        if (queue.length < 5 && masterAssets.length > 0) {
            const historyIds = new Set(history.map(h => h.asset.id));
            const nextBatch = masterAssets.filter(a => !historyIds.has(a.id)).slice(0, 20);

            if (nextBatch.length > 0 && (queue.length === 0 || nextBatch[0].id !== queue[0].id)) {
                setQueue(nextBatch);
            }
        }

        // 2. Trigger Network Fetch if nearing end of MasterAssets
        // Need to calculate how many unprocessed items we have left in masterAssets
        const historyIds = new Set(history.map(h => h.asset.id));
        const unprocessedCount = masterAssets.length - historyIds.size;

        // If we have fewer than 20 items left locally, and there's a next page, fetch more.
        if (unprocessedCount < 20 && nextPage !== null && !loadingRef.current) {
            loadMoreAssets();
        }
    }, [queue.length, masterAssets, history, nextPage]);


    const handleSwipe = async (direction: 'left' | 'right') => {
        const asset = queue[0];
        if (!asset) return;

        // Optimistic Update
        const nextQueue = queue.slice(1);
        setQueue(nextQueue);

        const actionType = direction === 'left' ? 'DELETE' : 'KEEP';
        const action: SwipeAction = {
            asset: asset,
            action: actionType,
            timestamp: Date.now(),
        };

        setHistory((prev) => [action, ...prev]);

        if (direction === 'left') {
            // Soft Delete: Add to trash queue
            setTrashQueue(prev => [asset, ...prev]);
        }

        // Refill logic handled by useEffect
    };

    const handleUndo = async () => {
        const lastAction = history[0];
        if (!lastAction) return;

        setHistory((prev) => prev.slice(1));

        if (lastAction.action === 'DELETE') {
            // Undo Delete: Remove from trash queue
            setTrashQueue(prev => prev.filter(a => a.id !== lastAction.asset.id));
        }

        // Put back in queue at the TOP
        setQueue(prev => [lastAction.asset, ...prev]);
    };

    const restoreFromTrash = (assetId: string) => {
        setTrashQueue(prev => prev.filter(a => a.id !== assetId));
        setHistory(prev => prev.filter(h => h.asset.id !== assetId));
    };

    const emptyTrash = async () => {
        if (trashQueue.length === 0) return;

        // Optimistic clear
        const assetsToDelete = [...trashQueue];
        setTrashQueue([]);

        // Async API calls
        for (const asset of assetsToDelete) {
            try {
                await api.delete('/assets', { data: { ids: [asset.id] } });
            } catch (e) {
                console.error(`Failed to delete asset ${asset.id}`, e);
            }
        }

        // Update Stats
        const bytesFreed = assetsToDelete.reduce((acc, curr) => acc + (curr.exifInfo?.fileSizeInByte || 0), 0);
        if (bytesFreed > 0) {
            const currentWeek = getWeekKey(new Date());
            const newTotal = stats.total + bytesFreed;
            const newWeek = stats.thisWeek + bytesFreed;

            setStats({ total: newTotal, thisWeek: newWeek });
            setSessionCleanedBytes(prev => prev + bytesFreed);

            // Persist
            try {
                const raw = localStorage.getItem('immich_swipe_stats');
                const data = raw ? JSON.parse(raw) : { total: 0, weeks: {} };
                data.total = newTotal;
                if (!data.weeks) data.weeks = {};
                data.weeks[currentWeek] = (data.weeks[currentWeek] || 0) + bytesFreed;
                localStorage.setItem('immich_swipe_stats', JSON.stringify(data));
            } catch (e) {
                console.error('Failed to save stats', e);
            }
        }
    };

    const clearTrash = () => {
        setTrashQueue([]);
    };

    return (
        <SwipeContext.Provider value={{
            queue,
            history,
            isLoading,
            loadMore: loadMoreAssets,

            handleSwipe,
            handleUndo,
            currentAsset: queue[0] || null,
            albumId,
            setAlbumId,
            albums,
            fetchAlbums,
            remainingCount,
            // New: view mode and timeline
            viewMode,
            setViewMode,
            monthGroups,
            selectedMonth,
            setSelectedMonth,
            fetchTimeline,
            // People
            people,
            selectedPerson,
            setSelectedPerson,
            fetchPeople,
            // Review Bin
            trashQueue,
            restoreFromTrash,
            emptyTrash,
            clearTrash,
            stats,
            sessionCleanedBytes,
        }}>
            {children}
        </SwipeContext.Provider>
    )
};
