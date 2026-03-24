import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';
import { orderAPI } from '../../services/api';

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

const STATUS_STEPS = [
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

export default function OrderTracking() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const socketRef = useRef(null);

  useEffect(() => {
    loadOrder();
    setupSocket();
    return () => { socketRef.current?.disconnect(); };
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const { data } = await orderAPI.getOrder(orderId);
      setOrder(data.data);
      if (data.data.driver?.currentLat) {
        setDriverPos([data.data.driver.currentLat, data.data.driver.currentLng]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const setupSocket = () => {
    const token = localStorage.getItem('accessToken');
    const socket = io('/', { auth: { token } });

    socket.emit('join_order', orderId);
    socket.on('driver_location', ({ lat, lng }) => setDriverPos([lat, lng]));
    socket.on('order_status_updated', () => loadOrder());
    socket.on('order_cancelled', () => loadOrder());

    socketRef.current = socket;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!order) return null;

  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === order.status);
  const mapCenter = driverPos || [order.pickupLat, order.pickupLng];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/store/orders" className="text-gray-400 hover:text-gray-600">← Back</Link>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Tracking Order #{order.orderNumber}</h1>
          <p className="text-gray-500 text-sm">ትዕዛዝ መከታተያ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 card p-0 overflow-hidden h-96">
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            <MapUpdater center={driverPos} />
            <Marker position={[order.pickupLat, order.pickupLng]} icon={greenIcon}>
              <Popup>📦 Pickup: {order.pickupAddress}</Popup>
            </Marker>
            <Marker position={[order.deliveryLat, order.deliveryLng]}>
              <Popup>🏠 Delivery: {order.deliveryAddress}</Popup>
            </Marker>
            {driverPos && (
              <Marker position={driverPos}>
                <Popup>🚗 Driver: {order.driver?.user?.fullName}</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Details */}
        <div className="space-y-4">
          {/* Progress */}
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4">Delivery Progress</h3>
            <div className="space-y-3">
              {STATUS_STEPS.map((step, idx) => {
                const isDone = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
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

          {/* Driver Info */}
          {order.driver && (
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-3">Driver Info</h3>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-xl font-bold text-primary-700">
                  {order.driver.user?.fullName?.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold">{order.driver.user?.fullName}</div>
                  <div className="text-sm text-gray-500">⭐ {order.driver.rating?.toFixed(1)} • {order.driver.totalDeliveries} trips</div>
                </div>
              </div>
              <div className="text-sm space-y-1 text-gray-600">
                <div>🚗 {order.driver.vehicleColor} {order.driver.vehicleModel}</div>
                <div>🔤 {order.driver.vehiclePlate}</div>
                <div>📞 {order.driver.user?.phone}</div>
              </div>
              <a href={`tel:${order.driver.user?.phone}`} className="btn-primary w-full mt-3 text-sm text-center block">
                📞 Call Driver
              </a>
            </div>
          )}

          {/* Order Summary */}
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Distance</span><span className="font-medium">{order.distanceKm?.toFixed(1)} km</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Base Fee</span><span>ETB {order.baseFee?.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Platform Fee</span><span>ETB {order.platformFee?.toFixed(2)}</span></div>
              <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span className="text-primary-700">ETB {order.totalAmount?.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
