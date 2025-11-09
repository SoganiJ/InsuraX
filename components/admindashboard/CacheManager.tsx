'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Trash2, Clock, Database } from 'lucide-react';
import { clearNetworkAnalysisCache, getCacheInfo, forceRefreshCache } from '@/lib/cacheUtils';

const CacheManager: React.FC = () => {
  const [cacheInfo, setCacheInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadCacheInfo = async () => {
    setIsLoading(true);
    try {
      const info = await getCacheInfo();
      setCacheInfo(info);
    } catch (error) {
      console.error('Error loading cache info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = async () => {
    setIsLoading(true);
    try {
      const success = await clearNetworkAnalysisCache();
      if (success) {
        await loadCacheInfo();
        alert('Cache cleared successfully!');
      } else {
        alert('Failed to clear cache');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Error clearing cache');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceRefresh = async () => {
    setIsLoading(true);
    try {
      const success = await forceRefreshCache();
      if (success) {
        await loadCacheInfo();
        alert('Cache refreshed! Next network analysis will fetch fresh data.');
      } else {
        alert('Failed to refresh cache');
      }
    } catch (error) {
      console.error('Error refreshing cache:', error);
      alert('Error refreshing cache');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCacheInfo();
  }, []);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatAge = (age: number) => {
    const minutes = Math.floor(age / 60000);
    const seconds = Math.floor((age % 60000) / 1000);
    return `${minutes}m ${seconds}s ago`;
  };

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Database className="w-5 h-5" />
          Network Analysis Cache Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            <span className="text-slate-400">Loading...</span>
          </div>
        ) : (
          <>
            {cacheInfo?.exists ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-green-400" />
                  <span className="text-slate-300">
                    Last updated: {formatTime(cacheInfo.timestamp)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-300">
                    Age: {formatAge(cacheInfo.age)}
                  </span>
                  {cacheInfo.isExpired ? (
                    <span className="text-red-400 text-xs">(Expired)</span>
                  ) : (
                    <span className="text-green-400 text-xs">(Fresh)</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-300">
                    Source: {cacheInfo.source}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-sm">
                No cache data found
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                onClick={loadCacheInfo}
                variant="outline"
                size="sm"
                className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Info
              </Button>
              
              <Button
                onClick={handleClearCache}
                variant="outline"
                size="sm"
                className="bg-red-900/20 border-red-500/30 text-red-400 hover:bg-red-900/30"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Cache
              </Button>
              
              <Button
                onClick={handleForceRefresh}
                variant="outline"
                size="sm"
                className="bg-blue-900/20 border-blue-500/30 text-blue-400 hover:bg-blue-900/30"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Force Refresh
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CacheManager;
