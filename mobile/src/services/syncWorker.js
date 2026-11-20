import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  SERVER_URL: 'lumina_server_url',
  PAIR_TOKEN: 'lumina_pair_token',
  WATCHED_ALBUMS: 'lumina_watched_albums',
  SYNCED_ASSET_IDS: 'lumina_synced_asset_ids',
  LAST_SYNC_TIME: 'lumina_last_sync_time',
  AUTO_SYNC_ENABLED: 'lumina_auto_sync_enabled',
};

export class MobileSyncEngine {
  /**
   * Save paired server credentials scanned from PC QR code.
   */
  static async pairWithServer(serverUrl, token) {
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, serverUrl.replace(/\/+$/, ''));
    await AsyncStorage.setItem(STORAGE_KEYS.PAIR_TOKEN, token);
    await AsyncStorage.setItem(STORAGE_KEYS.AUTO_SYNC_ENABLED, 'true');
  }

  static async getServerConfig() {
    const serverUrl = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
    const token = await AsyncStorage.getItem(STORAGE_KEYS.PAIR_TOKEN);
    const autoSync = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_SYNC_ENABLED);
    return {
      serverUrl,
      token,
      autoSync: autoSync === 'true',
    };
  }

  /**
   * Fetch device albums for folder picker (Camera, WhatsApp, Screenshots, etc.)
   */
  static async getDeviceAlbums() {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Photo library permission denied');
    }
    const albums = await MediaLibrary.getAlbumsAsync();
    return albums;
  }

  static async setWatchedAlbums(albumTitles) {
    await AsyncStorage.setItem(STORAGE_KEYS.WATCHED_ALBUMS, JSON.stringify(albumTitles));
  }

  static async getWatchedAlbums() {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.WATCHED_ALBUMS);
    return raw ? JSON.parse(raw) : ['Camera', 'DCIM'];
  }

  /**
   * Auto-detect new photos/videos taken on phone and upload to PC server.
   */
  static async runAutoSync(onProgress) {
    const config = await this.getServerConfig();
    if (!config.serverUrl) {
      console.log('[Sync] Server not paired yet.');
      return { status: 'unpaired' };
    }

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      return { status: 'permission_denied' };
    }

    // Load tracked assets
    const syncedRaw = await AsyncStorage.getItem(STORAGE_KEYS.SYNCED_ASSET_IDS);
    const syncedIds = new Set(syncedRaw ? JSON.parse(syncedRaw) : []);
    const watchedAlbums = await this.getWatchedAlbums();

    // Query recent assets
    const media = await MediaLibrary.getAssetsAsync({
      first: 50,
      sortBy: [MediaLibrary.SortBy.creationTime],
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
    });

    const newAssets = media.assets.filter((asset) => !syncedIds.has(asset.id));
    if (newAssets.length === 0) {
      return { status: 'up_to_date', uploadedCount: 0 };
    }

    console.log(`[Sync] Found ${newAssets.length} new photos to upload to PC.`);
    let uploadedCount = 0;

    for (let i = 0; i < newAssets.length; i++) {
      const asset = newAssets[i];
      try {
        const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
        const fileUri = assetInfo.localUri || asset.uri;

        const uploadUrl = `${config.serverUrl}/api/upload`;
        const response = await FileSystem.uploadAsync(uploadUrl, fileUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'files',
          parameters: {
            filename: asset.filename || 'photo.jpg',
          },
          headers: {
            Authorization: `Bearer ${config.token}`,
          },
        });

        if (response.status === 200 || response.status === 201) {
          syncedIds.add(asset.id);
          uploadedCount++;
          if (onProgress) {
            onProgress({
              current: i + 1,
              total: newAssets.length,
              filename: asset.filename,
            });
          }
        } else if (response.status === 402) {
          console.warn('[Sync] Server switch paused/expired.');
          return { status: 'server_paused' };
        } else {
          console.warn(`[Sync] Upload returned HTTP ${response.status}:`, response.body);
        }
      } catch (err) {
        console.error(`[Sync] Failed to upload ${asset.filename}:`, err);
      }
    }

    // Save updated synced set
    await AsyncStorage.setItem(
      STORAGE_KEYS.SYNCED_ASSET_IDS,
      JSON.stringify(Array.from(syncedIds))
    );
    await AsyncStorage.setItem(
      STORAGE_KEYS.LAST_SYNC_TIME,
      new Date().toISOString()
    );

    return { status: 'completed', uploadedCount };
  }
}
