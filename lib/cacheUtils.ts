import { doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';

/**
 * Clear the network analysis cache from Firestore
 */
export const clearNetworkAnalysisCache = async () => {
  try {
    await deleteDoc(doc(db, 'networkAnalysisCache', 'latest'));
    console.log('🗑️ Network analysis cache cleared');
    return true;
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    return false;
  }
};

/**
 * Get cache information
 */
export const getCacheInfo = async () => {
  try {
    const cacheDoc = await getDoc(doc(db, 'networkAnalysisCache', 'latest'));
    if (cacheDoc.exists()) {
      const data = cacheDoc.data();
      const cacheAge = Date.now() - data.timestamp;
      const maxCacheAge = 5 * 60 * 1000; // 5 minutes
      
      return {
        exists: true,
        timestamp: data.timestamp,
        age: cacheAge,
        isExpired: cacheAge > maxCacheAge,
        source: data.source || 'unknown'
      };
    }
    return { exists: false };
  } catch (error) {
    console.error('❌ Error getting cache info:', error);
    return { exists: false, error: error.message };
  }
};

/**
 * Force refresh the cache by clearing it
 */
export const forceRefreshCache = async () => {
  const cleared = await clearNetworkAnalysisCache();
  if (cleared) {
    console.log('🔄 Cache cleared. Next network analysis will fetch fresh data.');
  }
  return cleared;
};
