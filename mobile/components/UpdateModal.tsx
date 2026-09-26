import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface UpdateModalProps {
    visible: boolean;
    onUpdate: () => void;
    onCancel: () => void;
    isDownloading: boolean;
    manifest: any;
}

export function UpdateModal({ visible, onUpdate, onCancel, isDownloading, manifest }: UpdateModalProps) {
    const m = manifest?.manifest || {};
    const expoClient = m.extra?.expoClient || {};

    const updateMessage =
        m.message ||
        expoClient.extra?.updateMessage ||
        expoClient.extra?.message ||
        m.extra?.message ||
        m.extra?.changelog ||
        m.metadata?.message ||
        "A new version of Immich Swipe is available with improvements and bug fixes.";

    const version = expoClient.version || m.version || "Latest";

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onCancel}
        >
            <View style={styles.centeredView}>
                <BlurView
                    intensity={Platform.OS === 'ios' ? 40 : 100}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                />

                <View style={styles.modalView}>
                    {/* Header / Icon */}
                    <LinearGradient
                        colors={['#3B82F6', '#6366F1']}
                        style={styles.iconContainer}
                    >
                        <Ionicons name="rocket-sharp" size={32} color="#FFFFFF" />
                    </LinearGradient>

                    <Text style={styles.title}>
                        Update Available!
                    </Text>

                    <View style={styles.versionBadge}>
                        <Text style={styles.versionText}>v{version}</Text>
                    </View>

                    <View style={styles.changelogContainer}>
                        <Text style={styles.changelogLabel}>
                            What's New:
                        </Text>
                        <Text style={styles.changelogText}>
                            {updateMessage}
                        </Text>
                    </View>

                    {/* Action Buttons */}
                    <TouchableOpacity
                        style={styles.updateButton}
                        onPress={onUpdate}
                        disabled={isDownloading}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['#3B82F6', '#2563EB']}
                            style={styles.updateButtonGradient}
                        >
                            <Text style={styles.updateButtonText}>
                                {isDownloading ? 'Downloading...' : 'Update Now'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {!isDownloading && (
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={onCancel}
                        >
                            <Text style={styles.cancelButtonText}>
                                Not Now
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
    },
    modalView: {
        width: '85%',
        backgroundColor: '#1E1E24',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
        color: '#FFFFFF',
    },
    versionBadge: {
        backgroundColor: '#2A2A32',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 20,
    },
    versionText: {
        fontSize: 13,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    changelogContainer: {
        width: '100%',
        marginBottom: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    changelogLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#9CA3AF',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    changelogText: {
        fontSize: 14,
        color: '#E5E7EB',
        lineHeight: 20,
    },
    updateButton: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        marginBottom: 8,
    },
    updateButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    updateButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    cancelButtonText: {
        color: '#9CA3AF',
        fontSize: 15,
        fontWeight: '500',
    },
});
