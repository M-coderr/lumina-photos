import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export const getPhotos = async (params = {}) => {
  const res = await api.get('/photos', { params });
  return res.data;
};

export const getTimelineDates = async () => {
  const res = await api.get('/photos/timeline/dates');
  return res.data;
};

export const getPhoto = async (id) => {
  const res = await api.get(`/photos/${id}`);
  return res.data;
};

export const toggleFavorite = async (id, isFavorite) => {
  const res = await api.post(`/photos/${id}/favorite`, { is_favorite: isFavorite });
  return res.data;
};

export const toggleTrash = async (id, isTrashed) => {
  const res = await api.post(`/photos/${id}/trash`, { is_trashed: isTrashed });
  return res.data;
};

export const deletePhotoPermanently = async (id) => {
  const res = await api.delete(`/photos/${id}`);
  return res.data;
};

export const uploadPhotos = async (files, onProgress) => {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }
  const res = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });
  return res.data;
};

export const getStats = async () => {
  const res = await api.get('/system/stats');
  return res.data;
};

export const getPairingInfo = async () => {
  const res = await api.get('/system/pair');
  return res.data;
};

export const getLicense = async () => {
  const res = await api.get('/system/license');
  return res.data;
};

export const updateAdminSwitch = async (status, planType) => {
  const res = await api.post('/system/admin/switch', { status, plan_type: planType });
  return res.data;
};

export const getTunnelStatus = async () => {
  const res = await api.get('/system/tunnel');
  return res.data;
};

export const setTunnelUrl = async (publicUrl, provider = 'cloudflare') => {
  const res = await api.post('/system/tunnel', { public_url: publicUrl, provider });
  return res.data;
};

export const getWatchedFolders = async () => {
  const res = await api.get('/folders');
  return res.data;
};

export const addWatchedFolder = async (folderPath, name, autoBackup = true) => {
  const res = await api.post('/folders', {
    folder_path: folderPath,
    name,
    auto_backup: autoBackup,
  });
  return res.data;
};

export const scanWatchedFolder = async (id) => {
  const res = await api.post(`/folders/${id}/scan`);
  return res.data;
};

export const removeWatchedFolder = async (id) => {
  const res = await api.delete(`/folders/${id}`);
  return res.data;
};

export const getAlbums = async () => {
  const res = await api.get('/albums');
  return res.data;
};

export const createAlbum = async (title, description = '') => {
  const res = await api.post('/albums', { title, description });
  return res.data;
};

export const getAlbum = async (id) => {
  const res = await api.get(`/albums/${id}`);
  return res.data;
};

export const addPhotosToAlbum = async (albumId, photoIds) => {
  const res = await api.post(`/albums/${albumId}/photos`, { photo_ids: photoIds });
  return res.data;
};

export const deleteAlbum = async (id) => {
  const res = await api.delete(`/albums/${id}`);
  return res.data;
};

export default api;
