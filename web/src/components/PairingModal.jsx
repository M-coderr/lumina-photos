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
  ShieldCheck
} from 'lucide-react';
import { getPairingInfo } from '../api';

export default function PairingModal({ isOpen, onClose }) {
  const [pairingData, setPairingData] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const copyUrl = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const creds = pairingData?.credentials;

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

              {/* Instructions */}
              <div className="bg-neutral-800/60 rounded-2xl p-4 border border-neutral-800 space-y-2 text-xs text-neutral-300">
                <p className="font-semibold text-white">Quick 3-step mobile setup:</p>
                <ol className="list-decimal list-inside space-y-1 text-neutral-400">
                  <li>Open the mobile app or browser on your phone.</li>
                  <li>Scan this QR Code with your phone camera.</li>
                  <li>Select phone folders to watch — new photos auto-upload to your PC!</li>
                </ol>
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

                {/* Remote Tunnel (if configured) */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/40 border border-neutral-800">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <div>
                      <p className="font-medium text-white">Remote Access</p>
                      <p className="text-neutral-400 text-[11px]">
                        {creds?.remote_url || 'Active on Local Network'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
