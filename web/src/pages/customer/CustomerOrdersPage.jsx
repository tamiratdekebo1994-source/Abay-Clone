import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { customerAPI } from '../../services/api';
import { logout } from '../../store/authSlice';

const STATUS_LABELS = {
  SEARCHING_DRIVER: 'Finding a driver',
  DRIVER_ASSIGNED: 'Driver assigned',
  DRIVER_AT_STORE: 'Driver at store',
  PICKED_UP: 'Picked up',
  IN_TRANSIT: 'On the way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export default function CustomerOrdersPage() {
  const dispatch = useDispatch();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState(null); // order being reviewed
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const { data } = await customerAPI.getOrders();
      setOrders(data.data.orders);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const openReview = (order) => {
    setReviewing(order);
    setRating(0);
    setComment('');
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!rating) return;
    setSubmitting(true);
    try {
      await customerAPI.reviewOrder(reviewing.id, { rating, comment });
      setReviewing(null);
      await loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit your review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-accent text-primary px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight">ET SPARK</h1>
          <p className="text-xs font-bold">My deliveries</p>
        </div>
        <button onClick={() => dispatch(logout())} className="text-sm font-semibold underline">
          Sign out
        </button>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">⚠ {error}</div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-400 shadow-sm">
            <p>No deliveries yet.</p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-primary-700">#{order.orderNumber}</span>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-accent text-primary">
                  {STATUS_LABELS[order.status] || order.status}
                </span>
              </div>

              <div className="text-sm text-gray-700">
                <p><span className="text-gray-400">To:</span> {order.deliveryAddress}</p>
                <p><span className="text-gray-400">From:</span> {order.pickupAddress}</p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="font-bold">ETB {order.totalAmount?.toFixed(2)}</span>
                <span className="text-gray-400">
                  {order.createdAt ? new Date(order.createdAt._seconds ? order.createdAt._seconds * 1000 : order.createdAt).toLocaleDateString() : ''}
                </span>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <a href={`/track/${order.id}`} className="text-sm font-semibold text-primary-700 hover:underline">
                  Track delivery →
                </a>
                {order.status === 'DELIVERED' && !order.customerReview && (
                  <button onClick={() => openReview(order)} className="ml-auto bg-primary text-accent text-sm font-bold px-4 py-2 rounded-lg">
                    Rate delivery
                  </button>
                )}
                {order.customerReview && (
                  <span className="ml-auto text-sm text-gray-500">Rated {order.customerReview.rating} ★</span>
                )}
              </div>
            </div>
          ))
        )}
      </main>

      {reviewing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={submitReview} className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-black text-primary-900">Rate your delivery</h2>
            <p className="text-sm text-gray-500">Order #{reviewing.orderNumber}</p>

            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`text-3xl ${n <= rating ? 'text-accent' : 'text-gray-300'}`}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              maxLength={500}
              placeholder="Anything to add? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />

            <div className="flex gap-3">
              <button type="button" onClick={() => setReviewing(null)} className="flex-1 border border-gray-200 rounded-xl py-2 font-semibold text-gray-600">
                Cancel
              </button>
              <button type="submit" disabled={!rating || submitting} className="flex-1 bg-primary text-accent rounded-xl py-2 font-bold disabled:opacity-50">
                {submitting ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
