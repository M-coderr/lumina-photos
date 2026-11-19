import AsyncStorage from '@react-native-async-storage/async-storage';

export async function fetchServer(endpoint, options = {}) {
  const serverUrl = await AsyncStorage.getItem('lumina_server_url');
  const token = await AsyncStorage.getItem('lumina_pair_token');

  if (!serverUrl) {
    throw new Error('Server not paired');
  }

  const url = `${serverUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Server returned ${response.status}: ${errorText}`);
  }

  return response.json();
}

export const getMobileTimeline = (params = '') => fetchServer(`/api/photos${params}`);
export const getMobileStats = () => fetchServer('/api/system/stats');
export const toggleMobileFavorite = (id, isFavorite) => 
  fetchServer(`/api/photos/${id}/favorite`, {
    method: 'POST',
    body: JSON.stringify({ is_favorite: isFavorite }),
  });
