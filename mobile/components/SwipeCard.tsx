import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
    interpolate,
    Extrapolation,
} from 'react-native-reanimated';
import { ImmichAsset } from '@/types/immich';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

interface SwipeCardProps {
    asset: ImmichAsset;
    onSwipe: (direction: 'left' | 'right') => void;
}

export function SwipeCard({ asset, onSwipe }: SwipeCardProps) {
    const { serverUrl, accessToken } = useAuth();
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);

    // Thumbnail URL for fast initial display
    const thumbnailUrl = React.useMemo(() => {
        if (!serverUrl) return null;
        return `${serverUrl}/api/assets/${asset.id}/thumbnail?format=JPEG`;
    }, [asset.id, serverUrl]);

    // Full resolution image URL
    // Optimization: WE USE THE PREVIEW THUMBNAIL AS THE "FULL" IMAGE 
    // This is because loading 5-10MB originals for every swipe is too slow.
    // The 'preview' format from Immich is high quality enough for mobile screens.
    const imageUrl = React.useMemo(() => {
        if (!serverUrl) return null;
        return `${serverUrl}/api/assets/${asset.id}/thumbnail?format=JPEG`;
    }, [asset.id, serverUrl]);

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            translateX.value = event.translationX;
            translateY.value = event.translationY * 0.3;
            scale.value = interpolate(
                Math.abs(event.translationX),
                [0, 200],
                [1, 1.05],
                Extrapolation.CLAMP
            );
        })
        .onEnd((event) => {
            if (event.translationX < -SWIPE_THRESHOLD) {
                translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 200 });
                runOnJS(onSwipe)('left');
            } else if (event.translationX > SWIPE_THRESHOLD) {
                translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 200 });
                runOnJS(onSwipe)('right');
            } else {
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                scale.value = withSpring(1);
            }
        });

    const cardStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${interpolate(translateX.value, [-200, 200], [-15, 15])}deg` },
            { scale: scale.value },
        ],
    }));

    const leftIndicatorStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            translateX.value,
            [-100, -20],
            [1, 0],
            Extrapolation.CLAMP
        ),
    }));

    const rightIndicatorStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            translateX.value,
            [20, 100],
            [0, 1],
            Extrapolation.CLAMP
        ),
    }));

    const backgroundStyle = useAnimatedStyle(() => {
        const red = interpolate(
            translateX.value,
            [-100, 0],
            [0.15, 0],
            Extrapolation.CLAMP
        );
        const green = interpolate(
            translateX.value,
            [0, 100],
            [0, 0.15],
            Extrapolation.CLAMP
        );
        return {
            backgroundColor: translateX.value < 0
                ? `rgba(239, 68, 68, ${red})`
                : `rgba(34, 197, 94, ${green})`,
        };
    });

    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.container, cardStyle, backgroundStyle]}>
                {imageUrl && (
                    <Image
                        source={{
                            uri: imageUrl,
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'x-api-key': accessToken
                            }
                        }}
                        placeholder={{
                            uri: thumbnailUrl!,
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'x-api-key': accessToken
                            }
                        }}
                        placeholderContentFit="contain"
                        style={styles.image}
                        contentFit="contain"
                        transition={200}
                        priority="high"
                    />
                )}

                {/* Delete Indicator */}
                <Animated.View style={[styles.indicator, styles.deleteIndicator, leftIndicatorStyle]}>
                    <Ionicons name="close" size={32} color="#fff" />
                </Animated.View>

                {/* Keep Indicator */}
                <Animated.View style={[styles.indicator, styles.keepIndicator, rightIndicatorStyle]}>
                    <Ionicons name="checkmark" size={32} color="#fff" />
                </Animated.View>
            </Animated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: {
        width: SCREEN_WIDTH - 32,
        maxHeight: SCREEN_HEIGHT * 0.65,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#000',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 20,
    },
    image: {
        width: '100%',
        height: '100%',
        minHeight: 300,
    },
    indicator: {
        position: 'absolute',
        top: 16,
        padding: 12,
        borderRadius: 999,
    },
    deleteIndicator: {
        right: 16,
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
    },
    keepIndicator: {
        left: 16,
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
    },
});
