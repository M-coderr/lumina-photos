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
} from 'react-native';
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

  const handleManualPair = async () => {
    if (!serverUrlInput.trim()) return;
    try {
      await MobileSyncEngine.pairWithServer(serverUrlInput.trim(), 'mobile-client-token');
      setPairedServer(serverUrlInput.trim());
      setIsPairModalOpen(false);
      await loadTimeline();
    } catch (e) {
      alert(e.message);
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
            <Text style={styles.headerSubtitle}>
              {pairedServer ? 'Connected to PC Server' : 'Not paired'}
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
            Lumina automatically monitors these folders and syncs new photos in the background to your home PC.
          </Text>

          {['Camera (DCIM)', 'WhatsApp Images', 'Screenshots', 'Downloads', 'Instagram'].map(
            (folderName) => {
              const isChecked = watchedFolders.includes(folderName.split(' ')[0]);
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
                      const prefix = folderName.split(' ')[0];
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

      {/* Lightbox / Fullscreen Viewer Modal */}
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

      {/* Pairing Modal */}
      <Modal
        visible={isPairModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsPairModalOpen(false)}
      >
        <View style={styles.pairModalWrapper}>
          <View style={styles.pairModalCard}>
            <Text style={styles.pairTitle}>Pair with PC Server</Text>
            <Text style={styles.pairDesc}>
              Scan the QR Code on your PC or enter your PC server IP:
            </Text>

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
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Connect & Pair</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  pairModalCard: {
    backgroundColor: '#18181b',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  pairTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  pairDesc: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 6,
    marginBottom: 16,
  },
  urlInput: {
    backgroundColor: '#27272a',
    color: '#fff',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    marginBottom: 20,
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
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
});
