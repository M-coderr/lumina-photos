import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { MobileSyncEngine } from './src/services/syncWorker';
import { getMobileTimeline, getMobileStats, toggleMobileFavorite } from './src/services/api';

const { width } = Dimensions.get('window');
const COLUMN_SIZE = width / 3 - 3;

export default function App() {
  const [pairedServer, setPairedServer] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [isScanningQR, setIsScanningQR] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [activePhoto, setActivePhoto] = useState(null);
  const [activeTab, setActiveTab] = useState('photos'); // 'photos', 'folders', 'settings'
  const [watchedFolders, setWatchedFolders] = useState(['Camera', 'Screenshots', 'WhatsApp']);

  useEffect(() => {
    checkPairing();
  }, []);

  const checkPairing = async () => {
    const config = await MobileSyncEngine.getServerConfig();
    if (config.serverUrl) {
      setPairedServer(config.serverUrl);
      loadTimeline(config.serverUrl);
    } else {
      setIsPairModalOpen(true);
    }
  };

  const loadTimeline = async (url) => {
    try {
      setRefreshing(true);
      const data = await getMobileTimeline('?limit=200');
      setPhotos(data.items || []);
      const s = await getMobileStats();
      setStats(s);
    } catch (e) {
      console.log('Failed to fetch timeline:', e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncStatus({ text: 'Scanning phone folders for new photos...' });
    try {
      const res = await MobileSyncEngine.runAutoSync((prog) => {
        setSyncStatus({
          text: `Uploading ${prog.current}/${prog.total}: ${prog.filename}`,
        });
      });
      if (res.status === 'completed') {
        setSyncStatus({ text: `Backup complete: ${res.uploadedCount} photos uploaded!` });
        await loadTimeline();
      } else if (res.status === 'up_to_date') {
        setSyncStatus({ text: 'All photos are up to date on your PC!' });
      } else if (res.status === 'server_paused') {
        setSyncStatus({ text: 'Server paused by licensing switch.' });
      }
    } catch (e) {
      setSyncStatus({ text: `Sync error: ${e.message}` });
    } finally {
      setTimeout(() => setSyncStatus(null), 4000);
    }
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (!data) return;
    try {
      let url = null;
      let token = 'mobile-pair-token';

      // Check if data is JSON payload from PC QR code
      if (data.startsWith('{')) {
        const payload = JSON.parse(data);
        url = payload.primary_url || payload.remote_url || payload.local_url;
        token = payload.token || token;
      } else if (data.startsWith('http://') || data.startsWith('https://')) {
        url = data;
      }

      if (url) {
        setIsScanningQR(false);
        setIsPairModalOpen(false);
        await MobileSyncEngine.pairWithServer(url, token);
        setPairedServer(url);
        Alert.alert('Connected!', `Paired successfully with your PC server at:\n${url}`);
        await loadTimeline(url);
      }
    } catch (err) {
      console.log('QR parse error:', err);
    }
  };

  const handleStartQRScan = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status === 'granted') {
      setIsScanningQR(true);
    } else {
      Alert.alert('Camera Permission', 'Please grant camera access to scan the pairing QR code.');
    }
  };

  const handleManualPair = async () => {
    if (!serverUrlInput.trim()) return;
    try {
      const cleanUrl = serverUrlInput.trim().replace(/\/+$/, '');
      await MobileSyncEngine.pairWithServer(cleanUrl, 'mobile-client-token');
      setPairedServer(cleanUrl);
      setIsPairModalOpen(false);
      await loadTimeline(cleanUrl);
    } catch (e) {
      Alert.alert('Connection Failed', e.message);
    }
  };

  const handleToggleFavorite = async (photo) => {
    try {
      const newFav = !photo.is_favorite;
      await toggleMobileFavorite(photo.id, newFav);
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, is_favorite: newFav ? 1 : 0 } : p))
      );
      if (activePhoto?.id === photo.id) {
        setActivePhoto((prev) => ({ ...prev, is_favorite: newFav ? 1 : 0 }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandIcon}>✨</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Lumina Photos</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {pairedServer ? `PC: ${pairedServer.replace(/^https?:\/\//, '')}` : 'Not connected'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.syncButton}
            onPress={handleSyncNow}
            activeOpacity={0.8}
          >
            <Text style={styles.syncButtonText}>⚡ Auto-Backup</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pairIconBtn}
            onPress={() => setIsPairModalOpen(true)}
          >
            <Text style={{ fontSize: 18 }}>📱</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Live Sync Status Banner */}
      {syncStatus && (
        <View style={styles.syncBanner}>
          <ActivityIndicator size="small" color="#60a5fa" style={{ marginRight: 8 }} />
          <Text style={styles.syncBannerText}>{syncStatus.text}</Text>
        </View>
      )}

      {/* Content Routing */}
      {activeTab === 'photos' && (
        <FlatList
          data={photos}
          numColumns={3}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadTimeline(pairedServer)}
              tintColor="#60a5fa"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.photoItem}
              activeOpacity={0.8}
              onPress={() => setActivePhoto(item)}
            >
              <Image
                source={{
                  uri: `${pairedServer}/api/photos/${item.id}/thumbnail/micro`,
                }}
                style={styles.photoThumb}
              />
              {item.is_favorite === 1 && (
                <View style={styles.favStarBadge}>
                  <Text style={{ fontSize: 12 }}>⭐</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🖼️</Text>
              <Text style={styles.emptyTitle}>No photos backed up yet</Text>
              <Text style={styles.emptyDesc}>
                Tap '⚡ Auto-Backup' above to auto-upload camera roll photos to your PC!
              </Text>
            </View>
          }
        />
      )}

      {activeTab === 'folders' && (
        <ScrollView style={styles.folderContainer}>
          <Text style={styles.sectionTitle}>Auto-Detected Phone Folders</Text>
          <Text style={styles.sectionDesc}>
            Lumina monitors these folders and syncs new photos in the background to your PC.
          </Text>

          {['Camera (DCIM)', 'WhatsApp Images', 'Screenshots', 'Downloads', 'Instagram'].map(
            (folderName) => {
              const prefix = folderName.split(' ')[0];
              const isChecked = watchedFolders.includes(prefix);
              return (
                <View key={folderName} style={styles.folderCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.folderName}>{folderName}</Text>
                    <Text style={styles.folderStatus}>
                      {isChecked ? 'Auto-backup enabled' : 'Disabled'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.checkBtn, isChecked && styles.checkBtnActive]}
                    onPress={() => {
                      if (isChecked) {
                        setWatchedFolders(watchedFolders.filter((f) => f !== prefix));
                      } else {
                        setWatchedFolders([...watchedFolders, prefix]);
                      }
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                      {isChecked ? '✓' : '+'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }
          )}
        </ScrollView>
      )}

      {/* Bottom Tabs */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('photos')}
        >
          <Text style={{ fontSize: 20 }}>🖼️</Text>
          <Text style={[styles.navLabel, activeTab === 'photos' && styles.navLabelActive]}>
            Photos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('folders')}
        >
          <Text style={{ fontSize: 20 }}>📁</Text>
          <Text style={[styles.navLabel, activeTab === 'folders' && styles.navLabelActive]}>
            Folders
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setIsPairModalOpen(true)}
        >
          <Text style={{ fontSize: 20 }}>⚙️</Text>
          <Text style={styles.navLabel}>PC Server</Text>
        </TouchableOpacity>
      </View>

      {/* Fullscreen Photo Viewer */}
      {activePhoto && (
        <Modal
          visible={!!activePhoto}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setActivePhoto(null)}
        >
          <View style={styles.modalBg}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setActivePhoto(null)} style={styles.closeBtn}>
                <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalFilename} numberOfLines={1}>
                {activePhoto.filename}
              </Text>
              <TouchableOpacity
                onPress={() => handleToggleFavorite(activePhoto)}
                style={styles.closeBtn}
              >
                <Text style={{ fontSize: 18 }}>
                  {activePhoto.is_favorite ? '⭐' : '☆'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.previewContainer}>
              <Image
                source={{
                  uri: `${pairedServer}/api/photos/${activePhoto.id}/thumbnail/preview`,
                }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.metaFooter}>
              <Text style={styles.metaDate}>
                {activePhoto.taken_at ? new Date(activePhoto.taken_at).toLocaleString() : ''}
              </Text>
              <Text style={styles.metaSpecs}>
                {activePhoto.width} × {activePhoto.height} • {(activePhoto.file_size / (1024 * 1024)).toFixed(2)} MB
              </Text>
              {activePhoto.camera_model && (
                <Text style={styles.metaSpecs}>
                  📷 {activePhoto.camera_make} {activePhoto.camera_model}
                </Text>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Pairing Modal (QR Camera Scanner + Manual Fallback) */}
      <Modal
        visible={isPairModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setIsScanningQR(false);
          setIsPairModalOpen(false);
        }}
      >
        <View style={styles.pairModalWrapper}>
          <View style={styles.pairModalCard}>
            <Text style={styles.pairTitle}>Connect to Your PC</Text>
            <Text style={styles.pairDesc}>
              Pair your phone with your PC server to automatically back up your photos.
            </Text>

            {/* QR Camera Scanner View */}
            {isScanningQR ? (
              <View style={styles.scannerWrapper}>
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                  }}
                  onBarcodeScanned={handleBarcodeScanned}
                />
                <View style={styles.reticleOverlay}>
                  <View style={styles.reticleSquare} />
                  <Text style={styles.reticleText}>Point at the QR code on your PC screen</Text>
                </View>
                <TouchableOpacity
                  style={styles.cancelScanBtn}
                  onPress={() => setIsScanningQR(false)}
                >
                  <Text style={{ color: '#fff', fontSize: 12 }}>Close Camera</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* 1-Tap QR Scan Button */}
                <TouchableOpacity
                  style={styles.scanQrBigBtn}
                  onPress={handleStartQRScan}
                >
                  <Text style={{ fontSize: 24, marginRight: 10 }}>📷</Text>
                  <View>
                    <Text style={styles.scanQrBigBtnText}>Scan PC Screen QR Code</Text>
                    <Text style={styles.scanQrBigBtnSub}>Instant 1-second pairing</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR ENTER ADDRESS</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Manual URL Input */}
                <TextInput
                  style={styles.urlInput}
                  placeholder="e.g. http://192.168.1.21:8000"
                  placeholderTextColor="#666"
                  value={serverUrlInput}
                  onChangeText={setServerUrlInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <View style={styles.pairActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setIsPairModalOpen(false)}
                  >
                    <Text style={{ color: '#aaa' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.savePairBtn}
                    onPress={handleManualPair}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Connect</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: '#121212',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  brandIcon: {
    fontSize: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#71717a',
    fontSize: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  pairIconBtn: {
    padding: 6,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  syncBannerText: {
    color: '#93c5fd',
    fontSize: 12,
  },
  photoItem: {
    width: COLUMN_SIZE,
    height: COLUMN_SIZE,
    margin: 1.5,
    backgroundColor: '#1f1f1f',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  favStarBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 2,
  },
  emptyContainer: {
    paddingTop: 100,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyDesc: {
    color: '#71717a',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  bottomNav: {
    height: 56,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#121212',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navTab: {
    alignItems: 'center',
  },
  navLabel: {
    color: '#71717a',
    fontSize: 10,
    marginTop: 2,
  },
  navLabelActive: {
    color: '#60a5fa',
    fontWeight: 'bold',
  },
  modalBg: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  closeBtn: {
    padding: 8,
  },
  modalFilename: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 200,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  metaFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  metaDate: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  metaSpecs: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  folderContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionDesc: {
    color: '#71717a',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 16,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#262626',
  },
  folderName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  folderStatus: {
    color: '#10b981',
    fontSize: 11,
    marginTop: 2,
  },
  checkBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBtnActive: {
    backgroundColor: '#2563eb',
  },
  pairModalWrapper: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  pairModalCard: {
    backgroundColor: '#18181b',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a',
    overflow: 'hidden',
  },
  pairTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  pairDesc: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 20,
  },
  scanQrBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#2563eb',
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  scanQrBigBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scanQrBigBtnSub: {
    color: '#bfdbfe',
    fontSize: 11,
    marginTop: 1,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#27272a',
  },
  dividerText: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: 'bold',
    marginHorizontal: 10,
    letterSpacing: 0.5,
  },
  urlInput: {
    backgroundColor: '#27272a',
    color: '#fff',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  pairActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  savePairBtn: {
    backgroundColor: '#3f3f46',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  scannerWrapper: {
    height: 280,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleOverlay: {
    alignItems: 'center',
  },
  reticleSquare: {
    width: 180,
    height: 180,
    borderWidth: 2,
    borderColor: '#60a5fa',
    borderRadius: 16,
    backgroundColor: 'rgba(96, 165, 250, 0.05)',
  },
  reticleText: {
    color: '#fff',
    fontSize: 11,
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  cancelScanBtn: {
    position: 'absolute',
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
});
