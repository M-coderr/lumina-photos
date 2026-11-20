import React, { useState, useEffect } from 'react';
import { 
  X, 
  QrCode, 
  Wifi, 
  Globe, 
  Smartphone, 
  Check, 
  Copy, 
  ExternalLink,
  ShieldCheck,
  Radio,
  Zap
} from 'lucide-react';
import { getPairingInfo, toggleRemoteTunnel } from '../api';

export default function PairingModal({ isOpen, onClose }) {
  const [pairingData, setPairingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPairing();
    }
  }, [isOpen]);

  const loadPairing = async () => {
    try {
      setLoading(true);
      const data = await getPairingInfo();
      setPairingData(data);
    } catch (e) {
      console.error('Failed to load pairing info:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTunnel = async () => {
    try {
      setTunnelLoading(true);
      await toggleRemoteTunnel();
      await loadPairing();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to toggle remote tunnel');
    } finally {
      setTunnelLoading(false);
    }
  };

  const copyUrl = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const creds = pairingData?.credentials;
  const isTunnelActive = Boolean(creds?.remote_url);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Pair Mobile App</h3>
              <p className="text-xs text-neutral-400">Zero-config Plug & Play Connection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-neutral-400 mt-3">Generating pairing credentials...</p>
            </div>
          ) : (
            <>
              {/* QR Code Container */}
              <div className="flex flex-col items-center">
                <div className="p-4 bg-white rounded-2xl shadow-xl">
                  {pairingData?.qr_image && (
                    <img
                      src={pairingData.qr_image}
                      alt="Pairing QR Code"
                      className="w-52 h-52 object-contain"
                    />
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-xs text-emerald-400 font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Zero-Knowledge: 100% Private to your PC</span>
                </div>
              </div>

              {/* Remote Tunnel (Access from 4G/5G anywhere) */}
              <div className={`p-4 rounded-2xl border transition-all ${
                isTunnelActive
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-neutral-800/40 border-neutral-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Globe className={`w-5 h-5 ${isTunnelActive ? 'text-emerald-400' : 'text-blue-400'}`} />
                    <div>
                      <h4 className="text-sm font-semibold text-white">
                        Global Remote Access (4G/5G)
                      </h4>
                      <p className="text-[11px] text-neutral-400">
                        {isTunnelActive
                          ? 'Zero-config HTTPS tunnel active worldwide'
                          : 'Currently local Wi-Fi only. Enable to sync away from home.'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleToggleTunnel}
                    disabled={tunnelLoading}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                      isTunnelActive
                        ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30'
                    }`}
                  >
                    {tunnelLoading ? 'Connecting...' : isTunnelActive ? 'Turn OFF' : '⚡ Turn ON'}
                  </button>
                </div>

                {isTunnelActive && (
                  <div className="mt-3 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-xs">
                    <span className="text-emerald-300 font-mono text-[11px] truncate max-w-xs">
                      {creds?.remote_url}
                    </span>
                    <button
                      onClick={() => copyUrl(creds?.remote_url)}
                      className="text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Endpoints */}
              <div className="space-y-2 text-xs">
                {/* Local Wi-Fi */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/40 border border-neutral-800">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="font-medium text-white">Home Wi-Fi Address</p>
                      <p className="text-neutral-400 text-[11px]">{creds?.local_url}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => copyUrl(creds?.local_url)}
                    className="p-1.5 rounded-lg hover:bg-neutral-700 text-neutral-400 hover:text-white cursor-pointer"
                    title="Copy URL"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
