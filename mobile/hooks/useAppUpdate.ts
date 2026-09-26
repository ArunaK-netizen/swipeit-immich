import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

export function useAppUpdate() {
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [manifest, setManifest] = useState<any | null>(null);

    useEffect(() => {
        if (__DEV__) return;

        async function checkUpdate() {
            try {
                const update = await Updates.checkForUpdateAsync();
                console.log('[OTA] Check result:', JSON.stringify(update));
                if (update.isAvailable) {
                    setIsUpdateAvailable(true);
                    setManifest(update);
                }
            } catch (error: any) {
                console.log('[OTA] Error checking update:', error?.message);
            }
        }

        checkUpdate();
    }, []);

    const performUpdate = async () => {
        try {
            setIsDownloading(true);
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
        } catch (error: any) {
            setIsDownloading(false);
            Alert.alert('Error', 'Failed to download update.');
            console.log('[OTA] Error downloading update:', error);
        }
    };

    const cancelUpdate = () => {
        setIsUpdateAvailable(false);
    };

    return {
        isUpdateAvailable,
        isDownloading,
        manifest,
        performUpdate,
        cancelUpdate,
    };
}
