'use client';

import { useEffect, useState } from 'react';

import {
  isVehicleList,
  requestApi,
  type CreateVehicleInput,
  type Vehicle,
  type VehicleStatus,
} from './api-contracts';
import { CreateVehicleDialog } from './CreateVehicleDialog';

const weightFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 1,
});

const statusLabels: Record<VehicleStatus, string> = {
  IDLE: 'Sẵn sàng',
  ON_ROUTE: 'Đang giao hàng',
};

export function FleetManager() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadVehicles() {
      try {
        const payload = await requestApi('/api/v1/vehicles');
        if (!isVehicleList(payload)) {
          throw new Error('API trả về danh sách đội xe không hợp lệ.');
        }
        if (active) {
          setVehicles(payload);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Không thể tải đội xe.',
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadVehicles();
    return () => {
      active = false;
    };
  }, []);

  async function createVehicle(input: CreateVehicleInput) {
    const payload = await requestApi('/api/v1/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const createdVehicles = [payload];
    if (!isVehicleList(createdVehicles)) {
      throw new Error('API trả về phương tiện không hợp lệ.');
    }

    setVehicles((current) => [createdVehicles[0], ...current]);
  }

  const availableCount = vehicles.filter((vehicle) => vehicle.status === 'IDLE').length;
  const totalCapacity = vehicles.reduce(
    (total, vehicle) => total + vehicle.capacity_kg,
    0,
  );

  return (
    <section className="management-workspace" aria-labelledby="fleet-heading">
      <header className="management-toolbar">
        <div>
          <h2 id="fleet-heading">Danh sách phương tiện</h2>
          <p>
            {vehicles.length} xe · {availableCount} sẵn sàng ·{' '}
            {weightFormatter.format(totalCapacity)} kg tổng tải trọng
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => setIsCreateOpen(true)}
        >
          <span aria-hidden="true">＋</span>
          Thêm xe mới
        </button>
      </header>

      {error && <p className="management-alert" role="alert">{error}</p>}

      <div className="table-panel">
        <div className="table-scroll">
          <table className="management-table">
            <caption className="sr-only">Danh sách đội xe LogiRoute</caption>
            <thead>
              <tr>
                <th scope="col">Biển số</th>
                <th scope="col">Tải trọng tối đa</th>
                <th scope="col">Tài xế</th>
                <th scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 3 }, (_, index) => (
                  <tr className="skeleton-row" key={index} aria-hidden="true">
                    <td colSpan={4}><span /></td>
                  </tr>
                ))}
              {!isLoading && vehicles.length === 0 && (
                <tr>
                  <td className="table-empty" colSpan={4}>
                    <strong>Chưa có phương tiện</strong>
                    <span>Thêm xe đầu tiên để bắt đầu điều phối.</span>
                  </td>
                </tr>
              )}
              {!isLoading && vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td><strong>{vehicle.license_plate}</strong></td>
                  <td>{weightFormatter.format(vehicle.capacity_kg)} kg</td>
                  <td>
                    {vehicle.driver_name ? (
                      <span className="driver-cell">
                        <i aria-hidden="true">
                          {vehicle.driver_name.charAt(0).toUpperCase()}
                        </i>
                        {vehicle.driver_name}
                      </span>
                    ) : (
                      <span className="muted">Chưa phân công</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge status-${vehicle.status.toLowerCase()}`}>
                      {statusLabels[vehicle.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateOpen && (
        <CreateVehicleDialog
          open
          onClose={() => setIsCreateOpen(false)}
          onCreate={createVehicle}
        />
      )}
    </section>
  );
}
