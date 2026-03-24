import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { orderAPI } from '../../services/api';
import api from '../../services/api';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20; // 60 seconds total

export default function PaymentResult() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const payRef = searchParams.get('ref') || searchParams.get('payRef');

  const [status, setStatus] = useState('checking'); // checking | paid | failed | pending
  const [order, setOrder] = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!payRef && !orderId) {
      setStatus('failed');
      return;
    }
    checkStatus();
    return () => clearTimeout(timerRef.current);
  }, []);

  const checkStatus = async () => {
    try {
      // First try payment ref status
      let paymentStatus = null;
      if (payRef) {
        const { data } = await api.get(`/payments/status/${payRef}`);
        if (data.success) {
          paymentStatus = data.data.paymentStatus;
          setOrder(data.data);
        }
      }

      // Fallback: check order directly
      if (!paymentStatus && orderId) {
        const { data } = await orderAPI.getOrder(orderId);
        if (data.success) {
          paymentStatus = data.data.paymentStatus;
          setOrder(data.data);
        }
      }

      if (paymentStatus === 'PAID') {
        setStatus('paid');
        return;
      }
      if (paymentStatus === 'FAILED') {
        setStatus('failed');
        return;
      }

      // Still pending — keep polling
      setPollCount((prev) => {
        const next = prev + 1;
        if (next >= MAX_POLLS) {
          setStatus('pending');
          return next;
        }
        timerRef.current = setTimeout(checkStatus, POLL_INTERVAL_MS);
        return next;
      });
    } catch {
      setStatus('failed');
    }
  };

  const dotCount = (pollCount % 3) + 1;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8 text-center">

        {/* Checking */}
        {status === 'checking' && (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
              </div>
            </div>
            <h1 className="text-xl font-black text-gray-900 mb-2">Verifying Payment</h1>
            <p className="text-gray-500 text-sm mb-1">ክፍያ እየተረጋገጠ ነው{'.'.repeat(dotCount)}</p>
            <p className="text-gray-400 text-xs">Please wait, do not close this page.</p>
            {order && (
              <div className="mt-6 bg-gray-50 rounded-xl p-4 text-left text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Order</span>
                  <span className="font-mono font-semibold">#{order.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-semibold">ETB {order.totalAmount?.toFixed(2)}</span>
                </div>
                {payRef && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reference</span>
                    <span className="font-mono text-xs">{payRef}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Paid */}
        {status === 'paid' && (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-4xl">
                🎉
              </div>
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Payment Confirmed!</h1>
            <p className="text-green-600 font-semibold mb-1">ክፍያ ተረጋግጧል</p>
            {order && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Order</span>
                  <span className="font-mono font-semibold">#{order.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount paid</span>
                  <span className="font-bold text-green-700">ETB {order.totalAmount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment method</span>
                  <span className="font-semibold">{order.paymentMethod?.replace('_', ' ')}</span>
                </div>
                {order.paymentRef && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reference</span>
                    <span className="font-mono text-xs text-gray-600">{order.paymentRef}</span>
                  </div>
                )}
              </div>
            )}
            <div className="mt-6 flex flex-col gap-3">
              <Link
                to={`/store/orders/${orderId || order?.id}/track`}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors"
              >
                📍 Track Delivery
              </Link>
              <Link
                to="/store/orders"
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
              >
                View All Orders
              </Link>
            </div>
          </>
        )}

        {/* Failed */}
        {status === 'failed' && (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center text-4xl">
                ❌
              </div>
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Payment Failed</h1>
            <p className="text-red-600 font-semibold mb-1">ክፍያ አልተሳካም</p>
            <p className="text-gray-500 text-sm mt-2">
              The payment could not be completed. Your order has been saved — you can retry payment from your orders list.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {orderId && (
                <Link
                  to={`/store/orders/${orderId}/track`}
                  className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors"
                >
                  Back to Order
                </Link>
              )}
              <Link
                to="/store/orders/new"
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
              >
                Create New Order
              </Link>
              <Link
                to="/store"
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Return to Dashboard
              </Link>
            </div>
          </>
        )}

        {/* Timed out — still pending */}
        {status === 'pending' && (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center text-4xl">
                ⏳
              </div>
            </div>
            <h1 className="text-xl font-black text-gray-900 mb-2">Payment Pending</h1>
            <p className="text-yellow-600 font-semibold mb-1">ክፍያ በመጠባበቅ ላይ</p>
            <p className="text-gray-500 text-sm mt-2">
              We haven't received confirmation yet. This can take a few minutes.
              Your order is saved — check back shortly.
            </p>
            {payRef && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-gray-600">
                Reference: <span className="font-mono font-semibold">{payRef}</span>
              </div>
            )}
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => { setStatus('checking'); setPollCount(0); checkStatus(); }}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors"
              >
                ↻ Check Again
              </button>
              <Link
                to="/store/orders"
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
              >
                View My Orders
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
