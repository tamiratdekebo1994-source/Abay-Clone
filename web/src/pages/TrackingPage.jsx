import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';
import axios from 'axios';
import { SOCKET_URL } from '../services/api';

// Fix leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const STATUS_STEPS = [
  { key: 'SEARCHING_DRIVER', label: 'Finding Driver', am: 'ሾፌር እየፈለጉ', icon: '🔍' },
  { key: 'DRIVER_ASSIGNED', label: 'Driver Assigned', am: 'ሾፌር ተመድቧል', icon: '👤' },
  { key: 'DRIVER_AT_STORE', label: 'At Pickup', am: 'መነሻ ደርሷል', icon: '🏪' },
  { key: 'PICKED_UP', label: 'Picked Up', am: 'ተወሷል', icon: '📦' },
  { key: 'IN_TRANSIT', label: 'On the Way', am: 'በመጓዝ ላይ', icon: '🚚' },
  { key: 'DELIVERED', label: 'Delivered', am: 'ደርሷል', icon: '✅' },
];

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, map.getZoom()); }, [center]);
  return null;
}

export default function TrackingPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    loadOrder();
    setupSocket();
    return () => { socketRef.current?.disconnect(); };
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const { data } = await axios.get(`/api/track/${orderId}`);
      setOrder(data.data);
      if (data.data.driver?.currentLat) {
        setDriverPos([data.data.driver.currentLat, data.data.driver.currentLng]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Order not found');
    } finally {
      setIsLoading(false);
    }
  };

  const setupSocket = () => {
    // Public socket — no auth token
    const socket = io(SOCKET_URL);
    socket.emit('join_order', orderId);
    socket.on('driver_location', ({ lat, lng }) => setDriverPos([lat, lng]));
    socket.on('order_status_updated', () => loadOrder());
    socketRef.current = socket;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">📦</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-500">{error || 'This tracking link may have expired.'}</p>
        </div>
      </div>
    );
  }

  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === order.status);
  const currentStep = STATUS_STEPS[currentStepIdx] || STATUS_STEPS[STATUS_STEPS.length - 1];
  const mapCenter = driverPos || [order.pickupLat, order.pickupLng];
  const isDelivered = order.status === 'DELIVERED' || order.status === 'CANCELLED';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center text-white font-black text-lg">⚡</div>
            <span className="font-black text-gray-900 text-lg">ET SPAR</span>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Order</div>
            <div className="font-bold text-gray-900">#{order.orderNumber}</div>
          </div>
        </div>
      </header>

      {/* Status Banner */}
      <div className={`py-4 text-center text-white font-semibold text-lg ${
        isDelivered ? 'bg-green-600' : 'bg-primary-600'
      }`}>
        {currentStep?.icon} {currentStep?.label}
        <div className="text-sm font-normal opacity-90">{currentStep?.am}</div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Map */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ height: 360 }}>
          <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
            <MapUpdater center={driverPos} />
            <Marker position={[order.pickupLat, order.pickupLng]} icon={greenIcon}>
              <Popup>📦 Pickup: {order.pickupAddress}</Popup>
            </Marker>
            <Marker position={[order.deliveryLat, order.deliveryLng]}>
              <Popup>🏠 Delivery: {order.deliveryAddress}</Popup>
            </Marker>
            {driverPos && (
              <Marker position={driverPos} icon={blueIcon}>
                <Popup>🚗 Driver: {order.driver?.user?.fullName}</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Progress Steps */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-bold text-gray-900 mb-4">Delivery Progress</h3>
            <div className="space-y-3">
              {STATUS_STEPS.map((step, idx) => {
                const isDone = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${
                      isDone ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'
                    } ${isCurrent ? 'ring-2 ring-primary-600 ring-offset-2' : ''}`}>
                      {step.icon}
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${isDone ? 'text-primary-700' : 'text-gray-400'}`}>
                        {step.label}
                      </div>
                      <div className="text-xs text-gray-400">{step.am}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info Panel */}
          <div className="space-y-4">
            {/* Driver info */}
            {order.driver && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="font-bold text-gray-900 mb-3">Your Driver</h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-xl font-bold text-primary-700">
                    {order.driver.user?.fullName?.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold">{order.driver.user?.fullName}</div>
                    <div className="text-sm text-gray-500">
                      ⭐ {order.driver.rating?.toFixed(1)} &nbsp;·&nbsp; {order.driver.totalDeliveries} trips
                    </div>
                  </div>
                </div>
                <div className="text-sm space-y-1 text-gray-600">
                  <div>🚗 {order.driver.vehicleColor} {order.driver.vehicleModel}</div>
                  <div>🔤 {order.driver.vehiclePlate}</div>
                </div>
              </div>
            )}

            {/* Order details */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-3">Order Details</h3>
              <div className="text-sm space-y-2 text-gray-600">
                <div className="flex gap-2">
                  <span className="text-green-600 flex-shrink-0">📦</span>
                  <span>{order.pickupAddress}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary-600 flex-shrink-0">📍</span>
                  <span>{order.deliveryAddress}</span>
                </div>
                <div className="flex gap-2">
                  <span className="flex-shrink-0">🏪</span>
                  <span>{order.store?.storeName}</span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between font-semibold text-gray-900">
                  <span>Total</span>
                  <span className="text-primary-700">ETB {order.totalAmount?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Proof of delivery photo */}
            {order.cargoPhotoUrl && order.status === 'DELIVERED' && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="font-bold text-gray-900 mb-3">Proof of Delivery</h3>
                <img
                  src={order.cargoPhotoUrl}
                  alt="Delivery proof"
                  className="w-full rounded-lg object-cover"
                  style={{ maxHeight: 200 }}
                />
                {order.deliveredAt && (
                  <p className="text-xs text-gray-500 mt-2">
                    Delivered {new Date(order.deliveredAt).toLocaleString('en-ET')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
