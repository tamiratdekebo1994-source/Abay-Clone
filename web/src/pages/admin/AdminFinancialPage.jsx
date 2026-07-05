import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminFinancialPage() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(30);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [period]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const { data } = await adminAPI.getFinancialReport(period);
      setData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const metrics = data?.metrics || {};

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Financial Reports</h1>
          <p className="text-gray-500 text-sm mt-1">{data?.period}</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[7, 14, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                period === days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500 uppercase">Total Revenue</p>
          <p className="text-3xl font-black text-primary-700 mt-2">
            ETB {metrics.totalRevenue?.toLocaleString('en-ET', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500 uppercase">Platform Fees</p>
          <p className="text-3xl font-black text-green-600 mt-2">
            ETB {metrics.platformFees?.toLocaleString('en-ET', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">Profit: ETB {metrics.profit?.toLocaleString()}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500 uppercase">Driver Payouts</p>
          <p className="text-3xl font-black text-blue-600 mt-2">
            ETB {metrics.driverPayouts?.toLocaleString('en-ET', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500 uppercase">Conversion Rate</p>
          <p className="text-3xl font-black text-orange-600 mt-2">{metrics.conversionRate}%</p>
          <p className="text-xs text-gray-400 mt-1">{metrics.deliveredOrders} / {metrics.totalOrders} orders</p>
        </div>
      </div>

      {/* Summary Table */}
      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Summary</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-gray-200 pb-3">
            <span className="text-gray-600">Total Orders</span>
            <span className="font-bold">{metrics.totalOrders?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-b border-gray-200 pb-3">
            <span className="text-gray-600">Delivered Orders</span>
            <span className="font-bold">{metrics.deliveredOrders?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-b border-gray-200 pb-3">
            <span className="text-gray-600">Total Customer Revenue</span>
            <span className="font-bold">ETB {metrics.totalRevenue?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-b border-gray-200 pb-3">
            <span className="text-gray-600">Platform Commission (15%)</span>
            <span className="font-bold text-green-600">ETB {metrics.platformFees?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Driver Earnings (85%)</span>
            <span className="font-bold text-blue-600">ETB {metrics.driverPayouts?.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
