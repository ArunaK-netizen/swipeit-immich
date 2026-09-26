import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useAuth } from '@/context/AuthContext';
import { SwipeProvider, useSwipe } from '@/context/SwipeContext';
import { AlbumGrid } from '@/components/AlbumGrid';
import { SwipeCard } from '@/components/SwipeCard';
import { SwipeButtons } from '@/components/SwipeButtons';
import { ReviewBinModal } from '@/components/ReviewBinModal';
import { Sidebar } from '@/components/Sidebar';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { formatBytes } from '@/lib/utils';

function SwipeInterface() {
    const { queue, handleSwipe, handleUndo, history, isLoading, albumId, setAlbumId, remainingCount, selectedMonth, setSelectedMonth, selectedPerson, setSelectedPerson, trashQueue, clearTrash, sessionCleanedBytes } = useSwipe();
    const { logout, serverUrl, accessToken } = useAuth();
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    // Prefetch upcoming images
    useEffect(() => {
        if (!serverUrl || !accessToken || queue.length <= 1) return;

        // Prefetch next 3 images in queue
        const prefetchImages = async () => {
            const nextAssets = queue.slice(1, 4);
            for (const asset of nextAssets) {
                const isHeic = asset.originalFileName.toLowerCase().endsWith('.heic') ||
                    asset.originalFileName.toLowerCase().endsWith('.heif');
                // Optimization: Always prefetch the JPEG preview, never the full original
                const url = `${serverUrl}/api/assets/${asset.id}/thumbnail?format=JPEG`;

                try {
                    await ExpoImage.prefetch(url, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'x-api-key': accessToken
                        }
                    });
                } catch (e) {
                    // Ignore prefetch errors
                }
            }
        };

        prefetchImages();
    }, [queue, serverUrl, accessToken]);

    // Stats
    const keptCount = history.filter(h => h.action === 'KEEP').length;
    const deletedCount = history.filter(h => h.action === 'DELETE').length;

    // If no album or month or person selected, show grid
    if (!albumId && !selectedMonth && !selectedPerson) {
        return (
            <View style={styles.container}>
                <StatusBar style="light" />
                {/* Header */}
                {/* Header / Menu moved to AlbumGrid */}
                <AlbumGrid onMenuPress={() => setSidebarOpen(true)} />
                <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
            </View>
        );
    }

    // Loading state
    if (queue.length === 0 && isLoading) {
        return (
            <View style={styles.centerContainer}>
                <StatusBar style="light" />
                <ActivityIndicator size="large" color="#f59e0b" />
                <Text style={styles.loadingText}>Loading photos...</Text>
            </View>
        );
    }

    // Empty state
    if (queue.length === 0 && !isLoading) {
        if (trashQueue.length > 0) {
            return (
                <View style={styles.container}>
                    <ReviewBinModal isOpen={true} onClose={clearTrash} />
                </View>
            );
        }

        return (
            <View style={styles.centerContainer}>
                <StatusBar style="light" />
                <View style={styles.doneIcon}>
                    <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
                </View>
                <Text style={styles.doneTitle}>All caught up!</Text>
                <Text style={styles.doneSubtitle}>No more photos to review.</Text>

                {sessionCleanedBytes > 0 && (
                    <View style={{ marginTop: 20, marginBottom: 20, alignItems: 'center' }}>
                        <Text style={{ color: '#34d399', fontSize: 14 }}>You cleaned {formatBytes(sessionCleanedBytes)}</Text>
                    </View>
                )}

                <TouchableOpacity style={styles.backButton} onPress={() => { setAlbumId(null); setSelectedMonth(null); setSelectedPerson(null); }}>
                    <Ionicons name="arrow-back" size={20} color="#fff" />
                    <Text style={styles.backButtonText}>Back to Library</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Current asset for background
    const currentAsset = queue[0];

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Ambient Background */}
            {currentAsset && (
                <Animated.View
                    entering={FadeIn.duration(500)}
                    exiting={FadeOut.duration(300)}
                    style={styles.ambientBackground}
                >
                    <Image
                        source={{ uri: `${serverUrl}/api/assets/${currentAsset.id}/thumbnail?format=JPEG` }}
                        style={styles.ambientImage}
                        blurRadius={50}
                    />
                    <View style={styles.ambientOverlay} />
                </Animated.View>
            )}

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backChip} onPress={() => { setAlbumId(null); setSelectedMonth(null); setSelectedPerson(null); }}>
                    <Ionicons name="arrow-back" size={18} color="#fff" />
                    <Text style={styles.backChipText}>Library</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                        style={[styles.backChip, { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }]}
                        onPress={() => setIsReviewOpen(true)}
                    >
                        <Ionicons name="trash-outline" size={18} color="#fca5a5" />
                        {trashQueue.length > 0 && (
                            <View style={{ backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4 }}>
                                <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{trashQueue.length}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Main Card Area */}
            <View style={styles.cardContainer}>
                {queue.length > 0 && (
                    <Animated.View
                        key={queue[0].id}
                        entering={FadeIn.duration(200)}
                    >
                        <SwipeCard
                            asset={queue[0]}
                            onSwipe={handleSwipe}
                        />
                    </Animated.View>
                )}
            </View>

            {/* Footer Controls */}
            <View style={styles.footer}>
                <SwipeButtons
                    onSwipeLeft={() => handleSwipe('left')}
                    onSwipeRight={() => handleSwipe('right')}
                    onUndo={handleUndo}
                    canUndo={history.length > 0}
                    remainingCount={remainingCount}
                    keptCount={keptCount}
                    deletedCount={deletedCount}
                />
            </View>

            <ReviewBinModal isOpen={isReviewOpen} onClose={() => setIsReviewOpen(false)} />
            <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
        </View>
    );
}

// Wrapper with Provider
export default function HomeScreen() {
    const { isAuthenticated, isLoading } = useAuth();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace('/login');
        }
    }, [isLoading, isAuthenticated]);

    if (isLoading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#f59e0b" />
            </View>
        );
    }

    if (!isAuthenticated) return null;

    return (
        <SwipeProvider>
            <SwipeInterface />
        </SwipeProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#71717a',
        marginTop: 16,
        fontSize: 16,
    },
    headerRight: {
        position: 'absolute',
        top: 50,
        right: 16,
        zIndex: 100,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
    },
    logoutText: {
        color: '#71717a',
        fontSize: 14,
    },
    // Swipe View
    ambientBackground: {
        ...StyleSheet.absoluteFillObject,
        zIndex: -1,
    },
    ambientImage: {
        width: '100%',
        height: '100%',
        transform: [{ scale: 1.2 }],
    },
    ambientOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    backChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    backChipText: {
        color: '#fff',
        fontSize: 14,
    },
    cardContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    footer: {
        paddingBottom: 20,
    },
    // Done state
    doneIcon: {
        marginBottom: 24,
    },
    doneTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    doneSubtitle: {
        fontSize: 16,
        color: '#71717a',
        marginBottom: 32,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 999,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
});
